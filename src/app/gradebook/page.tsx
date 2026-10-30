'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { MOCK_SUBMISSIONS, MOCK_EXAMS } from '@/lib/supabase/mockStore';
import { Submission } from '@/types/database';
import { createClient } from '@/lib/supabase/client';
import { broadcastDataChange } from '@/lib/realtime/syncService';
import {
  Award,
  Download,
  CheckCircle,
  Clock,
  Pencil,
  BarChart3,
  TrendingUp,
  Users,
  Search,
  BookOpen,
  ArrowRight,
  Sparkles,
  Plus,
  Trash2,
} from 'lucide-react';

export default function GradebookPage() {
  const { user, isTeacher, isStudent } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const globalSaved = localStorage.getItem('lms_all_submissions');
      if (globalSaved) {
        const parsed = JSON.parse(globalSaved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [];
  });
  const [search, setSearch] = useState('');
  const [filterExamId, setFilterExamId] = useState<string>('all');

  // Modals
  const [showEditScoreModal, setShowEditScoreModal] = useState(false);
  const [showAddGradeModal, setShowAddGradeModal] = useState(false);
  const [editingSub, setEditingSub] = useState<Submission | null>(null);

  // Edit score form
  const [editScoreValue, setEditScoreValue] = useState<number>(10);
  const [editStatus, setEditStatus] = useState<'graded' | 'grading'>('graded');

  // Add grade form
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentEmail, setNewStudentEmail] = useState('');
  const [newExamTitle, setNewExamTitle] = useState('Đề Khảo Sát Toán THPT 2025');
  const [newScore, setNewScore] = useState<number>(8.5);

  // 1. Đọc filter đề thi từ URL query param nếu có: ?examId=...
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const eId = params.get('examId');
      if (eId) setFilterExamId(eId);
    }
  }, []);

  // 2. Tải bài thi thời gian thực từ Supabase Cloud API (Source of Truth)
  const fetchSubmissions = async () => {
    let combined: Submission[] = [];

    // A. Nạp từ cache nội bộ (đã loại bỏ sạch sẽ các bản ghi giả định / mock cũ)
    if (typeof window !== 'undefined') {
      const globalSaved = localStorage.getItem('lms_all_submissions');
      if (globalSaved) {
        try {
          const parsed = JSON.parse(globalSaved);
          if (Array.isArray(parsed)) {
            combined = parsed.filter(
              (s) =>
                s &&
                s.id &&
                !s.id.startsWith('sub-') &&
                !s.id.startsWith('mock-') &&
                s.exam_id !== 'exam-1' &&
                !s.exam?.title?.includes('12-1')
            );
          }
        } catch {}
      }
    }

    if (!isTeacher && user) {
      const studentOnly = combined.filter(
        (s) =>
          s.student_id === user.id ||
          s.student?.id === user.id ||
          (user.email && s.student?.email && s.student.email.toLowerCase() === user.email.toLowerCase())
      );
      setSubmissions(studentOnly);
    } else {
      setSubmissions(combined);
    }

    // B. Đồng bộ từ Cloud Supabase API (Chân lý nguồn)
    try {
      const res = await fetch(`/api/submissions?t=${Date.now()}`, { cache: 'no-store' });
      const data = await res.json();
      if (data.success && Array.isArray(data.submissions)) {
        const cloudList: Submission[] = data.submissions;

        // Chỉ kết hợp thêm các bài vừa nộp cục bộ trong 60 giây (nếu có bài thi mới chưa kịp đồng bộ)
        const now = Date.now();
        const recentLocal = combined.filter((s) => {
          if (!s || !s.id) return false;
          if (s.id.startsWith('sub-') || s.id.startsWith('mock-') || s.exam_id === 'exam-1' || s.exam?.title?.includes('12-1')) {
            return false;
          }
          const subTime = s.submitted_at ? new Date(s.submitted_at).getTime() : 0;
          return now - subTime < 60 * 1000;
        });

        const mergedMap = new Map<string, Submission>();
        cloudList.forEach((s) => mergedMap.set(s.id, s));
        recentLocal.forEach((s) => {
          if (!mergedMap.has(s.id)) mergedMap.set(s.id, s);
        });
        const finalMerged = Array.from(mergedMap.values());

        if (typeof window !== 'undefined') {
          localStorage.setItem('lms_all_submissions', JSON.stringify(finalMerged));
          if (user) {
            const mySubs = finalMerged.filter(
              (s) =>
                s.student_id === user.id ||
                s.student?.id === user.id ||
                (user.email && s.student?.email && s.student.email.toLowerCase() === user.email.toLowerCase())
            );
            localStorage.setItem(`my_submissions_${user.id}`, JSON.stringify(mySubs));
          }
        }

        if (!isTeacher && user) {
          setSubmissions(
            finalMerged.filter(
              (s) =>
                s.student_id === user.id ||
                s.student?.id === user.id ||
                (user.email && s.student?.email && s.student.email.toLowerCase() === user.email.toLowerCase())
            )
          );
        } else {
          setSubmissions(finalMerged);
        }
      }
    } catch (e) {
      console.warn('Lỗi fetch /api/submissions:', e);
    }
  };

  useEffect(() => {
    fetchSubmissions();

    window.addEventListener('lms_submissions_updated', fetchSubmissions);

    // Kênh Realtime Broadcast đa tab 0ms
    let bc: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      bc = new BroadcastChannel('lms_realtime_sync');
      bc.onmessage = (event) => {
        if (event.data?.type === 'SUBMISSIONS_UPDATED' || event.data?.type === 'ALL_UPDATED') {
          fetchSubmissions();
        }
      };
    }

    // Polling định kỳ 3s từ Supabase Cloud
    const pollInterval = setInterval(() => {
      fetchSubmissions();
    }, 3000);

    return () => {
      window.removeEventListener('lms_submissions_updated', fetchSubmissions);
      if (bc) bc.close();
      clearInterval(pollInterval);
    };
  }, [user, isTeacher]);

  const saveSubmissions = (updated: Submission[]) => {
    setSubmissions(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('lms_all_submissions', JSON.stringify(updated));
    }
  };

  const openEditModal = (sub: Submission) => {
    setEditingSub(sub);
    setEditScoreValue(sub.score ?? 8.0);
    setEditStatus(sub.status === 'grading' ? 'grading' : 'graded');
    setShowEditScoreModal(true);
  };

  const handleUpdateScore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSub) return;

    const updated = submissions.map((s) => {
      if (s.id === editingSub.id) {
        return {
          ...s,
          score: Number(editScoreValue),
          status: editStatus,
        };
      }
      return s;
    });

    saveSubmissions(updated);

    try {
      const supabase = createClient();
      if (supabase) {
        await supabase
          .from('submissions')
          .update({
            score: Number(editScoreValue),
            status: editStatus,
          })
          .eq('id', editingSub.id);
      }
    } catch (err) {
      console.warn('Lỗi cập nhật điểm trên Supabase:', err);
    }

    setShowEditScoreModal(false);
    setEditingSub(null);
  };

  const handleDeleteSubmission = async (subId: string, studentName: string) => {
    const isConfirmed = confirm(
      `Thầy có chắc chắn muốn xóa bản ghi kết quả của "${studentName}" không?`
    );
    if (!isConfirmed) return;

    if (typeof window !== 'undefined') {
      localStorage.removeItem(`submission_${subId}`);
    }

    const updated = submissions.filter((s) => s.id !== subId);
    saveSubmissions(updated);

    try {
      await fetch(`/api/submissions?id=${subId}`, { method: 'DELETE' });
      broadcastDataChange('SUBMISSIONS_UPDATED');
      broadcastDataChange('EXAMS_UPDATED');
      broadcastDataChange('ALL_UPDATED');
    } catch (err) {
      console.warn('Lỗi xóa bài nộp trên Supabase:', err);
    }
  };

  const handleAddGrade = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentName.trim()) return;

    const newSub: Submission = {
      id: `sub-${Date.now()}`,
      exam_id: 'exam-1',
      student_id: `stu-${Date.now()}`,
      attempt_number: 1,
      start_time: new Date().toISOString(),
      submitted_at: new Date().toISOString(),
      score: Number(newScore),
      max_score: 10,
      status: 'graded',
      student: {
        id: `stu-${Date.now()}`,
        email: newStudentEmail.trim() || 'hocsinh@sontoan.edu.vn',
        full_name: newStudentName.trim(),
        role: 'student',
        grade: 12,
        school_name: 'THPT Chuyên Lê Hồng Phong',
      },
      exam: {
        id: 'exam-1',
        title: newExamTitle.trim(),
        description: 'Bài kiểm tra chuyên đề Toán THPT',
        grade: 12,
        duration_minutes: 45,
        passing_score: 5.0,
        status: 'published',
        teacher_id: '11111111-1111-1111-1111-111111111111',
        shuffle_questions: true,
        shuffle_options: true,
        max_attempts: 3,
        is_view_answer_allowed: true,
      },
    };

    const updated = [newSub, ...submissions];
    saveSubmissions(updated);
    setShowAddGradeModal(false);
    setNewStudentName('');
    setNewStudentEmail('');
  };

  const filtered = submissions.filter((s) => {
    // Lọc theo đề thi cụ thể nếu được chuyển từ nút [Kết quả] của đề thi
    if (
      filterExamId !== 'all' &&
      s.exam_id !== filterExamId &&
      s.exam?.id !== filterExamId &&
      s.exam?.code !== filterExamId
    ) {
      return false;
    }

    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      s.student?.full_name?.toLowerCase().includes(q) ||
      s.student?.email?.toLowerCase().includes(q) ||
      s.exam?.title?.toLowerCase().includes(q) ||
      s.exam?.code?.toLowerCase().includes(q)
    );
  });

  const pendingEssayCount = filtered.filter((s) => s.status === 'grading').length;
  const firstPendingSub = filtered.find((s) => s.status === 'grading');

  // Thống kê điểm số
  const scores = submissions.map((s) => s.score ?? 0);
  const avgScore =
    scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2) : '0.00';
  const maxScore = scores.length > 0 ? Math.max(...scores).toFixed(2) : '0.00';
  const passRate =
    scores.length > 0
      ? ((scores.filter((sc) => sc >= 5.0).length / scores.length) * 100).toFixed(0)
      : '0';

  // Xuất file CSV có BOM UTF-8 hỗ trợ tiếng Việt trên Excel
  const exportCsv = () => {
    const headers = ['STT', 'Học Sinh', 'Email', 'Đề Thi', 'Điểm Số (Thang 10)', 'Trạng Thái', 'Thời Gian Nộp'];
    const rows = submissions.map((s, idx) => [
      idx + 1,
      `"${s.student?.full_name || 'Học sinh'}"`,
      `"${s.student?.email || ''}"`,
      `"${s.exam?.title || 'Đề thi'}"`,
      s.score ?? 'Chưa chấm',
      s.status === 'graded' ? 'Đã chấm' : 'Chờ chấm',
      `"${s.submitted_at ? new Date(s.submitted_at).toLocaleString('vi-VN') : '26/10/2026'}"`,
    ]);

    const csvContent =
      '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `so_diem_toan_thpt_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Award className="h-8 w-8 text-blue-600 shrink-0" />
            {isTeacher ? 'Sổ Điểm & Báo Cáo Kết Quả Lớp' : 'Lịch Sử Thi & Điểm Số Của Tôi'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {isTeacher
              ? 'Tổng hợp kết quả làm bài thi, phân tích phổ điểm và công cụ quản lý điểm số học sinh của Thầy Sơn.'
              : user
              ? `Học sinh: ${user.full_name} • ${user.school_name || 'THPT Chuyên'} • Lớp ${user.grade || 12}. Xem lại lịch sử các bài thi và lời giải chi tiết KaTeX.`
              : 'Xem lại lịch sử kết quả các bài thi trắc nghiệm và tự luận.'}
          </p>
        </div>

        {isTeacher && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddGradeModal(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-500 transition"
            >
              <Plus className="h-4 w-4" />
              Thêm Điểm Thi Mới
            </button>
            <button
              onClick={exportCsv}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
            >
              <Download className="h-4 w-4 text-emerald-600" />
              Xuất Sổ Điểm
            </button>
          </div>
        )}
      </div>

      {/* Analytics Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase">
            <span>{isTeacher ? 'Điểm trung bình lớp' : 'Điểm trung bình của tôi'}</span>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </div>
          <div className="mt-2 text-3xl font-black text-slate-900">{avgScore}</div>
          <div className="mt-1 text-xs text-slate-400">Thang điểm 10 chuẩn THPT</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase">
            <span>{isTeacher ? 'Điểm cao nhất lớp' : 'Điểm cao nhất của tôi'}</span>
            <Award className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 text-3xl font-black text-slate-900">{maxScore}</div>
          <div className="mt-1 text-xs text-slate-400">Kỷ lục bài thi</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase">
            <span>{isTeacher ? 'Tỷ lệ đạt chuẩn (>= 5.0)' : 'Số bài thi đã làm'}</span>
            {isTeacher ? <BarChart3 className="h-4 w-4 text-emerald-600" /> : <BookOpen className="h-4 w-4 text-indigo-600" />}
          </div>
          <div className="mt-2 text-3xl font-black text-slate-900">
            {isTeacher ? `${passRate}%` : submissions.length}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {isTeacher ? `Trên tổng số ${submissions.length} lượt thi` : 'Đã nộp và chấm điểm'}
          </div>
        </div>
      </div>

      {/* Banner Cảnh Báo Có Bài Chờ Chấm Tự Luận Cho Giáo Viên */}
      {isTeacher && pendingEssayCount > 0 && (
        <div className="rounded-2xl border border-amber-300 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Clock className="h-5 w-5 animate-spin" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-amber-950 flex items-center gap-2">
                <span>Thầy có {pendingEssayCount} bài thi tự luận đang chờ chấm điểm!</span>
                <span className="bg-amber-200 text-amber-900 text-[10px] px-2 py-0.5 rounded-full font-black uppercase">
                  Cần chấm ngay
                </span>
              </h3>
              <p className="text-xs text-amber-800 mt-0.5">
                Học sinh đã nộp bài giải trắc nghiệm và đính kèm ảnh/lời giải tự luận. Thầy hãy vào chấm để học sinh nhận điểm chính thức.
              </p>
            </div>
          </div>
          {firstPendingSub && (
            <Link
              href={`/gradebook/grade/${firstPendingSub.id}`}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white px-4 py-2.5 text-xs font-extrabold shadow-md shadow-amber-600/20 transition active:scale-95 shrink-0"
            >
              <Pencil className="h-4 w-4" />
              <span>Chấm bài tự luận ngay</span>
            </Link>
          )}
        </div>
      )}

      {/* Search Bar & Filter Đề Thi */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200">
        <div className="flex items-center gap-3 flex-1">
          <Search className="h-4 w-4 text-slate-400 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              isTeacher
                ? 'Tìm kiếm theo tên học sinh, email hoặc tên đề thi...'
                : 'Tìm kiếm theo tên bài thi...'
            }
            className="w-full text-xs text-slate-900 focus:outline-none"
          />
        </div>

        {filterExamId !== 'all' && (
          <div className="flex items-center gap-2 self-start sm:self-auto bg-blue-50 border border-blue-200 text-blue-700 px-3 py-1.5 rounded-xl text-xs font-bold shrink-0">
            <span>Đang lọc theo đề thi</span>
            <button
              onClick={() => setFilterExamId('all')}
              className="text-blue-500 hover:text-blue-800 font-black ml-1 cursor-pointer"
              title="Xem tất cả đề thi"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Submissions Table */}
      {filtered.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-xs">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 mb-3">
            <BookOpen className="h-7 w-7" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Chưa có bài thi nào được ghi nhận</h3>
          <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
            {isTeacher
              ? 'Chưa có học sinh nào nộp bài thi cho các đề đã giao.'
              : 'Bạn chưa tham gia bài thi nào. Hãy vào mục Đề thi & Luyện tập để thử sức ngay nhé!'}
          </p>
          <div className="mt-5">
            <Link
              href="/exams"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition"
            >
              <span>Vào chọn đề thi ngay</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase font-semibold">
              <tr>
                <th className="py-3.5 px-6">{isTeacher ? 'Học Sinh' : 'Tài Khoản'}</th>
                <th className="py-3.5 px-6">Đề Thi</th>
                <th className="py-3.5 px-6 text-center">Điểm Số</th>
                <th className="py-3.5 px-6">Trạng Thái</th>
                <th className="py-3.5 px-6">Thời Gian Nộp</th>
                <th className="py-3.5 px-6 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/50 transition">
                  <td className="py-4 px-6">
                    <div className="font-semibold text-slate-900">
                      {!isTeacher && user?.full_name ? user.full_name : (s.student?.full_name || 'Học sinh')}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {!isTeacher && user?.email ? user.email : (s.student?.email || '')}
                    </div>
                  </td>
                  <td className="py-4 px-6 text-slate-700 font-medium">
                    {s.exam?.title || 'Đề Khảo Sát Toán 12'}
                  </td>
                  <td className="py-4 px-6 text-center">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-black ${
                        (s.score ?? 0) >= 8.0
                          ? 'bg-emerald-50 text-emerald-700'
                          : (s.score ?? 0) >= 5.0
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-rose-50 text-rose-700'
                      }`}
                    >
                      {s.score !== undefined ? `${s.score.toFixed(2)}/10` : 'Chưa có'}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    {s.status === 'graded' ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 font-semibold text-emerald-700">
                        <CheckCircle className="h-3 w-3" /> Đã chấm
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 font-semibold text-amber-700 animate-pulse">
                        <Clock className="h-3 w-3" /> Chờ chấm tự luận
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-6 text-slate-500">
                    {s.submitted_at
                      ? new Date(s.submitted_at).toLocaleDateString('vi-VN')
                      : '26/10/2026'}
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="flex items-center justify-end gap-1.5 flex-wrap">
                      {isTeacher && (
                        <Link
                          href={`/gradebook/grade/${s.id}`}
                          className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold shadow-xs transition active:scale-95 ${
                            s.status === 'grading'
                              ? 'bg-amber-500 hover:bg-amber-600 text-white'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          }`}
                          title="Chấm điểm câu hỏi tự luận của học sinh"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          <span>{s.status === 'grading' ? 'Chấm tự luận' : 'Xem / Chấm lại'}</span>
                        </Link>
                      )}

                      <Link
                        href={`/exams/${s.exam_id}/result/${s.id}`}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition"
                      >
                        Xem Lời Giải KaTeX
                      </Link>

                      {isTeacher && (
                        <>
                          <button
                            type="button"
                            onClick={() => openEditModal(s)}
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 transition"
                            title="Chỉnh sửa điểm số"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span>Sửa điểm</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleDeleteSubmission(s.id, s.student?.full_name || 'Học sinh')
                            }
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition"
                            title="Xóa bản ghi điểm"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Xóa</span>
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Sửa Điểm Số */}
      {showEditScoreModal && editingSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <h2 className="text-xl font-bold text-slate-900">Chỉnh Sửa Điểm Số</h2>
            <p className="mt-1 text-xs text-slate-500">
              Học sinh: {editingSub.student?.full_name || 'Học sinh'}
            </p>

            <form onSubmit={handleUpdateScore} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Điểm số (Thang 10)
                </label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  step={0.1}
                  required
                  value={editScoreValue}
                  onChange={(e) => setEditScoreValue(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-center text-lg font-black text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Trạng thái</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as any)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                >
                  <option value="graded">Đã chấm điểm</option>
                  <option value="grading">Đang chờ chấm</option>
                </select>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditScoreModal(false);
                    setEditingSub(null);
                  }}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition shadow-sm"
                >
                  Lưu Điểm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Thêm Điểm Mới */}
      {showAddGradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <h2 className="text-xl font-bold text-slate-900">Thêm Kết Quả Điểm Thi</h2>
            <p className="mt-1 text-xs text-slate-500">
              Nhập điểm kiểm tra trực tiếp cho học sinh.
            </p>

            <form onSubmit={handleAddGrade} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tên học sinh <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                  placeholder="Ví dụ: Hoàng Minh Nhật"
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email học sinh</label>
                <input
                  type="email"
                  value={newStudentEmail}
                  onChange={(e) => setNewStudentEmail(e.target.value)}
                  placeholder="minhnhat@gmail.com"
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Đề thi / Bài kiểm tra</label>
                <input
                  type="text"
                  required
                  value={newExamTitle}
                  onChange={(e) => setNewExamTitle(e.target.value)}
                  placeholder="Đề Khảo Sát Toán 12..."
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Điểm số (Thang 10)</label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  step={0.1}
                  required
                  value={newScore}
                  onChange={(e) => setNewScore(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-center text-lg font-black text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddGradeModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition shadow-sm"
                >
                  Lưu Kết Quả
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
