'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Profile, UserRole } from '@/types/database';
import { MOCK_USERS } from '@/lib/supabase/mockStore';
import { createClient } from '@/lib/supabase/client';

interface AuthContextType {
  user: Profile | null;
  role: UserRole;
  isLoading: boolean;
  isAdmin: boolean;
  isTeacher: boolean;
  isStudent: boolean;
  switchDemoUser: (userId: string) => void;
  signIn: (email: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  updateProfile: (updated: Partial<Profile>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Mặc định khởi tạo với tài khoản Giáo viên (Thầy Nguyễn Văn Toán) để trải nghiệm đầy đủ tính năng tạo đề, câu hỏi, chấm điểm
  const [user, setUser] = useState<Profile | null>(MOCK_USERS[1]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Kiểm tra xem có lưu user trong localStorage không
    if (typeof window !== 'undefined') {
      const savedUserId = localStorage.getItem('lms_current_user_id');
      if (savedUserId) {
        const found = MOCK_USERS.find((u) => u.id === savedUserId);
        if (found) {
          setUser(found);
        }
      }
    }

    // Nếu cấu hình Supabase thực tế, kiểm tra session
    const supabase = createClient();
    if (supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          // Lấy profile tương ứng
          supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single()
            .then(({ data }) => {
              if (data) setUser(data as Profile);
            });
        }
      });
    }
  }, []);

  const switchDemoUser = (userId: string) => {
    const selected = MOCK_USERS.find((u) => u.id === userId);
    if (selected) {
      setUser(selected);
      if (typeof window !== 'undefined') {
        localStorage.setItem('lms_current_user_id', selected.id);
      }
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

      // Demo login
      const matched = MOCK_USERS.find(
        (u) => u.email.toLowerCase() === email.toLowerCase().trim()
      );
      if (matched) {
        setUser(matched);
        if (typeof window !== 'undefined') {
          localStorage.setItem('lms_current_user_id', matched.id);
        }
        return { success: true };
      }
      return { success: false, error: 'Email không tìm thấy trong danh sách mẫu.' };
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    const supabase = createClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    setUser(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('lms_current_user_id');
    }
  };

  const updateProfile = (updated: Partial<Profile>) => {
    if (!user) return;
    const newProfile = { ...user, ...updated };
    setUser(newProfile);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`profile_${user.id}`, JSON.stringify(newProfile));
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
