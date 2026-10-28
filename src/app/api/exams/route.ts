import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/adminClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET: Lấy danh sách toàn bộ đề thi thời gian thực từ Supabase Cloud
export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('exams')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('API /api/exams GET error:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { success: true, exams: data || [] },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );
  } catch (err: any) {
    console.error('API /api/exams GET error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// POST: Tạo hoặc cập nhật đề thi trên Supabase Cloud
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      id,
      title,
      description,
      grade,
      duration_minutes,
      teacher_id,
      class_id,
      status,
      passing_score,
      shuffle_questions,
      shuffle_options,
      max_attempts,
      start_time,
      end_time,
      is_view_answer_allowed,
    } = body;

    if (!title) {
      return NextResponse.json({ success: false, error: 'Tiêu đề đề thi là bắt buộc' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const examUuid =
      id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
        ? id
        : typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : undefined;

    const payload = {
      ...(examUuid ? { id: examUuid } : {}),
      title: title.trim(),
      description: description ? description.trim() : 'Đề kiểm tra Toán THPT Thầy Sơn.',
      grade: Number(grade) || 12,
      duration_minutes: Number(duration_minutes) || 45,
      teacher_id: teacher_id || '11111111-1111-1111-1111-111111111111',
      class_id: class_id || null,
      status: status || 'published',
      passing_score: passing_score || 5.0,
      shuffle_questions: shuffle_questions ?? true,
      shuffle_options: shuffle_options ?? true,
      max_attempts: max_attempts || 1,
      start_time: start_time || null,
      end_time: end_time || null,
      is_view_answer_allowed: is_view_answer_allowed ?? true,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('exams')
      .upsert([payload])
      .select()
      .single();

    if (error) {
      console.error('Error upserting exam:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, exam: data });
  } catch (err: any) {
    console.error('API /api/exams POST error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// DELETE: Xóa đề thi (hoặc xóa tất cả) khỏi Supabase Cloud
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const examId = searchParams.get('id');
    const deleteAll = searchParams.get('all') === 'true';

    const supabase = getSupabaseAdmin();

    if (deleteAll) {
      try {
        await supabase.from('submissions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      } catch {}

      const { error } = await supabase
        .from('exams')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, message: 'Đã xóa toàn bộ đề thi trên Cloud' });
    }

    if (!examId) {
      return NextResponse.json({ success: false, error: 'Thiếu ID đề thi cần xóa' }, { status: 400 });
    }

    try {
      await supabase.from('submissions').delete().eq('exam_id', examId);
    } catch {}

    const { error } = await supabase.from('exams').delete().eq('id', examId);

    if (error) {
      console.error('Error deleting exam:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Đã xóa đề thi thành công' });
  } catch (err: any) {
    console.error('API /api/exams DELETE error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
