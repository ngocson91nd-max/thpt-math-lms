'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Profile, UserRole } from '@/types/database';
import { MOCK_USERS } from '@/lib/supabase/mockStore';
import { createClient } from '@/lib/supabase/client';

export interface SignUpData {
  email: string;
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
  signInWithPassword: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signIn: (email: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  updateProfile: (updated: Partial<Profile>) => void;
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
            // Kiểm tra trong custom_user hoặc MOCK_USERS
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
            const found = MOCK_USERS.find((u) => u.id === savedUserId);
            if (found) {
              setUser(found);
              setIsLoading(false);
              return;
            }
          }

          if (!isExplicitlyLoggedOut) {
            // Mặc định khởi tạo Thầy Nguyễn Văn Toán để xem thử giao diện
            setUser(MOCK_USERS[1]);
          }
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
    email,
    password,
    fullName,
    grade,
    schoolName = 'THPT Chuyên Lê Hồng Phong',
    phone = '',
    role = 'student',
  }: SignUpData) => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      if (supabase) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              role,
              grade,
              school_name: schoolName,
              phone,
            },
          },
        });

        if (error) {
          return { success: false, error: error.message };
        }

        if (data?.user) {
          const newProfile: Profile = {
            id: data.user.id,
            email,
            full_name: fullName,
            role,
            grade,
            school_name: schoolName,
            phone,
            created_at: new Date().toISOString(),
          };

          try {
            await supabase.from('profiles').upsert([newProfile]);
          } catch (e) {
            console.warn('Profile upsert note:', e);
          }

          setUser(newProfile);
          if (typeof window !== 'undefined') {
            localStorage.setItem('lms_current_user_id', newProfile.id);
            localStorage.setItem(`custom_user_${newProfile.id}`, JSON.stringify(newProfile));
            localStorage.removeItem('lms_is_logged_out');
          }
          return { success: true };
        }
      }

      // Mock fallback khi chạy offline hoặc chưa cấu hình Supabase
      const mockId =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `student-${Date.now()}`;

      const newProfile: Profile = {
        id: mockId,
        email,
        full_name: fullName,
        role,
        grade,
        school_name: schoolName,
        phone,
        created_at: new Date().toISOString(),
      };

      MOCK_USERS.push(newProfile);
      setUser(newProfile);
      if (typeof window !== 'undefined') {
        localStorage.setItem('lms_current_user_id', newProfile.id);
        localStorage.setItem(`custom_user_${newProfile.id}`, JSON.stringify(newProfile));
        localStorage.removeItem('lms_is_logged_out');
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Lỗi trong quá trình đăng ký.' };
    } finally {
      setIsLoading(false);
    }
  };

  const signInWithPassword = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      if (supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          return { success: false, error: error.message };
        }

        if (data.user) {
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
          } else {
            const meta = data.user.user_metadata || {};
            const fallback: Profile = {
              id: data.user.id,
              email: data.user.email || email,
              full_name: meta.full_name || email.split('@')[0],
              role: (meta.role as UserRole) || 'student',
              grade: ((Number(meta.grade) || 12) as 10 | 11 | 12),
              school_name: meta.school_name || 'THPT Chuyên',
              phone: meta.phone || '',
            };
            setUser(fallback);
            if (typeof window !== 'undefined') {
              localStorage.setItem('lms_current_user_id', fallback.id);
              localStorage.removeItem('lms_is_logged_out');
            }
            return { success: true };
          }
        }
      }

      // Check trong localStorage và mock store
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

      return {
        success: false,
        error: 'Email hoặc mật khẩu không chính xác. Hãy kiểm tra lại!',
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

  const updateProfile = (updated: Partial<Profile>) => {
    if (!user) return;
    const newProfile = { ...user, ...updated };
    setUser(newProfile);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`custom_user_${user.id}`, JSON.stringify(newProfile));
    }
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
