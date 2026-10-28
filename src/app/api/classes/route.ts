import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/adminClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET: Lấy danh sách toàn bộ lớp học thời gian thực từ Supabase Cloud
export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const { data: classes, error } = await supabase
      .from('classes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching classes:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Đếm số lượng học sinh thực tế và số học sinh chờ duyệt của từng lớp
    const { data: allMembers } = await supabase
      .from('class_members')
      .select('class_id, status');

    const memberCountMap: Record<string, number> = {};
    const pendingCountMap: Record<string, number> = {};

    (allMembers || []).forEach((m: any) => {
      if (m.status === 'active') {
        memberCountMap[m.class_id] = (memberCountMap[m.class_id] || 0) + 1;
      } else if (m.status === 'pending') {
        pendingCountMap[m.class_id] = (pendingCountMap[m.class_id] || 0) + 1;
      }
    });

    const classesWithCounts = (classes || []).map((c: any) => ({
      ...c,
      member_count: memberCountMap[c.id] || 0,
      pending_count: pendingCountMap[c.id] || 0,
    }));

    return NextResponse.json(
      { success: true, classes: classesWithCounts },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );
  } catch (err: any) {
    console.error('API /api/classes GET error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// POST: Tạo lớp học mới trực tiếp trên Supabase Cloud
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, code, grade, academic_year, teacher_id, description } = body;

    if (!name || !code) {
      return NextResponse.json({ success: false, error: 'Tên lớp và Mã lớp là bắt buộc' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const classId = body.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : undefined);

    const newClass = {
      ...(classId ? { id: classId } : {}),
      name: name.trim(),
      code: code.trim().toUpperCase(),
      grade: Number(grade) || 12,
      academic_year: academic_year || '2025-2026',
      teacher_id: teacher_id || '11111111-1111-1111-1111-111111111111',
      description: description || 'Lớp bồi dưỡng và luyện thi THPT Thầy Sơn.',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('classes')
      .insert([newClass])
      .select()
      .single();

    if (error) {
      console.error('Error inserting class:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, class: data });
  } catch (err: any) {
    console.error('API /api/classes POST error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// PUT: Cập nhật lớp học trên Supabase Cloud
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, name, code, grade, academic_year, description } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Thiếu ID lớp học' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('classes')
      .update({
        ...(name ? { name: name.trim() } : {}),
        ...(code ? { code: code.trim().toUpperCase() } : {}),
        ...(grade ? { grade: Number(grade) } : {}),
        ...(academic_year ? { academic_year } : {}),
        ...(description !== undefined ? { description } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, class: data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// DELETE: Xóa lớp học và toàn bộ thành viên khỏi Supabase Cloud
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Thiếu ID lớp học' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // 1. Xóa các thành viên trong lớp
    await supabase.from('class_members').delete().eq('class_id', id);

    // 2. Xóa lớp học
    const { error } = await supabase.from('classes').delete().eq('id', id);

    if (error) {
      console.error('Error deleting class:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Đã xóa lớp học thành công khỏi Cloud!' });
  } catch (err: any) {
    console.error('API /api/classes DELETE error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
