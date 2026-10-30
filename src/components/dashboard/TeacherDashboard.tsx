'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { ClassItem, Exam, Submission } from '@/types/database';
import {
  GraduationCap,
  Users,
  Award,
  ClipboardList,
  Plus,
  ArrowRight,
  Copy,
  Check,
  Clock,
  Sparkles,
  FileQuestion,
  BookOpen,
  FolderDown,
  TrendingUp,
  BarChart3,
  Radio,
  CheckCircle2,
  AlertCircle,
  Pencil,
  Calendar,
  Layers,
  Search,
} from 'lucide-react';

export const TeacherDashboard: React.FC = () => {
  const router = useRouter();
  const { user } = useAuth();

  // 1. Tải danh sách lớp học
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

  // 2. Tải danh sách đề thi
  const [exams, setExams] = useState<Exam[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const savedDeleted = localStorage.getItem('lms_deleted_exam_ids');
      const deletedIds = new Set<string>(savedDeleted ? JSON.parse(savedDeleted) : []);
      const savedExams = localStorage.getItem('lms_exams');
      if (savedExams) {
        const parsed = JSON.parse(savedExams);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.filter((e: any) => !deletedIds.has(e.id) && !deletedIds.has(e.code));
        }
      }
    } catch {}
    return [];
  });

  // 3. Tải danh sách bài nộp của học sinh
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

  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Đồng bộ dữ liệu mới nhất từ API & LocalStorage
  useEffect(() => {
    const syncData = async () => {
      try {
        // Tải danh sách lớp
        const resClasses = await fetch('/api/classes');
        const dataClasses = await resClasses.json();
        if (dataClasses.success && Array.isArray(dataClasses.classes)) {
          setClasses(dataClasses.classes);
          localStorage.setItem('lms_classes', JSON.stringify(dataClasses.classes));
        }
      } catch {}

      try {
        // Tải danh sách đề thi
        const resExams = await fetch('/api/exams');
        const dataExams = await resExams.json();
        if (dataExams.success && Array.isArray(dataExams.exams)) {
          setExams(dataExams.exams);
          localStorage.setItem('lms_exams', JSON.stringify(dataExams.exams));
        }
      } catch {}

      try {
        // Tải bài nộp
        const resSub = await fetch('/api/submissions');
        const dataSub = await resSub.json();
        if (dataSub.success && Array.isArray(dataSub.submissions)) {
          setSubmissions(dataSub.submissions);
          localStorage.setItem('lms_all_submissions', JSON.stringify(dataSub.submissions));
        }
      } catch {}
    };

    syncData();

    // Lắng nghe sự kiện cập nhật
    window.addEventListener('lms_classes_updated', syncData);
    window.addEventListener('lms_exams_updated', syncData);

    return () => {
      window.removeEventListener('lms_classes_updated', syncData);
      window.removeEventListener('lms_exams_updated', syncData);
    };
  }, []);

  // Tính toán các chỉ số thống kê KPI
  const totalClasses = classes.length;
  const totalStudents = classes.reduce((sum, c) => sum + (c.member_count || 0), 0);
  const pendingGradingSubmissions = submissions.filter(
    (s) => s.status === 'submitted' || s.status === 'grading'
  );
  const pendingApprovalCount = classes.reduce((sum, c) => sum + (c.pending_count || 0), 0);

  // Bài thi gần đây & Đang diễn ra
  const recentExams = [...exams].slice(0, 5);
  const liveExams = exams.filter((e) => e.status === 'published' && !e.is_locked);

  // Sao chép mã lớp
  const handleCopyCode = (code: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  return (
    <div className="space-y-8 pb-12">
      {/* 1. Header Chào Mừng & Thao Tác Nhanh */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-900 via-indigo-900 to-slate-900 p-6 sm:p-8 text-white shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:24px_24px] opacity-20 pointer-events-none" />
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-500/10 px-3.5 py-1 text-xs font-semibold text-blue-200 backdrop-blur-md">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              Bàn làm việc Giảng viên
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight">
              Kính chào {user?.full_name?.startsWith('Thầy') ? user.full_name : `Thầy ${user?.full_name || 'Sơn'}`}! 👋
            </h1>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Chúc Thầy một ngày giảng dạy hiệu quả. Dưới đây là tổng hợp lớp học, tiến độ làm bài và các công việc cần chú ý hôm nay.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/exams/editor"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-blue-600/30 hover:bg-blue-500 transition active:scale-95"
            >
              <Plus className="h-4 w-4" />
              <span>Tạo đề thi mới</span>
            </Link>

            <Link
              href="/classes"
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white backdrop-blur-md hover:bg-white/20 transition active:scale-95"
            >
              <GraduationCap className="h-4 w-4" />
              <span>Quản lý lớp</span>
            </Link>
          </div>
        </div>
      </section>

      {/* 2. Thẻ Chỉ Số KPI (Metrics Grid) */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* KPI 1: Số lớp học */}
        <Link
          href="/classes"
          className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs hover:shadow-md hover:border-blue-300 transition duration-200"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Lớp đang dạy
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 group-hover:scale-110 transition">
              <GraduationCap className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{totalClasses}</span>
            <span className="text-xs font-medium text-slate-500">lớp</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-blue-600 font-semibold">
            <span>Tổng {totalStudents} học sinh</span>
            <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition" />
          </div>
        </Link>

        {/* KPI 2: Bài chờ chấm */}
        <Link
          href="/gradebook"
          className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs hover:shadow-md hover:border-amber-300 transition duration-200"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Bài chờ chấm
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 group-hover:scale-110 transition">
              <Award className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">
              {pendingGradingSubmissions.length}
            </span>
            <span className="text-xs font-medium text-slate-500">bài nộp</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold">
            {pendingGradingSubmissions.length > 0 ? (
              <span className="text-amber-600 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> Cần Thầy chấm điểm
              </span>
            ) : (
              <span className="text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Đã hoàn tất 100%
              </span>
            )}
          </div>
        </Link>

        {/* KPI 3: Số đề thi trong kho */}
        <Link
          href="/exams"
          className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs hover:shadow-md hover:border-indigo-300 transition duration-200"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Đề thi & Luyện tập
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 group-hover:scale-110 transition">
              <ClipboardList className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{exams.length}</span>
            <span className="text-xs font-medium text-slate-500">đề thi</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-indigo-600 font-semibold">
            <span>{liveExams.length} đề đang mở</span>
            <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition" />
          </div>
        </Link>

        {/* KPI 4: Học sinh xin vào lớp */}
        <Link
          href="/classes"
          className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs hover:shadow-md hover:border-emerald-300 transition duration-200"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Chờ duyệt vào lớp
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 group-hover:scale-110 transition">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">
              {pendingApprovalCount}
            </span>
            <span className="text-xs font-medium text-slate-500">yêu cầu</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold">
            {pendingApprovalCount > 0 ? (
              <span className="text-rose-600 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> Cần duyệt thành viên
              </span>
            ) : (
              <span className="text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Tất cả đã duyệt
              </span>
            )}
          </div>
        </Link>
      </section>

      {/* 3. Thanh Thao Tác Nhanh (Quick Actions Toolbar) */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
        <div className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-3">
          Thao tác nhanh cho Giáo viên
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Link
            href="/exams/editor"
            className="flex flex-col items-center justify-center gap-2 rounded-xl border border-slate-200/70 p-3.5 text-center hover:bg-blue-50/60 hover:border-blue-300 hover:text-blue-700 transition group"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100/70 text-blue-700 group-hover:scale-110 transition">
              <Plus className="h-5 w-5" />
            </div>
            <span className="text-xs font-bold text-slate-700 group-hover:text-blue-700">
              Tạo đề Word/TeX
            </span>
          </Link>

          <Link
            href="/gradebook"
            className="flex flex-col items-center justify-center gap-2 rounded-xl border border-slate-200/70 p-3.5 text-center hover:bg-amber-50/60 hover:border-amber-300 hover:text-amber-700 transition group"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100/70 text-amber-700 group-hover:scale-110 transition">
              <Award className="h-5 w-5" />
            </div>
            <span className="text-xs font-bold text-slate-700 group-hover:text-amber-700">
              Chấm bài & Điểm
            </span>
          </Link>

          <Link
            href="/questions"
            className="flex flex-col items-center justify-center gap-2 rounded-xl border border-slate-200/70 p-3.5 text-center hover:bg-indigo-50/60 hover:border-indigo-300 hover:text-indigo-700 transition group"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100/70 text-indigo-700 group-hover:scale-110 transition">
              <FileQuestion className="h-5 w-5" />
            </div>
            <span className="text-xs font-bold text-slate-700 group-hover:text-indigo-700">
              Ngân hàng câu hỏi
            </span>
          </Link>

          <Link
            href="/classes"
            className="flex flex-col items-center justify-center gap-2 rounded-xl border border-slate-200/70 p-3.5 text-center hover:bg-emerald-50/60 hover:border-emerald-300 hover:text-emerald-700 transition group"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100/70 text-emerald-700 group-hover:scale-110 transition">
              <GraduationCap className="h-5 w-5" />
            </div>
            <span className="text-xs font-bold text-slate-700 group-hover:text-emerald-700">
              Lớp học & Cấp SBD
            </span>
          </Link>

          <Link
            href="/materials"
            className="flex flex-col items-center justify-center gap-2 rounded-xl border border-slate-200/70 p-3.5 text-center hover:bg-teal-50/60 hover:border-teal-300 hover:text-teal-700 transition group"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100/70 text-teal-700 group-hover:scale-110 transition">
              <FolderDown className="h-5 w-5" />
            </div>
            <span className="text-xs font-bold text-slate-700 group-hover:text-teal-700">
              Học liệu & PDF
            </span>
          </Link>

          <Link
            href="/ai-assistant"
            className="flex flex-col items-center justify-center gap-2 rounded-xl border border-purple-200/80 bg-purple-50/30 p-3.5 text-center hover:bg-purple-100/60 hover:border-purple-300 hover:text-purple-700 transition group"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-purple-700 group-hover:scale-110 transition">
              <Sparkles className="h-5 w-5" />
            </div>
            <span className="text-xs font-bold text-purple-900 group-hover:text-purple-700">
              AI Trợ lý Toán
            </span>
          </Link>
        </div>
      </section>

      {/* 4. Khối Nội Dung Chính (2 Cột) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* CỘT CHÍNH (8 Cột) */}
        <div className="lg:col-span-8 space-y-8">
          {/* A. Danh sách các lớp học đang dạy */}
          <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700 font-bold">
                  <GraduationCap className="h-4 w-4" />
                </div>
                <h2 className="text-lg font-bold text-slate-900">Lớp học Thầy đang phụ trách</h2>
              </div>

              <Link
                href="/classes"
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 group"
              >
                <span>Xem tất cả ({classes.length})</span>
                <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition" />
              </Link>
            </div>

            {classes.length === 0 ? (
              <div className="py-10 text-center">
                <GraduationCap className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-600">Thầy chưa tạo lớp học nào</p>
                <p className="text-xs text-slate-400 mt-1">
                  Hãy tạo lớp học đầu tiên để cấp mã tham gia cho học sinh.
                </p>
                <Link
                  href="/classes"
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-500 transition"
                >
                  <Plus className="h-4 w-4" />
                  Tạo lớp học ngay
                </Link>
              </div>
            ) : (
              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {classes.slice(0, 4).map((c) => (
                  <div
                    key={c.id}
                    onClick={() => router.push(`/classes/${c.id}`)}
                    className="group flex flex-col justify-between rounded-xl border border-slate-200/80 p-4.5 hover:border-blue-300 hover:shadow-md transition cursor-pointer bg-slate-50/40 hover:bg-white"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="rounded-md bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-700">
                          Khối {c.grade || 12}
                        </span>
                        {c.pending_count && c.pending_count > 0 ? (
                          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                            {c.pending_count} chờ duyệt
                          </span>
                        ) : null}
                      </div>

                      <h3 className="mt-2 text-base font-bold text-slate-900 group-hover:text-blue-600 transition truncate">
                        {c.name}
                      </h3>

                      <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                        {c.description || (c.grade ? `Lớp ${c.grade} • Toán THPT` : 'Toán THPT')}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                        <Users className="h-3.5 w-3.5 text-slate-400" />
                        <span>{c.member_count || 0} học sinh</span>
                      </div>

                      {/* Mã lớp click to copy */}
                      <button
                        type="button"
                        onClick={(e) => handleCopyCode(c.code, e)}
                        className="inline-flex items-center gap-1 rounded-md bg-slate-200/70 px-2 py-1 font-mono text-[11px] font-bold text-slate-700 hover:bg-blue-100 hover:text-blue-700 transition"
                        title="Bấm để sao chép mã lớp"
                      >
                        {copiedCode === c.code ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-600" />
                            <span className="text-emerald-700">Đã chép</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3 text-slate-400" />
                            <span>{c.code}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* B. Các đề thi và bài kiểm tra gần đây */}
          <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 font-bold">
                  <ClipboardList className="h-4 w-4" />
                </div>
                <h2 className="text-lg font-bold text-slate-900">Hoạt động kiểm tra & Đề thi mới</h2>
              </div>

              <Link
                href="/exams"
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 group"
              >
                <span>Xem tất cả đề thi</span>
                <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition" />
              </Link>
            </div>

            {recentExams.length === 0 ? (
              <div className="py-10 text-center">
                <ClipboardList className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-600">Chưa có đề thi nào</p>
                <p className="text-xs text-slate-400 mt-1">
                  Thầy có thể tạo đề thi nhanh từ file Word (.docx) hoặc mã LaTeX (.tex).
                </p>
                <Link
                  href="/exams/editor"
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-500 transition"
                >
                  <Plus className="h-4 w-4" />
                  Soạn đề thi ngay
                </Link>
              </div>
            ) : (
              <div className="mt-4 divide-y divide-slate-100">
                {recentExams.map((exam) => {
                  const isLive = exam.status === 'published' && !exam.is_locked;
                  return (
                    <div
                      key={exam.id}
                      className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 px-2 rounded-xl transition"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                              exam.category === 'practice'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {exam.category === 'practice' ? 'Luyện tập' : 'Đề thi'}
                          </span>

                          {isLive && (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              ĐANG MỞ
                            </span>
                          )}

                          <span className="text-xs text-slate-400">Khối {exam.grade || 12}</span>
                        </div>

                        <h3 className="mt-1 text-sm font-bold text-slate-900 truncate hover:text-blue-600 transition">
                          <Link href={`/exams`}>{exam.title}</Link>
                        </h3>

                        <div className="mt-1 flex items-center gap-4 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {exam.duration_minutes || 45} phút
                          </span>
                          <span>•</span>
                          <span>{exam.questions_count || exam.questions?.length || 0} câu hỏi</span>
                          <span>•</span>
                          <span>{exam.submissions_count || 0} lượt nộp</span>
                        </div>
                      </div>

                      {/* Các nút thao tác */}
                      <div className="flex items-center gap-2 shrink-0">
                        {isLive && (
                          <Link
                            href={`/exams/${exam.id}/monitor`}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 transition border border-rose-200"
                            title="Mở phòng giám sát trực tiếp"
                          >
                            <Radio className="h-3.5 w-3.5 text-rose-600 animate-pulse" />
                            <span>Giám sát</span>
                          </Link>
                        )}

                        <Link
                          href={`/exams/editor?id=${exam.id}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
                        >
                          <Pencil className="h-3 w-3" />
                          <span>Chỉnh sửa</span>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* CỘT PHỤ (4 Cột) */}
        <div className="lg:col-span-4 space-y-8">
          {/* Khối 1: Bài thi cần chấm ngay */}
          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Award className="h-4 w-4 text-amber-600" />
                <span>Cần Thầy chấm điểm</span>
              </h2>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                {pendingGradingSubmissions.length} bài
              </span>
            </div>

            {pendingGradingSubmissions.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-1.5" />
                <span>Không có bài nộp nào đang chờ chấm!</span>
              </div>
            ) : (
              <div className="mt-3 space-y-2.5">
                {pendingGradingSubmissions.slice(0, 4).map((sub) => (
                  <div
                    key={sub.id}
                    className="p-3 rounded-xl bg-slate-50/70 border border-slate-100 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-slate-800 truncate">
                        {sub.student?.full_name || 'Học sinh'}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {sub.exam?.title || 'Bài kiểm tra'}
                      </div>
                    </div>
                    <Link
                      href={`/gradebook/grade/${sub.id}`}
                      className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-[11px] font-bold text-white shadow-2xs hover:bg-blue-500 transition"
                    >
                      <span>Chấm</span>
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                ))}

                <Link
                  href="/gradebook"
                  className="mt-3 block text-center text-xs font-semibold text-blue-600 hover:text-blue-700 pt-2 border-t border-slate-100"
                >
                  Vào sổ điểm toàn diện →
                </Link>
              </div>
            )}
          </section>

          {/* Khối 2: Widget AI Sư Phạm Toán */}
          <section className="rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50/80 via-white to-indigo-50/50 p-5 shadow-xs">
            <div className="flex items-center gap-2 text-purple-900 font-bold text-sm mb-2">
              <Sparkles className="h-4 w-4 text-purple-600" />
              <span>AI Trợ lý Sư Phạm Toán</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Hỗ trợ Thầy tạo đề thi tự động, sinh các bài toán tương tự cùng mức độ nhận thức, và gợi ý nhận xét bài tự luận.
            </p>
            <div className="space-y-2">
              <Link
                href="/ai-assistant?prompt=Sinh+5+câu+trắc nghiệm+Đúng/Sai+về+Cực+trị+hàm+số+chuẩn+cấu+trúc+2025"
                className="block text-xs font-medium text-purple-700 bg-white/90 p-2.5 rounded-xl border border-purple-100 shadow-2xs hover:bg-purple-100/60 transition truncate"
              >
                ✨ Sinh 5 câu Đúng/Sai Cực trị hàm số 2025
              </Link>
              <Link
                href="/ai-assistant?prompt=Gợi+ý+barem+chấm+điểm+chi+tiết+cho+bài+toán+Tối+ưu+hóa+hình+học"
                className="block text-xs font-medium text-purple-700 bg-white/90 p-2.5 rounded-xl border border-purple-100 shadow-2xs hover:bg-purple-100/60 transition truncate"
              >
                📐 Soạn barem điểm bài toán Tối ưu hóa
              </Link>
            </div>
          </section>

          {/* Khối 3: Thống kê nhanh hệ thống */}
          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              Thông tin cấu hình
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-600 py-1 border-b border-slate-100">
                <span>Cấu trúc đề thi</span>
                <span className="font-semibold text-slate-900">Bộ GD&ĐT 2025</span>
              </div>
              <div className="flex items-center justify-between text-slate-600 py-1 border-b border-slate-100">
                <span>Bộ dựng công thức</span>
                <span className="font-semibold text-blue-600">KaTeX + Pure SVG</span>
              </div>
              <div className="flex items-center justify-between text-slate-600 py-1 border-b border-slate-100">
                <span>Hình vẽ TikZ THPT</span>
                <span className="font-semibold text-emerald-600">0ms Turbo SVG</span>
              </div>
              <div className="flex items-center justify-between text-slate-600 py-1">
                <span>Hạ tầng đám mây</span>
                <span className="font-semibold text-slate-900">Supabase RLS</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default TeacherDashboard;
