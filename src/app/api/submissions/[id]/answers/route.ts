import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/adminClient';
import { getAuthenticatedUser } from '@/lib/exam/authHelper';

export const dynamic = 'force-dynamic';

export async function PUT(
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
      .select('*')
      .eq('id', submissionId)
      .maybeSingle();

    if (subErr || !sub) {
      return NextResponse.json(
        { success: false, error: 'Bài nộp không tồn tại' },
        { status: 404 }
      );
    }

    // 2. Kiểm tra chủ sở hữu bài nộp (Chống IDOR)
    if (sub.student_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền sửa bài nộp này' },
        { status: 403 }
      );
    }

    // 3. Kiểm tra trạng thái bài nộp
    if (sub.status !== 'in_progress') {
      return NextResponse.json(
        { success: false, error: 'Bài thi đã kết thúc, không thể cập nhật đáp án' },
        { status: 403 }
      );
    }

    // 4. Kiểm tra thời hạn làm bài (Thời gian hiện tại <= deadline_at + 5 giây độ trễ mạng)
    const deadline = new Date(sub.deadline_at);
    const gracePeriodMs = 5000; // 5s tolerance
    if (now.getTime() > deadline.getTime() + gracePeriodMs) {
      return NextResponse.json(
        { success: false, error: 'Đã hết thời gian làm bài (+5s độ trễ mạng)' },
        { status: 403 }
      );
    }

    // 5. Đọc câu trả lời từ body và lưu vào database
    const body = await req.json();
    const newAnswers = body.answers || {};

    const { error: updateErr } = await admin
      .from('submissions')
      .update({
        answers: newAnswers,
      })
      .eq('id', submissionId);

    if (updateErr) {
      console.error('Error saving answers:', updateErr);
      return NextResponse.json(
        { success: false, error: 'Lỗi khi lưu bài làm' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        saved_at: now.toISOString(),
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    );
  } catch (err: any) {
    console.error('API /api/submissions/[id]/answers error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Lỗi hệ thống' },
      { status: 500 }
    );
  }
}
