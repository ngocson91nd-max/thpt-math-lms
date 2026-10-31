import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/adminClient';
import { getAuthenticatedUser } from '@/lib/exam/authHelper';
import { canViewSolutions } from '@/lib/exam/access';
import { mapCanonicalToDisplayed } from '@/lib/exam/shuffler';
import { QuestionKey } from '@/lib/exam/schema';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: submissionId } = await context.params;
    const user = await getAuthenticatedUser(req);

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Yêu cầu xác thực tài khoản' },
        { status: 401 }
      );
    }

    const admin = getSupabaseAdmin();
    const now = new Date();

    // 1. Lấy thông tin bài nộp kèm thông tin đề thi
    const { data: sub, error: subErr } = await admin
      .from('submissions')
      .select('*, exam:exams(*)')
      .eq('id', submissionId)
      .maybeSingle();

    if (subErr || !sub || !sub.exam) {
      return NextResponse.json(
        { success: false, error: 'Bài nộp không tồn tại' },
        { status: 404 }
      );
    }

    const exam = sub.exam;
    const examClosesAt = new Date(exam.closes_at || exam.end_time || 0);
    const solutionsPublishedAt = exam.solutions_published_at
      ? new Date(exam.solutions_published_at)
      : null;

    // 2. Kiểm tra điều kiện mở khóa đáp án bằng hàm thuần canViewSolutions
    const isAllowed = canViewSolutions({
      role: user.role,
      userId: user.id,
      exam: {
        owner_id: exam.owner_id || exam.teacher_id,
        closes_at: examClosesAt,
        solutions_published_at: solutionsPublishedAt,
      },
      submission: {
        student_id: sub.student_id,
        status: sub.status,
        exam_id: sub.exam_id,
      },
      examIdRequested: sub.exam_id,
      now,
    });

    if (!isAllowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Chưa đến thời điểm được phép xem đáp án và lời giải chi tiết',
          status: sub.status,
          closes_at: examClosesAt,
        },
        { status: 403 }
      );
    }

    // 3. Đã đủ điều kiện: Đọc đáp án từ private.question_keys
    const questionOrder: string[] = sub.question_order || [];
    const permutations: Record<string, string[]> = sub.option_permutations || {};

    const { data: keysData } = await admin
      .schema('private' as any)
      .from('question_keys')
      .select('*')
      .in('question_version_id', questionOrder);

    const keyMap = new Map<string, QuestionKey>();
    if (keysData) {
      for (const k of keysData) {
        keyMap.set(k.question_version_id, {
          type: k.type,
          ...k.key,
          explanation: k.explanation,
        } as QuestionKey);
      }
    }

    // 4. Dịch các đáp án đúng sang đúng chữ cái hiển thị mà học sinh đã thấy
    const solutions: Record<string, any> = {};

    for (const qId of questionOrder) {
      const qKey = keyMap.get(qId);
      const perm = permutations[qId];

      if (!qKey) continue;

      if (qKey.type === 'single_choice') {
        const displayedCorrect = mapCanonicalToDisplayed(qKey.correct, perm);
        solutions[qId] = {
          type: 'single_choice',
          correct_displayed: displayedCorrect,
          explanation: qKey.explanation,
        };
      } else if (qKey.type === 'true_false') {
        // Ánh xạ đáp án đúng của từng ý sang thứ tự hiển thị
        const displayedTrueFalse: Record<string, boolean> = {};
        const branches = ['a', 'b', 'c', 'd'] as const;
        for (let i = 0; i < branches.length; i++) {
          const dispLetter = branches[i];
          const origLetter = perm && perm[i] ? perm[i] : dispLetter;
          displayedTrueFalse[dispLetter] = qKey.correct[origLetter as 'a' | 'b' | 'c' | 'd'];
        }
        solutions[qId] = {
          type: 'true_false',
          correct_displayed: displayedTrueFalse,
          explanation: qKey.explanation,
        };
      } else if (qKey.type === 'short_answer') {
        solutions[qId] = {
          type: 'short_answer',
          correct_value: qKey.value,
          display_answer: qKey.display_answer || qKey.value,
          explanation: qKey.explanation,
        };
      } else if (qKey.type === 'essay') {
        solutions[qId] = {
          type: 'essay',
          rubric: qKey.rubric,
          explanation: qKey.explanation,
        };
      }
    }

    return NextResponse.json(
      {
        success: true,
        submission: {
          id: sub.id,
          exam_id: sub.exam_id,
          score: sub.score,
          status: sub.status,
          submitted_at: sub.submitted_at,
          answers: sub.answers,
        },
        solutions,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    );
  } catch (err: any) {
    console.error('API /api/submissions/[id]/review error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Lỗi hệ thống' },
      { status: 500 }
    );
  }
}
