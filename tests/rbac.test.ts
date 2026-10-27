import { describe, it, expect } from 'vitest';
import {
  canCreateClass,
  canManageClass,
  canCreateQuestion,
  canCreateExam,
  canGradeSubmission,
  canTakeExam,
  UserContext,
} from '../src/lib/auth/rbac';
import { isUserEnrolledInAnyClass } from '../src/lib/auth/enrollment';
import { Profile } from '../src/types/database';

describe('Kiểm thử phân quyền RBAC (Admin, Teacher, Student)', () => {
  const admin: UserContext = { id: 'admin-1', role: 'admin' };
  const teacherA: UserContext = { id: 'teacher-a', role: 'teacher' };
  const teacherB: UserContext = { id: 'teacher-b', role: 'teacher' };
  const student: UserContext = { id: 'student-1', role: 'student' };

  it('1. Quyền tạo lớp học: Chỉ Admin và Giáo viên được phép', () => {
    expect(canCreateClass(admin)).toBe(true);
    expect(canCreateClass(teacherA)).toBe(true);
    expect(canCreateClass(student)).toBe(false);
    expect(canCreateClass(null)).toBe(false);
  });

  it('2. Quyền quản lý lớp: Chỉ Admin hoặc chính Giáo viên phụ trách lớp', () => {
    expect(canManageClass(admin, 'teacher-a')).toBe(true);
    expect(canManageClass(teacherA, 'teacher-a')).toBe(true);
    expect(canManageClass(teacherB, 'teacher-a')).toBe(false);
    expect(canManageClass(student, 'teacher-a')).toBe(false);
  });

  it('3. Quyền tạo câu hỏi và đề thi: Chỉ Admin và Giáo viên', () => {
    expect(canCreateQuestion(admin)).toBe(true);
    expect(canCreateQuestion(teacherA)).toBe(true);
    expect(canCreateQuestion(student)).toBe(false);

    expect(canCreateExam(admin)).toBe(true);
    expect(canCreateExam(teacherA)).toBe(true);
    expect(canCreateExam(student)).toBe(false);
  });

  it('4. Quyền chấm bài tự luận: Học sinh không được phép', () => {
    expect(canGradeSubmission(admin)).toBe(true);
    expect(canGradeSubmission(teacherA, 'teacher-a')).toBe(true);
    expect(canGradeSubmission(teacherB, 'teacher-a')).toBe(false);
    expect(canGradeSubmission(student)).toBe(false);
  });

  it('5. Quyền tham gia làm bài thi: Người dùng đã đăng nhập', () => {
    expect(canTakeExam(student)).toBe(true);
    expect(canTakeExam(teacherA)).toBe(true);
    expect(canTakeExam(null)).toBe(false);
  });

  it('6. Phân quyền duyệt lớp: Giáo viên/Admin luôn mở khóa, học sinh chưa vào lớp bị khóa', () => {
    const teacherProfile: Profile = {
      id: 'teacher-1',
      email: 'teacher@thpt.vn',
      full_name: 'Thầy Sơn',
      role: 'teacher',
      grade: 12,
    };
    const guestUser = null;
    const unenrolledStudent: Profile = {
      id: 'new-student-999',
      email: 'newstudent@gmail.com',
      full_name: 'Học sinh mới',
      role: 'student',
      grade: 12,
    };
    const enrolledStudent: Profile = {
      id: '33333333-3333-3333-3333-333333333333', // Đã có trong MOCK_CLASS_MEMBERS
      email: 'student.mai@thpt-math-lms.vn',
      full_name: 'Nguyễn Thị Mai',
      role: 'student',
      grade: 12,
    };

    // Giáo viên luôn mở khóa
    expect(isUserEnrolledInAnyClass(teacherProfile)).toBe(true);
    // Khách chưa đăng nhập bị khóa
    expect(isUserEnrolledInAnyClass(guestUser)).toBe(false);
    // Học sinh chưa add vào lớp bị khóa
    expect(isUserEnrolledInAnyClass(unenrolledStudent)).toBe(false);
    // Học sinh đã add vào lớp được mở khóa
    expect(isUserEnrolledInAnyClass(enrolledStudent)).toBe(true);
  });
});
