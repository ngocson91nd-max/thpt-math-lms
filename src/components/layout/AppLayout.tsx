'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Sidebar } from './Sidebar';
import { GuestAuthWall } from '@/components/auth/GuestAuthWall';
import { StudentPendingApprovalView } from '@/components/auth/StudentPendingApprovalView';
import { isUserEnrolledInAnyClass, getEnrolledClassIdsForUser } from '@/lib/auth/enrollment';
import { setupRealtimeSync, autoRecoverAllSubmissionsFromBrowser } from '@/lib/realtime/syncService';
import { MOCK_USERS } from '@/lib/supabase/mockStore';
import { PanelLeftOpen, Loader2 } from 'lucide-react';

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname();
  const { user, isLoading } = useAuth();
  
  // Khởi tạo ngay trạng thái từ cache localStorage để không bao giờ bị "out ra" khi F5 reload
  const [isEnrolled, setIsEnrolled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      const savedUserId = localStorage.getItem('lms_current_user_id');
      if (savedUserId) {
        const registeredList = JSON.parse(localStorage.getItem('lms_registered_users') || '[]');
        const found =
          registeredList.find((u: any) => u.id === savedUserId) ||
          MOCK_USERS.find((u) => u.id === savedUserId);
        if (found) {
          if (found.role === 'teacher' || found.role === 'admin') return true;
          return isUserEnrolledInAnyClass(found);
        }
      }
    } catch {}
    return false;
  });

  const [hasCheckedEnrollment, setHasCheckedEnrollment] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      const savedUserId = localStorage.getItem('lms_current_user_id');
      if (savedUserId) {
        const key = `lms_student_classes_${savedUserId}`;
        const raw = localStorage.getItem(key);
        if (raw && JSON.parse(raw).length > 0) return true;
      }
    } catch {}
    return false;
  });

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  // Khôi phục tùy chọn ẩn/hiện thanh bên từ localStorage & Dọn dẹp dữ liệu rác/đề thi cũ
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('lms_sidebar_collapsed');
      if (saved === 'true') {
        setIsSidebarCollapsed(true);
      }

      // Dọn sạch toàn bộ cache TikZ cũ để nạp đồ thị mới sửa
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith('tikz_') && !key.startsWith('tikz_v8_')) {
          localStorage.removeItem(key);
        }
      }

      // Xóa sạch toàn bộ dữ liệu bài thi/đề thi cũ theo yêu cầu của Thầy Sơn (reset sạch sẽ)
      const DATA_CLEAN_VERSION = 'lms_v3_clean_all_exams_data';
      if (localStorage.getItem(DATA_CLEAN_VERSION) !== 'true') {
        localStorage.removeItem('lms_exams');
        localStorage.removeItem('lms_deleted_exam_ids');
        localStorage.removeItem('lms_submissions');
        
        // Dọn sạch tất cả bài nộp của học sinh và câu trả lời tạm
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i);
          if (
            key &&
            (key.startsWith('my_submissions_') ||
             key.startsWith('submission_') ||
             key.startsWith('exam_answers_') ||
             key.startsWith('exam_draft_') ||
             key.startsWith('tikz_'))
          ) {
            localStorage.removeItem(key);
          }
        }
        localStorage.setItem(DATA_CLEAN_VERSION, 'true');
        window.dispatchEvent(new Event('lms_exams_updated'));
      }

      // Xóa sạch dữ liệu ngân hàng câu hỏi theo yêu cầu của Thầy Sơn
      const QB_CLEAN_VERSION = 'lms_v4_clean_questions_bank';
      if (localStorage.getItem(QB_CLEAN_VERSION) !== 'true') {
        localStorage.setItem('lms_questions', '[]');
        localStorage.setItem(QB_CLEAN_VERSION, 'true');
      }

      // Tự động quét và gom toàn bộ bài thi của học sinh trên máy vào Sổ điểm chung
      autoRecoverAllSubmissionsFromBrowser();
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
        if (isMounted) {
          setIsEnrolled(false);
          setHasCheckedEnrollment(true);
        }
        return;
      }

      // Giáo viên hoặc Quản trị viên luôn có toàn quyền
      if (user.role === 'teacher' || user.role === 'admin') {
        if (isMounted) {
          setIsEnrolled(true);
          setHasCheckedEnrollment(true);
        }
        return;
      }

      // 1. Kiểm tra nhanh từ cache nội bộ: nếu học sinh đã có lớp thì mở ngay lập tức!
      const initialLocalCheck = isUserEnrolledInAnyClass(user);
      if (initialLocalCheck && isMounted) {
        setIsEnrolled(true);
      }

      // 2. Đối với học sinh: Tải danh sách lớp thực tế ĐANG HOẠT ĐỘNG trên Cloud
      try {
        const res = await fetch('/api/classes');
        const data = await res.json();
        let activeIds = new Set<string>();
        if (data.success && Array.isArray(data.classes)) {
          localStorage.setItem('lms_classes', JSON.stringify(data.classes));
          activeIds = new Set(data.classes.map((c: any) => c.id));

          const key = `lms_student_classes_${user.id}`;
          const currentEnrolled: string[] = JSON.parse(localStorage.getItem(key) || '[]');
          if (activeIds.size > 0 && currentEnrolled.length > 0) {
            // Loại bỏ các lớp đã bị Thầy xóa trên Cloud
            const cleaned = currentEnrolled.filter((id) => activeIds.has(id));
            localStorage.setItem(key, JSON.stringify(cleaned));
          }
        }

        // 3. Đồng bộ trạng thái duyệt lớp thực tế từ Supabase Cloud
        const syncUrl = `/api/cloud-sync?userId=${encodeURIComponent(user.id)}&email=${encodeURIComponent(user.email || '')}`;
        const syncRes = await fetch(syncUrl);
        const syncData = await syncRes.json();
        if (syncData.success) {
          const key = `lms_student_classes_${user.id}`;
          const cloudApproved = Array.isArray(syncData.approvedClasses) ? syncData.approvedClasses : [];

          if (cloudApproved.length > 0) {
            localStorage.setItem(key, JSON.stringify(cloudApproved));
            if (user.email) {
              localStorage.setItem(`lms_student_classes_${user.email.toLowerCase()}`, JSON.stringify(cloudApproved));
            }
            if (user.username) {
              localStorage.setItem(`lms_student_classes_${user.username.toLowerCase()}`, JSON.stringify(cloudApproved));
            }

            // Xóa mọi request pending cũ của các lớp đã được duyệt
            const userPendingKey = `lms_user_pending_requests_${user.id}`;
            const pendingArr: string[] = JSON.parse(localStorage.getItem(userPendingKey) || '[]');
            const cleanedPending = pendingArr.filter((id) => !cloudApproved.includes(id));
            localStorage.setItem(userPendingKey, JSON.stringify(cleanedPending));

            // Dọn sạch luôn danh sách pending trong từng lớp
            cloudApproved.forEach((cId: string) => {
              const cpKey = `lms_class_pending_requests_${cId}`;
              try {
                const cpArr = JSON.parse(localStorage.getItem(cpKey) || '[]');
                if (Array.isArray(cpArr)) {
                  const cleanedCp = cpArr.filter((p: any) => p.user_id !== user.id && p.user?.email !== user.email);
                  localStorage.setItem(cpKey, JSON.stringify(cleanedCp));
                }
              } catch {}
            });

            if (isMounted) {
              setIsEnrolled(true);
            }
          } else {
            // Khi Cloud đã phản hồi thành công và approvedClasses rỗng (học sinh chưa vào lớp nào hoặc đã bị Thầy xóa)
            localStorage.setItem(key, JSON.stringify([]));
            if (user.email) {
              localStorage.setItem(`lms_student_classes_${user.email.toLowerCase()}`, JSON.stringify([]));
            }
            if (user.username) {
              localStorage.setItem(`lms_student_classes_${user.username.toLowerCase()}`, JSON.stringify([]));
            }
            if (isMounted) {
              setIsEnrolled(false);
            }
          }

          if (Array.isArray(syncData.pendingClasses)) {
            localStorage.setItem(`lms_user_pending_requests_${user.id}`, JSON.stringify(syncData.pendingClasses));
          }
        }
      } catch (e) {
        console.error('Check enrollment error:', e);
      }

      // 4. Đánh giá quyền chính thức: Học sinh phải thuộc ít nhất 1 lớp thực tế
      if (isMounted) {
        const enrolled = isUserEnrolledInAnyClass(user);
        setIsEnrolled(enrolled);
        setHasCheckedEnrollment(true);
      }
    };

    checkEnrollment();
    window.addEventListener('lms_enrollment_changed', checkEnrollment);

    // Kích hoạt đồng bộ thời gian thực toàn cục (đa tab + Supabase WebSocket)
    const cleanupRealtime = setupRealtimeSync({
      onEnrollmentChange: checkEnrollment,
      onClassesChange: () => {
        fetch('/api/classes')
          .then((r) => r.json())
          .then((d) => {
            if (d.success && Array.isArray(d.classes)) {
              localStorage.setItem('lms_classes', JSON.stringify(d.classes));
            }
          })
          .catch(() => {});
        checkEnrollment();
      },
    });

    return () => {
      isMounted = false;
      window.removeEventListener('lms_enrollment_changed', checkEnrollment);
      cleanupRealtime();
    };
  }, [user]);

  const isTakeExamPage = pathname.includes('/take');
  const isEditorPage = pathname.includes('/exams/editor');
  const isAuthPage = pathname === '/login' || pathname === '/register';

  // Xác định nội dung cần hiển thị theo phân quyền
  const renderContent = () => {
    // 1. Các trang đăng nhập / đăng ký: Luôn cho phép hiển thị
    if (isAuthPage) {
      return children;
    }

    // 2. Chờ tải thông tin tài khoản nếu Auth đang nạp
    if (isLoading) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center p-8">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className="text-xs font-semibold text-slate-500">Đang tải tài khoản...</span>
          </div>
        </div>
      );
    }

    // 3. Khách chưa đăng nhập:
    // Nếu ở Trang chủ (/): Cho phép xem Landing Page giới thiệu VNS Math
    // Nếu ở các trang nội bộ khác: Hiển thị tường bảo vệ GuestAuthWall yêu cầu đăng nhập
    if (!user) {
      if (pathname === '/') {
        return children;
      }
      return <GuestAuthWall />;
    }

    // 4. Giáo viên hoặc Quản trị viên: Toàn quyền truy cập
    if (user.role === 'teacher' || user.role === 'admin') {
      return children;
    }

    // 5. Học sinh ĐÃ ĐƯỢC VÀO LỚP: Cho phép truy cập ngay, không bao giờ out!
    if (isEnrolled) {
      return children;
    }

    // 6. Nếu đang kiểm tra xác thực lần đầu: Hiện loading êm dịu, tuyệt đối không flash phòng chờ
    if (!hasCheckedEnrollment) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center p-8">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className="text-xs font-semibold text-slate-500">Đang đồng bộ lớp học...</span>
          </div>
        </div>
      );
    }

    // 7. Học sinh THỰC SỰ CHƯA VÀO LỚP: Hiển thị phòng chờ nhập mã
    return <StudentPendingApprovalView />;
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans">
      {!isTakeExamPage && !isEditorPage && (
        <Sidebar
          isCollapsed={isSidebarCollapsed}
          onToggle={toggleSidebar}
        />
      )}

      {/* Nút nổi "Hiện thanh bên" khi thanh bên đang bị ẩn trên Desktop */}
      {isSidebarCollapsed && !isTakeExamPage && !isEditorPage && (
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
          isTakeExamPage || isEditorPage || isSidebarCollapsed ? 'w-full lg:pl-0' : 'lg:pl-64'
        }`}
      >
        <main
          className={
            isEditorPage
              ? 'flex-1 w-full h-screen overflow-hidden p-0'
              : 'flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6'
          }
        >
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
