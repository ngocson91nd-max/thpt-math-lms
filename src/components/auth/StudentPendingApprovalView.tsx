'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { joinClassWithCode } from '@/lib/auth/enrollment';
import { ClassItem } from '@/types/database';
import {
  GraduationCap,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  LogOut,
  Sparkles,
  MessageCircle,
  Loader2,
  Clock,
  ShieldAlert,
  RefreshCw,
} from 'lucide-react';

export const StudentPendingApprovalView: React.FC = () => {
  const router = useRouter();
  const { user, signOut } = useAuth();

  const [classCodeInput, setClassCodeInput] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [codeSuccess, setCodeSuccess] = useState<string | null>(null);
  const [isSubmittingCode, setIsSubmittingCode] = useState(false);
  const [pendingClasses, setPendingClasses] = useState<ClassItem[]>([]);

  // Nạp danh sách lớp đang chờ duyệt của học sinh này
  const loadPendingClasses = () => {
    if (typeof window === 'undefined' || !user) return;
    try {
      const classesRaw = localStorage.getItem('lms_classes');
      const classes: ClassItem[] = classesRaw ? JSON.parse(classesRaw) : [];

      const userPendingRaw = localStorage.getItem(`lms_user_pending_requests_${user.id}`);
      const userPendingIds: string[] = userPendingRaw ? JSON.parse(userPendingRaw) : [];

      const foundList: ClassItem[] = [];
      classes.forEach((c) => {
        // Kiểm tra qua danh sách user pending
        if (userPendingIds.includes(c.id)) {
          foundList.push(c);
          return;
        }
        // Kiểm tra trong pending requests của từng lớp
        const cPendingRaw = localStorage.getItem(`lms_class_pending_requests_${c.id}`);
        if (cPendingRaw) {
          const cPending: any[] = JSON.parse(cPendingRaw);
          const isPending = cPending.some(
            (p) =>
              p.user_id === user.id ||
              (user.email && p.user?.email && p.user.email.toLowerCase() === user.email.toLowerCase())
          );
          if (isPending && !foundList.some((f) => f.id === c.id)) {
            foundList.push(c);
          }
        }
      });
      setPendingClasses(foundList);
    } catch (e) {
      console.error(e);
    }
  };

  const [isCheckingNow, setIsCheckingNow] = useState(false);
  const [isApprovedSuccess, setIsApprovedSuccess] = useState(false);

  const handleApplyApproved = (approvedList: string[]) => {
    if (!user || approvedList.length === 0) return;
    setIsApprovedSuccess(true);
    const studentClassesKey = `lms_student_classes_${user.id}`;
    localStorage.setItem(studentClassesKey, JSON.stringify(approvedList));
    if (user.email) {
      localStorage.setItem(`lms_student_classes_${user.email.toLowerCase()}`, JSON.stringify(approvedList));
    }

    // Xóa triệt để các lớp đã được duyệt khỏi danh sách chờ của học sinh
    const uPendKey = `lms_user_pending_requests_${user.id}`;
    const uPend: string[] = JSON.parse(localStorage.getItem(uPendKey) || '[]');
    const remainingPend = uPend.filter((id) => !approvedList.includes(id));
    localStorage.setItem(uPendKey, JSON.stringify(remainingPend));

    // Dọn sạch luôn danh sách pending trong từng lớp để không bị kẹt cache
    approvedList.forEach((cId) => {
      const cpKey = `lms_class_pending_requests_${cId}`;
      try {
        const cpArr = JSON.parse(localStorage.getItem(cpKey) || '[]');
        if (Array.isArray(cpArr)) {
          const cleaned = cpArr.filter((p: any) => p.user_id !== user.id && p.user?.email !== user.email);
          localStorage.setItem(cpKey, JSON.stringify(cleaned));
        }
      } catch {}
    });

    setPendingClasses([]);

    // Bắn event để AppLayout mở khóa phòng thi ngay tức thì mà KHÔNG CẦN reload trang
    window.dispatchEvent(new Event('lms_enrollment_changed'));
  };

  const triggerCheckApproval = async (manual = false) => {
    if (!user || isApprovedSuccess) return;
    if (manual) setIsCheckingNow(true);
    try {
      const r = await fetch(
        `/api/cloud-sync?userId=${encodeURIComponent(user.id)}&email=${encodeURIComponent(user.email || '')}&t=${Date.now()}`,
        { cache: 'no-store' }
      );
      const res = await r.json();
      if (res.success && Array.isArray(res.approvedClasses) && res.approvedClasses.length > 0) {
        handleApplyApproved(res.approvedClasses);
      }
    } catch (e) {
      console.warn('Lỗi kiểm tra duyệt:', e);
    } finally {
      if (manual) setIsCheckingNow(false);
    }
  };

  useEffect(() => {
    // Nếu đã được duyệt thành công thì dừng toàn bộ polling để chống nháy màn hình
    if (isApprovedSuccess) return;

    // 1. Tải danh sách lớp thực tế âm thầm từ Supabase Cloud để cập nhật cache mã lớp
    fetch('/api/classes')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.classes)) {
          if (typeof window !== 'undefined') {
            localStorage.setItem('lms_classes', JSON.stringify(data.classes));
            localStorage.removeItem('lms_deleted_class_ids');
            loadPendingClasses();
          }
        }
      })
      .catch(console.error);

    loadPendingClasses();

    // 2. Định kỳ kiểm tra (polling 3s/lần) xem Thầy Sơn đã duyệt học sinh chưa
    if (!user) return;

    triggerCheckApproval(false);
    const interval = setInterval(() => {
      triggerCheckApproval(false);
    }, 3000);
    return () => clearInterval(interval);
  }, [user, isApprovedSuccess]);

  const handleJoinWithCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setCodeError(null);
    setCodeSuccess(null);

    const trimmed = classCodeInput.trim().toUpperCase();
    if (!trimmed) {
      setCodeError('Vui lòng nhập mã lớp học do Thầy Sơn cấp!');
      return;
    }

    setIsSubmittingCode(true);
    const result = joinClassWithCode(user, trimmed);

    if (result.success) {
      setCodeSuccess(result.message);
      setClassCodeInput('');
      loadPendingClasses();
      setIsSubmittingCode(false);
    } else {
      setCodeError(result.message);
      setIsSubmittingCode(false);
    }
  };

  return (
    <div className="min-h-[75vh] flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-7 sm:p-9 shadow-lg shadow-blue-900/5 text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Biểu tượng trạng thái */}
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-tr from-amber-500 to-indigo-600 text-white shadow-lg shadow-amber-500/25">
          <KeyRound className="h-10 w-10 stroke-[2.2]" />
        </div>

        {/* Thông điệp chào mừng */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-xs font-bold text-blue-700">
            <Sparkles className="h-3.5 w-3.5 text-blue-600" />
            <span>Toán Thầy Sơn THPT</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Chào mừng em, {user?.full_name || 'Học sinh'}!
          </h1>

          <p className="text-xs sm:text-sm text-slate-500 leading-relaxed max-w-md mx-auto">
            Nhập <strong>Mã Lớp Học</strong> để gửi yêu cầu tham gia lớp. Đề thi và bài giảng sẽ được kích hoạt ngay khi <strong>Thầy Sơn phê duyệt</strong>.
          </p>
        </div>

        {/* Khối hiển thị khi đã được duyệt thành công */}
        {isApprovedSuccess && (
          <div className="rounded-2xl border-2 border-emerald-400 bg-emerald-50 p-5 text-center space-y-3 animate-in zoom-in-95">
            <div className="w-12 h-12 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto shadow-md">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">Thầy Sơn đã phê duyệt vào lớp!</h3>
              <p className="text-xs text-emerald-800 mt-1">Đang tự động chuyển hướng đến danh sách đề thi...</p>
            </div>
            <button
              type="button"
              onClick={() => {
                window.dispatchEvent(new Event('lms_enrollment_changed'));
                router.replace('/exams');
              }}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm transition shadow-sm cursor-pointer"
            >
              <span>Vào làm bài thi ngay</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Khối hiển thị các lớp đang chờ Thầy Sơn duyệt */}
        {!isApprovedSuccess && pendingClasses.length > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-left space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between text-xs font-bold text-amber-900">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-600 animate-pulse shrink-0" />
                <span>Yêu cầu đang chờ Thầy Sơn phê duyệt ({pendingClasses.length}):</span>
              </div>
              <button
                type="button"
                onClick={() => triggerCheckApproval(true)}
                disabled={isCheckingNow}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-[11px] font-semibold transition cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`h-3 w-3 ${isCheckingNow ? 'animate-spin text-blue-600' : 'text-amber-600'}`} />
                <span>{isCheckingNow ? 'Đang kiểm tra...' : 'Kiểm tra ngay'}</span>
              </button>
            </div>

            <div className="space-y-2">
              {pendingClasses.map((cls) => (
                <div
                  key={cls.id}
                  className="flex items-center justify-between bg-white px-3.5 py-2.5 rounded-xl border border-amber-200 shadow-2xs text-xs"
                >
                  <div>
                    <div className="font-extrabold text-slate-900">{cls.name}</div>
                    <div className="text-[11px] text-slate-400">Toán Lớp {cls.grade}</div>
                  </div>
                  <div className="text-right">
                    <span className="inline-block font-mono text-[11px] font-bold text-amber-700 bg-amber-100/70 border border-amber-300 px-2 py-0.5 rounded-md">
                      Mã: {cls.code}
                    </span>
                    <div className="text-[10px] text-amber-600 font-semibold mt-0.5">Chờ Thầy duyệt...</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between gap-2 text-[11px] text-amber-700 pt-1 border-t border-amber-200/60">
              <div className="flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-600 shrink-0" />
                <span>Hệ thống đang tự động kiểm tra mỗi 2.5s...</span>
              </div>
              <button
                type="button"
                onClick={() => triggerCheckApproval(true)}
                className="text-blue-700 hover:underline font-bold cursor-pointer"
              >
                Tải lại trạng thái
              </button>
            </div>
          </div>
        )}

        {/* Form nhập mã lớp */}
        <form onSubmit={handleJoinWithCode} className="space-y-3.5 pt-1">
          <div>
            <label className="block text-xs font-semibold text-slate-700 text-left mb-1.5">
              Nhập mã tham gia lớp học mới:
            </label>
            <input
              type="text"
              value={classCodeInput}
              onChange={(e) => setClassCodeInput(e.target.value.toUpperCase())}
              placeholder="VD: TOAN12-6084"
              autoFocus={pendingClasses.length === 0}
              className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50/70 p-4 text-center font-mono text-base sm:text-lg font-extrabold tracking-widest text-slate-900 uppercase placeholder:text-slate-400 placeholder:font-sans placeholder:tracking-normal focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-100 transition"
            />
          </div>

          {codeError && (
            <div className="rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700 border border-rose-200 text-center animate-in fade-in">
              {codeError}
            </div>
          )}

          {codeSuccess && (
            <div className="rounded-xl bg-emerald-50 p-3 text-xs font-bold text-emerald-700 border border-emerald-200 text-center flex items-center justify-center gap-1.5 animate-in fade-in">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>{codeSuccess}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmittingCode}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3.5 text-sm sm:text-base font-bold text-white shadow-md shadow-blue-500/25 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 transition cursor-pointer active:scale-[0.99]"
          >
            {isSubmittingCode ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Đang gửi yêu cầu...</span>
              </>
            ) : (
              <>
                <span>Gửi Yêu Cầu Vào Lớp</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        {/* Hướng dẫn trợ giúp & Đăng xuất */}
        <div className="pt-4 border-t border-slate-100 space-y-3">
          <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
            <MessageCircle className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>
              Chưa có mã lớp? Hãy liên hệ với <strong>Thầy Sơn</strong> qua nhóm Zalo lớp.
            </span>
          </div>

          <div>
            <button
              type="button"
              onClick={() => signOut()}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-rose-600 transition cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Đăng xuất tài khoản</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentPendingApprovalView;
