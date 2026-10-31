import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import { connectDb, seed, teardown, type World } from './harness';
import { probeLeakyInsert, probeReadVersions, probeScoreWrite } from './probes';

let w: World;
let c: Client;
let subId = '';

beforeAll(async () => {
  w = await seed();
  c = await connectDb();
  const r = await c.query(
    `insert into public.submissions (exam_id, student_id, deadline_at, question_order, option_permutations)
     values ($1, $2, now() + interval '30 minutes', $3::jsonb, '{}'::jsonb) returning id`,
    [w.examX, w.s1.id, JSON.stringify([w.qvScX, w.qvTfX])],
  );
  subId = r.rows[0].id;
});
afterAll(async () => {
  await c?.end();
  await teardown(w);
});

describe('Test đột biến: đầu dò phải phát hiện được lỗi cố ý, rồi hoàn tác sạch', () => {
  it('M1: thêm policy SELECT tràn lan trên question_versions -> phát hiện rò rỉ', async () => {
    expect(await probeReadVersions(w.s1, w.allVersionIds)).toBe(0); // trạng thái đúng
    const had = (await c.query(`select has_table_privilege('authenticated','public.question_versions','select') b`)).rows[0].b;
    await c.query(`create policy tmp_leak on public.question_versions for select to authenticated using (true)`);
    if (!had) await c.query(`grant select on public.question_versions to authenticated`);
    try {
      expect(await probeReadVersions(w.s1, w.allVersionIds)).toBeGreaterThan(0); // đầu dò thấy lỗi
    } finally {
      await c.query(`drop policy if exists tmp_leak on public.question_versions`);
      if (!had) await c.query(`revoke select on public.question_versions from authenticated`);
    }
    expect(await probeReadVersions(w.s1, w.allVersionIds)).toBe(0); // đã hoàn tác
  });

  it('M2: gỡ CHECK no_leak_content -> chèn \\True được; thêm lại -> bị chặn', async () => {
    const defs = await c.query(
      `select conname, pg_get_constraintdef(oid) def from pg_constraint
       where conrelid = 'public.question_versions'::regclass and conname = 'no_leak_content'`);
    expect(defs.rows).toHaveLength(1);
    const def = defs.rows[0].def as string;

    expect(await probeLeakyInsert(c, w.draftQuestionId)).toBe(false);
    await c.query(`alter table public.question_versions drop constraint no_leak_content`);
    try {
      expect(await probeLeakyInsert(c, w.draftQuestionId)).toBe(true); // đầu dò thấy lỗi
    } finally {
      await c.query(`alter table public.question_versions add constraint no_leak_content ${def}`);
    }
    expect(await probeLeakyInsert(c, w.draftQuestionId)).toBe(false);
  });

  it('M3: cấp UPDATE trên submissions cho học sinh -> sửa được điểm; hoàn tác -> bị chặn', async () => {
    const had = (await c.query(`select has_table_privilege('authenticated','public.submissions','update') b`)).rows[0].b;
    expect(had, 'authenticated không được có UPDATE trên submissions trước khi thử').toBe(false);
    expect(await probeScoreWrite(w.s1, c, subId)).toBe(false);

    await c.query(`create policy tmp_upd on public.submissions for update to authenticated
                   using (student_id = auth.uid()) with check (student_id = auth.uid())`);
    await c.query(`grant update on public.submissions to authenticated`);
    try {
      expect(await probeScoreWrite(w.s1, c, subId)).toBe(true); // đầu dò thấy lỗi
    } finally {
      await c.query(`drop policy if exists tmp_upd on public.submissions`);
      await c.query(`revoke update on public.submissions from authenticated`);
    }
    expect(await probeScoreWrite(w.s1, c, subId)).toBe(false);
  });
});
