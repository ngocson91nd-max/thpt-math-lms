'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { MOCK_EXAMS, MOCK_QUESTIONS } from '@/lib/supabase/mockStore';
import { Exam } from '@/types/database';
import { createClient } from '@/lib/supabase/client';
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
  Pencil,
  Trash2,
} from 'lucide-react';

export default function ExamsPage() {
  const { user, isTeacher, isStudent } = useAuth();
  const [exams, setExams] = useState<Exam[]>(MOCK_EXAMS);
  const [selectedGrade, setSelectedGrade] = useState<number | 'all'>('all');
  const [filterType, setFilterType] = useState<'all' | 'timed' | 'practice'>('all');

  // Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);

  // Form tạo đề mới
  const [newTitle, setNewTitle] = useState('');
  const [newGrade, setNewGrade] = useState<10 | 11 | 12>(12);
  const [newDuration, setNewDuration] = useState(45);
  const [newDescription, setNewDescription] = useState('');
  const [shuffleQuestions, setShuffleQuestions] = useState(true);

  // Form sửa đề
  const [editTitle, setEditTitle] = useState('');
  const [editGrade, setEditGrade] = useState<10 | 11 | 12>(12);
  const [editDuration, setEditDuration] = useState(45);
  const [editDescription, setEditDescription] = useState('');
  const [editShuffle, setEditShuffle] = useState(true);

  // Tải danh sách đề thi từ localStorage hoặc Supabase
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('lms_exams');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setExams(parsed);
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
        .from('exams')
        .select('*')
        .then(({ data, error }) => {
          if (!error && data && data.length > 0) {
            setExams(data as any);
            if (typeof window !== 'undefined') {
              localStorage.setItem('lms_exams', JSON.stringify(data));
            }
          }
        });
    }
  }, []);

  const saveExamsToStorage = (updated: Exam[]) => {
    setExams(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('lms_exams', JSON.stringify(updated));
    }
  };

  const filteredExams = exams.filter((e) => {
    if (selectedGrade !== 'all' && e.grade !== selectedGrade) return false;
    if (filterType === 'timed' && e.duration_minutes < 45) return false;
    if (filterType === 'practice' && e.duration_minutes >= 90) return false;
    return true;
  });

  // Tạo đề thi mới
  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `exam-${Date.now()}`;

    const created: Exam = {
      id: newId,
      title: newTitle.trim(),
      description: newDescription.trim() || 'Đề thi trắc nghiệm và tự luận Toán THPT Thầy Sơn.',
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

    const updated = [created, ...exams];
    saveExamsToStorage(updated);

    try {
      const supabase = createClient();
      if (supabase && user) {
        await supabase.from('exams').insert([
          {
            id: newId,
            title: created.title,
            description: created.description,
            grade: created.grade,
            duration_minutes: created.duration_minutes,
            teacher_id: user.id,
            passing_score: 5.0,
            status: 'published',
            shuffle_questions: shuffleQuestions,
          },
        ]);
      }
    } catch (err) {
      console.warn('Lỗi lưu đề thi vào Supabase:', err);
    }

    setShowCreateModal(false);
    setNewTitle('');
    setNewDescription('');
  };

  // Mở modal sửa đề
  const openEditModal = (exam: Exam) => {
    setEditingExam(exam);
    setEditTitle(exam.title);
    setEditGrade(exam.grade);
    setEditDuration(exam.duration_minutes);
    setEditDescription(exam.description || '');
    setEditShuffle(exam.shuffle_questions);
    setShowEditModal(true);
  };

  // Cập nhật đề thi
  const handleUpdateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExam || !editTitle.trim()) return;

    const updated = exams.map((ex) => {
      if (ex.id === editingExam.id) {
        return {
          ...ex,
          title: editTitle.trim(),
          grade: editGrade,
          duration_minutes: Number(editDuration),
          description: editDescription.trim(),
          shuffle_questions: editShuffle,
        };
      }
      return ex;
    });

    saveExamsToStorage(updated);

    try {
      const supabase = createClient();
      if (supabase) {
        await supabase
          .from('exams')
          .update({
            title: editTitle.trim(),
            grade: editGrade,
            duration_minutes: Number(editDuration),
            description: editDescription.trim(),
            shuffle_questions: editShuffle,
          })
          .eq('id', editingExam.id);
      }
    } catch (err) {
      console.warn('Lỗi cập nhật đề thi trên Supabase:', err);
    }

    setShowEditModal(false);
    setEditingExam(null);
  };

  // Xóa đề thi
  const handleDeleteExam = async (examId: string, examTitle: string) => {
    const isConfirmed = confirm(
      `Thầy có chắc chắn muốn xóa đề thi "${examTitle}" không?\nHọc sinh sẽ không còn thấy đề này trong danh sách.`
    );
    if (!isConfirmed) return;

    const updated = exams.filter((e) => e.id !== examId);
    saveExamsToStorage(updated);

    try {
      const supabase = createClient();
      if (supabase) {
        await supabase.from('exams').delete().eq('id', examId);
      }
    } catch (err) {
      console.warn('Lỗi xóa đề thi trên Supabase:', err);
    }
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
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 font-bold">
              !
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-900">
                Bạn chưa đăng nhập vào Toán Thầy Sơn
              </h3>
              <p className="text-xs text-amber-700 mt-0.5">
                Đăng ký tài khoản hoặc đăng nhập để lưu kết quả bài thi vào bảng vàng và xem lời giải chi tiết.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 shadow-xs transition"
            >
              <LogIn className="h-3.5 w-3.5" />
              Đăng nhập ngay
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-white px-4 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-50 transition"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Đăng ký học sinh
            </Link>
          </div>
        </div>
      )}

      {/* Filter and Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Grade Filter */}
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
              {g === 'all' ? 'Tất cả khối lớp' : `Toán Lớp ${g}`}
            </button>
          ))}
        </div>

        {/* Type Filter */}
        <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 text-xs text-slate-600 self-start md:self-auto">
          <button
            onClick={() => setFilterType('all')}
            className={`rounded-lg px-3 py-1.5 transition ${
              filterType === 'all' ? 'bg-white text-slate-900 font-semibold shadow-2xs' : 'hover:text-slate-900'
            }`}
          >
            Tất cả đề thi
          </button>
          <button
            onClick={() => setFilterType('timed')}
            className={`rounded-lg px-3 py-1.5 transition ${
              filterType === 'timed' ? 'bg-white text-slate-900 font-semibold shadow-2xs' : 'hover:text-slate-900'
            }`}
          >
            ⏱️ Đề thi bấm giờ (45 - 90 phút)
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
      {filteredExams.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-xs">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 mb-3">
            <ClipboardList className="h-7 w-7" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Chưa có đề thi nào phù hợp</h3>
          <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
            Thầy có thể bấm &quot;Tạo Đề Thi Mới&quot; để thiết lập thêm bài kiểm tra cho học sinh.
          </p>
        </div>
      ) : (
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

                <div className="flex items-center gap-2">
                  {isTeacher && (
                    <>
                      <button
                        type="button"
                        onClick={() => openEditModal(exam)}
                        className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50 transition"
                        title="Chỉnh sửa đề thi"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span>Sửa</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteExam(exam.id, exam.title)}
                        className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition"
                        title="Xóa đề thi"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Xóa</span>
                      </button>
                    </>
                  )}

                  <Link
                    href={`/exams/${exam.id}/take`}
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-sm shadow-blue-500/20 hover:bg-blue-700 transition active:scale-95"
                  >
                    <Play className="h-3.5 w-3.5 fill-white" />
                    Làm bài
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Tạo đề thi mới */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg my-8 rounded-3xl bg-white p-6 sm:p-8 shadow-2xl animate-in fade-in zoom-in-95">
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

      {/* Modal Chỉnh Sửa đề thi */}
      {showEditModal && editingExam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg my-8 rounded-3xl bg-white p-6 sm:p-8 shadow-2xl animate-in fade-in zoom-in-95">
            <h2 className="text-xl font-bold text-slate-900">Chỉnh Sửa Đề Thi</h2>
            <p className="mt-1 text-xs text-slate-500">
              Cập nhật thông số đề thi của Thầy Sơn.
            </p>

            <form onSubmit={handleUpdateExam} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tiêu đề đề thi <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Tiêu đề đề thi..."
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Khối lớp</label>
                  <select
                    value={editGrade}
                    onChange={(e) => setEditGrade(Number(e.target.value) as any)}
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
                    value={editDuration}
                    onChange={(e) => setEditDuration(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Mô tả đề thi</label>
                <textarea
                  rows={2}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Ghi chú dành cho học sinh..."
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="editShuffle"
                  checked={editShuffle}
                  onChange={(e) => setEditShuffle(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="editShuffle" className="text-xs text-slate-700 font-medium cursor-pointer">
                  Xáo trộn thứ tự câu hỏi ngẫu nhiên
                </label>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingExam(null);
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
    </div>
  );
}
