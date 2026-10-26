import { UserRole } from '@/types/database';

export interface UserContext {
  id: string;
  role: UserRole;
}

export const canCreateClass = (user: UserContext | null): boolean => {
  if (!user) return false;
  return user.role === 'admin' || user.role === 'teacher';
};

export const canManageClass = (user: UserContext | null, teacherId: string): boolean => {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return user.role === 'teacher' && user.id === teacherId;
};

export const canCreateQuestion = (user: UserContext | null): boolean => {
  if (!user) return false;
  return user.role === 'admin' || user.role === 'teacher';
};

export const canCreateExam = (user: UserContext | null): boolean => {
  if (!user) return false;
  return user.role === 'admin' || user.role === 'teacher';
};

export const canGradeSubmission = (user: UserContext | null, examTeacherId?: string): boolean => {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'teacher') {
    return !examTeacherId || user.id === examTeacherId;
  }
  return false;
};

export const canTakeExam = (user: UserContext | null): boolean => {
  return !!user; // Cả học sinh, giáo viên (để xem trước thử) đều có thể làm
};
