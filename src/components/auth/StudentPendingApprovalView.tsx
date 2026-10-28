'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { ClassItem } from '@/types/database';
import { MOCK_CLASSES } from '@/lib/supabase/mockStore';
import {
  joinClassWithCode,
  requestToJoinClass,
  getPendingClassRequestsForUser,
} from '@/lib/auth/enrollment';
import {
  GraduationCap,
  KeyRound,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Phone,
  MessageCircle,
  LogOut,
  Sparkles,
  BookOpen,
} from 'lucide-react';

export const StudentPendingApprovalView: React.FC = () => {
  const router = useRouter();
  const { user, signOut } = useAuth();

  const [classCodeInput, setClassCodeInput] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [codeSuccess, setCodeSuccess] = useState<string | null>(null);
  const [isSubmittingCode, setIsSubmittingCode] = useState(false);

  const [availableClasses, setAvailableClasses] = useState<ClassItem[]>(MOCK_CLASSES);
  const [pendingRequests, setPendingRequests] = useState<string[]>([]);
  const [requestNotice, setRequestNotice] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedDeletedCls = localStorage.getItem('lms_deleted_class_ids');
      const deletedClassIds = new Set<string>(savedDeletedCls ? JSON.parse(savedDeletedCls) : []);

      const saved = localStorage.getItem('lms_classes');
      const localClasses: ClassItem[] = saved ? JSON.parse(saved) : [];
      const combined = [...localClasses];
      MOCK_CLASSES.forEach((mock) => {
        if (!combined.some((c) => c.id === mock.id || c.code?.toUpperCase() === mock.code?.toUpperCase())) {
          combined.push(mock);
        }
      });
      const validClasses = combined.filter((c: any) => !deletedClassIds.has(c.id) && !deletedClassIds.has(c.code));
      setAvailableClasses(validClasses);
      localStorage.setItem('lms_classes', JSON.stringify(validClasses));

      if (user) {
        setPendingRequests(getPendingClassRequestsForUser(user.id));

        // Kiểm tra xem Thầy Sơn đã phê duyệt vào lớp trên Cloud chưa
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
    }
  }, [user]);

  const handleJoinWithCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setCodeError(null);
    setCodeSuccess(null);

    if (!classCodeInput.trim()) {
      setCodeError('Vui lòng nhập mã lớp học do Thầy Sơn cấp!');
      return;
    }

    setIsSubmittingCode(true);
    const result = joinClassWithCode(user, classCodeInput);

    if (result.success) {
      setCodeSuccess(result.message);
      setClassCodeInput('');
      setTimeout(() => {
        // Tải lại trang để mở khóa toàn bộ nội dung
        window.location.reload();
      }, 1200);
    } else {
      setCodeError(result.message);
      setIsSubmittingCode(false);
    }
  };

  const handleRequestJoin = (classId: string) => {
    if (!user) return;
    const res = requestToJoinClass(user, classId);
    if (res.success) {
      setPendingRequests((prev) => [...prev, classId]);
      setRequestNotice(res.message);

      // Đồng bộ ngay lập tức lên Cloud để mọi trình duyệt của Thầy Sơn nhận được
      fetch('/api/cloud-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'request_join',
          classId,
          user,
        }),
      }).catch(console.error);

      setTimeout(() => setRequestNotice(null), 4000);
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-4 max-w-4xl mx-auto space-y-8 animate-in fade-in duration-200">
      {/* 1. Header Card: Thông báo trạng thái */}
      <div className="w-full rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50/70 via-white to-amber-50/40 p-6 sm:p-8 shadow-md shadow-amber-500/5 text-center space-y-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-md shadow-amber-500/25">
          <Clock className="h-8 w-8 stroke-[2.5] animate-pulse" />
        </div>

        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
            <span>Tài Khoản Đang Chờ Duyệt Vào Lớp</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Chào mừng em, {user?.full_name || 'Học sinh'}!
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed max-w-xl mx-auto">
            Tài khoản của em đã được đăng ký thành công trên hệ thống <strong>Toán Thầy Sơn</strong>. Để xem được đề thi, làm bài trắc nghiệm và tải học liệu, em cần được <strong>Thầy Sơn thêm vào lớp học</strong>.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
        {/* CÁCH 1: NHẬP MÃ LỚP ĐỂ VÀO NGAY */}
        <div className="rounded-3xl border border-blue-200 bg-white p-6 sm:p-7 shadow-sm space-y-5 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 font-bold">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                  Cách 1 • Kích hoạt nhanh
                </span>
                <h2 className="text-base font-bold text-slate-900">Em đã có Mã Lớp của Thầy?</h2>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Nếu Thầy Sơn đã nhắn mã lớp trong nhóm Zalo lớp học (ví dụ: <code className="bg-slate-100 font-mono text-blue-700 px-1 py-0.5 rounded font-bold">TOAN12A1-2026</code>), em hãy nhập vào ô bên dưới để mở khóa ngay lập tức:
            </p>
          </div>

          <form onSubmit={handleJoinWithCode} className="space-y-3">
            <div>
              <input
                type="text"
                value={classCodeInput}
                onChange={(e) => setClassCodeInput(e.target.value.toUpperCase())}
                placeholder="Nhập mã lớp (VD: TOAN12A1-2026)..."
                className="w-full rounded-2xl border border-slate-300 bg-slate-50/50 p-3.5 text-center font-mono text-sm font-bold tracking-wider text-slate-900 uppercase focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {codeError && (
              <div className="rounded-xl bg-rose-50 p-2.5 text-xs font-medium text-rose-700 border border-rose-200 text-center">
                {codeError}
              </div>
            )}

            {codeSuccess && (
              <div className="rounded-xl bg-emerald-50 p-2.5 text-xs font-bold text-emerald-700 border border-emerald-200 text-center flex items-center justify-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" />
                <span>{codeSuccess}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmittingCode}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-md shadow-blue-600/20 hover:bg-blue-500 disabled:opacity-50 transition cursor-pointer"
            >
              <span>Kích Hoạt & Vào Lớp Ngay</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </div>

        {/* CÁCH 2: CHỌN LỚP ĐỂ GỬI YÊU CẦU XIN VÀO */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-7 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700 font-bold">
                <GraduationCap className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                  Cách 2 • Gửi duyệt online
                </span>
                <h2 className="text-base font-bold text-slate-900">Xin Thầy Sơn duyệt vào lớp</h2>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Chọn đúng khối lớp em đang theo học, bấm <strong>Xin vào lớp</strong> để Thầy Sơn phê duyệt trong danh sách lớp:
            </p>
          </div>

          {requestNotice && (
            <div className="rounded-xl bg-emerald-50 p-2.5 text-xs font-bold text-emerald-700 border border-emerald-200 text-center flex items-center justify-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" />
              <span>{requestNotice}</span>
            </div>
          )}

          <div className="space-y-2 overflow-y-auto max-h-56 pr-1">
            {availableClasses.map((c) => {
              const isRequested = pendingRequests.includes(c.id);
              return (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-slate-300 transition"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-xs text-slate-900 truncate">{c.name}</div>
                    <div className="text-[11px] text-slate-400">
                      Khối Lớp {c.grade} • Năm học {c.academic_year || '2025-2026'}
                    </div>
                  </div>

                  {isRequested ? (
                    <span className="shrink-0 rounded-xl bg-amber-100 px-3 py-1 text-[11px] font-bold text-amber-800 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>Đang chờ duyệt</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleRequestJoin(c.id)}
                      className="shrink-0 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-500 transition cursor-pointer shadow-2xs"
                    >
                      Xin vào lớp
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. Footer Hỗ Trợ & Zalo Thầy Sơn */}
      <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-3xl border border-slate-200 bg-white shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <MessageCircle className="h-5 w-5" />
          </div>
          <div className="text-xs text-slate-600">
            <span className="font-bold text-slate-900 block">Cần duyệt nhanh để vào kiểm tra ngay?</span>
            <span>Liên hệ Zalo Thầy Sơn hoặc báo với lớp trưởng để được phê duyệt tức thì.</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => signOut()}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Đăng xuất tài khoản</span>
        </button>
      </div>
    </div>
  );
};

export default StudentPendingApprovalView;
