import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/adminClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const classId = searchParams.get('classId');
    const userId = searchParams.get('userId');
    const getClasses = searchParams.get('classes');

    const supabase = getSupabaseAdmin();

    // 1. Lấy danh sách tất cả các lớp học từ Supabase Cloud
    if (getClasses === 'true') {
      const { data: classesData, error: clsErr } = await supabase
        .from('classes')
        .select('*')
        .order('created_at', { ascending: false });

      if (clsErr) {
        console.error('Supabase get classes error:', clsErr);
        return NextResponse.json({ success: false, error: clsErr.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, classes: classesData || [] });
    }

    // 2. Lấy danh sách học sinh theo lớp học (chờ duyệt và chính thức)
    if (classId) {
      const cid = classId.trim();

      // Tìm ID lớp chuẩn từ Supabase nếu đầu vào là mã lớp
      let targetClassId = cid;
      if (!cid.includes('-')) {
        const { data: found } = await supabase
          .from('classes')
          .select('id')
          .ilike('code', `%${cid}%`)
          .single();
        if (found) targetClassId = found.id;
      }

      const { data: membersData, error: memErr } = await supabase
        .from('class_members')
        .select('*, profiles(*)')
        .eq('class_id', targetClassId);

      if (memErr) {
        console.error('Supabase get members error:', memErr);
        return NextResponse.json({ success: false, error: memErr.message }, { status: 500 });
      }

      const pending = (membersData || [])
        .filter((m: any) => m.status === 'pending')
        .map((m: any) => ({
          id: m.id,
          class_id: m.class_id,
          user_id: m.user_id,
          user: m.profiles || {
            id: m.user_id,
            full_name: 'Học sinh',
            email: 'student@thpt-math-lms.vn',
            role: 'student',
            grade: 12,
            school_name: 'THPT Chuyên',
          },
          status: 'pending',
          requested_at: m.joined_at,
        }));

      const members = (membersData || [])
        .filter((m: any) => m.status === 'active')
        .map((m: any) => ({
          id: m.id,
          class_id: m.class_id,
          user_id: m.user_id,
          role: m.role || 'student',
          status: 'active',
          joined_at: m.joined_at,
          profile: m.profiles,
        }));

      return NextResponse.json({ success: true, pending, members });
    }

    // 3. Kiểm tra các lớp mà học sinh đã tham gia hoặc đang chờ duyệt
    if (userId) {
      const uid = userId.trim();
      let targetUserId = uid;

      // Tìm user ID nếu truyền vào email
      if (uid.includes('@')) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('id')
          .ilike('email', uid)
          .single();
        if (prof) targetUserId = prof.id;
      }

      const { data: userMembers, error: uErr } = await supabase
        .from('class_members')
        .select('class_id, status')
        .eq('user_id', targetUserId);

      if (uErr) {
        console.error('Supabase user members error:', uErr);
        return NextResponse.json({ success: false, error: uErr.message }, { status: 500 });
      }

      const pendingClasses = (userMembers || [])
        .filter((m: any) => m.status === 'pending')
        .map((m: any) => m.class_id);

      const approvedClasses = (userMembers || [])
        .filter((m: any) => m.status === 'active')
        .map((m: any) => m.class_id);

      return NextResponse.json({ success: true, pendingClasses, approvedClasses });
    }

    return NextResponse.json({ success: true, message: 'Cloud sync API ready' });
  } catch (err: any) {
    console.error('Cloud Sync GET error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, classId, user, student, userId } = body;
    const supabase = getSupabaseAdmin();

    const targetClassId = classId;

    // 1. Học sinh xin vào lớp (chờ duyệt)
    if (action === 'request_join') {
      const studentProfile = user || student;
      const targetUserId =
        studentProfile?.id === 'user-an-toan-12' || studentProfile?.email === 'an.toan12@gmail.com'
          ? '48dc643d-1b47-4c4e-a473-ca2f622b761c'
          : studentProfile?.id || userId;

      if (!targetClassId || !targetUserId) {
        return NextResponse.json({ success: false, error: 'Thiếu thông tin' }, { status: 400 });
      }

      // Đảm bảo Profile đã tồn tại trong Supabase
      if (studentProfile) {
        try {
          await supabase.from('profiles').upsert([
            {
              id: targetUserId,
              email: studentProfile.email || 'student@thpt-math-lms.vn',
              full_name: studentProfile.full_name || 'Học sinh',
              role: 'student',
              grade: studentProfile.grade || 12,
              school_name: studentProfile.school_name || 'THPT Chuyên',
              phone: studentProfile.phone || '',
            },
          ]);
        } catch (e) {
          console.warn('Profile upsert note:', e);
        }
      }

      // Lưu trạng thái pending vào class_members
      const { error: reqErr } = await supabase.from('class_members').upsert([
        {
          id: `${targetClassId}_${targetUserId}`,
          class_id: targetClassId,
          user_id: targetUserId,
          role: 'student',
          status: 'pending',
          joined_at: new Date().toISOString(),
        },
      ]);

      if (reqErr) {
        console.error('Request join error:', reqErr);
        return NextResponse.json({ success: false, error: reqErr.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: 'Đã gửi yêu cầu vào lớp trên Supabase Cloud!' });
    }

    // 2. Học sinh kích hoạt mã vào lớp thành công (active ngay)
    if (action === 'join_with_code') {
      const studentProfile = user || student;
      const targetUserId =
        studentProfile?.id === 'user-an-toan-12' || studentProfile?.email === 'an.toan12@gmail.com'
          ? '48dc643d-1b47-4c4e-a473-ca2f622b761c'
          : studentProfile?.id || userId;

      if (!targetClassId || !targetUserId) {
        return NextResponse.json({ success: false, error: 'Thiếu thông tin' }, { status: 400 });
      }

      if (studentProfile) {
        try {
          await supabase.from('profiles').upsert([
            {
              id: targetUserId,
              email: studentProfile.email || 'student@thpt-math-lms.vn',
              full_name: studentProfile.full_name || 'Học sinh',
              role: 'student',
              grade: studentProfile.grade || 12,
              school_name: studentProfile.school_name || 'THPT Chuyên',
              phone: studentProfile.phone || '',
            },
          ]);
        } catch (e) {}
      }

      const { error: joinErr } = await supabase.from('class_members').upsert([
        {
          id: `${targetClassId}_${targetUserId}`,
          class_id: targetClassId,
          user_id: targetUserId,
          role: 'student',
          status: 'active',
          joined_at: new Date().toISOString(),
        },
      ]);

      if (joinErr) {
        console.error('Join with code cloud error:', joinErr);
        return NextResponse.json({ success: false, error: joinErr.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: 'Đã vào lớp trên Cloud thành công!' });
    }

    // 3. Thầy Sơn duyệt học sinh vào lớp
    if (action === 'approve_student') {
      const studentProfile = student || user;
      const targetUserId =
        studentProfile?.id === 'user-an-toan-12' || studentProfile?.email === 'an.toan12@gmail.com'
          ? '48dc643d-1b47-4c4e-a473-ca2f622b761c'
          : studentProfile?.id || userId;

      if (!targetClassId || !targetUserId) {
        return NextResponse.json({ success: false, error: 'Thiếu thông tin' }, { status: 400 });
      }

      const { error: appErr } = await supabase
        .from('class_members')
        .update({ status: 'active' })
        .eq('class_id', targetClassId)
        .eq('user_id', targetUserId);

      if (appErr) {
        // Fallback upsert
        await supabase.from('class_members').upsert([
          {
            id: `${targetClassId}_${targetUserId}`,
            class_id: targetClassId,
            user_id: targetUserId,
            role: 'student',
            status: 'active',
            joined_at: new Date().toISOString(),
          },
        ]);
      }

      return NextResponse.json({ success: true, message: 'Đã phê duyệt học sinh trên Supabase Cloud thành công!' });
    }

    // 4. Từ chối yêu cầu hoặc xóa học sinh khỏi lớp
    if (action === 'reject_student' || action === 'remove_student') {
      const targetUserId =
        userId === 'user-an-toan-12' ? '48dc643d-1b47-4c4e-a473-ca2f622b761c' : userId;

      await supabase
        .from('class_members')
        .delete()
        .eq('class_id', targetClassId)
        .eq('user_id', targetUserId);

      return NextResponse.json({ success: true, message: 'Đã xử lý học sinh trên Supabase Cloud!' });
    }

    // 5. Tạo lớp học mới
    if (action === 'create_class') {
      const { classData } = body;
      if (classData) {
        const { error: clsErr } = await supabase.from('classes').upsert([classData]);
        if (clsErr) {
          return NextResponse.json({ success: false, error: clsErr.message }, { status: 500 });
        }
        return NextResponse.json({ success: true, message: 'Đã tạo lớp trên Supabase Cloud!' });
      }
    }

    // 6. Xóa lớp học
    if (action === 'delete_class') {
      if (targetClassId) {
        await supabase.from('class_members').delete().eq('class_id', targetClassId);
        await supabase.from('classes').delete().eq('id', targetClassId);
        return NextResponse.json({ success: true, message: 'Đã xóa lớp trên Supabase Cloud!' });
      }
    }

    return NextResponse.json({ success: false, error: 'Hành động không hợp lệ' }, { status: 400 });
  } catch (err: any) {
    console.error('Cloud Sync POST error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
