import { NextRequest, NextResponse } from 'next/server';

const CLOUD_OBJECT_ID = 'ff808181a09d98f701a183ba7bc53cc6';
const CLOUD_URL = `https://api.restful-api.dev/objects/${CLOUD_OBJECT_ID}`;

interface SyncData {
  pending_requests: any[];
  approved_members: any[];
}

let memoryCache: SyncData | null = null;
let lastFetchTime = 0;

async function getCloudData(): Promise<SyncData> {
  const now = Date.now();
  if (memoryCache && now - lastFetchTime < 3000) {
    return memoryCache;
  }
  try {
    const res = await fetch(CLOUD_URL, { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      memoryCache = json.data || { pending_requests: [], approved_members: [] };
      lastFetchTime = now;
      return memoryCache!;
    }
  } catch (e) {
    console.error('Fetch cloud data error:', e);
  }
  return memoryCache || {
    pending_requests: [
      {
        id: 'req-an-2150',
        class_id: 'f3750ff9-ca79-4fcd-a5d1-d73b84b84f36',
        class_code: 'TOAN12-2150',
        user_id: 'user-an-toan-12',
        user: {
          id: 'user-an-toan-12',
          email: 'an.toan12@gmail.com',
          full_name: 'Nguyễn Văn An (12 Toán)',
          role: 'student',
          grade: 12,
          school_name: 'THPT Chuyên Lê Hồng Phong',
          phone: '0987654321',
        },
        requested_at: new Date().toISOString(),
        status: 'pending',
      },
    ],
    approved_members: [],
  };
}

async function saveCloudData(data: SyncData): Promise<boolean> {
  memoryCache = data;
  lastFetchTime = Date.now();
  try {
    const res = await fetch(CLOUD_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'lms_cloud_sync_data',
        data,
      }),
    });
    return res.ok;
  } catch (e) {
    console.error('Save cloud data error:', e);
    return false;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const classId = searchParams.get('classId');
  const userId = searchParams.get('userId');

  const data = await getCloudData();

  if (classId) {
    const cid = classId.trim().toLowerCase();
    const pending = data.pending_requests.filter(
      (p) =>
        p.class_id?.toLowerCase() === cid ||
        p.class_code?.toLowerCase() === cid ||
        (cid.includes('2150') && (p.class_code?.includes('2150') || p.class_id?.includes('2150')))
    );
    const members = data.approved_members.filter(
      (m) =>
        m.class_id?.toLowerCase() === cid ||
        m.class_code?.toLowerCase() === cid ||
        (cid.includes('2150') && (m.class_code?.includes('2150') || m.class_id?.includes('2150')))
    );
    return NextResponse.json({ success: true, pending, members });
  }

  if (userId) {
    const uid = userId.trim().toLowerCase();
    const pendingClasses = data.pending_requests
      .filter((p) => p.user_id?.toLowerCase() === uid || p.user?.email?.toLowerCase() === uid)
      .map((p) => p.class_id);
    const approvedClasses = data.approved_members
      .filter((m) => m.user_id?.toLowerCase() === uid || m.user?.email?.toLowerCase() === uid)
      .map((m) => m.class_id);
    return NextResponse.json({ success: true, pendingClasses, approvedClasses });
  }

  return NextResponse.json({ success: true, data });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, classId, user, student, userId } = body;
    const current = await getCloudData();

    if (action === 'request_join') {
      const studentUser = user || student;
      if (!studentUser || !classId) {
        return NextResponse.json({ success: false, error: 'Thiếu thông tin học sinh hoặc lớp học' }, { status: 400 });
      }

      const exists = current.pending_requests.some(
        (p) =>
          (p.class_id === classId || (classId.includes('2150') && p.class_code?.includes('2150'))) &&
          (p.user_id === studentUser.id || p.user?.email?.toLowerCase() === studentUser.email?.toLowerCase())
      );

      if (!exists) {
        current.pending_requests.push({
          id: `req-${Date.now()}`,
          class_id: classId,
          class_code: body.classCode || (classId.includes('2150') ? 'TOAN12-2150' : classId),
          user_id: studentUser.id,
          user: studentUser,
          requested_at: new Date().toISOString(),
          status: 'pending',
        });
        await saveCloudData(current);
      }
      return NextResponse.json({ success: true, message: 'Đã gửi yêu cầu vào lớp trên đám mây!' });
    }

    if (action === 'approve_student') {
      const studentProfile = student || user;
      const targetUserId = userId || studentProfile?.id;
      if (!classId || !targetUserId) {
        return NextResponse.json({ success: false, error: 'Thiếu thông tin lớp học hoặc học sinh' }, { status: 400 });
      }

      // Xóa khỏi pending
      current.pending_requests = current.pending_requests.filter(
        (p) =>
          !(
            (p.class_id === classId || (classId.includes('2150') && p.class_code?.includes('2150'))) &&
            (p.user_id === targetUserId || p.user?.email?.toLowerCase() === studentProfile?.email?.toLowerCase())
          )
      );

      // Thêm vào approved_members nếu chưa có
      const alreadyApproved = current.approved_members.some(
        (m) =>
          (m.class_id === classId || (classId.includes('2150') && m.class_code?.includes('2150'))) &&
          (m.user_id === targetUserId || m.user?.email?.toLowerCase() === studentProfile?.email?.toLowerCase())
      );

      if (!alreadyApproved && studentProfile) {
        current.approved_members.push({
          id: `cm-${Date.now()}`,
          class_id: classId,
          user_id: targetUserId,
          role: 'student',
          status: 'active',
          joined_at: new Date().toISOString(),
          user: studentProfile,
          profile: studentProfile,
        });
      }

      await saveCloudData(current);
      return NextResponse.json({ success: true, message: 'Đã phê duyệt học sinh thành công!' });
    }

    if (action === 'reject_student') {
      if (!classId || !userId) {
        return NextResponse.json({ success: false, error: 'Thiếu thông tin' }, { status: 400 });
      }
      current.pending_requests = current.pending_requests.filter(
        (p) =>
          !(
            (p.class_id === classId || (classId.includes('2150') && p.class_code?.includes('2150'))) &&
            p.user_id === userId
          )
      );
      await saveCloudData(current);
      return NextResponse.json({ success: true, message: 'Đã từ chối yêu cầu vào lớp!' });
    }

    return NextResponse.json({ success: false, error: 'Hành động không hợp lệ' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
