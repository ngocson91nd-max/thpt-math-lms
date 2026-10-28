import { Profile, ClassItem, ClassMember, Exam } from '../../types/database';
import { MOCK_CLASSES, MOCK_CLASS_MEMBERS } from '../supabase/mockStore';

/**
 * Lấy danh sách ID các lớp học mà học sinh đã tham gia chính thức
 * CHỈ CHẤP NHẬN các lớp học HIỆN HỮU và ĐANG HOẠT ĐỘNG trên hệ thống
 */
export const getEnrolledClassIdsForUser = (userId: string): string[] => {
  if (!userId) {
    return [];
  }

  const storage = typeof window !== 'undefined' ? window.localStorage : (globalThis as any).localStorage;
  if (!storage) {
    return [];
  }

  // 1. Lấy danh sách các lớp học hiện có thực tế trên hệ thống (từ lms_classes)
  const classesRaw = storage.getItem('lms_classes');
  const activeClasses: ClassItem[] = classesRaw ? JSON.parse(classesRaw) : [];

  // Nếu hệ thống hiện chưa có lớp nào -> học sinh không thể thuộc về bất kỳ lớp nào!
  if (activeClasses.length === 0) {
    return [];
  }

  const activeClassIdSet = new Set<string>(activeClasses.map((c) => c.id));
  const enrolledSet = new Set<string>();

  // 2. Kiểm tra bộ nhớ cache riêng của học sinh (CHỈ chấp nhận các lớp ID ĐANG TỒN TẠI thực tế)
  try {
    const cached = storage.getItem(`lms_student_classes_${userId}`);
    if (cached) {
      const parsed: string[] = JSON.parse(cached);
      if (Array.isArray(parsed)) {
        // Lọc bỏ toàn bộ các lớp đã bị xóa trên Cloud
        const validParsed = parsed.filter((id) => activeClassIdSet.has(id));
        validParsed.forEach((id) => enrolledSet.add(id));
        // Tự động dọn dẹp cache trình duyệt nếu có lớp rác / lớp đã bị xóa
        if (validParsed.length !== parsed.length) {
          storage.setItem(`lms_student_classes_${userId}`, JSON.stringify(validParsed));
        }
      }
    }
  } catch (e) {
    console.error(e);
  }

  // 3. Kiểm tra danh sách thành viên trong từng lớp hiện hữu
  try {
    activeClasses.forEach((c) => {
      const memRaw = storage.getItem(`lms_class_members_${c.id}`);
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

  return Array.from(enrolledSet);
};

/**
 * Kiểm tra xem người dùng có quyền xem nội dung hệ thống không:
 * - Admin và Giáo viên: Luôn luôn có quyền (true).
 * - Học sinh: BẮT BUỘC phải được add vào ít nhất 1 lớp học THỰC TẾ ĐANG TỒN TẠI (true), nếu chưa vào lớp -> false.
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
  if (typeof window === 'undefined' || !userId) return [];
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
export const requestToJoinClass = (
  user: Profile,
  classId: string
): { success: boolean; message: string } => {
  if (typeof window === 'undefined') return { success: false, message: 'Thao tác không khả dụng' };

  try {
    // 1. Cập nhật danh sách yêu cầu của học sinh
    const userPendingKey = `lms_user_pending_requests_${user.id}`;
    const userPending: string[] = JSON.parse(localStorage.getItem(userPendingKey) || '[]');
    if (!userPending.includes(classId)) {
      userPending.push(classId);
      localStorage.setItem(userPendingKey, JSON.stringify(userPending));
    }

    // 2. Thêm vào danh sách chờ duyệt của lớp
    const classPendingKey = `lms_class_pending_requests_${classId}`;
    const classPending: any[] = JSON.parse(localStorage.getItem(classPendingKey) || '[]');
    const alreadyExists = classPending.find((p) => p.user_id === user.id);
    if (!alreadyExists) {
      classPending.push({
        id: `req-${Date.now()}`,
        class_id: classId,
        user_id: user.id,
        user: {
          id: user.id,
          full_name: user.full_name || 'Học sinh',
          email: user.email,
          role: 'student',
          grade: user.grade || 12,
          school_name: user.school_name || 'THPT Chuyên',
        },
        status: 'pending',
        requested_at: new Date().toISOString(),
      });
      localStorage.setItem(classPendingKey, JSON.stringify(classPending));
    }

    // Đồng bộ lên Cloud
    fetch('/api/cloud-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'request_join',
        classId,
        user,
      }),
    }).catch(console.error);

    return {
      success: true,
      message: 'Đã gửi yêu cầu vào lớp! Vui lòng chờ Thầy Sơn phê duyệt trong nhóm lớp.',
    };
  } catch (err) {
    return { success: false, message: 'Có lỗi xảy ra khi gửi yêu cầu.' };
  }
};

/**
 * Học sinh nhập mã lớp để vào thẳng lớp học (khi Thầy phát mã)
 */
export const joinClassWithCode = (
  user: Profile,
  code: string
): { success: boolean; message: string; classItem?: ClassItem } => {
  if (typeof window === 'undefined') return { success: false, message: 'Thao tác không khả dụng' };

  const cleanCode = code.trim().toUpperCase();
  if (!cleanCode) return { success: false, message: 'Vui lòng nhập mã lớp học!' };

  try {
    const classesRaw = localStorage.getItem('lms_classes');
    const classes: ClassItem[] = classesRaw ? JSON.parse(classesRaw) : [];

    // Tìm lớp theo mã code hoặc id
    const foundClass = classes.find(
      (c) =>
        c.code?.trim().toUpperCase() === cleanCode ||
        c.id?.trim().toUpperCase() === cleanCode
    );

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
      });
      localStorage.setItem(memKey, JSON.stringify(existingMems));
    }

    // 2. Thêm vào cache các lớp học đã tham gia của học sinh
    const studentClassesKey = `lms_student_classes_${user.id}`;
    const enrolledClasses: string[] = JSON.parse(localStorage.getItem(studentClassesKey) || '[]');
    if (!enrolledClasses.includes(foundClass.id)) {
      enrolledClasses.push(foundClass.id);
      localStorage.setItem(studentClassesKey, JSON.stringify(enrolledClasses));
    }

    // 3. Xóa khỏi danh sách chờ duyệt nếu có
    const userPendingKey = `lms_user_pending_requests_${user.id}`;
    const userPending: string[] = JSON.parse(localStorage.getItem(userPendingKey) || '[]');
    localStorage.setItem(
      userPendingKey,
      JSON.stringify(userPending.filter((id) => id !== foundClass.id))
    );

    // 4. Đồng bộ ngay lập tức lên Supabase Cloud
    fetch('/api/cloud-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'join_with_code',
        classId: foundClass.id,
        user,
      }),
    }).catch(console.error);

    // Phát event thông báo trạng thái
    window.dispatchEvent(new Event('lms_enrollment_changed'));

    return {
      success: true,
      message: `Chào mừng em đã vào lớp "${foundClass.name}" thành công!`,
      classItem: foundClass,
    };
  } catch (err) {
    return { success: false, message: 'Có lỗi xảy ra khi tham gia lớp học.' };
  }
};

/**
 * Thầy Sơn duyệt học sinh vào lớp (Admin Action)
 */
export const approveStudentJoinRequest = (
  classId: string,
  student: Profile
): { success: boolean; message: string } => {
  if (typeof window === 'undefined') return { success: false, message: 'Thao tác không khả dụng' };

  try {
    // 1. Thêm học sinh vào danh sách thành viên chính thức của lớp
    const classMemKey = `lms_class_members_${classId}`;
    const members: ClassMember[] = JSON.parse(localStorage.getItem(classMemKey) || '[]');
    const exists = members.find((m) => m.user_id === student.id);
    if (!exists) {
      members.push({
        id: `cm-${Date.now()}`,
        class_id: classId,
        user_id: student.id,
        role: 'student',
        status: 'active',
        joined_at: new Date().toISOString(),
        profile: student,
      });
      localStorage.setItem(classMemKey, JSON.stringify(members));
    }

    // 2. Thêm vào danh sách lớp đã tham gia của học sinh
    const studentClassesKey = `lms_student_classes_${student.id}`;
    const enrolledClasses: string[] = JSON.parse(localStorage.getItem(studentClassesKey) || '[]');
    if (!enrolledClasses.includes(classId)) {
      enrolledClasses.push(classId);
      localStorage.setItem(studentClassesKey, JSON.stringify(enrolledClasses));
    }

    // 3. Xóa khỏi danh sách chờ duyệt của lớp
    const classPendingKey = `lms_class_pending_requests_${classId}`;
    const classPending: any[] = JSON.parse(localStorage.getItem(classPendingKey) || '[]');
    const updatedClassPending = classPending.filter((p) => p.user_id !== student.id);
    localStorage.setItem(classPendingKey, JSON.stringify(updatedClassPending));

    // 4. Xóa khỏi danh sách chờ duyệt của học sinh
    const userPendingKey = `lms_user_pending_requests_${student.id}`;
    const userPending: string[] = JSON.parse(localStorage.getItem(userPendingKey) || '[]');
    const updatedUserPending = userPending.filter((id) => id !== classId);
    localStorage.setItem(userPendingKey, JSON.stringify(updatedUserPending));

    // Đồng bộ lên Cloud
    fetch('/api/cloud-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'approve_student',
        classId,
        student,
      }),
    }).catch(console.error);

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
 * NGUYÊN TẮC BẤT DI BẤT DỊCH:
 * - Học sinh CHƯA VÀO LỚP (enrolledIds.length === 0) -> TUYỆT ĐỐI KHÔNG THẤY BẤT KỲ ĐỀ THI NÀO (kể cả đề công khai)!
 * - Học sinh ĐÃ ĐƯỢC DUYỆT VÀO LỚP:
 *   + Đề 'public' -> Xem được.
 *   + Đề 'restricted' -> Phải khớp với lớp học của học sinh.
 */
export const isExamPermittedForStudent = (
  exam: Exam,
  studentId?: string,
  allClasses: ClassItem[] = []
): boolean => {
  if (!studentId) return false;

  // BƯỚC 1: Kiểm tra học sinh đã vào lớp nào chưa
  const enrolledIds = getEnrolledClassIdsForUser(studentId);
  if (enrolledIds.length === 0) {
    // CHƯA VÀO LỚP -> CHẶN 100%!
    return false;
  }

  // BƯỚC 2: Khi học sinh đã vào lớp, nếu đề thi là 'public' -> Cho phép xem
  if (exam.access_type === 'public') {
    return true;
  }

  // BƯỚC 3: Đề thi giới hạn lớp -> Học sinh phải thuộc đúng lớp được phân công
  const enrolledClasses = allClasses.filter((c) => enrolledIds.includes(c.id));
  const enrolledNames = enrolledClasses.map((c) => c.name.trim().toLowerCase());
  const enrolledCodes = enrolledClasses.map((c) => c.code?.trim().toLowerCase()).filter(Boolean) as string[];

  if (exam.class_id && enrolledIds.includes(exam.class_id)) return true;
  if (
    exam.class_name &&
    (enrolledNames.includes(exam.class_name.trim().toLowerCase()) ||
      enrolledCodes.includes(exam.class_name.trim().toLowerCase()))
  ) {
    return true;
  }

  if (Array.isArray(exam.assigned_classes) && exam.assigned_classes.length > 0) {
    return exam.assigned_classes.some((cls) => {
      const cleanCls = cls.trim().toLowerCase();
      return enrolledNames.includes(cleanCls) || enrolledCodes.includes(cleanCls);
    });
  }

  // Nếu đề không công khai và không được phân công cho lớp của học sinh -> Chặn
  return false;
};
