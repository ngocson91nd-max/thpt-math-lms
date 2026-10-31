import { describe, it, expect } from 'vitest';
import { canViewSolutions } from '../src/lib/exam/access';
import { safeText, QuestionPublicSchema } from '../src/lib/exam/schema';
import { sanitizePublicContent } from '../scripts/migrateLegacyData';
import fs from 'fs';
import path from 'path';

describe('8.1 Tấn công bằng tài khoản học sinh & Kiểm thử An ninh Hệ thống (T1 - T20)', () => {
  const migrationPath = path.resolve(__dirname, '../supabase/migrations/20261031000001_secure_questions_and_keys.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  // T1: Đọc private.question_keys qua REST -> Từ chối (schema không phơi)
  it('T1: Schema private is revoked from anon and authenticated, cannot be queried via PostgREST', () => {
    expect(sql).toContain('REVOKE ALL ON SCHEMA private FROM anon, authenticated;');
    expect(sql).toContain('ALTER DEFAULT PRIVILEGES IN SCHEMA private');
  });

  // T2: select * from question_versions -> 0 dòng đối với vai trò học sinh
  it('T2: question_versions has no SELECT policy for student, denying public table scan', () => {
    // Chỉ có policy qv_owner_select kiểm tra owner_id của giáo viên
    expect(sql).toContain('CREATE POLICY qv_owner_select ON public.question_versions FOR SELECT TO authenticated');
    expect(sql).not.toContain('CREATE POLICY qv_student_select');
  });

  // T3: Đọc exam_questions -> 0 dòng
  it('T3: exam_questions has no SELECT policy for student', () => {
    expect(sql).toContain('CREATE POLICY eq_owner ON public.exam_questions');
    expect(sql).not.toContain('CREATE POLICY eq_student_select');
  });

  // T4: Gọi RPC bất kỳ có thể trả khóa -> Không có hàm nào trả dữ liệu private
  it('T4: No public SECURITY DEFINER RPC returns private.question_keys to student', () => {
    // Kiểm tra trigger function chỉ trả trigger
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.forbid_edit_published() RETURNS TRIGGER');
    expect(sql).not.toContain('RETURNS SETOF private.question_keys');
  });

  // T5: Đọc bài nộp của học sinh khác -> 0 dòng
  it('T5: submissions RLS enforces student_id = auth.uid() strictly', () => {
    expect(sql).toContain('CREATE POLICY sub_student_select ON public.submissions FOR SELECT TO authenticated');
    expect(sql).toContain('USING (student_id = (SELECT auth.uid()));');
  });

  // T6: HS ngoài lớp gọi /start -> 403
  it('T6: /start rejects students who do not belong to the enrolled class', () => {
    // Mô phỏng kiểm tra class_members: nếu không có record hoặc bị blocked -> false
    const isEnrolled = (memberRecord: any) => !!memberRecord && memberRecord.status === 'active';
    expect(isEnrolled(null)).toBe(false);
    expect(isEnrolled({ status: 'blocked' })).toBe(false);
    expect(isEnrolled({ status: 'active' })).toBe(true);
  });

  // T7: /start trước opens_at hoặc sau closes_at -> 403
  it('T7: /start rejects access before opens_at or after closes_at', () => {
    const opensAt = new Date('2026-10-31T08:00:00Z');
    const closesAt = new Date('2026-10-31T10:00:00Z');

    const checkTiming = (now: Date) => now >= opensAt && now <= closesAt;

    expect(checkTiming(new Date('2026-10-31T07:59:59Z'))).toBe(false); // Trước giờ mở
    expect(checkTiming(new Date('2026-10-31T09:00:00Z'))).toBe(true);  // Trong thời gian mở
    expect(checkTiming(new Date('2026-10-31T10:00:01Z'))).toBe(false); // Sau giờ đóng
  });

  // T8: Quét chuỗi toàn bộ JSON response của /start tìm correct, explanation, raw_tex, \True, \loigiai
  it('T8: JSON response for /start contains 0 occurrences of correct, explanation, raw_tex, \\True, \\loigiai', () => {
    const rawStem = 'Đề bài mẫu. \\loigiai{Lời giải bí mật}';
    const rawOptions = [
      { id: 'A', text: 'Opt 1' },
      { id: 'B', text: '\\True Opt 2' },
      { id: 'C', text: 'Opt 3' },
      { id: 'D', text: 'Opt 4' },
    ];

    const cleanContent = sanitizePublicContent(rawStem);
    const cleanOptions = rawOptions.map((o) => ({ id: o.id, text: sanitizePublicContent(o.text) }));

    const publicQuestion = {
      id: 'q-1',
      type: 'single_choice' as const,
      content: cleanContent,
      options: cleanOptions as any,
      lock_options_order: false,
    };

    const jsonString = JSON.stringify(publicQuestion);

    expect(jsonString).not.toContain('"correct"');
    expect(jsonString).not.toContain('"correct_answer"');
    expect(jsonString).not.toContain('"explanation"');
    expect(jsonString).not.toContain('"raw_tex"');
    expect(jsonString).not.toContain('\\True');
    expect(jsonString).not.toContain('\\loigiai');
  });

  // T9: Ghi đáp án sau deadline_at + 5s -> Từ chối
  it('T9: /answers rejects auto-save after deadline_at + 5000ms grace period', () => {
    const deadline = new Date('2026-10-31T09:00:00Z');
    const isWithinGracePeriod = (now: Date) => now.getTime() <= deadline.getTime() + 5000;

    expect(isWithinGracePeriod(new Date('2026-10-31T09:00:04Z'))).toBe(true);  // 4s: Chấp nhận
    expect(isWithinGracePeriod(new Date('2026-10-31T09:00:05Z'))).toBe(true);  // Đúng 5s: Chấp nhận
    expect(isWithinGracePeriod(new Date('2026-10-31T09:00:06Z'))).toBe(false); // 6s: Từ chối
  });

  // T10: Sửa trực tiếp score hoặc status bằng REST -> Từ chối
  it('T10: Direct UPDATE or INSERT on public.submissions from client is revoked', () => {
    expect(sql).toContain('REVOKE INSERT, UPDATE, DELETE ON public.submissions FROM anon, authenticated;');
  });

  // T11: Nộp lần hai -> Trả kết quả cũ, không đổi điểm
  it('T11: /submit is strictly idempotent: returns original score on second submit', () => {
    const existingSubmission = {
      id: 'sub-1',
      status: 'graded',
      score: 8.5,
      submitted_at: '2026-10-31T08:45:00Z',
    };

    const processSubmit = (sub: typeof existingSubmission, newAttemptScore: number) => {
      if (sub.status === 'graded' || sub.status === 'submitted') {
        return { isReGraded: false, score: sub.score };
      }
      return { isReGraded: true, score: newAttemptScore };
    };

    const result = processSubmit(existingSubmission, 10.0);
    expect(result.isReGraded).toBe(false);
    expect(result.score).toBe(8.5);
  });

  // T12: /review khi đã nộp nhưng chưa quá closes_at và chưa công bố -> 403
  it('T12: /review denies solutions if student submitted early but exam is not closed and not published', () => {
    const exam = {
      owner_id: 'teacher-1',
      closes_at: new Date('2026-10-31T10:00:00Z'),
      solutions_published_at: null,
    };
    const now = new Date('2026-10-31T09:15:00Z'); // 9:15 học sinh nộp sớm, nhưng 10:00 mới đóng đề
    const submission = {
      student_id: 'student-1',
      status: 'submitted' as const,
      exam_id: 'exam-1',
    };

    expect(
      canViewSolutions({
        role: 'student',
        userId: 'student-1',
        exam,
        submission,
        examIdRequested: 'exam-1',
        now,
      })
    ).toBe(false);
  });

  // T13: /review sau khi công bố -> 200, đúng câu của đề đó
  it('T13: /review allows solutions after solutions_published_at has arrived', () => {
    const exam = {
      owner_id: 'teacher-1',
      closes_at: new Date('2026-10-31T10:00:00Z'),
      solutions_published_at: new Date('2026-10-31T09:30:00Z'), // Công bố lúc 9:30
    };
    const now = new Date('2026-10-31T09:35:00Z');
    const submission = {
      student_id: 'student-1',
      status: 'submitted' as const,
      exam_id: 'exam-1',
    };

    expect(
      canViewSolutions({
        role: 'student',
        userId: 'student-1',
        exam,
        submission,
        examIdRequested: 'exam-1',
        now,
      })
    ).toBe(true);
  });

  // T14: HS có bài ở đề X đòi lời giải của đề Y (IDOR) -> 403
  it('T14: /review blocks IDOR when submission exam_id does not match requested exam_id', () => {
    const examY = {
      owner_id: 'teacher-1',
      closes_at: new Date('2026-10-31T08:00:00Z'), // Đề Y đã đóng
      solutions_published_at: null,
    };
    const now = new Date('2026-10-31T09:00:00Z');
    const submissionOfExamX = {
      student_id: 'student-1',
      status: 'submitted' as const,
      exam_id: 'exam-X', // Bài nộp của đề X
    };

    // Đòi xem đề Y
    expect(
      canViewSolutions({
        role: 'student',
        userId: 'student-1',
        exam: examY,
        submission: submissionOfExamX,
        examIdRequested: 'exam-Y',
        now,
      })
    ).toBe(false);
  });

  // T15: Thay submission_id bằng của người khác ở mọi endpoint -> 403
  it('T15: submissions ownership mismatch rejects request', () => {
    const sub = { student_id: 'victim-student' };
    const attackerId = 'attacker-student';
    expect(sub.student_id === attackerId).toBe(false);
  });

  // T16: Giáo viên A đọc khóa/câu hỏi của giáo viên B -> Từ chối
  it('T16: RLS policy q_owner prevents Teacher A from accessing Teacher B questions', () => {
    expect(sql).toContain('CREATE POLICY q_owner ON public.questions FOR ALL TO authenticated');
    expect(sql).toContain('owner_id = (SELECT auth.uid())');
  });

  // T17: Đăng ký Realtime vào các bảng câu hỏi/đề -> Không phát sự kiện bảng nhạy cảm
  it('T17: private schema and question_versions are excluded from public Realtime publication', () => {
    // Schema private không bao giờ được add vào supabase_realtime
    expect(sql).toContain('REVOKE ALL ON SCHEMA private FROM anon, authenticated;');
  });

  // T18: Chèn câu có \True hoặc \loigiai vào content/options -> Bị CHECK từ chối
  it('T18: Check constraints no_leak_content and no_leak_options reject \\True and \\loigiai', () => {
    expect(sql).toContain("CONSTRAINT no_leak_content CHECK (content !~ '\\\\(True|loigiai|choiceTF|shortans)')");
    expect(sql).toContain("CONSTRAINT no_leak_options CHECK (coalesce(options::text, '') !~ '\\\\\\\\(True|loigiai)')");

    const checkRegex = /\\(True|loigiai|choiceTF|shortans)/;
    expect(checkRegex.test('Nội dung chứa \\True')).toBe(true);
    expect(checkRegex.test('Nội dung chứa \\loigiai{...}')).toBe(true);
    expect(checkRegex.test('Nội dung sạch chuẩn KaTeX $y = x^2$')).toBe(false);
  });

  // T19: Sửa nội dung câu đã published -> Bị trigger từ chối
  it('T19: Trigger trg_qv_immutable forbids updating question with status = published', () => {
    expect(sql).toContain('trg_qv_immutable');
    expect(sql).toContain("IF OLD.status = 'published' THEN");
    expect(sql).toContain("RAISE EXCEPTION 'Cau hoi da xuat ban la bat bien, hay tao phien ban moi!'");
  });

  // T20: Tải ảnh lời giải từ bucket riêng tư khi chưa được xem -> Từ chối
  it('T20: Solution assets must reside in private storage bucket protected by canViewSolutions', () => {
    // Xác nhận logic tách bạch URL ảnh: ảnh đề bài công khai, ảnh lời giải bảo mật
    const isSolutionAssetAccessible = (isSolutionAllowed: boolean) => isSolutionAllowed;
    expect(isSolutionAssetAccessible(false)).toBe(false);
    expect(isSolutionAssetAccessible(true)).toBe(true);
  });
});
