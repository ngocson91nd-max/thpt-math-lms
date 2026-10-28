'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { joinClassWithCode } from '@/lib/auth/enrollment';
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
} from 'lucide-react';

export const StudentPendingApprovalView: React.FC = () => {
  const router = useRouter();
  const { user, signOut } = useAuth();

  const [classCodeInput, setClassCodeInput] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [codeSuccess, setCodeSuccess] = useState<string | null>(null);
  const [isSubmittingCode, setIsSubmittingCode] = useState(false);

  useEffect(() => {
    // 1. Tải danh sách lớp thực tế âm thầm từ Supabase Cloud để cập nhật cache mã lớp
    fetch('/api/classes')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.classes)) {
          if (typeof window !== 'undefined') {
            localStorage.setItem('lms_classes', JSON.stringify(data.classes));
            localStorage.removeItem('lms_deleted_class_ids');
          }
        }
      })
      .catch(console.error);

    // 2. Kiểm tra nếu Thầy Sơn đã duyệt học sinh trên Cloud
    if (user) {
      fetch(`/api/cloud-sync?userId=${user.id}`)
        .then((r) => r.json())
        .then((res) => {
          if (res.success && Array.isArray(res.approvedClasses) && res.approvedClasses.length > 0) {
            const studentClassesKey = `lms_student_classes_${user.id}`;
            const existing: string[] = JSON.parse(localStorage.getItem(studentClassesKey) || '[]');
            const merged = Array.from(new Set([...existing, ...res.approvedClasses]));
            localStorage.setItem(studentClassesKey, JSON.stringify(merged));
            window.location.reload();
          }
        })
        .catch(() => {});
    }
  }, [user]);

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
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } else {
      setCodeError(result.message);
      setIsSubmittingCode(false);
    }
  };

  return (
    <div className="min-h-[75vh] flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-7 sm:p-9 shadow-lg shadow-blue-900/5 text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Biểu tượng thương hiệu Toán Thầy Sơn */}
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25">
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
            Nhập <strong>Mã Lớp Học</strong> do Thầy Sơn cấp qua Zalo để mở khóa đề thi và bắt đầu học ngay.
          </p>
        </div>

        {/* Form nhập mã lớp duy nhất (tối giản, trực quan) */}
        <form onSubmit={handleJoinWithCode} className="space-y-3.5 pt-2">
          <div>
            <input
              type="text"
              value={classCodeInput}
              onChange={(e) => setClassCodeInput(e.target.value.toUpperCase())}
              placeholder="VD: TOAN12-2150"
              autoFocus
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
                <span>Đang kích hoạt...</span>
              </>
            ) : (
              <>
                <span>Kích Hoạt & Vào Học Ngay</span>
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
