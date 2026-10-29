'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Profile, UserRole } from '@/types/database';
import { MOCK_USERS } from '@/lib/supabase/mockStore';
import { createClient } from '@/lib/supabase/client';

export interface SignUpData {
  username?: string; // Tên đăng nhập (cho phép không cần email)
  email?: string; // Email (tùy chọn)
  candidateNumber?: string; // Số báo danh (SBD)
  birthDate?: string; // Ngày sinh
  password: string;
  fullName: string;
  grade: 10 | 11 | 12;
  schoolName?: string;
  phone?: string;
  role?: UserRole;
}

interface AuthContextType {
  user: Profile | null;
  role: UserRole;
  isLoading: boolean;
  isAdmin: boolean;
  isTeacher: boolean;
  isStudent: boolean;
  switchDemoUser: (userId: string) => void;
  signUpWithPassword: (data: SignUpData) => Promise<{ success: boolean; error?: string }>;
  signInWithPassword: (identifier: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signIn: (email: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  updateProfile: (updated: Partial<Profile>) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      setIsLoading(true);
      try {
        const supabase = createClient();
        if (supabase) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single();

            if (profile) {
              setUser(profile as Profile);
              setIsLoading(false);
              return;
            } else {
              const meta = session.user.user_metadata || {};
              const fallback: Profile = {
                id: session.user.id,
                email: session.user.email || '',
                full_name: meta.full_name || session.user.email?.split('@')[0] || 'Học sinh',
                role: (meta.role as UserRole) || 'student',
                grade: ((Number(meta.grade) || 12) as 10 | 11 | 12),
                school_name: meta.school_name || 'THPT Chuyên',
                phone: meta.phone || '',
              };
              setUser(fallback);
              setIsLoading(false);
              return;
            }
          }

          // Lắng nghe thay đổi trạng thái đăng nhập từ Supabase
          const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
            if (session?.user) {
              const { data: p } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .single();
              if (p) setUser(p as Profile);
            }
          });
        }

        // Kiểm tra localStorage
        if (typeof window !== 'undefined') {
          const isExplicitlyLoggedOut = localStorage.getItem('lms_is_logged_out') === 'true';
          const savedUserId = localStorage.getItem('lms_current_user_id');

          if (savedUserId) {
            // Kiểm tra trong custom_user, lms_registered_users hoặc MOCK_USERS
            const customUserRaw = localStorage.getItem(`custom_user_${savedUserId}`);
            if (customUserRaw) {
              try {
                setUser(JSON.parse(customUserRaw));
                setIsLoading(false);
                return;
              } catch (e) {
                console.error(e);
              }
            }

            const registeredList = JSON.parse(localStorage.getItem('lms_registered_users') || '[]');
            const foundReg = registeredList.find((u: any) => u.id === savedUserId);
            if (foundReg) {
              const { password: _, ...cleanProf } = foundReg;
              setUser(cleanProf);
              setIsLoading(false);
              return;
            }

            const found = MOCK_USERS.find((u) => u.id === savedUserId);
            if (found) {
              setUser(found);
              setIsLoading(false);
              return;
            }
          }

          // Mặc định khách chưa đăng nhập
          setUser(null);
        }
      } catch (err) {
        console.error('Lỗi khởi tạo Auth:', err);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const switchDemoUser = (userId: string) => {
    const selected = MOCK_USERS.find((u) => u.id === userId);
    if (selected) {
      setUser(selected);
      if (typeof window !== 'undefined') {
        localStorage.setItem('lms_current_user_id', selected.id);
        localStorage.removeItem('lms_is_logged_out');
      }
    }
  };

  const signUpWithPassword = async ({
    username,
    email,
    candidateNumber,
    birthDate,
    password,
    fullName,
    grade,
    schoolName = 'THPT Chuyên Lê Hồng Phong',
    phone = '',
    role = 'student',
  }: SignUpData) => {
    setIsLoading(true);
    try {
      const cleanUsername = (username || phone || fullName.replace(/\s+/g, '').toLowerCase() || `stu${Date.now()}`)
        .trim()
        .toLowerCase()
        .replace(/[^a-zA-Z0-9_]/g, '');
      const finalEmail = email?.trim() && email.includes('@')
        ? email.trim().toLowerCase()
        : `${cleanUsername}@thpt.sontoan.vn`;

      const supabase = createClient();
      let registeredUserId: string | null = null;

      if (supabase) {
        const { data, error } = await supabase.auth.signUp({
          email: finalEmail,
          password,
          options: {
            data: {
              full_name: fullName,
              role,
              grade,
              school_name: schoolName,
              phone,
              username: cleanUsername,
              candidate_number: candidateNumber,
              birth_date: birthDate,
            },
          },
        });

        if (error) {
          console.warn('Supabase Auth lưu ý (kích hoạt đăng ký trực tiếp):', error.message);
        } else if (data?.user) {
          registeredUserId = data.user.id;
        }
      }

      const studentId =
        registeredUserId ||
        (typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `student-${Date.now()}`);

      const newProfile: Profile = {
        id: studentId,
        email: finalEmail,
        username: cleanUsername,
        candidate_number: candidateNumber || '',
        birth_date: birthDate || '',
        full_name: fullName.trim(),
        role,
        grade,
        school_name: schoolName,
        phone: phone.trim(),
        created_at: new Date().toISOString(),
      };

      if (supabase && registeredUserId) {
        try {
          await supabase.from('profiles').upsert([newProfile]);
        } catch (e) {
          console.warn('Profile upsert note:', e);
        }
      }

      setUser(newProfile);
      if (typeof window !== 'undefined') {
        localStorage.setItem('lms_current_user_id', newProfile.id);
        localStorage.setItem(`custom_user_${newProfile.id}`, JSON.stringify(newProfile));

        // Lưu tài khoản và mật khẩu vào danh sách tài khoản học sinh đã đăng ký
        const registeredList = JSON.parse(localStorage.getItem('lms_registered_users') || '[]');
        const cleanAccEmail = finalEmail.toLowerCase().trim();
        const idx = registeredList.findIndex(
          (u: any) =>
            u.email.toLowerCase() === cleanAccEmail ||
            (u.username && u.username.toLowerCase() === cleanUsername) ||
            (phone && u.phone === phone)
        );
        const accountToSave = { ...newProfile, password };
        if (idx >= 0) registeredList[idx] = accountToSave;
        else registeredList.push(accountToSave);
        localStorage.setItem('lms_registered_users', JSON.stringify(registeredList));

        localStorage.removeItem('lms_is_logged_out');
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Lỗi trong quá trình đăng ký.' };
    } finally {
      setIsLoading(false);
    }
  };

  const signInWithPassword = async (identifier: string, password: string) => {
    setIsLoading(true);
    try {
      const cleanId = identifier.toLowerCase().trim();
      const cleanPassword = password.trim();

      // 1. Kiểm tra tài khoản Quản Trị Viên (Thầy Sơn)
      if (
        (cleanId === 'admin' ||
          cleanId === 'thayson' ||
          cleanId === '0901234567' ||
          cleanId === 'admin@sontoan.edu.vn' ||
          cleanId === 'admin@sontoan.vn' ||
          cleanId === 'admin@thpt-math-lms.vn' ||
          cleanId.startsWith('admin@')) &&
        (cleanPassword === '123456' || cleanPassword === 'admin123' || cleanPassword === 'toan123')
      ) {
        const adminProfile: Profile = {
          id: '11111111-1111-1111-1111-111111111111',
          email: cleanId.includes('@') ? cleanId : 'admin@sontoan.edu.vn',
          username: 'admin',
          full_name: 'Thầy Sơn (Quản Trị Viên)',
          role: 'admin',
          avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
          school_name: 'THPT Chuyên Lê Hồng Phong',
          grade: 12,
          phone: '0901234567',
        };
        setUser(adminProfile);
        if (typeof window !== 'undefined') {
          localStorage.setItem('lms_current_user_id', adminProfile.id);
          localStorage.setItem(`custom_user_${adminProfile.id}`, JSON.stringify(adminProfile));
          localStorage.removeItem('lms_is_logged_out');
        }
        return { success: true };
      }

      // 2. Kiểm tra danh sách tài khoản học sinh đã đăng ký (khớp email, username, sđt hoặc SBD)
      if (typeof window !== 'undefined') {
        const registeredList: Array<Profile & { password?: string }> = JSON.parse(
          localStorage.getItem('lms_registered_users') || '[]'
        );
        const found = registeredList.find((u) => {
          if (u.email && u.email.toLowerCase() === cleanId) return true;
          if (u.username && u.username.toLowerCase() === cleanId) return true;
          if (u.phone && u.phone.trim() === cleanId) return true;
          if (u.candidate_number && u.candidate_number.trim().toLowerCase() === cleanId) return true;
          // Ánh xạ username nội bộ @thpt.sontoan.vn
          if (u.email && u.email.toLowerCase() === `${cleanId}@thpt.sontoan.vn`) return true;
          return false;
        });

        if (found && found.password === cleanPassword) {
          const { password: _, ...cleanProfile } = found;
          setUser(cleanProfile as Profile);
          localStorage.setItem('lms_current_user_id', cleanProfile.id);
          localStorage.removeItem('lms_is_logged_out');
          return { success: true };
        }
      }

      // 3. Thử xác thực với Supabase Auth nếu đầu vào là Email hoặc chuyển đổi
      const supabase = createClient();
      const targetEmail = cleanId.includes('@') ? cleanId : `${cleanId}@thpt.sontoan.vn`;
      if (supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: targetEmail,
          password: cleanPassword,
        });

        if (!error && data?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();

          if (profile) {
            setUser(profile as Profile);
            if (typeof window !== 'undefined') {
              localStorage.setItem('lms_current_user_id', profile.id);
              localStorage.removeItem('lms_is_logged_out');
            }
            return { success: true };
          }
        }
      }

      // 4. Kiểm tra danh sách người dùng mẫu (MOCK_USERS)
      const matched = MOCK_USERS.find(
        (u) =>
          u.email.toLowerCase() === cleanId ||
          (u.phone && u.phone.trim() === cleanId)
      );
      if (
        matched &&
        (cleanPassword === '123456' ||
          cleanPassword === 'admin123' ||
          cleanPassword === 'toan123' ||
          cleanPassword.length >= 4)
      ) {
        setUser(matched);
        if (typeof window !== 'undefined') {
          localStorage.setItem('lms_current_user_id', matched.id);
          localStorage.removeItem('lms_is_logged_out');
        }
        return { success: true };
      }

      return {
        success: false,
        error: 'Tên đăng nhập, số điện thoại hoặc mật khẩu không chính xác. Thầy/học sinh vui lòng kiểm tra lại!',
      };
    } catch (err: any) {
      return { success: false, error: err.message || 'Lỗi khi đăng nhập.' };
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async (email: string) => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      if (supabase) {
        const { error } = await supabase.auth.signInWithOtp({ email });
        if (error) return { success: false, error: error.message };
        return { success: true };
      }

      const matched = MOCK_USERS.find(
        (u) => u.email.toLowerCase() === email.toLowerCase().trim()
      );
      if (matched) {
        setUser(matched);
        if (typeof window !== 'undefined') {
          localStorage.setItem('lms_current_user_id', matched.id);
          localStorage.removeItem('lms_is_logged_out');
        }
        return { success: true };
      }
      return { success: false, error: 'Email không tìm thấy trong danh sách.' };
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      if (supabase) {
        await supabase.auth.signOut();
      }
    } catch (e) {
      console.warn('Sign out warning:', e);
    } finally {
      setUser(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('lms_current_user_id');
        localStorage.setItem('lms_is_logged_out', 'true');
      }
      setIsLoading(false);
    }
  };

  const changePassword = async (
    oldPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'Chưa đăng nhập.' };
    if (!newPassword || newPassword.trim().length < 4) {
      return { success: false, error: 'Mật khẩu mới phải có ít nhất 4 ký tự.' };
    }

    const cleanNewPass = newPassword.trim();
    const cleanOldPass = oldPassword.trim();

    // 1. Cập nhật mật khẩu trong danh sách tài khoản cục bộ
    if (typeof window !== 'undefined') {
      const registeredList: Array<Profile & { password?: string }> = JSON.parse(
        localStorage.getItem('lms_registered_users') || '[]'
      );
      const cleanEmail = (user.email || '').toLowerCase().trim();
      const idx = registeredList.findIndex(
        (u) =>
          u.id === user.id ||
          (u.email && u.email.toLowerCase() === cleanEmail) ||
          (user.username && u.username && u.username.toLowerCase() === user.username.toLowerCase())
      );

      if (idx >= 0) {
        if (registeredList[idx].password && registeredList[idx].password !== cleanOldPass) {
          return { success: false, error: 'Mật khẩu hiện tại không chính xác!' };
        }
        registeredList[idx].password = cleanNewPass;
        localStorage.setItem('lms_registered_users', JSON.stringify(registeredList));
      } else {
        registeredList.push({ ...user, password: cleanNewPass });
        localStorage.setItem('lms_registered_users', JSON.stringify(registeredList));
      }
    }

    // 2. Cập nhật qua Supabase Auth nếu có phiên đăng nhập
    try {
      const supabase = createClient();
      if (supabase) {
        await supabase.auth.updateUser({ password: cleanNewPass });
      }
    } catch (e) {
      console.warn('Supabase change password note:', e);
    }

    return { success: true };
  };

  const updateProfile = async (
    updated: Partial<Profile>
  ): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'Chưa đăng nhập.' };
    const newProfile: Profile = {
      ...user,
      ...updated,
      updated_at: new Date().toISOString(),
    };
    setUser(newProfile);

    if (typeof window !== 'undefined') {
      localStorage.setItem(`custom_user_${user.id}`, JSON.stringify(newProfile));
      localStorage.setItem('lms_current_user_id', user.id);

      const registeredList: Array<Profile & { password?: string }> = JSON.parse(
        localStorage.getItem('lms_registered_users') || '[]'
      );
      const cleanEmail = (user.email || '').toLowerCase().trim();
      const idx = registeredList.findIndex(
        (u) =>
          u.id === user.id ||
          (u.email && u.email.toLowerCase() === cleanEmail) ||
          (user.username && u.username && u.username.toLowerCase() === user.username.toLowerCase())
      );
      if (idx >= 0) {
        registeredList[idx] = { ...registeredList[idx], ...newProfile };
        localStorage.setItem('lms_registered_users', JSON.stringify(registeredList));
      }
    }

    // Đồng bộ lên Supabase Cloud qua API
    try {
      fetch('/api/cloud-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_profile',
          user: newProfile,
          userId: user.id,
        }),
      }).catch(console.warn);
    } catch {}

    return { success: true };
  };

  const role: UserRole = user?.role || 'student';
  const isAdmin = role === 'admin';
  const isTeacher = role === 'teacher' || role === 'admin';
  const isStudent = role === 'student';

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        isLoading,
        isAdmin,
        isTeacher,
        isStudent,
        switchDemoUser,
        signUpWithPassword,
        signInWithPassword,
        signIn,
        signOut,
        changePassword,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
