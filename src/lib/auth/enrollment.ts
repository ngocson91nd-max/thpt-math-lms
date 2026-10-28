import { Profile, ClassItem, ClassMember, Exam } from '../../types/database';
import { MOCK_CLASSES, MOCK_CLASS_MEMBERS } from '../supabase/mockStore';

/**
 * Lấy danh sách ID các lớp học mà học sinh đã tham gia chính thức
 */
export const getEnrolledClassIdsForUser = (userId: string): string[] => {
  if (typeof window === 'undefined') {
    // SSR fallback: kiểm tra trong mock
    return MOCK_CLASS_MEMBERS
      .filter((m) => m.user_id === userId && m.status === 'active')
      .map((m) => m.class_id);
  }

  const enrolledSet = new Set<string>();

  // 1. Kiểm tra bộ nhớ cache riêng của học sinh
  try {
    const cached = localStorage.getItem(`lms_student_classes_${userId}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) {
        parsed.forEach((id) => enrolledSet.add(id));
      }
    }
  } catch (e) {
    console.error(e);
  }

  // 2. Kiểm tra danh sách thành viên trong từng lớp
  try {
    const savedDeletedCls = localStorage.getItem('lms_deleted_class_ids');
    const deletedClassIds = new Set<string>(savedDeletedCls ? JSON.parse(savedDeletedCls) : []);
    const classesRaw = localStorage.getItem('lms_classes');
    const localClasses: ClassItem[] = classesRaw ? JSON.parse(classesRaw) : [];
    const combinedClasses = [...localClasses];
    MOCK_CLASSES.forEach((mock) => {
      if (!combinedClasses.some((c) => c.id === mock.id || c.code?.toUpperCase() === mock.code?.toUpperCase())) {
        combinedClasses.push(mock);
      }
    });
    const classes: ClassItem[] = combinedClasses.filter(
      (c) => !deletedClassIds.has(c.id) && !deletedClassIds.has(c.code)
    );

    classes.forEach((c) => {
      const memRaw = localStorage.getItem(`lms_class_members_${c.id}`);
      if (memRaw) {
        const mems: ClassMember[] = JSON.parse(memRaw);
        if (mems.some((m) => m.user_id === userId && m.status === 'active')) {
          enrolledSet.add(c.id);
        }
      }
    });
  } catch (e) {
    console.error(e);
  }

  // 3. Fallback mock store cho các tài khoản mẫu (chỉ nạp nếu lớp chưa bị xóa vĩnh viễn)
  try {
    const savedDeletedCls = typeof window !== 'undefined' ? localStorage.getItem('lms_deleted_class_ids') : null;
    const deletedClassIds = new Set<string>(savedDeletedCls ? JSON.parse(savedDeletedCls) : []);
    MOCK_CLASS_MEMBERS.forEach((m) => {
      if (m.user_id === userId && m.status === 'active' && !deletedClassIds.has(m.class_id)) {
        enrolledSet.add(m.class_id);
      }
    });
  } catch {}

  return Array.from(enrolledSet);
};

/**
 * Kiểm tra xem người dùng có quyền xem nội dung hệ thống không:
 * - Admin và Giáo viên: Luôn luôn có quyền (true).
 * - Học sinh: BẮT BUỘC phải được add vào ít nhất 1 lớp học (true), nếu chưa vào lớp -> false.
 */
export const isUserEnrolledInAnyClass = (user: Profile | null): boolean => {
  if (!user) return false;
  if (user.role === 'admin' || user.role === 'teacher') return true;
  const enrolledIds = getEnrolledClassIdsForUser(user.id);
  return enrolledIds.length > 0;
};

/**
 * Lấy danh sách ID các lớp mà học sinh đang gửi yêu cầu chờ duyệt
 */
export const getPendingClassRequestsForUser = (userId: string): string[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`lms_user_pending_requests_${userId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

/**
 * Học sinh gửi yêu cầu xin vào lớp học của Thầy Sơn
 */
export const requestToJoinClass = (user: Profile, classId: string): { success: boolean; message: string } => {
  if (typeof window === 'undefined') return { success: false, message: 'Thao tác không khả dụng' };

  try {
    // 1. Lưu vào danh sách chờ của lớp
    const classPendingKey = `lms_class_pending_requests_${classId}`;
    const existingClassPending: any[] = JSON.parse(localStorage.getItem(classPendingKey) || '[]');
    if (!existingClassPending.some((p) => p.user_id === user.id)) {
      existingClassPending.push({
        id: `req-${Date.now()}`,
        class_id: classId,
        user_id: user.id,
        user,
        requested_at: new Date().toISOString(),
        status: 'pending',
      });
      localStorage.setItem(classPendingKey, JSON.stringify(existingClassPending));
    }

    // 2. Lưu vào danh sách chờ của học sinh
    const userPendingKey = `lms_user_pending_requests_${user.id}`;
    const userPending: string[] = JSON.parse(localStorage.getItem(userPendingKey) || '[]');
    if (!userPending.includes(classId)) {
      userPending.push(classId);
      localStorage.setItem(userPendingKey, JSON.stringify(userPending));
    }

    // Phát event để giao diện cập nhật ngay
    window.dispatchEvent(new Event('lms_enrollment_changed'));

    return { success: true, message: 'Đã gửi yêu cầu vào lớp. Thầy Sơn sẽ phê duyệt cho em sớm nhất!' };
  } catch (err) {
    return { success: false, message: 'Có lỗi xảy ra khi gửi yêu cầu.' };
  }
};

/**
 * Học sinh nhập Mã Lớp Học (Class Code) do Thầy Sơn cấp để tự kích hoạt và vào lớp ngay tức thì
 */
export const joinClassWithCode = (
  user: Profile,
  code: string
): { success: boolean; message: string; classItem?: ClassItem } => {
  if (typeof window === 'undefined') return { success: false, message: 'Thao tác không khả dụng' };

  const cleanCode = code.trim().toUpperCase();
  if (!cleanCode) return { success: false, message: 'Vui lòng nhập mã lớp học!' };

  try {
    const savedDeletedCls = localStorage.getItem('lms_deleted_class_ids');
    const deletedClassIds = new Set<string>(savedDeletedCls ? JSON.parse(savedDeletedCls) : []);

    // Hợp nhất lms_classes từ localStorage và MOCK_CLASSES
    const classesRaw = localStorage.getItem('lms_classes');
    const localClasses: ClassItem[] = classesRaw ? JSON.parse(classesRaw) : [];
    const combinedClasses = [...localClasses];
    MOCK_CLASSES.forEach((mock) => {
      if (!combinedClasses.some((c) => c.id === mock.id || c.code?.toUpperCase() === mock.code?.toUpperCase())) {
        combinedClasses.push(mock);
      }
    });

    const classes: ClassItem[] = combinedClasses.filter(
      (c) => !deletedClassIds.has(c.id) && !deletedClassIds.has(c.code)
    );

    // Tìm lớp theo mã code, id, hoặc mã số có chứa 2150 / 1665
    let foundClass = classes.find(
      (c) =>
        c.code?.trim().toUpperCase() === cleanCode ||
        c.id?.trim().toUpperCase() === cleanCode ||
        (cleanCode.includes('2150') && (c.code?.includes('2150') || c.id?.includes('2150'))) ||
        (cleanCode.includes('1665') && (c.code?.includes('1665') || c.id?.includes('1665')))
    );

    // Dự phòng chuẩn cho lớp TOAN12-2150 nếu chưa kịp ghi vào local cache
    if (!foundClass && cleanCode.includes('2150')) {
      foundClass = {
        id: 'f3750ff9-ca79-4fcd-a5d1-d73b84b84f36',
        name: '1',
        code: 'TOAN12-2150',
        grade: 12,
        academic_year: '2025-2026',
        teacher_id: '11111111-1111-1111-1111-111111111111',
        description: 'Lớp bồi dưỡng và luyện thi THPT Thầy Sơn.',
        is_active: true,
        member_count: 0,
      };
      combinedClasses.push(foundClass);
      localStorage.setItem('lms_classes', JSON.stringify(combinedClasses));
    }

    // Dự phòng chuẩn cho lớp TOAN12-1665
    if (!foundClass && cleanCode.includes('1665')) {
      foundClass = {
        id: '50fac48d-0674-4269-b84e-a653ec3c8c6a',
        name: '12 Toán (TOAN12-1665)',
        code: 'TOAN12-1665',
        grade: 12,
        academic_year: '2025-2026',
        teacher_id: '11111111-1111-1111-1111-111111111111',
        description: 'Lớp Toán 12 Thầy Sơn - Mã lớp TOAN12-1665.',
        is_active: true,
        member_count: 0,
      };
      combinedClasses.push(foundClass);
      localStorage.setItem('lms_classes', JSON.stringify(combinedClasses));
    }

    if (!foundClass) {
      return { success: false, message: `Không tìm thấy lớp học có mã "${cleanCode}". Em vui lòng kiểm tra lại!` };
    }

    // 1. Thêm học sinh vào danh sách thành viên của lớp
    const memKey = `lms_class_members_${foundClass.id}`;
    const existingMems: ClassMember[] = JSON.parse(localStorage.getItem(memKey) || '[]');

    const alreadyMember = existingMems.find((m) => m.user_id === user.id);
    if (!alreadyMember) {
      existingMems.push({
        id: `cm-${Date.now()}`,
        class_id: foundClass.id,
        user_id: user.id,
        role: 'student',
        status: 'active',
        joined_at: new Date().toISOString(),
        profile: user,
        student: user,
      });
      localStorage.setItem(memKey, JSON.stringify(existingMems));
    } else {
      alreadyMember.status = 'active';
      localStorage.setItem(memKey, JSON.stringify(existingMems));
    }

    // 2. Cập nhật danh sách lớp của học sinh
    const studentClassesKey = `lms_student_classes_${user.id}`;
    const studentClasses: string[] = JSON.parse(localStorage.getItem(studentClassesKey) || '[]');
    if (!studentClasses.includes(foundClass.id)) {
      studentClasses.push(foundClass.id);
      localStorage.setItem(studentClassesKey, JSON.stringify(studentClasses));
    }

    // 3. Đồng bộ lên Cloud API để giáo viên ở bất kỳ máy nào cũng thấy học sinh đã vào lớp
    fetch('/api/cloud-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'approve_student',
        classId: foundClass.id,
        student: user,
        userId: user.id,
      }),
    }).catch(console.error);

    // 4. Xóa khỏi danh sách chờ nếu có
    const userPendingKey = `lms_user_pending_requests_${user.id}`;
    const userPending: string[] = JSON.parse(localStorage.getItem(userPendingKey) || '[]');
    const filteredPending = userPending.filter((id) => id !== foundClass.id);
    localStorage.setItem(userPendingKey, JSON.stringify(filteredPending));

    // Phát event để AppLayout mở khóa ngay
    window.dispatchEvent(new Event('lms_enrollment_changed'));

    return {
      success: true,
      message: `Chúc mừng em đã tham gia thành công "${foundClass.name}"!`,
      classItem: foundClass,
    };
  } catch (err) {
    return { success: false, message: 'Lỗi trong quá trình tham gia lớp học.' };
  }
};

/**
 * Thầy Sơn duyệt học sinh vào lớp từ danh sách chờ
 */
export const approveStudentJoinRequest = (
  classId: string,
  student: Profile
): { success: boolean; message: string } => {
  if (typeof window === 'undefined') return { success: false, message: 'Thao tác không khả dụng' };

  try {
    // 1. Thêm học sinh vào thành viên lớp
    const memKey = `lms_class_members_${classId}`;
    const existingMems: ClassMember[] = JSON.parse(localStorage.getItem(memKey) || '[]');
    if (!existingMems.some((m) => m.user_id === student.id)) {
      existingMems.push({
        id: `cm-${Date.now()}`,
        class_id: classId,
        user_id: student.id,
        role: 'student',
        status: 'active',
        joined_at: new Date().toISOString(),
        profile: student,
        student,
      });
      localStorage.setItem(memKey, JSON.stringify(existingMems));
    }

    // 2. Cập nhật cache của học sinh
    const studentClassesKey = `lms_student_classes_${student.id}`;
    const studentClasses: string[] = JSON.parse(localStorage.getItem(studentClassesKey) || '[]');
    if (!studentClasses.includes(classId)) {
      studentClasses.push(classId);
      localStorage.setItem(studentClassesKey, JSON.stringify(studentClasses));
    }

    // 3. Xóa khỏi danh sách chờ của lớp
    const classPendingKey = `lms_class_pending_requests_${classId}`;
    const classPending: any[] = JSON.parse(localStorage.getItem(classPendingKey) || '[]');
    const updatedClassPending = classPending.filter((p) => p.user_id !== student.id);
    localStorage.setItem(classPendingKey, JSON.stringify(updatedClassPending));

    // 4. Xóa khỏi danh sách chờ của học sinh
    const userPendingKey = `lms_user_pending_requests_${student.id}`;
    const userPending: string[] = JSON.parse(localStorage.getItem(userPendingKey) || '[]');
    const updatedUserPending = userPending.filter((id) => id !== classId);
    localStorage.setItem(userPendingKey, JSON.stringify(updatedUserPending));

    // Phát event thông báo
    window.dispatchEvent(new Event('lms_enrollment_changed'));

    return { success: true, message: `Đã duyệt học sinh ${student.full_name} vào lớp!` };
  } catch (err) {
    return { success: false, message: 'Có lỗi xảy ra khi duyệt học sinh.' };
  }
};

/**
 * Thầy Sơn xóa hoặc từ chối yêu cầu xin vào lớp
 */
export const rejectStudentJoinRequest = (classId: string, studentId: string): { success: boolean } => {
  if (typeof window === 'undefined') return { success: false };

  try {
    const classPendingKey = `lms_class_pending_requests_${classId}`;
    const classPending: any[] = JSON.parse(localStorage.getItem(classPendingKey) || '[]');
    const updated = classPending.filter((p) => p.user_id !== studentId);
    localStorage.setItem(classPendingKey, JSON.stringify(updated));

    const userPendingKey = `lms_user_pending_requests_${studentId}`;
    const userPending: string[] = JSON.parse(localStorage.getItem(userPendingKey) || '[]');
    localStorage.setItem(userPendingKey, JSON.stringify(userPending.filter((id) => id !== classId)));

    window.dispatchEvent(new Event('lms_enrollment_changed'));
    return { success: true };
  } catch {
    return { success: false };
  }
};

/**
 * Kiểm tra xem học sinh có quyền xem và làm đề thi này không:
 * - Đề 'public': Mọi học sinh đều xem và làm bài được.
 * - Đề 'restricted': Học sinh BẮT BUỘC phải là thành viên chính thức của ít nhất một lớp được phân công.
 */
export const isExamPermittedForStudent = (
  exam: Exam,
  studentId?: string,
  allClasses: ClassItem[] = []
): boolean => {
  if (exam.access_type === 'public') return true;
  if (!studentId) return false;

  const enrolledIds = getEnrolledClassIdsForUser(studentId);
  if (enrolledIds.length === 0) return false;

  const enrolledNames = allClasses
    .filter((c) => enrolledIds.includes(c.id))
    .map((c) => c.name.trim().toLowerCase());

  if (exam.class_id && enrolledIds.includes(exam.class_id)) return true;
  if (exam.class_name && enrolledNames.includes(exam.class_name.trim().toLowerCase())) return true;

  if (Array.isArray(exam.assigned_classes) && exam.assigned_classes.length > 0) {
    return exam.assigned_classes.some((cls) => enrolledNames.includes(cls.trim().toLowerCase()));
  }

  return false;
};
