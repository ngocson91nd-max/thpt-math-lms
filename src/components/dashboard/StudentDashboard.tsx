'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { ClassItem, Exam, Submission, Course } from '@/types/database';
import { getEnrolledClassIdsForUser, isExamPermittedForStudent } from '@/lib/auth/enrollment';
import { MOCK_COURSES } from '@/lib/supabase/mockStore';
import {
  GraduationCap,
  ClipboardList,
  BookOpen,
  Award,
  ArrowRight,
  Clock,
  Sparkles,
  CheckCircle2,
  Calendar,
  AlertCircle,
  Play,
  RotateCcw,
  Users,
  Copy,
  Check,
  Zap,
  Target,
  TrendingUp,
  FileText,
  HelpCircle,
  ChevronRight,
  FolderDown,
  Flame,
} from 'lucide-react';

export const StudentDashboard: React.FC = () => {
  const router = useRouter();
  const { user } = useAuth();

  // 1. Danh sách lớp học
  const [classes, setClasses] = useState<ClassItem[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem('lms_classes');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  // 2. Danh sách đề thi & bài tập
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

  // 3. Danh sách bài nộp của học sinh
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

  // 4. Danh sách khóa học
  const [courses, setCourses] = useState<Course[]>(() => {
    if (typeof window === 'undefined') return MOCK_COURSES;
    try {
      const saved = localStorage.getItem('lms_courses');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return MOCK_COURSES;
  });

  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Đồng bộ dữ liệu nền
  useEffect(() => {
    const syncData = async () => {
      try {
        const resClasses = await fetch('/api/classes');
        const dataClasses = await resClasses.json();
        if (dataClasses.success && Array.isArray(dataClasses.classes)) {
          setClasses(dataClasses.classes);
          localStorage.setItem('lms_classes', JSON.stringify(dataClasses.classes));
        }
      } catch {}

      try {
        const resExams = await fetch('/api/exams');
        const dataExams = await resExams.json();
        if (dataExams.success && Array.isArray(dataExams.exams)) {
          setExams(dataExams.exams);
          localStorage.setItem('lms_exams', JSON.stringify(dataExams.exams));
        }
      } catch {}

      try {
        const resSub = await fetch('/api/submissions');
        const dataSub = await resSub.json();
        if (dataSub.success && Array.isArray(dataSub.submissions)) {
          setSubmissions(dataSub.submissions);
          localStorage.setItem('lms_all_submissions', JSON.stringify(dataSub.submissions));
        }
      } catch {}
    };

    syncData();
  }, []);

  // Các lớp học mà học sinh ĐÃ THAM GIA
  const enrolledClassIds = useMemo(() => {
    if (!user) return [];
    return getEnrolledClassIdsForUser(user.id, user.email);
  }, [user]);

  const myClasses = useMemo(() => {
    return classes.filter((c) => enrolledClassIds.includes(c.id));
  }, [classes, enrolledClassIds]);

  // Các bài thi mà học sinh ĐƯỢC PHÉP THAM GIA
  const accessibleExams = useMemo(() => {
    if (!user) return [];
    return exams.filter((e) => isExamPermittedForStudent(e, user.id, classes, user.email));
  }, [exams, user, classes]);

  // Bài nộp của riêng học sinh hiện tại
  const mySubmissions = useMemo(() => {
    if (!user) return [];
    return submissions.filter(
      (s) =>
        s.student_id === user.id ||
        (s.student?.email && user.email && s.student.email.toLowerCase() === user.email.toLowerCase())
    );
  }, [submissions, user]);

  // Lập bản đồ bài nộp theo exam_id
  const submissionsByExamId = useMemo(() => {
    const map = new Map<string, Submission>();
    mySubmissions.forEach((s) => {
      // Ưu tiên bài nộp có điểm hoặc mới nhất
      const existing = map.get(s.exam_id);
      if (!existing || (s.score !== undefined && (existing.score === undefined || s.score > existing.score))) {
        map.set(s.exam_id, s);
      }
    });
    return map;
  }, [mySubmissions]);

  // 1. Việc cần làm: Các bài kiểm tra/bài tập học sinh CHƯA HOÀN THÀNH
  const pendingTasks = useMemo(() => {
    return accessibleExams.filter((e) => {
      const sub = submissionsByExamId.get(e.id);
      // Chưa nộp bài hoặc đề cho phép làm lại nhiều lần
      return !sub && e.status === 'published';
    });
  }, [accessibleExams, submissionsByExamId]);

  // 2. Bài tập ưu tiên nhất hôm nay (High-priority action)
  const priorityTask = pendingTasks[0] || null;

  // 3. Kết quả các bài thi gần đây (Recent Submissions)
  const recentSubmissions = useMemo(() => {
    return [...mySubmissions]
      .sort((a, b) => new Date(b.submitted_at || b.start_time).getTime() - new Date(a.submitted_at || a.start_time).getTime())
      .slice(0, 4);
  }, [mySubmissions]);

  // 4. Thống kê điểm trung bình
  const avgScore = useMemo(() => {
    const scoredSubs = mySubmissions.filter((s) => typeof s.score === 'number');
    if (scoredSubs.length === 0) return null;
    const total = scoredSubs.reduce((sum, s) => sum + (s.score || 0), 0);
    return (total / scoredSubs.length).toFixed(1);
  }, [mySubmissions]);

  const handleCopyCode = (code: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  return (
    <div className="space-y-8 pb-12">
      {/* 1. Header Chào Mừng & Định Hướng Mục Tiêu */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-900 via-indigo-900 to-slate-900 p-6 sm:p-8 text-white shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:24px_24px] opacity-20 pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-500/10 px-3.5 py-1 text-xs font-semibold text-blue-200 backdrop-blur-md">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              Bàn học Trực tuyến • {myClasses.length > 0 ? myClasses[0].name : 'Học sinh Toán THPT'}
              {user?.candidate_number && ` • SBD: ${user.candidate_number}`}
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight">
              Chào em, {user?.full_name || 'Học sinh'}! 🎯
            </h1>

            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Hãy kiên trì mỗi ngày để chinh phục điểm 9.0+ môn Toán THPT 2025. Dưới đây là bài tập cần hoàn thành và tiến độ học tập của em.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/exams"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-blue-600/30 hover:bg-blue-500 transition active:scale-95"
            >
              <ClipboardList className="h-4 w-4" />
              <span>Vào phòng luyện thi</span>
            </Link>

            <Link
              href="/ai-assistant"
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white backdrop-blur-md hover:bg-white/20 transition active:scale-95"
            >
              <Sparkles className="h-4 w-4 text-purple-300" />
              <span>Hỏi bài Thầy AI</span>
            </Link>
          </div>
        </div>
      </section>

      {/* 2. Thẻ Chỉ Số Tiến Độ Học Tập (KPI Grid) */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* KPI 1: Nhiệm vụ cần làm */}
        <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs hover:border-amber-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Nhiệm vụ cần làm
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <ClipboardList className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{pendingTasks.length}</span>
            <span className="text-xs font-medium text-slate-500">bài tập/đề</span>
          </div>
          <div className="mt-2 text-xs font-semibold">
            {pendingTasks.length > 0 ? (
              <span className="text-amber-600 flex items-center gap-1">
                <Flame className="h-3.5 w-3.5" /> Có bài cần nộp tuần này
              </span>
            ) : (
              <span className="text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Đã làm hết bài được giao
              </span>
            )}
          </div>
        </div>

        {/* KPI 2: Điểm số trung bình */}
        <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs hover:border-emerald-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Điểm trung bình
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Award className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">
              {avgScore !== null ? avgScore : '--'}
            </span>
            <span className="text-xs font-medium text-slate-500">/ 10</span>
          </div>
          <div className="mt-2 text-xs font-semibold text-emerald-600 flex items-center gap-1">
            <TrendingUp className="h-3.5 w-3.5" />
            <span>{mySubmissions.length} bài đã có kết quả</span>
          </div>
        </div>

        {/* KPI 3: Bài thi đã nộp */}
        <Link
          href="/gradebook"
          className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs hover:border-blue-300 transition"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Đã hoàn thành
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{mySubmissions.length}</span>
            <span className="text-xs font-medium text-slate-500">lượt làm bài</span>
          </div>
          <div className="mt-2 text-xs font-semibold text-blue-600 flex items-center gap-1">
            <span>Xem lịch sử bài làm</span>
            <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition" />
          </div>
        </Link>

        {/* KPI 4: Lớp học đang tham gia */}
        <Link
          href="/classes"
          className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs hover:border-indigo-300 transition"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Lớp tham gia
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <GraduationCap className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{myClasses.length}</span>
            <span className="text-xs font-medium text-slate-500">lớp học</span>
          </div>
          <div className="mt-2 text-xs font-semibold text-indigo-600 flex items-center gap-1">
            <span>Xem danh sách lớp</span>
            <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition" />
          </div>
        </Link>
      </section>

      {/* 3. Nhiệm Vụ Ưu Tiên Nổi Bật (Priority Action Banner) */}
      {priorityTask && (
        <section className="relative overflow-hidden rounded-2xl border border-amber-300/80 bg-gradient-to-r from-amber-50 via-orange-50/50 to-white p-5 sm:p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5 max-w-2xl">
              <div className="inline-flex items-center gap-1.5 rounded-md bg-amber-200/70 px-2.5 py-0.5 text-[11px] font-bold text-amber-900">
                <Flame className="h-3.5 w-3.5 text-amber-700" />
                <span>Nhiệm vụ ưu tiên cần làm</span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                {priorityTask.title}
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  {priorityTask.duration_minutes} phút
                </span>
                <span>•</span>
                <span>{priorityTask.questions_count || priorityTask.questions?.length || 0} câu hỏi chuẩn 2025</span>
                <span>•</span>
                <span className="text-amber-800 font-semibold">Chưa làm bài</span>
              </p>
            </div>

            <Link
              href={`/exams/${priorityTask.id}/take`}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-3.5 text-sm font-bold text-white shadow-md shadow-orange-500/20 hover:from-amber-600 hover:to-orange-700 transition active:scale-95 shrink-0"
            >
              <Play className="h-4 w-4 fill-current" />
              <span>BẮT ĐẦU LÀM BÀI</span>
            </Link>
          </div>
        </section>
      )}

      {/* 4. Khối Nội Dung Chính (2 Cột) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* CỘT CHÍNH (8 Cột) */}
        <div className="lg:col-span-8 space-y-8">
          {/* A. Danh sách bài tập & Đề thi cần hoàn thành */}
          <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700 font-bold">
                  <ClipboardList className="h-4 w-4" />
                </div>
                <h2 className="text-lg font-bold text-slate-900">Bài tập & Đề thi của em</h2>
              </div>

              <Link
                href="/exams"
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 group"
              >
                <span>Xem tất cả ({accessibleExams.length})</span>
                <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition" />
              </Link>
            </div>

            {accessibleExams.length === 0 ? (
              <div className="py-10 text-center">
                <ClipboardList className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-600">Chưa có bài tập nào được giao</p>
                <p className="text-xs text-slate-400 mt-1">
                  Khi Thầy Sơn giao đề thi cho lớp, các bài tập sẽ hiển thị tại đây.
                </p>
              </div>
            ) : (
              <div className="mt-4 divide-y divide-slate-100">
                {accessibleExams.slice(0, 5).map((exam) => {
                  const sub = submissionsByExamId.get(exam.id);
                  const isDone = !!sub;

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
                            {exam.category === 'practice' ? 'Luyện tập' : 'Đề kiểm tra'}
                          </span>

                          {isDone ? (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                              Đã nộp • {sub.score !== undefined ? `${sub.score}đ` : 'Đang chấm'}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                              <Clock className="h-3 w-3 text-amber-600" />
                              Chưa làm
                            </span>
                          )}

                          <span className="text-xs text-slate-400">Khối {exam.grade || 12}</span>
                        </div>

                        <h3 className="mt-1 text-sm font-bold text-slate-900 truncate hover:text-blue-600 transition">
                          <Link href={`/exams`}>{exam.title}</Link>
                        </h3>

                        <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                          <span>{exam.duration_minutes} phút</span>
                          <span>•</span>
                          <span>{exam.questions_count || exam.questions?.length || 0} câu hỏi</span>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        {isDone ? (
                          <>
                            <Link
                              href={`/exams/${exam.id}/result/${sub.id}`}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
                            >
                              <span>Xem lại</span>
                            </Link>
                            <Link
                              href={`/exams/${exam.id}/practice`}
                              className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition"
                            >
                              <RotateCcw className="h-3 w-3" />
                              <span>Luyện lại</span>
                            </Link>
                          </>
                        ) : (
                          <Link
                            href={`/exams/${exam.id}/take`}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-blue-500 transition"
                          >
                            <Play className="h-3 w-3 fill-current" />
                            <span>Làm bài</span>
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* B. Kết quả & Lịch sử học tập gần đây */}
          <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 font-bold">
                  <Award className="h-4 w-4" />
                </div>
                <h2 className="text-lg font-bold text-slate-900">Kết quả & Điểm số gần nhất</h2>
              </div>

              <Link
                href="/gradebook"
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 group"
              >
                <span>Xem sổ điểm</span>
                <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition" />
              </Link>
            </div>

            {recentSubmissions.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                <Award className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <span>Em chưa làm bài kiểm tra nào. Hãy bắt đầu bài tập đầu tiên nhé!</span>
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {recentSubmissions.map((sub) => {
                  const exam = exams.find((e) => e.id === sub.exam_id);
                  const isHigh = sub.score !== undefined && sub.score >= 8.0;

                  return (
                    <div
                      key={sub.id}
                      onClick={() => router.push(`/exams/${sub.exam_id}/result/${sub.id}`)}
                      className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-white hover:border-blue-300 hover:shadow-xs transition cursor-pointer flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-400">
                            {sub.submitted_at
                              ? new Date(sub.submitted_at).toLocaleDateString('vi-VN')
                              : 'Vừa nộp'}
                          </span>
                          <span
                            className={`rounded-md px-2 py-0.5 text-xs font-extrabold ${
                              isHigh ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {sub.score !== undefined ? `${sub.score} / ${sub.max_score || 10}` : 'Chờ chấm'}
                          </span>
                        </div>
                        <h4 className="mt-2 text-sm font-bold text-slate-900 line-clamp-1">
                          {sub.exam?.title || exam?.title || 'Bài kiểm tra'}
                        </h4>
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-blue-600 font-semibold">
                        <span>Xem lời giải chi tiết</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* C. Tiếp tục bài giảng & Khóa học */}
          <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 font-bold">
                  <BookOpen className="h-4 w-4" />
                </div>
                <h2 className="text-lg font-bold text-slate-900">Khóa học & Chuyên đề Toán</h2>
              </div>

              <Link
                href="/courses"
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 group"
              >
                <span>Tất cả khóa học</span>
                <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition" />
              </Link>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {courses.slice(0, 2).map((course) => (
                <div
                  key={course.id}
                  onClick={() => router.push(`/courses/${course.slug}`)}
                  className="rounded-xl border border-slate-200/80 p-4 hover:border-indigo-300 hover:shadow-xs transition cursor-pointer bg-slate-50/40 hover:bg-white"
                >
                  <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                    Khối {course.grade || 12}
                  </span>
                  <h3 className="mt-2 text-sm font-bold text-slate-900 line-clamp-1">
                    {course.title}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                    {course.description}
                  </p>
                  <div className="mt-3 flex items-center justify-between text-xs font-semibold text-indigo-600">
                    <span>Học chuyên đề này</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* CỘT PHỤ (4 Cột) */}
        <div className="lg:col-span-4 space-y-8">
          {/* Khối 1: Lớp học của em */}
          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-blue-600" />
                <span>Lớp học của em</span>
              </h2>
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800">
                {myClasses.length} lớp
              </span>
            </div>

            {myClasses.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                <GraduationCap className="h-8 w-8 text-slate-300 mx-auto mb-1.5" />
                <span>Em chưa thuộc lớp nào. Hãy nhập mã lớp do Thầy cấp.</span>
                <Link
                  href="/classes"
                  className="mt-3 inline-block rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-blue-500 transition"
                >
                  Nhập mã tham gia lớp
                </Link>
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                {myClasses.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => router.push(`/classes/${c.id}`)}
                    className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/70 hover:bg-white hover:border-blue-300 hover:shadow-2xs transition cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-md">
                        Khối {c.grade || 12}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => handleCopyCode(c.code, e)}
                        className="inline-flex items-center gap-1 rounded bg-slate-200/70 px-1.5 py-0.5 text-[10px] font-mono text-slate-700 hover:bg-blue-100"
                        title="Sao chép mã lớp"
                      >
                        {copiedCode === c.code ? (
                          <Check className="h-3 w-3 text-emerald-600" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                        <span>{c.code}</span>
                      </button>
                    </div>

                    <h4 className="mt-2 text-sm font-bold text-slate-900 truncate">{c.name}</h4>

                    <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {c.member_count || 0} bạn học
                      </span>
                      <span className="text-blue-600 font-semibold">Vào lớp →</span>
                    </div>
                  </div>
                ))}

                <Link
                  href="/classes"
                  className="block text-center text-xs font-semibold text-slate-500 hover:text-blue-600 pt-1"
                >
                  + Tham gia lớp khác bằng mã
                </Link>
              </div>
            )}
          </section>

          {/* Khối 2: AI Trợ Lý Toán Học */}
          <section className="rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50/80 via-white to-indigo-50/50 p-5 shadow-xs">
            <div className="flex items-center gap-2 text-purple-900 font-bold text-sm mb-2">
              <Sparkles className="h-4 w-4 text-purple-600" />
              <span>Hỏi bài Thầy AI (24/7)</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Gặp bài toán khó hoặc chưa hiểu phương pháp giải? Hãy hỏi ngay AI Trợ lý để nhận gợi ý tư duy từng bước.
            </p>
            <div className="space-y-2">
              <Link
                href="/ai-assistant?prompt=Hướng+dẫn+tôi+cách+giải+bài+toán+khoảng+cách+trong+hình+không+gian"
                className="block text-xs font-medium text-purple-700 bg-white/90 p-2.5 rounded-xl border border-purple-100 shadow-2xs hover:bg-purple-100/60 transition truncate"
              >
                📐 Phương pháp tính khoảng cách hình không gian
              </Link>
              <Link
                href="/ai-assistant?prompt=Giải+thích+bản+chất+tích+phân+từng+phần+và+cách+đặt+u,+dv"
                className="block text-xs font-medium text-purple-700 bg-white/90 p-2.5 rounded-xl border border-purple-100 shadow-2xs hover:bg-purple-100/60 transition truncate"
              >
                ∫ Mẹo đặt u, dv trong tích phân từng phần
              </Link>
            </div>
          </section>

          {/* Khối 3: Kho Tài Liệu & Đề Thi Thử */}
          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FolderDown className="h-4 w-4 text-teal-600" />
                <span>Tài liệu & Học liệu ôn thi</span>
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Tải tài liệu PDF, công thức tóm tắt và đề thi thử mới nhất của Thầy Sơn.
            </p>
            <Link
              href="/materials"
              className="mt-3 inline-flex items-center justify-center w-full gap-1.5 rounded-xl bg-slate-100 py-2.5 text-xs font-bold text-slate-700 hover:bg-teal-50 hover:text-teal-700 transition"
            >
              <span>Vào kho tài liệu PDF</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
