import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/adminClient';
import { getAuthenticatedUser } from '@/lib/exam/authHelper';
import { mapDisplayedToCanonical } from '@/lib/exam/shuffler';
import {
  gradeTrueFalseQuestion,
  gradeShortAnswerQuestion,
  QuestionKey,
} from '@/lib/exam/schema';

export const dynamic = 'force-dynamic';

export async function POST(
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

    // 1. Lấy thông tin bài nộp
    const { data: sub, error: subErr } = await admin
      .from('submissions')
      .select('*, exam:exams(*)')
      .eq('id', submissionId)
      .maybeSingle();

    if (subErr || !sub) {
      return NextResponse.json(
        { success: false, error: 'Bài nộp không tồn tại' },
        { status: 404 }
      );
    }

    // 2. Chống IDOR: Chỉ học sinh sở hữu mới có quyền nộp bài
    if (sub.student_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền nộp bài này' },
        { status: 403 }
      );
    }

    // 3. Tính Idempotent: Nếu bài nộp đã được chấm, trả về kết quả cũ, không chấm lại
    if (sub.status === 'graded' || sub.status === 'submitted') {
      return NextResponse.json(
        {
          success: true,
          message: 'Bài thi đã được nộp và chấm điểm trước đó',
          score: sub.score,
          status: sub.status,
          submitted_at: sub.submitted_at,
        },
        {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          },
        }
      );
    }

    // 4. Đọc câu trả lời từ body (nếu có cập nhật thêm lần cuối trước khi bấm nộp)
    let finalAnswers = sub.answers || {};
    try {
      const body = await req.json();
      if (body.answers && typeof body.answers === 'object') {
        finalAnswers = { ...finalAnswers, ...body.answers };
      }
    } catch {}

    const permutations: Record<string, string[]> = sub.option_permutations || {};
    const questionOrder: string[] = sub.question_order || [];

    // 5. Lấy danh sách khóa đáp án từ private.question_keys (Server-Side duy nhất)
    let totalScore = 0;
    const gradedAnswers: Record<string, any> = {};

    // Đọc từ private.question_keys
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
          raw_tex: k.raw_tex,
        } as QuestionKey);
      }
    }

    // Lấy điểm số cấu hình của từng câu hỏi
    const { data: eqPoints } = await admin
      .from('exam_questions')
      .select('question_version_id, points')
      .eq('exam_id', sub.exam_id);

    const pointMap = new Map<string, number>();
    if (eqPoints) {
      for (const row of eqPoints) {
        pointMap.set(row.question_version_id, Number(row.points) || 0.25);
      }
    }

    // 6. Chấm điểm từng câu hỏi
    for (const qId of questionOrder) {
      const studentAns = finalAnswers[qId];
      const qKey = keyMap.get(qId);
      const perm = permutations[qId];
      const maxPts = pointMap.get(qId) ?? (qKey?.type === 'true_false' ? 1.0 : qKey?.type === 'short_answer' ? 0.5 : 0.25);

      if (!qKey) {
        // Nếu câu hỏi chưa có trong private.question_keys (đang chạy dữ liệu mock/chưa nạp key)
        continue;
      }

      if (qKey.type === 'single_choice') {
        // Dịch chữ cái hiển thị mà học sinh chọn -> chữ cái gốc trong khóa
        const canonicalChoice = typeof studentAns === 'string' ? mapDisplayedToCanonical(studentAns, perm) : '';
        const isCorrect = canonicalChoice === qKey.correct;
        const pts = isCorrect ? maxPts : 0;
        totalScore += pts;
        gradedAnswers[qId] = {
          student_displayed: studentAns,
          student_canonical: canonicalChoice,
          is_correct: isCorrect,
          points: pts,
        };
      } else if (qKey.type === 'true_false') {
        // Học sinh gửi: { "a": true, "b": false, ... } theo chữ cái hiển thị
        // Cần ánh xạ từng ý hiển thị về ý gốc tương ứng
        const canonicalStudentMap: Record<string, boolean> = {};
        if (studentAns && typeof studentAns === 'object') {
          for (const dispBranch of ['a', 'b', 'c', 'd']) {
            if (typeof studentAns[dispBranch] === 'boolean') {
              const origBranch = mapDisplayedToCanonical(dispBranch, perm);
              canonicalStudentMap[origBranch] = studentAns[dispBranch];
            }
          }
        }

        const gradeResult = gradeTrueFalseQuestion(canonicalStudentMap, qKey.correct, maxPts);
        totalScore += gradeResult.points;
        gradedAnswers[qId] = {
          student_canonical_map: canonicalStudentMap,
          correct_count: gradeResult.correctCount,
          points: gradeResult.points,
        };
      } else if (qKey.type === 'short_answer') {
        // Câu trả lời ngắn chấm bằng decimal.js
        const examMode = sub.exam?.category === 'practice' ? 'practice' : 'exam';
        const gradeResult = gradeShortAnswerQuestion(
          typeof studentAns === 'string' ? studentAns : '',
          qKey,
          maxPts,
          examMode
        );
        totalScore += gradeResult.points;
        gradedAnswers[qId] = {
          student_input: studentAns,
          normalized_input: gradeResult.normalizedInput,
          is_correct: gradeResult.isCorrect,
          points: gradeResult.points,
        };
      }
    }

    // Làm tròn tổng điểm 2 chữ số thập phân
    const finalScore = Math.round(totalScore * 100) / 100;

    // 7. Cập nhật trạng thái bài nộp trong Supabase
    const { error: updateErr } = await admin
      .from('submissions')
      .update({
        status: 'graded',
        submitted_at: now.toISOString(),
        score: finalScore,
        answers: finalAnswers,
      })
      .eq('id', submissionId);

    if (updateErr) {
      console.error('Error updating submission on submit:', updateErr);
      return NextResponse.json(
        { success: false, error: 'Không thể cập nhật kết quả bài thi' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        submission_id: submissionId,
        score: finalScore,
        status: 'graded',
        submitted_at: now.toISOString(),
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    );
  } catch (err: any) {
    console.error('API /api/submissions/[id]/submit error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Lỗi hệ thống' },
      { status: 500 }
    );
  }
}
