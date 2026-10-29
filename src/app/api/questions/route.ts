import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/adminClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET: Lấy toàn bộ câu hỏi trong Ngân hàng đề thi
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('API /api/questions GET error:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { success: true, questions: data || [] },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    );
  } catch (err: any) {
    console.error('API /api/questions GET error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// POST: Nạp câu hỏi mới hoặc cập nhật vào Ngân hàng câu hỏi
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawList = Array.isArray(body)
      ? body
      : Array.isArray(body?.questions)
      ? body.questions
      : body?.question
      ? [body.question]
      : [body];

    if (!rawList || rawList.length === 0) {
      return NextResponse.json({ success: false, error: 'Không có dữ liệu câu hỏi' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const formattedQuestions = rawList.map((q: any) => {
      const qUuid =
        q.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q.id)
          ? q.id
          : typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : '00000000-0000-0000-0000-' + Math.random().toString(36).substring(2, 14);

      return {
        id: qUuid,
        teacher_id: q.teacher_id || '11111111-1111-1111-1111-111111111111',
        grade: [10, 11, 12].includes(Number(q.grade)) ? Number(q.grade) : 12,
        topic: q.topic?.trim() || 'Toán THPT',
        difficulty: ['nhan_biet', 'thong_hieu', 'van_dung', 'van_dung_cao'].includes(q.difficulty)
          ? q.difficulty
          : 'thong_hieu',
        type: ['single_choice', 'multiple_choice', 'true_false', 'short_answer', 'essay'].includes(q.type)
          ? q.type
          : 'single_choice',
        content: q.content?.trim() || 'Nội dung câu hỏi',
        options: q.options ?? [],
        correct_answer: q.correct_answer ?? 'A',
        explanation: q.explanation?.trim() || '',
        points: Number(q.points) || (q.type === 'single_choice' ? 0.25 : 1.0),
        is_public: q.is_public ?? true,
        updated_at: new Date().toISOString(),
      };
    });

    const { data, error } = await supabase
      .from('questions')
      .upsert(formattedQuestions)
      .select();

    if (error) {
      console.error('API /api/questions POST error:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      count: data?.length || 0,
      questions: data,
    });
  } catch (err: any) {
    console.error('API /api/questions POST error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// DELETE: Xóa câu hỏi (1 câu hoặc xóa toàn bộ ngân hàng)
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const questionId = searchParams.get('id');
    const deleteAll = searchParams.get('all') === 'true';

    const supabase = getSupabaseAdmin();

    if (deleteAll) {
      const { error } = await supabase
        .from('questions')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, message: 'Đã xóa toàn bộ câu hỏi trong ngân hàng đề' });
    }

    if (!questionId) {
      return NextResponse.json({ success: false, error: 'Thiếu ID câu hỏi cần xóa' }, { status: 400 });
    }

    const { error } = await supabase.from('questions').delete().eq('id', questionId);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Đã xóa câu hỏi thành công' });
  } catch (err: any) {
    console.error('API /api/questions DELETE error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
