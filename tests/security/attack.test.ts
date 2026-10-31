import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import {
  admin, assertNoLeak, BUCKET, callApi, connectDb, expectDenied, expectRejected,
  ROUTES, seed, sleep, teardown, type World,
} from './harness';
import { env } from './env';
import { probeReadVersions, probeScoreWrite } from './probes';

// Danh sách hàm SECURITY DEFINER được phép gọi bởi anon/authenticated.
// Mặc định RỖNG. Thêm hàm nào phải kèm lý do bằng văn bản trong báo cáo.
const ALLOWED_SECDEF: string[] = [];

let w: World;
let c: Client;
let subX = ''; // id bài nộp của s1 ở đề X
let qvOrder: string[] = [];

async function getSub(examId: string, studentId: string) {
  const r = await c.query(
    `select id, option_permutations, question_order from public.submissions
     where exam_id=$1 and student_id=$2`, [examId, studentId]);
  return r.rows[0];
}

beforeAll(async () => {
  w = await seed();
  c = await connectDb();
});
afterAll(async () => {
  await c?.end();
  await teardown(w);
});

describe('Kiểm soát: dữ liệu mẫu thật sự tồn tại (tránh pass vì bảng rỗng)', () => {
  it('service role / database thấy đủ dữ liệu', async () => {
    const q = await c.query(`select count(*)::int n from public.question_versions where id = any($1::uuid[])`, [w.allVersionIds]);
    expect(q.rows[0].n).toBe(4);
    const k = await c.query(`select count(*)::int n from private.question_keys where question_version_id = any($1::uuid[])`, [w.allVersionIds]);
    expect(k.rows[0].n).toBe(4);
    const e = await c.query(`select count(*)::int n from public.exam_questions where exam_id = any($1::uuid[])`, [w.examIds]);
    expect(e.rows[0].n).toBe(5);
  });
});

describe('8.1 Tấn công bằng tài khoản học sinh (T1–T20)', () => {
  it('T1: học sinh không đọc được schema private qua REST, và không có quyền ở mức database', async () => {
    const viaClient = await w.s1.client.schema('private' as any).from('question_keys').select('*');
    expect(viaClient.error).not.toBeNull();
    expect(viaClient.data ?? []).toHaveLength(0);

    const raw = await fetch(`${env.url}/rest/v1/question_keys?select=*`, {
      headers: { apikey: env.anon, authorization: `Bearer ${w.s1.token}`, 'Accept-Profile': 'private' },
    });
    expect(raw.status).toBeGreaterThanOrEqual(400);
    expect(await raw.text()).not.toMatch(/SENTINEL_/);

    for (const role of ['anon', 'authenticated']) {
      const p = await c.query(
        `select has_schema_privilege($1,'private','usage') as u,
                has_table_privilege($1,'private.question_keys','select') as s`, [role]);
      expect(p.rows[0].u, `${role} có USAGE trên schema private`).toBe(false);
      expect(p.rows[0].s, `${role} có SELECT trên private.question_keys`).toBe(false);
    }
  });

  it('T2: học sinh đọc question_versions qua REST được 0 dòng', async () => {
    expect(await probeReadVersions(w.s1, w.allVersionIds)).toBe(0);
    expect(await probeReadVersions(w.s3, w.allVersionIds)).toBe(0); // học sinh ngoài lớp
  });

  it('T3: học sinh đọc exam_questions được 0 dòng', async () => {
    const { data } = await w.s1.client.from('exam_questions').select('*').eq('exam_id', w.examX);
    expect(data ?? []).toHaveLength(0);
  });

  it('T4: không có hàm SECURITY DEFINER nào bị lộ cho anon/authenticated ngoài danh sách cho phép', async () => {
    const r = await c.query(`
      select p.proname
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prosecdef
        and (has_function_privilege('authenticated', p.oid, 'execute')
          or has_function_privilege('anon', p.oid, 'execute'))`);
    const names = r.rows.map((x) => x.proname as string).filter((n) => !ALLOWED_SECDEF.includes(n));
    expect(names, `Hàm SECURITY DEFINER chưa được duyệt: ${names.join(', ')}`).toEqual([]);
  });

  it('T6: học sinh ngoài lớp gọi /start bị từ chối', async () => {
    expectDenied(await callApi(w.s3.token, 'POST', ROUTES.start(w.examX)));
  });

  it('T7: /start trước opens_at và sau closes_at bị từ chối', async () => {
    expectRejected(await callApi(w.s1.token, 'POST', ROUTES.start(w.examFuture)));
    expectRejected(await callApi(w.s1.token, 'POST', ROUTES.start(w.examClosed)));
    const n = await c.query(`select count(*)::int n from public.submissions where student_id=$1 and exam_id = any($2::uuid[])`,
      [w.s1.id, [w.examFuture, w.examClosed]]);
    expect(n.rows[0].n).toBe(0); // không được tạo bài nộp
  });

  it('T8: /start hợp lệ trả đề, KHÔNG chứa đáp án; idempotent; chấm đúng sau khi trộn', async () => {
    const r = await callApi(w.s1.token, 'POST', ROUTES.start(w.examX));
    expect(r.status, r.text.slice(0, 300)).toBe(200);
    assertNoLeak(r.text);

    const again = await callApi(w.s1.token, 'POST', ROUTES.start(w.examX));
    expect(again.status).toBe(200);
    const cnt = await c.query(`select count(*)::int n from public.submissions where exam_id=$1 and student_id=$2`, [w.examX, w.s1.id]);
    expect(cnt.rows[0].n).toBe(1);

    const sub = await getSub(w.examX, w.s1.id);
    subX = sub.id;
    qvOrder = sub.question_order;
    expect([...qvOrder].sort()).toEqual([w.qvScX, w.qvTfX].sort());

    // Chọn đúng phương án HIỂN THỊ ứng với đáp án gốc B
    const perm: string[] = sub.option_permutations?.[w.qvScX] ?? ['A', 'B', 'C', 'D'];
    const displayed = 'ABCD'[perm.indexOf('B')];
    const save = await callApi(w.s1.token, 'PUT', ROUTES.answers(subX), { answers: { [w.qvScX]: displayed } });
    expect(save.status, save.text.slice(0, 300)).toBeLessThan(300);
    assertNoLeak(save.text);
  });

  it('T5: học sinh khác không đọc được bài nộp của s1 qua REST', async () => {
    const { data } = await w.s2.client.from('submissions').select('id').eq('id', subX);
    expect(data ?? []).toHaveLength(0);
    const own = await w.s1.client.from('submissions').select('id').eq('id', subX);
    expect(own.data ?? []).toHaveLength(1); // đối chứng: chủ bài nộp thì thấy
  });

  it('T10: học sinh không ghi trực tiếp được vào submissions', async () => {
    expect(await probeScoreWrite(w.s1, c, subX)).toBe(false);
    const ins = await w.s1.client.from('submissions').insert({ exam_id: w.examY, student_id: w.s1.id });
    expect(ins.error).not.toBeNull();
    const del = await w.s1.client.from('submissions').delete().eq('id', subX);
    const still = await c.query(`select count(*)::int n from public.submissions where id=$1`, [subX]);
    expect(still.rows[0].n, `delete trả: ${JSON.stringify(del.error)}`).toBe(1);
  });

  it('T9: tự lưu sau deadline_at + 5 giây bị từ chối', async () => {
    await c.query(`update public.submissions set deadline_at = now() - interval '10 seconds' where id=$1`, [subX]);
    const r = await callApi(w.s1.token, 'PUT', ROUTES.answers(subX), { answers: { [w.qvScX]: 'A' } });
    expectRejected(r);
    await c.query(`update public.submissions set deadline_at = now() + interval '30 minutes' where id=$1`, [subX]);
  });

  it('T11: /submit idempotent, điểm đúng = 0.25 và không lộ đáp án', async () => {
    const r1 = await callApi(w.s1.token, 'POST', ROUTES.submit(subX), {});
    expect(r1.status, r1.text.slice(0, 300)).toBeLessThan(300);
    assertNoLeak(r1.text);
    const s1row = (await c.query(`select score, status from public.submissions where id=$1`, [subX])).rows[0];
    expect(Number(s1row.score)).toBeCloseTo(0.25, 5);

    const r2 = await callApi(w.s1.token, 'POST', ROUTES.submit(subX), {});
    expect(r2.status).toBeLessThan(500);
    assertNoLeak(r2.text);
    const s2row = (await c.query(`select score, status from public.submissions where id=$1`, [subX])).rows[0];
    expect(String(s2row.score)).toBe(String(s1row.score));
  });

  it('T12: đã nộp nhưng đề chưa đóng và chưa công bố thì /review bị từ chối', async () => {
    expectDenied(await callApi(w.s1.token, 'GET', ROUTES.review(subX)));
  });

  it('T13: sau khi giáo viên công bố, /review trả lời giải đúng đề, không lẫn đề khác', async () => {
    await c.query(`update public.exams set solutions_published_at = now() - interval '1 second' where id=$1`, [w.examX]);
    const r = await callApi(w.s1.token, 'GET', ROUTES.review(subX));
    expect(r.status, r.text.slice(0, 300)).toBe(200);
    expect(r.text).toContain('SENTINEL_EXPLANATION_X');
    expect(r.text).not.toContain('SENTINEL_EXPLANATION_Y');
    expect(r.text).not.toContain('SENTINEL_EXPLANATION_D');
    expect(r.text, 'không được trả raw_tex cho học sinh').not.toContain('SENTINEL_RAWTEX');
  });

  it('T14: đã xem được lời giải đề X nhưng KHÔNG mở khóa được đề Y (chưa đóng, chưa công bố)', async () => {
    const start = await callApi(w.s1.token, 'POST', ROUTES.start(w.examY));
    expect(start.status).toBe(200);
    const subY = (await getSub(w.examY, w.s1.id)).id as string;
    const submit = await callApi(w.s1.token, 'POST', ROUTES.submit(subY), {});
    expect(submit.status).toBeLessThan(300);
    const r = await callApi(w.s1.token, 'GET', ROUTES.review(subY));
    expectDenied(r);
    expect(r.text).not.toContain('SENTINEL_EXPLANATION_Y');
  });

  it('T15: học sinh khác không thao tác được trên bài nộp của s1 (IDOR)', async () => {
    expectDenied(await callApi(w.s2.token, 'GET', ROUTES.review(subX)));
    expectDenied(await callApi(w.s2.token, 'PUT', ROUTES.answers(subX), { answers: { [w.qvScX]: 'A' } }));
    expectDenied(await callApi(w.s2.token, 'POST', ROUTES.submit(subX), {}));
  });

  it('T16: giáo viên B không đọc/ghi được dữ liệu của giáo viên A', async () => {
    const own = await w.teacherA.client.from('questions').select('id').in('id', w.questionIds);
    expect((own.data ?? []).length).toBe(4); // đối chứng: giáo viên A thấy

    const other = await w.teacherB.client.from('questions').select('id').in('id', w.questionIds);
    expect(other.data ?? []).toHaveLength(0);
    expect(await probeReadVersions(w.teacherB, w.allVersionIds)).toBe(0);

    const ins = await w.teacherB.client.from('question_versions').insert({
      question_id: w.draftQuestionId, version: 77, type: 'essay', content: 'x', content_hash: 'x', status: 'draft',
    });
    expect(ins.error).not.toBeNull();
  });

  it('T17: Realtime không phát sự kiện của question_versions; bảng không nằm trong publication', async () => {
    const pub = await c.query(`select tablename from pg_publication_tables where pubname='supabase_realtime'`);
    const tables = pub.rows.map((r) => r.tablename as string);
    for (const t of ['question_versions', 'questions', 'exam_questions', 'question_keys']) {
      expect(tables, `${t} đang nằm trong publication supabase_realtime`).not.toContain(t);
    }

    const events: unknown[] = [];
    const ch = w.s1.client.channel('probe-qv')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'question_versions' }, (p) => events.push(p))
      .subscribe();
    await sleep(2000);
    await c.query(`update public.question_versions set warnings = '["probe"]'::jsonb where id=$1`, [w.draftVersionId]);
    await sleep(2500);
    await w.s1.client.removeChannel(ch);
    expect(events).toHaveLength(0);
  });

  it('T18: CHECK no_leak_content / no_leak_options từ chối \\True và \\loigiai', async () => {
    const bad1 = await c.query(
      `insert into public.question_versions (question_id, version, type, content, options, content_hash, status)
       values ($1, 501, 'single_choice', $2, '[]'::jsonb, 'p1', 'draft')`,
      [w.draftQuestionId, 'abc \\True']).then(() => null, (e) => e);
    expect(bad1?.code).toBe('23514');

    const bad2 = await c.query(
      `insert into public.question_versions (question_id, version, type, content, options, content_hash, status)
       values ($1, 502, 'single_choice', 'ok', $2::jsonb, 'p2', 'draft')`,
      [w.draftQuestionId, JSON.stringify([{ id: 'A', text: '\\True 2' }])]).then(() => null, (e) => e);
    expect(bad2?.code).toBe('23514');

    const bad3 = await c.query(
      `insert into public.question_versions (question_id, version, type, content, options, content_hash, status)
       values ($1, 503, 'single_choice', $2, '[]'::jsonb, 'p3', 'draft')`,
      [w.draftQuestionId, 'x \\loigiai{...}']).then(() => null, (e) => e);
    expect(bad3?.code).toBe('23514');
  });

  it('T19: không sửa được câu hỏi đã xuất bản (trigger bất biến)', async () => {
    const err = await c.query(`update public.question_versions set content = 'doi noi dung' where id=$1`, [w.qvScX])
      .then(() => null, (e) => e);
    expect(err, 'UPDATE câu đã published phải bị từ chối').not.toBeNull();
    const row = await c.query(`select content from public.question_versions where id=$1`, [w.qvScX]);
    expect(row.rows[0].content).toBe('Tính $1+1$.');
  });

  it('T20: ảnh lời giải nằm ở bucket riêng tư; học sinh không tải được', async () => {
    const ctl = await admin.storage.from(BUCKET).download(w.bucketPath);
    expect(ctl.error, 'đối chứng: service role phải tải được').toBeNull();

    const dl = await w.s1.client.storage.from(BUCKET).download(w.bucketPath);
    expect(dl.error).not.toBeNull();

    const pub = await fetch(`${env.url}/storage/v1/object/public/${BUCKET}/${w.bucketPath}`);
    expect(pub.status).not.toBe(200);
  });
});
