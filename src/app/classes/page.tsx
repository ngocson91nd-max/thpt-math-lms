'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { MOCK_CLASSES, MOCK_USERS } from '@/lib/supabase/mockStore';
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
} from 'lucide-react';

export default function ClassesPage() {
  const { user, isTeacher, isStudent } = useAuth();
  const [classes, setClasses] = useState<ClassItem[]>(MOCK_CLASSES);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassItem | null>(null);

  // Create Form State
  const [className, setClassName] = useState('');
  const [classCode, setClassCode] = useState('');
  const [grade, setGrade] = useState<10 | 11 | 12>(12);
  const [desc, setDesc] = useState('');

  // Edit Form State
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editGrade, setEditGrade] = useState<10 | 11 | 12>(12);
  const [editDesc, setEditDesc] = useState('');
  const [editYear, setEditYear] = useState('2025-2026');

  // Join state
  const [joinInput, setJoinInput] = useState('');
  const [joinSuccess, setJoinSuccess] = useState(false);

  // Tải danh sách lớp từ localStorage hoặc Supabase
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('lms_classes');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            setClasses(parsed);
            return;
          }
        } catch (e) {
          console.error(e);
        }
      }
    }

    const supabase = createClient();
    if (supabase) {
      supabase
        .from('classes')
        .select('*')
        .then(({ data, error }) => {
          if (!error && data && data.length > 0) {
            setClasses(data as any);
            if (typeof window !== 'undefined') {
              localStorage.setItem('lms_classes', JSON.stringify(data));
            }
          }
        });
    }
  }, []);

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!className.trim()) return;

    const newId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `c-${Date.now()}`;

    const finalCode =
      classCode.trim().toUpperCase() || `TOAN${grade}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newClass: ClassItem = {
      id: newId,
      name: className.trim(),
      code: finalCode,
      grade,
      academic_year: '2025-2026',
      teacher_id: user?.id || '22222222-2222-2222-2222-222222222222',
      teacher: user || MOCK_USERS[1],
      description: desc.trim() || 'Lớp bồi dưỡng và luyện thi THPT Thầy Sơn.',
      is_active: true,
      member_count: 0,
    };

    const updated = [newClass, ...classes];
    setClasses(updated);

    if (typeof window !== 'undefined') {
      localStorage.setItem('lms_classes', JSON.stringify(updated));
    }

    try {
      const supabase = createClient();
      if (supabase && user) {
        await supabase.from('classes').insert([
          {
            id: newId,
            name: newClass.name,
            code: newClass.code,
            grade: newClass.grade,
            academic_year: newClass.academic_year,
            teacher_id: user.id,
            description: newClass.description,
            is_active: true,
          },
        ]);
      }
    } catch (err) {
      console.warn('Lỗi khi thêm lớp vào Supabase:', err);
    }

    setShowCreateModal(false);
    setClassName('');
    setClassCode('');
    setDesc('');
  };

  const openEditModal = (c: ClassItem) => {
    setEditingClass(c);
    setEditName(c.name);
    setEditCode(c.code);
    setEditGrade(c.grade);
    setEditDesc(c.description || '');
    setEditYear(c.academic_year || '2025-2026');
    setShowEditModal(true);
  };

  const handleUpdateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClass || !editName.trim()) return;

    const updated = classes.map((c) => {
      if (c.id === editingClass.id) {
        return {
          ...c,
          name: editName.trim(),
          code: editCode.trim().toUpperCase() || c.code,
          grade: editGrade,
          description: editDesc.trim(),
          academic_year: editYear.trim(),
        };
      }
      return c;
    });

    setClasses(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('lms_classes', JSON.stringify(updated));
    }

    try {
      const supabase = createClient();
      if (supabase) {
        await supabase
          .from('classes')
          .update({
            name: editName.trim(),
            code: editCode.trim().toUpperCase() || editingClass.code,
            grade: editGrade,
            description: editDesc.trim(),
            academic_year: editYear.trim(),
          })
          .eq('id', editingClass.id);
      }
    } catch (err) {
      console.warn('Lỗi khi cập nhật lớp trên Supabase:', err);
    }

    setShowEditModal(false);
    setEditingClass(null);
  };

  const handleDeleteClass = async (classId: string, name: string) => {
    const isConfirmed = confirm(
      `Thầy có chắc chắn muốn xóa "${name}" không?\nToàn bộ dữ liệu của lớp này sẽ bị xóa khỏi hệ thống.`
    );
    if (!isConfirmed) return;

    const updated = classes.filter((c) => c.id !== classId);
    setClasses(updated);

    if (typeof window !== 'undefined') {
      localStorage.setItem('lms_classes', JSON.stringify(updated));
    }

    try {
      const supabase = createClient();
      if (supabase) {
        await supabase.from('classes').delete().eq('id', classId);
      }
    } catch (err) {
      console.warn('Lỗi khi xóa lớp trên Supabase:', err);
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
      {classes.length === 0 ? (
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
              className="flex flex-col justify-between rounded-3xl border border-slate-200/90 bg-white p-7 shadow-xs hover:shadow-md transition hover:border-blue-200"
            >
              <div>
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                      Toán Lớp {c.grade}
                    </span>
                    {(() => {
                      if (typeof window === 'undefined') return null;
                      try {
                        const raw = localStorage.getItem(`lms_class_pending_requests_${c.id}`);
                        const count = raw ? JSON.parse(raw).length : 0;
                        if (count > 0) {
                          return (
                            <span className="rounded-full bg-amber-100 border border-amber-300 px-2.5 py-0.5 text-[10px] font-black text-amber-800 animate-pulse flex items-center gap-1">
                              <Clock className="h-3 w-3 text-amber-600" />
                              <span>{count} chờ duyệt</span>
                            </span>
                          );
                        }
                      } catch {}
                      return null;
                    })()}
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    <span>Năm học {c.academic_year || '2025-2026'}</span>
                  </div>
                </div>

                <h2 className="text-xl font-bold text-slate-900 leading-snug">{c.name}</h2>
                <p className="mt-2 text-xs text-slate-500 leading-relaxed line-clamp-2">
                  {c.description || 'Lớp bồi dưỡng và luyện thi THPT Thầy Sơn.'}
                </p>

                {/* Invite Code Box */}
                <div className="mt-5 rounded-2xl bg-slate-50 p-4 border border-slate-100 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[10px] font-semibold uppercase text-slate-400">
                      Mã Lớp Học (Dành Cho Học Sinh):
                    </div>
                    <div className="font-mono text-sm font-bold text-slate-900 tracking-wider">
                      {c.code}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => copyCode(c.code)}
                    className="flex items-center gap-1 rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 border border-slate-200 hover:bg-slate-50 shadow-2xs transition"
                  >
                    {copiedCode === c.code ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        <span className="text-emerald-600 font-bold">Đã chép</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5 text-slate-400" />
                        <span>Sao chép</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Users className="h-4 w-4 text-blue-600" />
                  <span>{c.member_count ?? 36} học sinh</span>
                </div>

                <div className="flex items-center gap-2">
                  {isTeacher && (
                    <>
                      <button
                        type="button"
                        onClick={() => openEditModal(c)}
                        className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-200 transition"
                        title="Chỉnh sửa lớp học"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span>Sửa</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteClass(c.id, c.name)}
                        className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition"
                        title="Xóa lớp học"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Xóa</span>
                      </button>
                    </>
                  )}

                  <Link
                    href={`/classes/${c.id}`}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-blue-50 px-3.5 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 transition"
                  >
                    <span>Vào lớp</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Tạo Lớp Học Mới */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <h2 className="text-xl font-bold text-slate-900">Tạo Lớp Học Trực Tuyến Mới</h2>
            <p className="mt-1 text-xs text-slate-500">
              Khởi tạo lớp mới của Thầy Sơn và cung cấp mã tham gia cho học sinh.
            </p>

            <form onSubmit={handleCreateClass} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tên lớp học <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  placeholder="Ví dụ: 12A1 Chuyên Toán..."
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                />
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
                    Mã vào lớp (Tùy chọn)
                  </label>
                  <input
                    type="text"
                    value={classCode}
                    onChange={(e) => setClassCode(e.target.value)}
                    placeholder="Tự động nếu bỏ trống"
                    className="w-full rounded-xl border border-slate-200 p-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-mono uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mô tả lớp học
                </label>
                <textarea
                  rows={2}
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="Thông tin mục tiêu ôn luyện, lịch học trực tuyến..."
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition shadow-sm"
                >
                  Lưu & Tạo Lớp
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Chỉnh Sửa Lớp Học */}
      {showEditModal && editingClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <h2 className="text-xl font-bold text-slate-900">Chỉnh Sửa Lớp Học</h2>
            <p className="mt-1 text-xs text-slate-500">
              Cập nhật thông tin lớp học của Thầy Sơn.
            </p>

            <form onSubmit={handleUpdateClass} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tên lớp học <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Ví dụ: Lớp 12A1 Chuyên Toán..."
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                />
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Năm học</label>
                  <input
                    type="text"
                    value={editYear}
                    onChange={(e) => setEditYear(e.target.value)}
                    placeholder="2025-2026"
                    className="w-full rounded-xl border border-slate-200 p-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
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

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mô tả lớp học
                </label>
                <textarea
                  rows={2}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  placeholder="Thông tin mục tiêu ôn luyện, lịch học trực tuyến..."
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingClass(null);
                  }}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition shadow-sm"
                >
                  Lưu Thay Đổi
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
