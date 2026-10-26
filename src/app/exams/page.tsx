'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { MOCK_EXAMS, MOCK_QUESTIONS } from '@/lib/supabase/mockStore';
import { Exam } from '@/types/database';
import {
  ClipboardList,
  Clock,
  Award,
  Plus,
  Play,
  CheckCircle,
  HelpCircle,
  Shuffle,
  Sparkles,
  UserCheck,
  LogIn,
  UserPlus,
  BookOpen,
  Filter,
} from 'lucide-react';

export default function ExamsPage() {
  const { user, isTeacher, isStudent } = useAuth();
  const [exams, setExams] = useState<Exam[]>(MOCK_EXAMS);
  const [selectedGrade, setSelectedGrade] = useState<number | 'all'>('all');
  const [filterType, setFilterType] = useState<'all' | 'timed' | 'practice'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form tạo đề mới
  const [newTitle, setNewTitle] = useState('');
  const [newGrade, setNewGrade] = useState<10 | 11 | 12>(12);
  const [newDuration, setNewDuration] = useState(45);
  const [newDescription, setNewDescription] = useState('');
  const [shuffleQuestions, setShuffleQuestions] = useState(true);

  const filteredExams = exams.filter((e) => {
    if (selectedGrade !== 'all' && e.grade !== selectedGrade) return false;
    if (filterType === 'timed' && e.duration_minutes < 45) return false;
    if (filterType === 'practice' && e.duration_minutes >= 90) return false;
    return true;
  });

  const handleCreateExam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const created: Exam = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `exam-${Date.now()}`,
      title: newTitle,
      description: newDescription,
      teacher_id: user?.id || '22222222-2222-2222-2222-222222222222',
      grade: newGrade,
      duration_minutes: Number(newDuration),
      passing_score: 5.0,
      shuffle_questions: shuffleQuestions,
      shuffle_options: true,
      max_attempts: 3,
      status: 'published',
      is_view_answer_allowed: true,
      questions: MOCK_QUESTIONS.slice(0, 5).map((q, i) => ({
        ...q,
        order_index: i + 1,
        custom_points: q.points,
      })),
    };

    setExams([created, ...exams]);
    setShowCreateModal(false);
    setNewTitle('');
    setNewDescription('');
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <ClipboardList className="h-8 w-8 text-blue-600 shrink-0" />
            Đề Thi & Bài Kiểm Tra Toán THPT
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Hệ thống bài kiểm tra định kỳ, đề thi thử Tốt nghiệp THPT chuẩn cấu trúc 2025 có bấm giờ và tự động chấm điểm.
          </p>
        </div>

        {isTeacher && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-500/20 hover:bg-blue-500 transition self-start sm:self-auto"
          >
            <Plus className="h-4 w-4" />
            Tạo Đề Thi Mới
          </button>
        )}
      </div>

      {/* Student Welcome or Guest Action Banner */}
      {user ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50/90 to-indigo-50/70 p-5 shadow-xs">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white font-bold text-lg shadow-sm">
              {user.full_name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-base">{user.full_name}</span>
                <span className="rounded-md bg-blue-600 text-white px-2 py-0.5 text-[10px] font-bold">
                  {user.role === 'teacher' ? 'Thầy Cô' : `Học sinh Lớp ${user.grade || 12}`}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                {user.school_name || 'THPT Chuyên Lê Hồng Phong'} • Hãy chọn đề thi bên dưới để bắt đầu làm bài!
              </p>
            </div>
          </div>

          <Link
            href="/gradebook"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white border border-blue-200 px-4 py-2 text-xs font-semibold text-blue-700 shadow-2xs hover:bg-blue-50 transition"
          >
            <Award className="h-4 w-4 text-blue-600" />
            <span>{isTeacher ? 'Xem Sổ Điểm Lớp' : 'Xem Điểm Thi Của Tôi'}</span>
          </Link>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50/70 p-5 shadow-xs">
          <div className="flex items-center gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="font-bold text-slate-900 text-sm">Học sinh chưa đăng nhập?</div>
              <p className="text-xs text-slate-600 mt-0.5">
                Bạn vẫn có thể làm thử bài thi tự do. Để tự động lưu điểm số và lời giải KaTeX vào học bạ cá nhân, hãy đăng ký tài khoản!
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>Đăng nhập</span>
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition shadow-md shadow-blue-500/20"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>Đăng ký học sinh</span>
            </Link>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Grade tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {(['all', 12, 11, 10] as const).map((g) => (
            <button
              key={g}
              onClick={() => setSelectedGrade(g)}
              className={`rounded-xl px-4 py-2 text-xs font-semibold transition ${
                selectedGrade === g
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {g === 'all' ? 'Tất cả khối lớp' : `Khối Lớp ${g}`}
            </button>
          ))}
        </div>

        {/* Type tabs */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl self-start sm:self-auto text-xs font-medium text-slate-600">
          <button
            onClick={() => setFilterType('all')}
            className={`rounded-lg px-3 py-1.5 transition ${
              filterType === 'all' ? 'bg-white text-slate-900 font-semibold shadow-2xs' : 'hover:text-slate-900'
            }`}
          >
            Tất cả ({exams.length})
          </button>
          <button
            onClick={() => setFilterType('timed')}
            className={`rounded-lg px-3 py-1.5 transition ${
              filterType === 'timed' ? 'bg-white text-slate-900 font-semibold shadow-2xs' : 'hover:text-slate-900'
            }`}
          >
            ⏱️ Đề thi tính giờ
          </button>
          <button
            onClick={() => setFilterType('practice')}
            className={`rounded-lg px-3 py-1.5 transition ${
              filterType === 'practice' ? 'bg-white text-slate-900 font-semibold shadow-2xs' : 'hover:text-slate-900'
            }`}
          >
            📚 Đề ôn tập chuyên đề
          </button>
        </div>
      </div>

      {/* Exams Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
        {filteredExams.map((exam) => (
          <div
            key={exam.id}
            className="flex flex-col justify-between rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-7 shadow-xs hover:shadow-md transition hover:border-blue-300"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="rounded-lg bg-blue-100/80 px-2.5 py-1 text-xs font-bold text-blue-700">
                  Toán Lớp {exam.grade}
                </span>
                <span className="flex items-center gap-1 text-xs font-semibold text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                  <Clock className="h-3.5 w-3.5 text-blue-600" />
                  {exam.duration_minutes} phút
                </span>
              </div>

              <h3 className="text-lg font-bold text-slate-900 leading-snug">
                {exam.title}
              </h3>

              <p className="mt-2 text-xs text-slate-500 line-clamp-2 leading-relaxed">
                {exam.description || 'Đề thi trắc nghiệm và tự luận Toán THPT.'}
              </p>

              <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                <div className="flex items-center gap-1.5">
                  <HelpCircle className="h-3.5 w-3.5 text-slate-400" />
                  <span>{exam.questions?.length || 7} câu hỏi (5 dạng)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Award className="h-3.5 w-3.5 text-slate-400" />
                  <span>Thang điểm: 10.0</span>
                </div>
                {exam.shuffle_questions && (
                  <div className="flex items-center gap-1.5 text-indigo-600 font-medium">
                    <Shuffle className="h-3.5 w-3.5" />
                    <span>Xáo câu ngẫu nhiên</span>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                <CheckCircle className="h-3.5 w-3.5" />
                Đang mở làm bài
              </span>

              <Link
                href={`/exams/${exam.id}/take`}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm shadow-blue-500/20 hover:bg-blue-700 transition active:scale-95"
              >
                <Play className="h-3.5 w-3.5 fill-white" />
                Bắt đầu làm bài
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Tạo đề thi mới */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <h2 className="text-xl font-bold text-slate-900">Tạo Đề Thi Toán Mới</h2>
            <p className="mt-1 text-xs text-slate-500">
              Thiết lập thông số đề thi cho lớp học. Hệ thống sẽ tự động tổng hợp câu hỏi từ ngân hàng đề.
            </p>

            <form onSubmit={handleCreateExam} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tiêu đề đề thi <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ví dụ: Kiểm tra 1 tiết Đại số & Giải tích 12..."
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Khối lớp</label>
                  <select
                    value={newGrade}
                    onChange={(e) => setNewGrade(Number(e.target.value) as any)}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                  >
                    <option value={12}>Lớp 12</option>
                    <option value={11}>Lớp 11</option>
                    <option value={10}>Lớp 10</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Thời gian làm bài (Phút)
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={180}
                    value={newDuration}
                    onChange={(e) => setNewDuration(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Mô tả đề thi</label>
                <textarea
                  rows={2}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Nội dung kiến thức, ghi chú dành cho học sinh..."
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="shuffle"
                  checked={shuffleQuestions}
                  onChange={(e) => setShuffleQuestions(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="shuffle" className="text-xs text-slate-700 font-medium cursor-pointer">
                  Xáo trộn thứ tự câu hỏi và phương án ngẫu nhiên cho từng học sinh
                </label>
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
                  Xác nhận Tạo đề
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
