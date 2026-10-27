'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Sidebar } from './Sidebar';
import { Footer } from './Footer';
import { GuestAuthWall } from '@/components/auth/GuestAuthWall';
import { StudentPendingApprovalView } from '@/components/auth/StudentPendingApprovalView';
import { isUserEnrolledInAnyClass } from '@/lib/auth/enrollment';

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname();
  const { user } = useAuth();
  const [isEnrolled, setIsEnrolled] = useState<boolean>(true);

  // Cập nhật trạng thái duyệt lớp của học sinh
  useEffect(() => {
    const checkEnrollment = () => {
      if (!user) {
        setIsEnrolled(false);
      } else if (user.role === 'teacher' || user.role === 'admin') {
        setIsEnrolled(true);
      } else {
        setIsEnrolled(isUserEnrolledInAnyClass(user));
      }
    };

    checkEnrollment();
    window.addEventListener('lms_enrollment_changed', checkEnrollment);
    return () => window.removeEventListener('lms_enrollment_changed', checkEnrollment);
  }, [user]);

  const isTakeExamPage = pathname.includes('/take');
  const isAuthPage = pathname === '/login' || pathname === '/register';
  const isHomePage = pathname === '/';

  // Xác định nội dung cần hiển thị theo phân quyền
  const renderContent = () => {
    // 1. Các trang đăng nhập / đăng ký: Luôn cho phép hiển thị
    if (isAuthPage) {
      return children;
    }

    // 2. Trang chủ: Cho phép khách vãng lai xem Landing Page giới thiệu
    if (isHomePage) {
      // Nếu là học sinh đã đăng nhập nhưng chưa vào lớp: hiện màn hình chờ duyệt vào lớp
      if (user && user.role === 'student' && !isEnrolled) {
        return <StudentPendingApprovalView />;
      }
      return children;
    }

    // 3. Khách chưa đăng nhập cố tình truy cập các trang nội bộ (/exams, /classes, /courses, /materials, /gradebook, /questions...):
    if (!user) {
      return <GuestAuthWall />;
    }

    // 4. Học sinh đã đăng nhập nhưng CHƯA ĐƯỢC ADD VÀO LỚP:
    if (user.role === 'student' && !isEnrolled) {
      return <StudentPendingApprovalView />;
    }

    // 5. Giáo viên hoặc Học sinh đã được duyệt vào lớp: Cho phép truy cập 100% nội dung
    return children;
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans">
      {!isTakeExamPage && <Sidebar />}
      <div className={`flex-1 flex flex-col min-h-screen transition-all ${isTakeExamPage ? 'w-full' : 'lg:pl-64'}`}>
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {renderContent()}
        </main>
        {!isTakeExamPage && <Footer />}
      </div>
    </div>
  );
};

export default AppLayout;
