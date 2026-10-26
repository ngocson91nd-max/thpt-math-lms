'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { MOCK_CLASSES, MOCK_USERS } from '@/lib/supabase/mockStore';
import { ClassItem } from '@/types/database';
import {
  GraduationCap,
  Plus,
  Users,
  Copy,
  Check,
  Calendar,
  Key,
  ArrowRight,
  UserPlus,
} from 'lucide-react';

export default function ClassesPage() {
  const { isTeacher, isStudent } = useAuth();
  const [classes, setClasses] = useState<ClassItem[]>(MOCK_CLASSES);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);

  // Form State
  const [className, setClassName] = useState('');
  const [classCode, setClassCode] = useState('');
  const [grade, setGrade] = useState<10 | 11 | 12>(12);
  const [desc, setDesc] = useState('');

  // Join state
  const [joinInput, setJoinInput] = useState('');
  const [joinSuccess, setJoinSuccess] = useState(false);

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleCreateClass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!className.trim()) return;

    const newClass: ClassItem = {
      id: `class-${Date.now()}`,
      name: className,
      code: classCode || `TOAN${grade}-${Math.floor(1000 + Math.random() * 9000)}`,
      grade,
      academic_year: '2025-2026',
      teacher_id: '22222222-2222-2222-2222-222222222222',
      teacher: MOCK_USERS[1],
      description: desc,
      is_active: true,
      member_count: 1,
    };

    setClasses([newClass, ...classes]);
    setShowCreateModal(false);
    setClassName('');
    setClassCode('');
    setDesc('');
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
      alert('Không tìm thấy lớp học với mã này. Vui lòng kiểm tra lại!');
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Quản Lý Lớp Học Toán THPT
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Danh sách các lớp học trực tuyến, mã tham gia lớp và quản lý học sinh theo từng khối lớp 10, 11, 12.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isStudent && (
            <button
              onClick={() => setShowJoinModal(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-blue-600 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-100 transition"
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {classes.map((c) => (
          <div
            key={c.id}
            className="flex flex-col justify-between rounded-3xl border border-slate-200/90 bg-white p-7 shadow-xs hover:shadow-md transition"
          >
            <div>
              <div className="flex items-center justify-between gap-3 mb-4">
                <span className="rounded-lg bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                  Lớp {c.grade}
                </span>

                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  <span>Năm học {c.academic_year}</span>
                </div>
              </div>

              <h2 className="text-xl font-bold text-slate-900 leading-snug">{c.name}</h2>
              <p className="mt-2 text-xs text-slate-500 leading-relaxed line-clamp-2">
                {c.description || 'Lớp bồi dưỡng và luyện thi THPT chất lượng cao.'}
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
                      <span className="text-emerald-600">Đã chép</span>
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
                <span>{c.member_count || 36} học sinh</span>
              </div>

              <Link
                href={`/classes/${c.id}`}
                className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700"
              >
                Vào lớp học <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Tạo Lớp Học Mới */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <h2 className="text-xl font-bold text-slate-900">Tạo Lớp Học Trực Tuyến</h2>
            <p className="mt-1 text-xs text-slate-500">
              Khởi tạo lớp mới và cung cấp mã tham gia cho học sinh.
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
                    className="w-full rounded-xl border border-slate-200 p-2 text-xs text-slate-900 focus:outline-none"
                  >
                    <option value={12}>Lớp 12</option>
                    <option value={11}>Lớp 11</option>
                    <option value={10}>Lớp 10</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Mã lớp</label>
                  <input
                    type="text"
                    value={classCode}
                    onChange={(e) => setClassCode(e.target.value)}
                    placeholder="Tùy chọn (tự sinh)"
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Mô tả</label>
                <textarea
                  rows={2}
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="Ghi chú về mục tiêu, định hướng lớp..."
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-blue-500"
                >
                  Tạo lớp
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Tham Gia Lớp Bằng Mã */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-2 text-blue-600 mb-2">
              <Key className="h-5 w-5" />
              <h2 className="text-lg font-bold text-slate-900">Tham Gia Lớp Học</h2>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Nhập mã lớp do thầy cô cung cấp (Ví dụ: <code>TOAN12A1-2026</code>) để ghi danh vào lớp.
            </p>

            <form onSubmit={handleJoinClass} className="mt-4 space-y-4">
              <div>
                <input
                  type="text"
                  required
                  value={joinInput}
                  onChange={(e) => setJoinInput(e.target.value)}
                  placeholder="Nhập mã lớp học..."
                  className="w-full rounded-xl border border-slate-200 p-3 text-sm font-mono font-bold text-center tracking-wider text-slate-900 focus:outline-none focus:border-blue-500 uppercase"
                />
              </div>

              {joinSuccess && (
                <div className="rounded-xl bg-emerald-50 p-2.5 text-center text-xs font-semibold text-emerald-700">
                  🎉 Ghi danh thành công! Đang chuyển hướng...
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowJoinModal(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-blue-500"
                >
                  Tham gia
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
