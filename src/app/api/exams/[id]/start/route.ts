import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/adminClient';
import { getAuthenticatedUser } from '@/lib/exam/authHelper';
import { shuffleExamQuestions, mapCanonicalToDisplayed } from '@/lib/exam/shuffler';
import { QuestionPublic, QuestionPublicSchema } from '@/lib/exam/schema';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: examId } = await context.params;
    const user = await getAuthenticatedUser(req);

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Yêu cầu xác thực tài khoản' },
        { status: 401 }
      );
    }

    const admin = getSupabaseAdmin();
    const now = new Date();

    // 1. Lấy thông tin đề thi
    const { data: exam, error: examErr } = await admin
      .from('exams')
      .select('*')
      .eq('id', examId)
      .maybeSingle();

    if (examErr || !exam) {
      return NextResponse.json(
        { success: false, error: 'Đề thi không tồn tại' },
        { status: 404 }
      );
    }

    // 2. Kiểm tra điều kiện mở đề: exam.status = 'open' và opens_at <= now <= closes_at
    const opensAt = new Date(exam.opens_at || exam.start_time || 0);
    const closesAt = new Date(exam.closes_at || exam.end_time || '2099-12-31');

    if (exam.status !== 'open' && exam.status !== 'published') {
      return NextResponse.json(
        { success: false, error: 'Đề thi chưa mở hoặc đã đóng' },
        { status: 403 }
      );
    }

    if (now < opensAt) {
      return NextResponse.json(
        { success: false, error: 'Chưa đến thời gian bắt đầu làm bài' },
        { status: 403 }
      );
    }

    if (now > closesAt) {
      return NextResponse.json(
        { success: false, error: 'Đề thi đã hết hạn làm bài' },
        { status: 403 }
      );
    }

    // 3. Kiểm tra học sinh có thuộc lớp hay không
    if (user.role === 'student') {
      const { data: member } = await admin
        .from('class_members')
        .select('id, status')
        .eq('class_id', exam.class_id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (!member || member.status === 'blocked') {
        return NextResponse.json(
          { success: false, error: 'Bạn không thuộc danh sách lớp thi này' },
          { status: 403 }
        );
      }
    }

    // 4. Kiểm tra xem học sinh đã có bài nộp trước đó chưa (Idempotent)
    const { data: existingSub } = await admin
      .from('submissions')
      .select('*')
      .eq('exam_id', examId)
      .eq('student_id', user.id)
      .maybeSingle();

    // Lấy danh sách câu hỏi phiên bản công khai của đề thi
    // Hỗ trợ cả bảng exam_questions liên kết question_versions và fallback mô tả đề
    let rawPublicQuestions: QuestionPublic[] = [];

    const { data: eqRows } = await admin
      .from('exam_questions')
      .select('position, points, question_versions(*)')
      .eq('exam_id', examId)
      .order('position', { ascending: true });

    if (eqRows && eqRows.length > 0) {
      rawPublicQuestions = eqRows
        .map((row: any) => {
          const qv = row.question_versions;
          if (!qv) return null;
          try {
            return QuestionPublicSchema.parse({
              id: qv.id,
              type: qv.type,
              content: qv.content,
              options: qv.options || [],
              image_url: qv.image_url || undefined,
              lock_options_order: qv.lock_options_order ?? false,
              group_id: qv.group_id || null,
            });
          } catch {
            return null;
          }
        })
        .filter(Boolean) as QuestionPublic[];
    }

    // Fallback: nếu đề tạo từ hệ thống cũ lưu danh sách câu hỏi trong description
    if (rawPublicQuestions.length === 0 && exam.description) {
      try {
        const extra = JSON.parse(exam.description);
        if (Array.isArray(extra.questions)) {
          rawPublicQuestions = extra.questions.map((q: any) => ({
            id: q.id,
            type: q.type,
            content: q.content,
            options: q.options || [],
            image_url: q.image_url,
            lock_options_order: q.lock_options_order ?? false,
            group_id: q.group_id ?? null,
          }));
        }
      } catch {}
    }

    // Nếu đã có bài nộp đang làm: Trả về đúng thứ tự và hoán vị đã sinh
    if (existingSub) {
      const qOrder: string[] = existingSub.question_order || [];
      const optPerms: Record<string, string[]> = existingSub.option_permutations || {};

      // Xếp lại theo qOrder
      const sorted = [...rawPublicQuestions].sort((a, b) => {
        const idxA = qOrder.indexOf(a.id);
        const idxB = qOrder.indexOf(b.id);
        return (idxA >= 0 ? idxA : 999) - (idxB >= 0 ? idxB : 999);
      });

      // Tái lập options theo optPerms
      const finalQuestions = sorted.map((q) => {
        const perm = optPerms[q.id];
        if (perm && (q.type === 'single_choice' || q.type === 'true_false') && Array.isArray(q.options)) {
          const letterList = q.type === 'single_choice' ? ['A', 'B', 'C', 'D'] : ['a', 'b', 'c', 'd'];
          const reorderedOpts = perm.map((origId, i) => {
            const found = q.options.find((o: any) => o.id === origId);
            return {
              id: letterList[i],
              text: found ? found.text : '',
            };
          });
          return { ...q, options: reorderedOpts };
        }
        return q;
      });

      return NextResponse.json(
        {
          success: true,
          submission_id: existingSub.id,
          deadline_at: existingSub.deadline_at,
          status: existingSub.status,
          questions: finalQuestions,
        },
        {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          },
        }
      );
    }

    // Chưa có bài nộp: Tiến hành xáo trộn an toàn và tạo bài nộp mới
    const shuffleResult = shuffleExamQuestions(rawPublicQuestions);
    const durationMinutes = exam.duration_minutes || 45;
    const durationMs = durationMinutes * 60 * 1000;
    const computedDeadline = new Date(now.getTime() + durationMs);
    const finalDeadline = computedDeadline < closesAt ? computedDeadline : closesAt;

    const { data: newSub, error: subErr } = await admin
      .from('submissions')
      .insert({
        exam_id: examId,
        student_id: user.id,
        started_at: now.toISOString(),
        deadline_at: finalDeadline.toISOString(),
        status: 'in_progress',
        question_order: shuffleResult.questionOrder,
        option_permutations: shuffleResult.optionPermutations,
        answers: {},
      })
      .select()
      .single();

    if (subErr) {
      console.error('Error creating submission:', subErr);
      return NextResponse.json(
        { success: false, error: 'Không thể khởi tạo bài nộp' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        submission_id: newSub.id,
        deadline_at: newSub.deadline_at,
        status: newSub.status,
        questions: shuffleResult.shuffledQuestions,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    );
  } catch (err: any) {
    console.error('API /api/exams/[id]/start error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Lỗi hệ thống' },
      { status: 500 }
    );
  }
}
