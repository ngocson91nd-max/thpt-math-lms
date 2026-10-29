import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/adminClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function resolveStudentUuid(rawId: string | null | undefined, email?: string | null): string {
  const s = (rawId || '').trim();
  const em = (email || '').trim().toLowerCase();
  if (s === 'user-an-toan-12' || em === 'an.toan12@gmail.com' || s === 'an.toan12@gmail.com') {
    return '48dc643d-1b47-4c4e-a473-ca2f622b761c';
  }
  if (s === '33333333-3333-3333-3333-333333333333' || em === 'student.mai@thpt-math-lms.vn') {
    return '33333333-3333-3333-3333-333333333333';
  }
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(s)) return s;
  return s;
}

/**
 * Tra cứu UUID chuẩn của lớp học trong Supabase từ bất kỳ định danh nào (UUID, Code, Tên lớp)
 */
async function resolveClassUuid(
  supabase: any,
  rawClassId?: string | null,
  name?: string | null,
  code?: string | null
): Promise<string | null> {
  const s = (rawClassId || '').trim();
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(s)) return s;

  // 1. Tìm theo mã code
  const targetCode = (code || s).trim();
  if (targetCode) {
    const { data: byCode } = await supabase
      .from('classes')
      .select('id')
      .ilike('code', targetCode)
      .maybeSingle();
    if (byCode?.id) return byCode.id;
  }

  // 2. Tìm theo tên lớp (ví dụ: '1' hoặc '12 Toán 1')
  const targetName = (name || s).trim();
  if (targetName) {
    const { data: byName } = await supabase
      .from('classes')
      .select('id')
      .ilike('name', targetName)
      .maybeSingle();
    if (byName?.id) return byName.id;
  }

  // 3. Tìm kiếm mờ theo code
  if (s) {
    const { data: byLike } = await supabase
      .from('classes')
      .select('id')
      .ilike('code', `%${s}%`)
      .limit(1);
    if (byLike && byLike.length > 0) return byLike[0].id;
  }

  // 4. Nếu database chỉ có đúng 1 lớp duy nhất
  const { data: allClasses } = await supabase.from('classes').select('id').limit(2);
  if (allClasses && allClasses.length === 1) return allClasses[0].id;

  return null;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const classId = searchParams.get('classId');
    const userId = searchParams.get('userId');
    const emailParam = searchParams.get('email');
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
    if (userId || emailParam) {
      let targetUserId = resolveStudentUuid(userId, emailParam);

      // Tìm user ID nếu truyền vào email
      if (targetUserId.includes('@')) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('id')
          .ilike('email', targetUserId)
          .single();
        if (prof) targetUserId = prof.id;
      }

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(targetUserId) && emailParam) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('id')
          .ilike('email', emailParam.trim())
          .single();
        if (prof) targetUserId = prof.id;
      }

      let userMembers: any[] = [];
      if (uuidRegex.test(targetUserId)) {
        const { data: members, error: uErr } = await supabase
          .from('class_members')
          .select('class_id, status, classes(id, name, code)')
          .eq('user_id', targetUserId);

        if (uErr) {
          console.error('Supabase user members error:', uErr);
        } else if (members) {
          userMembers = members;
        }
      }

      const pendingClassesSet = new Set<string>();
      const approvedClassesSet = new Set<string>();

      userMembers.forEach((m: any) => {
        if (m.status === 'pending') {
          if (m.class_id) pendingClassesSet.add(m.class_id);
          if (m.classes?.id) pendingClassesSet.add(m.classes.id);
          if (m.classes?.code) pendingClassesSet.add(m.classes.code);
          if (m.classes?.name) pendingClassesSet.add(m.classes.name);
        } else if (m.status === 'active') {
          if (m.class_id) approvedClassesSet.add(m.class_id);
          if (m.classes?.id) approvedClassesSet.add(m.classes.id);
          if (m.classes?.code) approvedClassesSet.add(m.classes.code);
          if (m.classes?.name) approvedClassesSet.add(m.classes.name);
        }
      });

      return NextResponse.json({
        success: true,
        pendingClasses: Array.from(pendingClassesSet),
        approvedClasses: Array.from(approvedClassesSet),
      });
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
    const { action, classId, className, classCode, user, student, userId } = body;
    const supabase = getSupabaseAdmin();

    const targetClassId = await resolveClassUuid(supabase, classId, className, classCode);

    // 1. Học sinh xin vào lớp (chờ duyệt)
    if (action === 'request_join' || action === 'join_with_code') {
      const studentProfile = user || student;
      const targetUserId = resolveStudentUuid(studentProfile?.id || userId, studentProfile?.email);

      if (!targetClassId || !targetUserId) {
        return NextResponse.json({ success: false, error: 'Thiếu thông tin lớp hoặc học sinh' }, { status: 400 });
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
      const { data: existing } = await supabase
        .from('class_members')
        .select('id, status')
        .eq('class_id', targetClassId)
        .eq('user_id', targetUserId)
        .maybeSingle();

      let reqErr: any = null;
      if (existing) {
        if (existing.status !== 'active') {
          const { error } = await supabase
            .from('class_members')
            .update({ status: 'pending', joined_at: new Date().toISOString() })
            .eq('id', existing.id);
          reqErr = error;
        }
      } else {
        const { error } = await supabase.from('class_members').insert([
          {
            class_id: targetClassId,
            user_id: targetUserId,
            role: 'student',
            status: 'pending',
            joined_at: new Date().toISOString(),
          },
        ]);
        reqErr = error;
      }

      if (reqErr) {
        console.error('Request join error:', reqErr);
        return NextResponse.json({ success: false, error: reqErr.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: 'Đã gửi yêu cầu vào lớp chờ Thầy Sơn phê duyệt!' });
    }

    // 3. Thầy Sơn duyệt học sinh vào lớp
    if (action === 'approve_student') {
      const studentProfile = student || user;
      const targetUserId = resolveStudentUuid(studentProfile?.id || userId, studentProfile?.email);

      if (!targetClassId || !targetUserId) {
        return NextResponse.json({ success: false, error: 'Thiếu thông tin lớp hoặc học sinh' }, { status: 400 });
      }

      // Đảm bảo Profile đã tồn tại trong Supabase trước khi ghi vào class_members
      if (studentProfile) {
        try {
          await supabase.from('profiles').upsert([
            {
              id: targetUserId,
              email: (studentProfile.email || '').trim().toLowerCase() || `${targetUserId}@lms.vn`,
              full_name: studentProfile.full_name || 'Học sinh',
              role: 'student',
              grade: Number(studentProfile.grade) || 12,
              school_name: studentProfile.school_name || 'THPT Chuyên',
              phone: studentProfile.phone || '',
            },
          ]);
        } catch (e) {
          console.warn('Upsert profile notice:', e);
        }
      }

      const { data: existing } = await supabase
        .from('class_members')
        .select('id')
        .eq('class_id', targetClassId)
        .eq('user_id', targetUserId)
        .maybeSingle();

      let appErr: any = null;
      if (existing) {
        const { error } = await supabase
          .from('class_members')
          .update({ status: 'active', joined_at: new Date().toISOString() })
          .eq('id', existing.id);
        appErr = error;
      } else {
        const { error } = await supabase.from('class_members').upsert([
          {
            class_id: targetClassId,
            user_id: targetUserId,
            role: 'student',
            status: 'active',
            joined_at: new Date().toISOString(),
          },
        ], { onConflict: 'class_id,user_id' });
        appErr = error;
      }

      if (appErr) {
        console.error('Approve student cloud error:', appErr);
        return NextResponse.json({ success: false, error: appErr.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: 'Đã phê duyệt học sinh trên Supabase Cloud thành công!' });
    }

    // 4. Từ chối yêu cầu hoặc xóa học sinh khỏi lớp
    if (action === 'reject_student' || action === 'remove_student') {
      const targetUserId = resolveStudentUuid(userId, (student || user)?.email);

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
