'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { MOCK_CLASSES, MOCK_USERS, MOCK_CLASS_MEMBERS } from '@/lib/supabase/mockStore';
import { ClassItem } from '@/types/database';
import { createClient } from '@/lib/supabase/client';
import {
  GraduationCap,
  Plus,
  Users,
  Copy,
  Check,
  Calendar,
  Key,
  ArrowRight,
  Trash2,
  AlertCircle,
  Sparkles,
  Pencil,
  Clock,
  ClipboardList,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  ShieldCheck,
} from 'lucide-react';

export default function ClassesPage() {
  const router = useRouter();
  const { user, isTeacher, isStudent } = useAuth();
  // Khởi tạo ngay lập tức từ bộ nhớ trình duyệt (0ms) để không bị trễ khi chuyển trang
  const [classes, setClasses] = useState<ClassItem[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const savedDeleted = localStorage.getItem('lms_deleted_class_ids');
      const deletedIds = new Set<string>(savedDeleted ? JSON.parse(savedDeleted) : []);
      const saved = localStorage.getItem('lms_classes');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.filter((c: any) => !deletedIds.has(c.id) && !deletedIds.has(c.code));
        }
      }
    } catch {}
    return [];
  });
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      const saved = localStorage.getItem('lms_classes');
      if (saved && JSON.parse(saved).length > 0) return false;
    } catch {}
    return true;
  });
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Phân quyền: Học sinh không cần xem danh mục quản lý lớp, chuyển hướng sang danh sách đề thi
  useEffect(() => {
    if (user && !isTeacher) {
      router.replace('/exams');
    }
  }, [user, isTeacher, router]);

  // Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassItem | null>(null);

  // Create Form State (Chuẩn iExam Ảnh 2)
  const [className, setClassName] = useState('');
  const [classCode, setClassCode] = useState('');
  const [grade, setGrade] = useState<10 | 11 | 12>(12);
  const [desc, setDesc] = useState('');
  const [createYear, setCreateYear] = useState('2026-2027');
  const [createJoinMode, setCreateJoinMode] = useState<'free' | 'approval'>('approval');
  const [createPassword, setCreatePassword] = useState('');
  const [showCreatePass, setShowCreatePass] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit Form State (Chuẩn iExam Ảnh 2)
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editGrade, setEditGrade] = useState<10 | 11 | 12>(12);
  const [editDesc, setEditDesc] = useState('');
  const [editYear, setEditYear] = useState('2026-2027');
  const [editJoinMode, setEditJoinMode] = useState<'free' | 'approval'>('approval');
  const [editPassword, setEditPassword] = useState('');
  const [showEditPass, setShowEditPass] = useState(false);

  // Join state
  const [joinInput, setJoinInput] = useState('');
  const [joinSuccess, setJoinSuccess] = useState(false);

  // Tải danh sách lớp học thời gian thực trực tiếp từ Supabase Cloud
  const fetchClasses = async () => {
    try {
      const res = await fetch('/api/classes');
      const data = await res.json();
      if (data.success && Array.isArray(data.classes)) {
        setClasses(data.classes);
        if (typeof window !== 'undefined') {
          localStorage.setItem('lms_classes', JSON.stringify(data.classes));
          localStorage.removeItem('lms_deleted_class_ids');
        }
      }
    } catch (e) {
      console.error('Fetch classes error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClasses();
    window.addEventListener('lms_classes_updated', fetchClasses);
    return () => {
      window.removeEventListener('lms_classes_updated', fetchClasses);
    };
  }, []);

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!className.trim() || isSubmitting) return;

    const trimmedName = className.trim();
    const finalCode =
      classCode.trim().toUpperCase() || `TOAN${grade}-${Math.floor(1000 + Math.random() * 9000)}`;
    const tempId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `cls-${Date.now()}`;
    const selectedYear = createYear || '2026-2027';
    const finalDesc = desc.trim() || 'Lớp bồi dưỡng và luyện thi THPT Thầy Sơn.';

    const optimisticClass: ClassItem = {
      id: tempId,
      name: trimmedName,
      code: finalCode,
      grade,
      academic_year: selectedYear,
      teacher_id: user?.id || '11111111-1111-1111-1111-111111111111',
      description: finalDesc,
      is_active: true,
      join_mode: createJoinMode,
      join_password: createPassword.trim() || undefined,
      member_count: 0,
      pending_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // 1. Phản hồi tức thì 0ms (Optimistic UI):
    // Đóng modal và hiển thị ngay lớp mới trên màn hình
    setShowCreateModal(false);
    setClassName('');
    setClassCode('');
    setDesc('');
    setCreatePassword('');
    setCreateJoinMode('approval');
    setClasses((prev) => [optimisticClass, ...prev]);

    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('lms_classes');
        const list: ClassItem[] = raw ? JSON.parse(raw) : [];
        localStorage.setItem('lms_classes', JSON.stringify([optimisticClass, ...list]));
      } catch {}
    }

    // 2. Đồng bộ ngầm lên Supabase Cloud (Background Sync không làm đơ giao diện)
    try {
      setIsSubmitting(true);
      const res = await fetch('/api/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: tempId,
          name: trimmedName,
          code: finalCode,
          grade,
          academic_year: selectedYear,
          teacher_id: user?.id || '11111111-1111-1111-1111-111111111111',
          description: finalDesc,
          join_mode: createJoinMode,
          join_password: createPassword.trim() || null,
        }),
      });
      const data = await res.json();
      if (data.success && data.class) {
        setClasses((prev) =>
          prev.map((c) =>
            c.id === tempId ? { ...c, ...data.class, pending_count: 0, member_count: 0 } : c
          )
        );
      } else if (!data.success) {
        setClasses((prev) => prev.filter((c) => c.id !== tempId));
        alert('Lỗi tạo lớp trên Cloud: ' + (data.error || 'Vui lòng thử lại'));
      }
    } catch (err) {
      console.error('Lỗi khi thêm lớp vào Supabase:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (c: ClassItem) => {
    setEditingClass(c);
    setEditName(c.name);
    setEditCode(c.code);
    setEditGrade(c.grade);
    setEditDesc(c.description || '');
    setEditYear(c.academic_year || '2026-2027');
    setEditJoinMode(c.join_mode || 'approval');
    setEditPassword(c.join_password || '');
    setShowEditModal(true);
  };

  const handleUpdateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClass || !editName.trim()) return;

    const targetId = editingClass.id;
    const updatedData = {
      name: editName.trim(),
      code: editCode.trim().toUpperCase() || editingClass.code,
      grade: editGrade,
      description: editDesc.trim(),
      academic_year: editYear.trim(),
      join_mode: editJoinMode,
      join_password: editPassword.trim() || undefined,
    };

    // 1. Phản hồi tức thì 0ms trên giao diện
    setClasses((prev) =>
      prev.map((c) => (c.id === targetId ? { ...c, ...updatedData } : c))
    );
    setShowEditModal(false);
    setEditingClass(null);

    // 2. Gửi ngầm lên Cloud
    try {
      await fetch('/api/classes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: targetId,
          ...updatedData,
        }),
      });
    } catch (err) {
      console.error('Lỗi khi cập nhật lớp trên Supabase:', err);
    }
  };

  // Xóa vĩnh viễn lớp học khỏi hệ thống
  const handleDeleteClass = async (classId: string, name: string) => {
    const isConfirmed = confirm(
      `Thầy có chắc chắn muốn xóa vĩnh viễn lớp "${name}" không?\nToàn bộ dữ liệu của lớp này sẽ bị xóa khỏi hệ thống.`
    );
    if (!isConfirmed) return;

    // 1. Cập nhật giao diện và local cache ngay lập tức 0ms
    setClasses((prev) => prev.filter((c) => c.id !== classId));
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem('lms_classes');
      if (raw) {
        try {
          const parsed: ClassItem[] = JSON.parse(raw);
          localStorage.setItem('lms_classes', JSON.stringify(parsed.filter((c) => c.id !== classId)));
        } catch {}
      }
      localStorage.removeItem(`lms_class_members_${classId}`);
      localStorage.removeItem(`lms_class_pending_requests_${classId}`);
    }

    // 2. Xóa vĩnh viễn trên Supabase Cloud Database ngầm
    try {
      const res = await fetch(`/api/classes?id=${classId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) {
        alert('Lỗi xóa trên Cloud: ' + (data.error || 'Vui lòng thử lại'));
      }
    } catch (err) {
      console.error('Lỗi khi xóa lớp trên Cloud:', err);
    }
  };

  const handleJoinClass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinInput.trim()) return;

    const found = classes.find((c) => c.code.toLowerCase() === joinInput.trim().toLowerCase());
    if (found) {
      setJoinSuccess(true);
      setTimeout(() => {
        setJoinSuccess(false);
        setShowJoinModal(false);
        setJoinInput('');
      }, 1500);
    } else {
      alert('Không tìm thấy lớp học với mã này. Thầy/học sinh vui lòng kiểm tra lại!');
    }
  };

  if (user && !isTeacher) {
    return null;
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <GraduationCap className="h-8 w-8 text-blue-600 shrink-0" />
            Quản Lý Lớp Học - Toán Thầy Sơn
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Danh sách các lớp học trực tuyến, mã tham gia lớp và quản lý học sinh theo từng khối lớp 10, 11, 12.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isStudent && (
            <button
              onClick={() => setShowJoinModal(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-blue-600 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-100 transition shadow-2xs"
            >
              <Key className="h-4 w-4" />
              Nhập mã vào lớp
            </button>
          )}

          {isTeacher && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-500/20 hover:bg-blue-500 transition"
            >
              <Plus className="h-4 w-4" />
              Tạo Lớp Học Mới
            </button>
          )}
        </div>
      </div>

      {/* Class Cards Grid */}
      {isLoading && classes.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse">
          {[1, 2].map((i) => (
            <div key={i} className="rounded-3xl border border-slate-200 bg-white p-7 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="h-6 w-24 bg-slate-200 rounded-lg"></div>
                <div className="h-4 w-28 bg-slate-100 rounded-md"></div>
              </div>
              <div className="h-7 w-48 bg-slate-200 rounded-lg"></div>
              <div className="h-4 w-full bg-slate-100 rounded-md"></div>
              <div className="h-16 bg-slate-50 rounded-2xl border border-slate-100"></div>
              <div className="flex justify-between pt-2">
                <div className="h-9 w-28 bg-slate-100 rounded-xl"></div>
                <div className="h-9 w-24 bg-blue-100 rounded-xl"></div>
              </div>
            </div>
          ))}
        </div>
      ) : classes.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-xs">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 mb-3">
            <GraduationCap className="h-7 w-7" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Chưa có lớp học nào</h3>
          <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
            Thầy có thể tạo các lớp mới (ví dụ Lớp 12A1 Chuyên Toán, Lớp 11 Ôn Thi...) để phân phát đề thi và bài giảng.
          </p>
          {isTeacher && (
            <div className="mt-5">
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition"
              >
                <Plus className="h-4 w-4" />
                Tạo Lớp Học Mới Ngay
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {classes.map((c) => (
            <div
              key={c.id}
              className="flex flex-col justify-between rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xs hover:shadow-md transition hover:border-blue-200 space-y-5"
            >
              <div>
                {/* Header Thẻ: Mã Lớp & Ngày Tạo (Chuẩn iExam Ảnh 3) */}
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-black bg-slate-900 text-white px-2.5 py-1 rounded-lg tracking-wider flex items-center gap-1.5 shadow-2xs">
                      <span>{c.code}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => copyCode(c.code)}
                      className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition cursor-pointer"
                      title="Sao chép mã lớp"
                    >
                      {copiedCode === c.code ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    <span>{c.created_at ? new Date(c.created_at).toLocaleDateString('vi-VN') : '21/09/2026'}</span>
                  </div>
                </div>

                {/* Tên Lớp & Mô Tả */}
                <h2 className="text-xl font-black text-slate-900 leading-snug">{c.name}</h2>
                <p className="mt-1 text-xs text-slate-400 leading-relaxed line-clamp-2">
                  {c.description || 'Chưa có mô tả.'}
                </p>

                {/* Hàng Badge Chuẩn iExam (Ảnh 3) */}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {/* Sĩ số */}
                  <span className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 border border-blue-100">
                    <Users className="h-3.5 w-3.5" />
                    <span>{c.member_count || 0} học sinh</span>
                  </span>

                  {/* Mật khẩu */}
                  <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                    {c.join_password ? (
                      <>
                        <Lock className="h-3.5 w-3.5 text-amber-600" />
                        <span>Có MK</span>
                      </>
                    ) : (
                      <>
                        <Unlock className="h-3.5 w-3.5 text-slate-400" />
                        <span>Không MK</span>
                      </>
                    )}
                  </span>

                  {/* Cách vào lớp */}
                  <span
                    className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold ${
                      c.join_mode === 'free'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-purple-50 text-purple-700 border border-purple-200'
                    }`}
                  >
                    <span>{c.join_mode === 'free' ? 'Vào tự do' : 'Duyệt khi vào'}</span>
                  </span>

                  {/* Pending duyệt nếu có */}
                  {c.pending_count !== undefined && c.pending_count > 0 && (
                    <span className="rounded-lg bg-amber-100 border border-amber-300 px-2.5 py-1 text-xs font-black text-amber-800 animate-pulse flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-amber-600" />
                      <span>{c.pending_count} chờ duyệt</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Hàng Nút Thao Tác Dưới Cùng (Chuẩn iExam Ảnh 3) */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <Link
                  href={`/classes/${c.id}`}
                  prefetch={true}
                  className="inline-flex items-center gap-1 rounded-xl bg-blue-50 px-3.5 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 transition shadow-2xs"
                >
                  <span>Xem học sinh</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>

                <div className="flex items-center gap-2">
                  {isTeacher && (
                    <>
                      <button
                        type="button"
                        onClick={() => openEditModal(c)}
                        className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs cursor-pointer"
                        title="Chỉnh sửa lớp học"
                      >
                        <Pencil className="h-3.5 w-3.5 text-slate-500" />
                        <span>Sửa</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteClass(c.id, c.name)}
                        className="inline-flex items-center gap-1 rounded-xl bg-rose-50 border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition shadow-2xs cursor-pointer"
                        title="Xóa lớp học"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Xóa</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Tạo Lớp Học Mới (Chuẩn iExam Ảnh 2) */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-xl font-bold text-slate-900">Tạo Lớp Học Mới</h2>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateClass} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tên lớp *
                </label>
                <input
                  type="text"
                  required
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  placeholder="Ví dụ: 11 Anh 1, 12 Toán 1..."
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-medium"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Mật khẩu tham gia mới (Tùy chọn)
                  </label>
                  <span className="text-[10px] text-slate-400">Để trống nếu không cần</span>
                </div>
                <div className="relative">
                  <input
                    type={showCreatePass ? 'text' : 'password'}
                    value={createPassword}
                    onChange={(e) => setCreatePassword(e.target.value)}
                    placeholder="Để trống để không đặt mật khẩu"
                    className="w-full rounded-xl border border-slate-200 p-2.5 pr-9 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCreatePass(!showCreatePass)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showCreatePass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Cách vào lớp: 2 Card chọn (Chuẩn iExam Ảnh 2) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  Cách vào lớp
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setCreateJoinMode('free')}
                    className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                      createJoinMode === 'free'
                        ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/20'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-bold text-xs text-slate-900">Vào tự do</div>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                      Có mã lớp là vào ngay.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCreateJoinMode('approval')}
                    className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                      createJoinMode === 'approval'
                        ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/20'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-bold text-xs text-slate-900">Thầy cô duyệt</div>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                      Học sinh gửi yêu cầu, duyệt xong mới vào lớp.
                    </p>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Khối lớp</label>
                  <select
                    value={grade}
                    onChange={(e) => setGrade(Number(e.target.value) as any)}
                    className="w-full rounded-xl border border-slate-200 p-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                  >
                    <option value={12}>Lớp 12</option>
                    <option value={11}>Lớp 11</option>
                    <option value={10}>Lớp 10</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mã vào lớp
                  </label>
                  <input
                    type="text"
                    value={classCode}
                    onChange={(e) => setClassCode(e.target.value)}
                    placeholder="Tự động"
                    className="w-full rounded-xl border border-slate-200 p-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-mono uppercase"
                  />
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-500 disabled:opacity-50 transition shadow-sm cursor-pointer"
                >
                  {isSubmitting ? 'Đang tạo...' : 'Lưu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Chỉnh Sửa Lớp Học (Chuẩn iExam Ảnh 2) */}
      {showEditModal && editingClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-xl font-bold text-slate-900">Sửa lớp học</h2>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateClass} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tên lớp *
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Ví dụ: 11 Anh 1..."
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-medium"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Mật khẩu tham gia mới
                  </label>
                  <span className="text-[10px] text-slate-400">
                    {editingClass.join_password ? 'Đang có mật khẩu' : 'Không có mật khẩu'}
                  </span>
                </div>
                <div className="relative">
                  <input
                    type={showEditPass ? 'text' : 'password'}
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="Để trống để giữ nguyên mật khẩu"
                    className="w-full rounded-xl border border-slate-200 p-2.5 pr-9 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPass(!showEditPass)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showEditPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Cách vào lớp: 2 Card chọn (Chuẩn iExam Ảnh 2) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  Cách vào lớp
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setEditJoinMode('free')}
                    className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                      editJoinMode === 'free'
                        ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/20'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-bold text-xs text-slate-900">Vào tự do</div>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                      Có mã lớp là vào ngay.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditJoinMode('approval')}
                    className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                      editJoinMode === 'approval'
                        ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/20'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-bold text-xs text-slate-900">Thầy cô duyệt</div>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                      Học sinh gửi yêu cầu, duyệt xong mới vào lớp.
                    </p>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Khối lớp</label>
                  <select
                    value={editGrade}
                    onChange={(e) => setEditGrade(Number(e.target.value) as 10 | 11 | 12)}
                    className="w-full rounded-xl border border-slate-200 p-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                  >
                    <option value={12}>Lớp 12</option>
                    <option value={11}>Lớp 11</option>
                    <option value={10}>Lớp 10</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mã vào lớp
                  </label>
                  <input
                    type="text"
                    value={editCode}
                    onChange={(e) => setEditCode(e.target.value)}
                    placeholder="TOAN12A1"
                    className="w-full rounded-xl border border-slate-200 p-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-mono uppercase"
                  />
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingClass(null);
                  }}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-500 transition shadow-sm cursor-pointer"
                >
                  Lưu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Nhập mã vào lớp */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <h2 className="text-xl font-bold text-slate-900">Vào Lớp Học Của Thầy Sơn</h2>
            <p className="mt-1 text-xs text-slate-500">
              Nhập mã lớp do Thầy Sơn cung cấp để tham gia và nhận bài tập.
            </p>

            {joinSuccess ? (
              <div className="my-6 rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-center animate-in fade-in">
                <div className="text-emerald-700 font-bold text-sm mb-1">Tham gia thành công!</div>
                <div className="text-xs text-emerald-600">Đang chuyển bạn vào lớp học...</div>
              </div>
            ) : (
              <form onSubmit={handleJoinClass} className="mt-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mã Lớp Học (6-10 ký tự)
                  </label>
                  <input
                    type="text"
                    required
                    value={joinInput}
                    onChange={(e) => setJoinInput(e.target.value)}
                    placeholder="Ví dụ: TOAN12A1, TOAN11-8899..."
                    className="w-full rounded-xl border border-slate-200 p-3 text-center text-sm font-mono font-bold tracking-wider text-slate-900 uppercase focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowJoinModal(false)}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition shadow-sm"
                  >
                    Vào Lớp
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
