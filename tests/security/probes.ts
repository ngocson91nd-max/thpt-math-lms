import type { Client } from 'pg';
import type { Actor } from './harness';

// Học sinh đọc được bao nhiêu phiên bản câu hỏi qua REST?
export async function probeReadVersions(a: Actor, ids: string[]): Promise<number> {
  const { data } = await a.client.from('question_versions').select('id').in('id', ids);
  return data?.length ?? 0;
}

// Có chèn được nội dung chứa \True vào cột công khai không? (true = LỖ HỔNG)
export async function probeLeakyInsert(c: Client, questionId: string): Promise<boolean> {
  try {
    const r = await c.query(
      `insert into public.question_versions
         (question_id, version, type, content, options, content_hash, status)
       values ($1, 9999, 'single_choice', $2, '[]'::jsonb, 'probe', 'draft') returning id`,
      [questionId, 'Noi dung \\True ro ri'],
    );
    await c.query(`delete from public.question_versions where id = $1`, [r.rows[0].id]);
    return true;
  } catch (e: any) {
    if (e.code === '23514') return false; // vi phạm CHECK: đúng như mong muốn
    throw e; // lỗi khác (sai cột, thiếu bảng...) thì không được coi là "an toàn"
  }
}

// Học sinh có sửa được điểm trực tiếp qua REST không? (true = LỖ HỔNG)
export async function probeScoreWrite(a: Actor, c: Client, subId: string): Promise<boolean> {
  const before = (await c.query(`select score, status from public.submissions where id=$1`, [subId])).rows[0];
  await a.client.from('submissions').update({ score: 10, status: 'graded' }).eq('id', subId);
  const after = (await c.query(`select score, status from public.submissions where id=$1`, [subId])).rows[0];
  const changed = String(after.score) !== String(before.score) || after.status !== before.status;
  if (changed) { // khôi phục để không làm hỏng các test sau
    await c.query(`update public.submissions set score=$2, status=$3 where id=$1`,
      [subId, before.score, before.status]);
  }
  return changed;
}
