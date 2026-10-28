'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Sidebar } from './Sidebar';
import { Footer } from './Footer';
import { GuestAuthWall } from '@/components/auth/GuestAuthWall';
import { StudentPendingApprovalView } from '@/components/auth/StudentPendingApprovalView';
import { isUserEnrolledInAnyClass } from '@/lib/auth/enrollment';
import { PanelLeftOpen } from 'lucide-react';

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname();
  const { user } = useAuth();
  // Mặc định là false để chặn triệt để tình trạng lộ đề thi khi chưa vào lớp
  const [isEnrolled, setIsEnrolled] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  // Khôi phục tùy chọn ẩn/hiện thanh bên từ localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('lms_sidebar_collapsed');
      if (saved === 'true') {
        setIsSidebarCollapsed(true);
      }
    }
  }, []);

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('lms_sidebar_collapsed', String(next));
      }
      return next;
    });
  };

  // Cập nhật và xác thực trạng thái duyệt lớp của học sinh từ Cloud
  useEffect(() => {
    let isMounted = true;

    const checkEnrollment = async () => {
      if (!user) {
        if (isMounted) setIsEnrolled(false);
        return;
      }

      // Giáo viên hoặc Quản trị viên luôn có toàn quyền
      if (user.role === 'teacher' || user.role === 'admin') {
        if (isMounted) setIsEnrolled(true);
        return;
      }

      // 1. Đối với học sinh: Tải danh sách lớp thực tế ĐANG HOẠT ĐỘNG trên Cloud
      try {
        const res = await fetch('/api/classes');
        const data = await res.json();
        if (data.success && Array.isArray(data.classes)) {
          localStorage.setItem('lms_classes', JSON.stringify(data.classes));

          const activeIds = new Set(data.classes.map((c: any) => c.id));
          const key = `lms_student_classes_${user.id}`;
          const currentEnrolled: string[] = JSON.parse(localStorage.getItem(key) || '[]');
          // Loại bỏ ngay lập tức các lớp đã bị Thầy xóa trên Cloud
          const cleaned = currentEnrolled.filter((id) => activeIds.has(id));
          localStorage.setItem(key, JSON.stringify(cleaned));
        }

        // 2. Đồng bộ trạng thái duyệt lớp thực tế từ Supabase Cloud
        const syncRes = await fetch(`/api/cloud-sync?userId=${user.id}`);
        const syncData = await syncRes.json();
        if (syncData.success) {
          const key = `lms_student_classes_${user.id}`;
          const activeClasses: any[] = JSON.parse(localStorage.getItem('lms_classes') || '[]');
          const activeIds = new Set(activeClasses.map((c) => c.id));
          const cloudApproved = Array.isArray(syncData.approvedClasses)
            ? syncData.approvedClasses.filter((id: string) => activeIds.has(id))
            : [];
          localStorage.setItem(key, JSON.stringify(cloudApproved));
        }
      } catch (e) {
        console.error('Check enrollment error:', e);
      }

      // 3. Đánh giá quyền chính thức: Học sinh phải thuộc ít nhất 1 lớp thực tế
      if (isMounted) {
        const enrolled = isUserEnrolledInAnyClass(user);
        setIsEnrolled(enrolled);
      }
    };

    checkEnrollment();
    window.addEventListener('lms_enrollment_changed', checkEnrollment);
    return () => {
      isMounted = false;
      window.removeEventListener('lms_enrollment_changed', checkEnrollment);
    };
  }, [user]);

  const isTakeExamPage = pathname.includes('/take');
  const isAuthPage = pathname === '/login' || pathname === '/register';

  // Xác định nội dung cần hiển thị theo phân quyền
  const renderContent = () => {
    // 1. Các trang đăng nhập / đăng ký: Luôn cho phép hiển thị
    if (isAuthPage) {
      return children;
    }

    // 2. Khách chưa đăng nhập: Yêu cầu đăng nhập khi truy cập nội dung
    if (!user) {
      return <GuestAuthWall />;
    }

    // 3. Học sinh CHƯA ĐƯỢC DUYỆT VÀO LỚP:
    // TUYỆT ĐỐI CHẶN MỌI TRANG (kể cả Trang chủ, Đề thi, Làm bài...) VÀ HIỂN THỊ PHÒNG CHỜ NHẬP MÃ LỚP
    if (user.role === 'student' && !isEnrolled) {
      return <StudentPendingApprovalView />;
    }

    // 4. Giáo viên hoặc Học sinh đã được duyệt vào lớp: Cho phép truy cập 100% nội dung
    return children;
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans">
      {!isTakeExamPage && (
        <Sidebar
          isCollapsed={isSidebarCollapsed}
          onToggle={toggleSidebar}
        />
      )}

      {/* Nút nổi "Hiện thanh bên" khi thanh bên đang bị ẩn trên Desktop */}
      {isSidebarCollapsed && !isTakeExamPage && (
        <button
          type="button"
          onClick={toggleSidebar}
          className="fixed top-3 left-4 z-40 hidden lg:flex items-center gap-2 rounded-2xl bg-white/95 px-3.5 py-2 text-xs font-bold text-slate-700 shadow-md border border-slate-200 backdrop-blur-md hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all cursor-pointer group animate-in fade-in"
          title="Hiện thanh bên"
        >
          <PanelLeftOpen className="h-4 w-4 text-blue-600 group-hover:scale-110 transition" />
          <span>Hiện thanh bên</span>
        </button>
      )}

      <div
        className={`flex-1 flex flex-col min-h-screen transition-[padding] duration-300 ease-in-out ${
          isTakeExamPage || isSidebarCollapsed ? 'w-full lg:pl-0' : 'lg:pl-64'
        }`}
      >
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {renderContent()}
        </main>
        {!isTakeExamPage && <Footer />}
      </div>
    </div>
  );
};

export default AppLayout;
