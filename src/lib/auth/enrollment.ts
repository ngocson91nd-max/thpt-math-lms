import { Profile, ClassItem, ClassMember, Exam } from '../../types/database';
import { MOCK_CLASSES, MOCK_CLASS_MEMBERS } from '../supabase/mockStore';

/**
 * Lấy danh sách ID các lớp học mà học sinh đã tham gia chính thức
 * CHỈ CHẤP NHẬN các lớp học HIỆN HỮU và ĐANG HOẠT ĐỘNG trên hệ thống
 * Hỗ trợ nhận diện qua cả ID học sinh và Email đăng nhập
 */
export const getEnrolledClassIdsForUser = (userId: string, userEmail?: string): string[] => {
  if (!userId && !userEmail) {
    return [];
  }

  const storage = typeof window !== 'undefined' ? window.localStorage : (globalThis as any).localStorage;
  if (!storage) {
    return [];
  }

  const cleanEmail = (userEmail || '').trim().toLowerCase();

  // 1. Lấy danh sách các lớp học hiện có thực tế trên hệ thống (từ lms_classes)
  const classesRaw = storage.getItem('lms_classes');
  const activeClasses: ClassItem[] = classesRaw ? JSON.parse(classesRaw) : [];
  const activeClassIdSet = new Set<string>(activeClasses.map((c) => c.id));
  const enrolledSet = new Set<string>();

  // 1.1 Lấy danh sách các lớp ĐÃ ĐƯỢC DUYỆT CHÍNH THỨC từ Cloud / Thầy Sơn
  const approvedCacheKeys = [
    userId ? `lms_student_classes_${userId}` : null,
    cleanEmail ? `lms_student_classes_${cleanEmail}` : null,
  ].filter(Boolean) as string[];

  const explicitlyApprovedIds = new Set<string>();
  approvedCacheKeys.forEach((key) => {
    try {
      const raw = storage.getItem(key);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          arr.forEach((id: string) => {
            if (id) explicitlyApprovedIds.add(id);
          });
        }
      }
    } catch {}
  });

  // Nếu đã được duyệt bất kỳ lớp nào -> Thêm ngay vào enrolledSet
  explicitlyApprovedIds.forEach((id) => {
    enrolledSet.add(id);
  });

  // Danh sách các lớp học sinh đang CHỜ DUYỆT (bắt buộc phải loại trừ các lớp ĐÃ ĐƯỢC DUYỆT)
  const pendingClassIds = new Set<string>();
  try {
    if (userId) {
      const userPendingRaw = storage.getItem(`lms_user_pending_requests_${userId}`);
      if (userPendingRaw) {
        const uPend: string[] = JSON.parse(userPendingRaw);
        if (Array.isArray(uPend)) {
          uPend.forEach((id) => {
            // Nếu lớp này đã được duyệt -> Bỏ qua, không coi là pending nữa
            if (!explicitlyApprovedIds.has(id)) {
              pendingClassIds.add(id);
            }
          });
        }
      }
    }
    activeClasses.forEach((c) => {
      // Nếu lớp đã được duyệt thì dọn sạch pending rác cũ
      if (explicitlyApprovedIds.has(c.id) || explicitlyApprovedIds.has(c.code)) {
        return;
      }

      const classPendingRaw = storage.getItem(`lms_class_pending_requests_${c.id}`);
      if (classPendingRaw) {
        const cPend: any[] = JSON.parse(classPendingRaw);
        if (Array.isArray(cPend)) {
          const isPendingInClass = cPend.some(
            (p) =>
              (userId && p.user_id === userId) ||
              (cleanEmail && p.user?.email && p.user.email.trim().toLowerCase() === cleanEmail)
          );
          if (isPendingInClass) {
            pendingClassIds.add(c.id);
          }
        }
      }
    });
  } catch (e) {
    console.error(e);
  }

  // 2. Kiểm tra danh sách thành viên trong từng lớp hiện hữu (NGUỒN SỰ THẬT CHÍNH THỨC)
  try {
    activeClasses.forEach((c) => {
      // Nếu đang trong danh sách chờ duyệt -> Tuyệt đối không tính là đã vào lớp
      if (pendingClassIds.has(c.id)) {
        return;
      }

      const memRaw = storage.getItem(`lms_class_members_${c.id}`);
      if (memRaw) {
        const mems: ClassMember[] = JSON.parse(memRaw);
        const activeMember = mems.find((m) => {
          if (m.status !== 'active') return false;
          if (userId && m.user_id === userId) return true;
          if (cleanEmail && m.profile?.email && m.profile.email.trim().toLowerCase() === cleanEmail) return true;
          return false;
        });
        if (activeMember) {
          enrolledSet.add(c.id);
        }
      }
    });
  } catch (e) {
    console.error(e);
  }

  // 3. Đối chiếu thêm với cache lms_student_classes_ nhưng PHẢI đảm bảo lớp đó không bị pending
  const checkCachedKeys = [
    userId ? `lms_student_classes_${userId}` : null,
    cleanEmail ? `lms_student_classes_${cleanEmail}` : null,
  ].filter(Boolean) as string[];

  checkCachedKeys.forEach((key) => {
    try {
      const cached = storage.getItem(key);
      if (cached) {
        const parsed: string[] = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          parsed.forEach((id) => {
            // Chỉ thêm nếu là lớp đang tồn tại và KHÔNG nằm trong danh sách chờ duyệt
            if (activeClasses.length > 0) {
              if (activeClassIdSet.has(id) && !pendingClassIds.has(id)) {
                // Kiểm tra thêm: nếu lớp này có cache thành viên mà học sinh không active thì xóa
                const memRaw = storage.getItem(`lms_class_members_${id}`);
                if (memRaw) {
                  const mems: ClassMember[] = JSON.parse(memRaw);
                  const isAct = mems.some(
                    (m) =>
                      m.status === 'active' &&
                      ((userId && m.user_id === userId) ||
                        (cleanEmail && m.profile?.email?.toLowerCase() === cleanEmail))
                  );
                  if (isAct) enrolledSet.add(id);
                } else {
                  enrolledSet.add(id);
                }
              }
            } else if (!pendingClassIds.has(id)) {
              enrolledSet.add(id);
            }
          });
        }
      }
    } catch (e) {
      console.error(e);
    }
  });

  // 4. Loại bỏ các lớp thực sự đang chờ duyệt (nếu lớp đã được Thầy duyệt thì giữ nguyên)
  pendingClassIds.forEach((id) => {
    if (!explicitlyApprovedIds.has(id)) {
      enrolledSet.delete(id);
    }
  });

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
  const enrolledIds = getEnrolledClassIdsForUser(user.id, user.email);
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
 * Học sinh nhập mã lớp để gửi yêu cầu xin vào lớp học (bắt buộc Thầy Sơn phê duyệt)
 */
export const joinClassWithCode = (
  user: Profile,
  code: string
): { success: boolean; message: string; classItem?: ClassItem; pending?: boolean } => {
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

    // Kiểm tra xem em đã là thành viên chính thức chưa
    const memKey = `lms_class_members_${foundClass.id}`;
    const existingMems: ClassMember[] = JSON.parse(localStorage.getItem(memKey) || '[]');
    const isAlreadyActive = existingMems.some(
      (m) =>
        m.status === 'active' &&
        (m.user_id === user.id || (user.email && m.profile?.email?.toLowerCase() === user.email.toLowerCase()))
    );
    if (isAlreadyActive) {
      return {
        success: true,
        pending: false,
        message: `Em đã là thành viên chính thức của lớp "${foundClass.name}" rồi!`,
        classItem: foundClass,
      };
    }

    // 0. Nếu lớp được cấu hình "Vào tự do" (join_mode === 'free') -> Vào thẳng lớp ngay không cần duyệt
    if (foundClass.join_mode === 'free') {
      const newMember: ClassMember = {
        id: `cm-${Date.now()}`,
        class_id: foundClass.id,
        user_id: user.id,
        role: 'student',
        status: 'active',
        joined_at: new Date().toISOString(),
        profile: user,
      };
      existingMems.push(newMember);
      localStorage.setItem(memKey, JSON.stringify(existingMems));

      const studentClassesKey = `lms_student_classes_${user.id}`;
      const enrolledClasses: string[] = JSON.parse(localStorage.getItem(studentClassesKey) || '[]');
      if (!enrolledClasses.includes(foundClass.id)) {
        enrolledClasses.push(foundClass.id);
        localStorage.setItem(studentClassesKey, JSON.stringify(enrolledClasses));
      }
      if (user.email) {
        const emailClassesKey = `lms_student_classes_${user.email.toLowerCase()}`;
        const emailEnrolled: string[] = JSON.parse(localStorage.getItem(emailClassesKey) || '[]');
        if (!emailEnrolled.includes(foundClass.id)) {
          emailEnrolled.push(foundClass.id);
          localStorage.setItem(emailClassesKey, JSON.stringify(emailEnrolled));
        }
      }

      // Xóa khỏi pending nếu có
      const userPendingKey = `lms_user_pending_requests_${user.id}`;
      const userPending: string[] = JSON.parse(localStorage.getItem(userPendingKey) || '[]');
      localStorage.setItem(userPendingKey, JSON.stringify(userPending.filter((id) => id !== foundClass.id)));

      // Đồng bộ kích hoạt học sinh vào Supabase Cloud
      fetch('/api/cloud-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve_student',
          classId: foundClass.id,
          className: foundClass.name,
          classCode: foundClass.code,
          student: user,
          userId: user.id,
        }),
      }).catch(console.error);

      window.dispatchEvent(new Event('lms_enrollment_changed'));
      return {
        success: true,
        pending: false,
        message: `Chúc mừng em đã tham gia lớp "${foundClass.name}" thành công!`,
        classItem: foundClass,
      };
    }

    // 1. Thêm vào danh sách chờ duyệt của lớp (PENDING - Mặc định Thầy cô duyệt)
    const classPendingKey = `lms_class_pending_requests_${foundClass.id}`;
    const classPending: any[] = JSON.parse(localStorage.getItem(classPendingKey) || '[]');
    const alreadyPending = classPending.some(
      (p) =>
        p.user_id === user.id ||
        (user.email && p.user?.email?.toLowerCase() === user.email.toLowerCase())
    );
    if (!alreadyPending) {
      classPending.push({
        id: `req-${Date.now()}`,
        class_id: foundClass.id,
        user_id: user.id,
        user: {
          id: user.id,
          full_name: user.full_name || 'Học sinh',
          email: user.email,
          role: 'student',
          grade: user.grade || foundClass.grade || 12,
          school_name: user.school_name || 'THPT Chuyên',
          phone: user.phone || '',
          candidate_number: user.candidate_number || '',
        },
        status: 'pending',
        requested_at: new Date().toISOString(),
      });
      localStorage.setItem(classPendingKey, JSON.stringify(classPending));
    }

    // 2. Thêm vào danh sách chờ duyệt của học sinh
    const userPendingKey = `lms_user_pending_requests_${user.id}`;
    const userPending: string[] = JSON.parse(localStorage.getItem(userPendingKey) || '[]');
    if (!userPending.includes(foundClass.id)) {
      userPending.push(foundClass.id);
      localStorage.setItem(userPendingKey, JSON.stringify(userPending));
    }

    // 3. Xóa khỏi cache enrolled (nếu có nhầm trước đó) để đảm bảo không được active trước khi Thầy duyệt
    const studentClassesKey = `lms_student_classes_${user.id}`;
    const enrolledClasses: string[] = JSON.parse(localStorage.getItem(studentClassesKey) || '[]');
    localStorage.setItem(studentClassesKey, JSON.stringify(enrolledClasses.filter((id) => id !== foundClass.id)));
    if (user.email) {
      const emailClassesKey = `lms_student_classes_${user.email.toLowerCase()}`;
      const emailEnrolled: string[] = JSON.parse(localStorage.getItem(emailClassesKey) || '[]');
      localStorage.setItem(emailClassesKey, JSON.stringify(emailEnrolled.filter((id) => id !== foundClass.id)));
    }

    // 4. Đồng bộ yêu cầu chờ duyệt lên Supabase Cloud
    fetch('/api/cloud-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'request_join',
        classId: foundClass.id,
        user,
      }),
    }).catch(console.error);

    // Phát event thông báo trạng thái
    window.dispatchEvent(new Event('lms_enrollment_changed'));

    return {
      success: true,
      pending: true,
      message: `Đã gửi yêu cầu vào lớp "${foundClass.name}" thành công! Vui lòng chờ Thầy Sơn phê duyệt trong danh sách lớp để được làm bài thi.`,
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

    // Xóa khỏi cache lớp đã tham gia nếu có
    const studentClassesKey = `lms_student_classes_${studentId}`;
    const enrolledClasses: string[] = JSON.parse(localStorage.getItem(studentClassesKey) || '[]');
    localStorage.setItem(studentClassesKey, JSON.stringify(enrolledClasses.filter((id) => id !== classId)));

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
  allClasses: ClassItem[] = [],
  studentEmail?: string
): boolean => {
  if (!studentId && !studentEmail) return false;

  // BƯỚC 1: Kiểm tra học sinh đã vào lớp nào chưa
  const enrolledIds = getEnrolledClassIdsForUser(studentId || '', studentEmail);
  if (enrolledIds.length === 0) {
    // CHƯA VÀO LỚP -> CHẶN 100%!
    return false;
  }

  // BƯỚC 2: Khi học sinh đã vào lớp, nếu đề thi là 'public' -> Cho phép xem
  if (exam.access_type === 'public') {
    return true;
  }

  // BƯỚC 3: Đề thi giới hạn lớp -> Học sinh phải thuộc đúng lớp được phân công
  // Thu thập danh sách lớp học từ cả allClasses và localStorage lms_classes
  const storage = typeof window !== 'undefined' ? window.localStorage : (globalThis as any).localStorage;
  const classesMap = new Map<string, ClassItem>();

  if (Array.isArray(allClasses)) {
    allClasses.forEach((c) => {
      if (c && c.id) classesMap.set(c.id, c);
    });
  }

  if (storage) {
    try {
      const saved = storage.getItem('lms_classes');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          parsed.forEach((c: any) => {
            if (c && c.id) classesMap.set(c.id, c);
          });
        }
      }
    } catch {}
  }

  const allClassesPool = Array.from(classesMap.values());
  const cleanEnrolledIds = enrolledIds.map((id) => id.trim().toLowerCase());
  const enrolledClasses = allClassesPool.filter((c) =>
    enrolledIds.includes(c.id) || cleanEnrolledIds.includes(c.id.toLowerCase()) || cleanEnrolledIds.includes(c.name.toLowerCase()) || (c.code && cleanEnrolledIds.includes(c.code.toLowerCase()))
  );
  const enrolledNames = Array.from(new Set([...enrolledClasses.map((c) => c.name.trim().toLowerCase()), ...cleanEnrolledIds]));
  const enrolledCodes = Array.from(new Set([...enrolledClasses.map((c) => c.code?.trim().toLowerCase()).filter(Boolean) as string[], ...cleanEnrolledIds]));

  // Hàm so khớp thông minh tên lớp (VD: '11' và '11 Anh 1' hay 'Lớp 11' đều khớp)
  const isClassMatch = (target: string) => {
    const t = target.trim().toLowerCase();
    if (enrolledNames.includes(t) || enrolledCodes.includes(t) || cleanEnrolledIds.includes(t)) return true;
    return enrolledNames.some((en) => {
      if (en === t) return true;
      if (en === '11' && (t.startsWith('11') || t.includes('11'))) return true;
      if (t === '11' && (en.startsWith('11') || en.includes('11'))) return true;
      if (en === '12' && (t.startsWith('12') || t.includes('12'))) return true;
      if (t === '12' && (en.startsWith('12') || en.includes('12'))) return true;
      if (en === '10' && (t.startsWith('10') || t.includes('10'))) return true;
      if (t === '10' && (en.startsWith('10') || en.includes('10'))) return true;
      return false;
    });
  };

  // 1. Kiểm tra trực tiếp theo class_id
  if (exam.class_id && (enrolledIds.includes(exam.class_id) || cleanEnrolledIds.includes(exam.class_id.toLowerCase()) || isClassMatch(exam.class_id))) return true;

  // 2. Kiểm tra theo class_name
  if (exam.class_name && isClassMatch(exam.class_name)) {
    return true;
  }

  // 3. Kiểm tra theo assigned_classes
  if (Array.isArray(exam.assigned_classes) && exam.assigned_classes.length > 0) {
    return exam.assigned_classes.some((cls) => cls && isClassMatch(cls));
  }

  // Nếu đề không công khai và không được phân công cho lớp của học sinh -> Chặn
  return false;
};
