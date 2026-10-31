import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Client } from 'pg';
import { expect } from 'vitest';
import { env } from './env';

// ===== CHỖ DUY NHẤT ĐƯỢC SỬA KHI KHÁC VỚI HỆ THỐNG THẬT =====
export const ROUTES = {
  start: (examId: string) => `/api/exams/${examId}/start`,
  answers: (subId: string) => `/api/submissions/${subId}/answers`,
  submit: (subId: string) => `/api/submissions/${subId}/submit`,
  review: (subId: string) => `/api/submissions/${subId}/review`,
};
export const BUCKET = 'solution-assets'; // bucket riêng tư chứa ảnh lời giải
// ADAPT: nếu API dùng cookie (@supabase/ssr) thay vì Bearer, sửa authHeaders()
const authHeaders = (token: string) => ({ authorization: `Bearer ${token}` });
// ADAPT: tên bảng lớp và thành viên lớp (khớp schema: teacher_id, code, grade, user_id, role, status)
const SQL_CLASS = `insert into public.classes (name, code, grade, teacher_id) values ('SEC-TEST', 'SEC-' || substr(md5(random()::text), 1, 8), 12, $1) returning id`;
const SQL_MEMBERS = `insert into public.class_members (class_id, user_id, role, status) values ($1, $2, 'student', 'active'), ($1, $3, 'student', 'active')`;
// ================================================================

const NOAUTH = { auth: { persistSession: false, autoRefreshToken: false } } as const;
export const admin = createClient(env.url, env.service, NOAUTH);

export async function connectDb(): Promise<Client> {
  const c = new Client({ connectionString: env.db });
  await c.connect();
  return c;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------- Gọi API ứng dụng ----------
export async function callApi(token: string, method: string, path: string, body?: unknown) {
  const res = await fetch(env.app + path, {
    method,
    headers: { 'content-type': 'application/json', ...authHeaders(token) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* không phải JSON */ }
  return { status: res.status, text, json };
}

// ---------- Kiểm tra rò rỉ ----------
export function assertNoLeak(text: string) {
  expect(text, 'lộ sentinel của đáp án/lời giải/raw_tex').not.toMatch(/SENTINEL_/);
  expect(text, 'lộ \\True hoặc \\loigiai').not.toMatch(/\\+(True|loigiai)/);
  expect(text, 'lộ khóa JSON của đáp án').not.toMatch(
    /"(correct|correct_answer|explanation|raw_tex|numeric_target)"\s*:/,
  );
}
// Bị từ chối: 401/403/404 và không lộ gì
export function expectDenied(r: { status: number; text: string }) {
  expect([401, 403, 404], `status ${r.status}: ${r.text.slice(0, 200)}`).toContain(r.status);
  expect(r.text).not.toMatch(/SENTINEL_/);
}
// Bị từ chối do vi phạm quy tắc (quá hạn, sai trạng thái...)
export function expectRejected(r: { status: number; text: string }) {
  expect(r.status, `status ${r.status}: ${r.text.slice(0, 200)}`).toBeGreaterThanOrEqual(400);
  expect(r.status).toBeLessThan(500);
  expect(r.text).not.toMatch(/SENTINEL_/);
}

// ---------- Người dùng thật ----------
export type Actor = { id: string; email: string; client: SupabaseClient; token: string };

async function makeUser(tag: string): Promise<Actor> {
  const email = `${tag}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@sec.test`;
  const password = 'Test-1234567!';
  const role = tag.startsWith('teacher') ? 'teacher' : 'student';
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role, full_name: tag },
  });
  if (created.error) throw created.error;
  const client = createClient(env.url, env.anon, NOAUTH);
  const signed = await client.auth.signInWithPassword({ email, password });
  if (signed.error || !signed.data.session) throw signed.error ?? new Error('không đăng nhập được');
  return { id: created.data.user!.id, email, client, token: signed.data.session.access_token };
}

// ---------- Dữ liệu mẫu ----------
export type World = {
  teacherA: Actor; teacherB: Actor; s1: Actor; s2: Actor; s3: Actor;
  classId: string;
  examX: string; examY: string; examFuture: string; examClosed: string;
  qvScX: string; qvTfX: string; qvY: string;
  draftVersionId: string; draftQuestionId: string;
  allVersionIds: string[]; questionIds: string[]; examIds: string[];
  bucketPath: string;
};

async function mkVersion(
  c: Client, owner: string,
  a: { type: string; content: string; options?: unknown; key: unknown;
       explanation: string; rawTex: string; status: 'draft' | 'published' },
) {
  const q = await c.query(`insert into public.questions (owner_id) values ($1) returning id`, [owner]);
  const v = await c.query(
    `insert into public.question_versions
       (question_id, version, type, grade, topic, difficulty, content, options, content_hash, status)
     values ($1,1,$2,12,'sec-test','nhan_biet',$3,$4::jsonb,$5,$6) returning id`,
    [q.rows[0].id, a.type, a.content, a.options ? JSON.stringify(a.options) : null,
     'h' + Math.random().toString(36).slice(2), a.status],
  );
  // Cột key theo cấu trúc Zod trong private.question_keys
  await c.query(
    `insert into private.question_keys (question_version_id, type, key, explanation, raw_tex)
     values ($1,$2,$3::jsonb,$4,$5)`,
    [v.rows[0].id, a.type, JSON.stringify(a.key), a.explanation, a.rawTex],
  );
  return { questionId: q.rows[0].id as string, versionId: v.rows[0].id as string };
}

async function mkExam(
  c: Client,
  o: { owner: string; classId: string; title: string; opens: string; closes: string;
       status: string; published?: string | null },
) {
  const r = await c.query(
    `insert into public.exams
       (owner_id, class_id, title, duration_minutes, opens_at, closes_at, status, solutions_published_at)
     values ($1,$2,$3,45, now() + $4::interval, now() + $5::interval, $6, $7::timestamptz)
     returning id`,
    [o.owner, o.classId, o.title, o.opens, o.closes, o.status, o.published ?? null],
  );
  return r.rows[0].id as string;
}

async function addToExam(c: Client, examId: string, pos: number, versionId: string, points: number) {
  await c.query(
    `insert into public.exam_questions (exam_id, position, question_version_id, points) values ($1,$2,$3,$4)`,
    [examId, pos, versionId, points],
  );
}

const OPTS = ['A', 'B', 'C', 'D'].map((id) => ({ id, text: `$OPT_${id}$` }));
const OPTS_TF = ['a', 'b', 'c', 'd'].map((id) => ({ id, text: `$MENH_DE_${id}$` }));

export async function seed(): Promise<World> {
  const [teacherA, teacherB, s1, s2, s3] = await Promise.all(
    ['teacherA', 'teacherB', 's1', 's2', 's3'].map(makeUser),
  );
  const c = await connectDb();
  try {
    const classId = (await c.query(SQL_CLASS, [teacherA.id])).rows[0].id as string;
    await c.query(SQL_MEMBERS, [classId, s1.id, s2.id]); // s3 KHÔNG thuộc lớp

    const scX = await mkVersion(c, teacherA.id, {
      type: 'single_choice', content: 'Tính $1+1$.', options: OPTS,
      key: { correct: 'B' },
      explanation: 'SENTINEL_EXPLANATION_X lời giải của đề X',
      rawTex: '\\begin{ex} SENTINEL_RAWTEX_X \\choice {$1$} {\\True $2$} {$3$} {$4$} \\loigiai{...} \\end{ex}',
      status: 'published',
    });
    const tfX = await mkVersion(c, teacherA.id, {
      type: 'true_false', content: 'Xét các mệnh đề sau.', options: OPTS_TF,
      key: { correct: { a: true, b: false, c: true, d: false } },
      explanation: 'SENTINEL_EXPLANATION_X2', rawTex: 'SENTINEL_RAWTEX_X2 \\True', status: 'published',
    });
    const scY = await mkVersion(c, teacherA.id, {
      type: 'single_choice', content: 'Tính $2+2$.', options: OPTS,
      key: { correct: 'C' },
      explanation: 'SENTINEL_EXPLANATION_Y lời giải của đề Y',
      rawTex: 'SENTINEL_RAWTEX_Y \\True', status: 'published',
    });
    const draft = await mkVersion(c, teacherA.id, {
      type: 'single_choice', content: 'Câu nháp.', options: OPTS,
      key: { correct: 'A' }, explanation: 'SENTINEL_EXPLANATION_D', rawTex: 'SENTINEL_RAWTEX_D', status: 'draft',
    });

    const examX = await mkExam(c, { owner: teacherA.id, classId, title: 'SEC X',
      opens: '-1 hour', closes: '2 hours', status: 'open' });
    const examY = await mkExam(c, { owner: teacherA.id, classId, title: 'SEC Y',
      opens: '-1 hour', closes: '2 hours', status: 'open' });
    const examFuture = await mkExam(c, { owner: teacherA.id, classId, title: 'SEC FUTURE',
      opens: '1 hour', closes: '3 hours', status: 'open' });
    const examClosed = await mkExam(c, { owner: teacherA.id, classId, title: 'SEC CLOSED',
      opens: '-3 hours', closes: '-1 hour', status: 'closed' });

    await addToExam(c, examX, 1, scX.versionId, 0.25);
    await addToExam(c, examX, 2, tfX.versionId, 1.0);
    await addToExam(c, examY, 1, scY.versionId, 0.25);
    await addToExam(c, examFuture, 1, scX.versionId, 0.25);
    await addToExam(c, examClosed, 1, scX.versionId, 0.25);

    // Bucket riêng tư cho ảnh lời giải
    await admin.storage.createBucket(BUCKET, { public: false }).catch(() => undefined);
    const bucketPath = `sec-test/${examX}/loigiai.png`;
    const up = await admin.storage.from(BUCKET).upload(bucketPath, new Blob(['png']), {
      upsert: true, contentType: 'image/png',
    });
    if (up.error) throw up.error;

    return {
      teacherA, teacherB, s1, s2, s3, classId,
      examX, examY, examFuture, examClosed,
      qvScX: scX.versionId, qvTfX: tfX.versionId, qvY: scY.versionId,
      draftVersionId: draft.versionId, draftQuestionId: draft.questionId,
      allVersionIds: [scX.versionId, tfX.versionId, scY.versionId, draft.versionId],
      questionIds: [scX.questionId, tfX.questionId, scY.questionId, draft.questionId],
      examIds: [examX, examY, examFuture, examClosed],
      bucketPath,
    };
  } finally {
    await c.end();
  }
}

export async function teardown(w: World | undefined) {
  if (!w) return;
  const c = await connectDb();
  const run = async (sql: string, args: unknown[] = []) => {
    try { await c.query(sql, args); } catch (e) { console.warn('teardown:', (e as Error).message); }
  };
  try {
    await run(`delete from public.submissions where exam_id = any($1::uuid[])`, [w.examIds]);
    await run(`delete from public.exam_questions where exam_id = any($1::uuid[])`, [w.examIds]);
    await run(`delete from public.exams where id = any($1::uuid[])`, [w.examIds]);
    await run(`delete from private.question_keys where question_version_id = any($1::uuid[])`, [w.allVersionIds]);
    await run(`delete from public.question_versions where question_id = any($1::uuid[])`, [w.questionIds]);
    await run(`delete from public.questions where id = any($1::uuid[])`, [w.questionIds]);
    await run(`delete from public.class_members where class_id = $1`, [w.classId]);
    await run(`delete from public.classes where id = $1`, [w.classId]);
    await admin.storage.from(BUCKET).remove([w.bucketPath]);
  } finally {
    await c.end();
  }
  for (const u of [w.teacherA, w.teacherB, w.s1, w.s2, w.s3]) {
    await admin.auth.admin.deleteUser(u.id).catch(() => undefined);
  }
}
