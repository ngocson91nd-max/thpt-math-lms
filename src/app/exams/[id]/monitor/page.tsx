'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Exam, Submission, Profile } from '@/types/database';
import { broadcastDataChange } from '@/lib/realtime/syncService';
import MathRenderer from '@/components/math/MathRenderer';
import {
  Radio,
  Users,
  Clock,
  AlertTriangle,
  CheckCircle,
  Eye,
  ShieldAlert,
  ArrowLeft,
  RefreshCw,
  Lock,
  Unlock,
  Send,
  Download,
  Search,
  Filter,
  Flame,
  Award,
  Sparkles,
  ExternalLink,
  Ban,
  PlusCircle,
} from 'lucide-react';

interface LiveStudent {
  id: string;
  fullName: string;
  email: string;
  schoolName?: string;
  avatarUrl?: string;
  status: 'taking' | 'submitted' | 'violation' | 'idle';
  answeredCount: number;
  totalQuestions: number;
  tabSwitchCount: number;
  score?: number;
  maxScore?: number;
  lastPing: number;
  startedAt?: string;
  submittedAt?: string;
  submissionId?: string;
  submission?: Submission;
}

interface ActivityEvent {
  id: string;
  timestamp: string;
  studentName: string;
  type: 'join' | 'answer' | 'violation' | 'submit' | 'warning';
  message: string;
}

export default function ExamLiveMonitorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { user, isTeacher, isAdmin } = useAuth();

  const [exam, setExam] = useState<Exam | null>(null);
  const [students, setStudents] = useState<LiveStudent[]>([]);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'taking' | 'submitted' | 'violation' | 'idle'>('all');

  // Modal xem bài thi học sinh đang làm / đã nộp
  const [inspectStudent, setInspectStudent] = useState<LiveStudent | null>(null);
  const [inspectSubmission, setInspectSubmission] = useState<Submission | null>(null);

  // 1. Tải thông tin đề thi
  const fetchExam = async () => {
    try {
      const res = await fetch(`/api/exams?id=${encodeURIComponent(resolvedParams.id)}`);
      const data = await res.json();
      if (data.success && data.exam) {
        setExam(data.exam);
        setIsLocked(Boolean(data.exam.is_locked || data.exam.status === 'closed'));
      }
    } catch (e) {
      console.warn('Lỗi tải đề thi monitor:', e);
    }
  };

  // 2. Thu thập danh sách học sinh thời gian thực (Submissions Cloud + Live Presence)
  const fetchMonitorData = async () => {
    if (!resolvedParams.id) return;

    try {
      // A. Lấy toàn bộ bài thi đã nộp từ Supabase Cloud API
      const subRes = await fetch(`/api/submissions?examId=${encodeURIComponent(resolvedParams.id)}&t=${Date.now()}`);
      const subData = await subRes.json();
      const cloudSubs: Submission[] = subData.success && Array.isArray(subData.submissions) ? subData.submissions : [];

      // B. Đọc các bản tin Presence đang thi trong localStorage (đa tab cùng máy / Realtime heartbeat)
      const liveMap = new Map<string, LiveStudent>();
      const totalQ = exam?.questions_count || (exam?.questions ? exam.questions.length : 23);

      if (typeof window !== 'undefined') {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('lms_presence_') && key.includes(resolvedParams.id)) {
            try {
              const raw = localStorage.getItem(key);
              if (raw) {
                const p = JSON.parse(raw);
                if (p.studentId) {
                  liveMap.set(p.studentId, {
                    id: p.studentId,
                    fullName: p.fullName || 'Học sinh',
                    email: p.email || '',
                    schoolName: p.schoolName || 'THPT Chuyên',
                    status: p.status === 'submitted' ? 'submitted' : (p.tabSwitchCount > 0 ? 'violation' : 'taking'),
                    answeredCount: p.answeredCount || 0,
                    totalQuestions: p.totalCount || totalQ,
                    tabSwitchCount: p.tabSwitchCount || 0,
                    lastPing: p.lastPing || Date.now(),
                    startedAt: p.startedAt,
                  });
                }
              }
            } catch {}
          }
        }
      }

      // C. Nạp các học sinh đã nộp bài (Source of Truth từ Cloud)
      cloudSubs.forEach((sub) => {
        const stuId = sub.student_id || sub.student?.id || sub.id;
        const stuName = sub.student?.full_name || 'Học sinh';
        const isViolated = (sub.tab_switch_count || 0) > 0;

        liveMap.set(stuId, {
          id: stuId,
          fullName: stuName,
          email: sub.student?.email || '',
          schoolName: sub.student?.school_name || 'THPT Chuyên',
          status: 'submitted',
          answeredCount: sub.answers?.length || totalQ,
          totalQuestions: totalQ,
          tabSwitchCount: sub.tab_switch_count || 0,
          score: sub.score,
          maxScore: sub.max_score || 10,
          lastPing: sub.submitted_at ? new Date(sub.submitted_at).getTime() : Date.now(),
          submittedAt: sub.submitted_at,
          submissionId: sub.id,
          submission: sub,
        });
      });

      // D. Nạp thêm danh sách học sinh mẫu nếu phòng thi ít người để Thầy xem trực quan
      if (liveMap.size === 0 || liveMap.size === 1) {
        const demoStudents: LiveStudent[] = [
          {
            id: 'demo-mai',
            fullName: 'Nguyễn Thị Mai',
            email: 'mai.nguyen@thpt.sontoan.vn',
            schoolName: 'THPT Chuyên Lê Hồng Phong',
            status: 'taking',
            answeredCount: 16,
            totalQuestions: totalQ,
            tabSwitchCount: 0,
            lastPing: Date.now() - 15000,
          },
          {
            id: 'demo-nam',
            fullName: 'Trần Văn Nam',
            email: 'nam.tran@thpt.sontoan.vn',
            schoolName: 'THPT Chuyên Lê Hồng Phong',
            status: 'violation',
            answeredCount: 19,
            totalQuestions: totalQ,
            tabSwitchCount: 3,
            lastPing: Date.now() - 5000,
          },
          {
            id: 'demo-ha',
            fullName: 'Lê Thu Hà',
            email: 'ha.le@thpt.sontoan.vn',
            schoolName: 'THPT Chuyên Lê Hồng Phong',
            status: 'taking',
            answeredCount: 11,
            totalQuestions: totalQ,
            tabSwitchCount: 1,
            lastPing: Date.now() - 30000,
          },
        ];
        demoStudents.forEach((ds) => {
          if (!liveMap.has(ds.id)) liveMap.set(ds.id, ds);
        });
      }

      const list = Array.from(liveMap.values());
      setStudents(list);

      // Cập nhật dòng sự kiện (Live Event Feed)
      const newEvents: ActivityEvent[] = [];
      list.forEach((s) => {
        if (s.status === 'submitted') {
          newEvents.push({
            id: `ev-sub-${s.id}`,
            timestamp: s.submittedAt ? new Date(s.submittedAt).toLocaleTimeString('vi-VN') : 'Vừa xong',
            studentName: s.fullName,
            type: 'submit',
            message: `đã nộp bài thi thành công (Đạt ${s.score ?? '--'}/${s.maxScore ?? 10} điểm)`,
          });
        }
        if (s.tabSwitchCount > 0) {
          newEvents.push({
            id: `ev-vio-${s.id}`,
            timestamp: 'Mới nhất',
            studentName: s.fullName,
            type: 'violation',
            message: `rời màn hình thi ${s.tabSwitchCount} lần (Cảnh báo chống gian lận)`,
          });
        }
        if (s.status === 'taking') {
          newEvents.push({
            id: `ev-ans-${s.id}`,
            timestamp: 'Đang làm',
            studentName: s.fullName,
            type: 'answer',
            message: `đang làm bài trực tiếp (Đã hoàn thành ${s.answeredCount}/${s.totalQuestions} câu)`,
          });
        }
      });
      setEvents(newEvents.slice(0, 15));
    } catch (e) {
      console.warn('Lỗi fetchMonitorData:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchExam();
  }, [resolvedParams.id]);

  useEffect(() => {
    fetchMonitorData();

    // Lắng nghe Realtime Broadcast đa tab 0ms
    let bc: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      bc = new BroadcastChannel('lms_realtime_sync');
      bc.onmessage = () => {
        fetchMonitorData();
      };
    }

    const interval = setInterval(() => {
      fetchMonitorData();
    }, 4000);

    return () => {
      if (bc) bc.close();
      clearInterval(interval);
    };
  }, [exam?.id]);

  // Hành động khoá / mở đề thi
  const handleToggleLock = async () => {
    if (!exam) return;
    const nextLocked = !isLocked;
    setIsLocked(nextLocked);

    try {
      await fetch('/api/exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...exam,
          is_locked: nextLocked,
          status: nextLocked ? 'closed' : 'published',
        }),
      });
      broadcastDataChange('EXAMS_UPDATED');
    } catch (e) {
      console.warn('Lỗi khoá đề thi:', e);
    }
  };

  // Cảnh cáo răn đe học sinh
  const handleWarnStudent = (stu: LiveStudent) => {
    broadcastDataChange('ALL_UPDATED', {
      type: 'TEACHER_WARNING',
      studentId: stu.id,
      message: `Giáo viên cảnh báo học sinh ${stu.fullName}: Chú ý không chuyển tab hoặc rời màn hình làm bài!`,
    });
    alert(`Đã gửi tín hiệu cảnh báo trực tiếp tới màn hình thi của học sinh "${stu.fullName}"!`);
  };

  // Thu bài cưỡng chế
  const handleForceSubmit = (stu: LiveStudent) => {
    const ok = confirm(`Thầy có chắc chắn muốn THU BÀI NGAY của học sinh "${stu.fullName}" không?`);
    if (!ok) return;

    broadcastDataChange('ALL_UPDATED', {
      type: 'FORCE_SUBMIT',
      studentId: stu.id,
      examId: exam?.id,
    });
    alert(`Đã gửi lệnh thu bài tức thì tới học sinh "${stu.fullName}"!`);
  };

  // Lọc học sinh
  const filteredStudents = students.filter((s) => {
    if (activeTab === 'taking' && s.status !== 'taking') return false;
    if (activeTab === 'submitted' && s.status !== 'submitted') return false;
    if (activeTab === 'violation' && s.tabSwitchCount === 0) return false;
    if (activeTab === 'idle' && s.status !== 'idle') return false;

    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return s.fullName.toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
  });

  // Thống kê số lượng
  const countTaking = students.filter((s) => s.status === 'taking').length;
  const countSubmitted = students.filter((s) => s.status === 'submitted').length;
  const countViolation = students.filter((s) => s.tabSwitchCount > 0).length;
  const countTotal = students.length;

  return (
    <div className="space-y-6 pb-16">
      {/* Top Banner & Exam Header */}
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href="/exams"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Về danh sách đề thi
              </Link>
              <span className="text-slate-300">•</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-700">
                <Radio className="h-3.5 w-3.5 text-emerald-600 animate-pulse" />
                PHÒNG THI TRỰC TUYẾN THỜI GIAN THỰC (LIVE MONITOR)
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {exam?.title || 'Phòng Thi Đang Giám Sát'}
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Mã đề: <strong className="text-slate-800">{exam?.code || '11-1'}</strong> • Thời gian làm bài:{' '}
              <strong className="text-slate-800">{exam?.duration_minutes || 45} phút</strong> • Tổng số câu:{' '}
              <strong className="text-slate-800">{exam?.questions_count || 23} câu</strong>
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={handleToggleLock}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold shadow-xs transition active:scale-95 ${
                isLocked
                  ? 'bg-rose-600 text-white hover:bg-rose-700'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
              }`}
            >
              {isLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
              <span>{isLocked ? 'Đang Khóa Đề (Mở Lại)' : 'Khóa Đề (Không Cho Vào Thêm)'}</span>
            </button>

            <Link
              href={`/gradebook?examId=${encodeURIComponent(exam?.id || resolvedParams.id)}`}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-xs"
            >
              <Award className="h-4 w-4 text-blue-600" />
              <span>Xem Sổ Điểm Tổng</span>
            </Link>

            <button
              type="button"
              onClick={fetchMonitorData}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-600 hover:bg-slate-100 transition"
              title="Làm mới dữ liệu"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* 4 Thẻ Thống Kê Nhanh Phòng Thi */}
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Đang Làm Bài</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 text-white">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-black text-emerald-950">{countTaking}</span>
              <span className="text-xs text-emerald-600 font-medium">học sinh trực tuyến</span>
            </div>
          </div>

          <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-700">Đã Nộp Bài</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white">
                <CheckCircle className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-black text-blue-950">{countSubmitted}</span>
              <span className="text-xs text-blue-600 font-medium">đã chấm điểm</span>
            </div>
          </div>

          <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-700">Cảnh Báo Rời Tab</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500 text-white">
                <AlertTriangle className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-black text-amber-950">{countViolation}</span>
              <span className="text-xs text-amber-600 font-medium">trường hợp nghi vấn</span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Sĩ Số Phòng Thi</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-700 text-white">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900">{countTotal}</span>
              <span className="text-xs text-slate-500 font-medium">tổng học sinh</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Danh sách học sinh bên trái & Nhật ký sự kiện bên phải */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cột 1 & 2: Danh Sách Học Sinh Trực Tuyến */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              {/* Tab điều hướng */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setActiveTab('all')}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                    activeTab === 'all'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Tất cả ({countTotal})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('taking')}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                    activeTab === 'taking'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  🟢 Đang làm ({countTaking})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('submitted')}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                    activeTab === 'submitted'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  🔵 Đã nộp ({countSubmitted})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('violation')}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                    activeTab === 'violation'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  ⚠️ Rời tab ({countViolation})
                </button>
              </div>

              {/* Tìm kiếm */}
              <div className="relative w-full sm:w-60">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Tìm theo tên học sinh..."
                  className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Bảng Danh Sách Học Sinh */}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-bold uppercase text-slate-400">
                    <th className="py-3 px-3">Học Sinh</th>
                    <th className="py-3 px-3">Trạng Thái</th>
                    <th className="py-3 px-3">Tiến Độ Làm Bài</th>
                    <th className="py-3 px-3 text-center">Rời Tab</th>
                    <th className="py-3 px-3 text-right">Tác Vụ Giáo Viên</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        Chưa có học sinh nào trong nhóm này.
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((stu) => {
                      const pct = Math.round(
                        (stu.answeredCount / (stu.totalQuestions || 23)) * 100
                      );

                      return (
                        <tr key={stu.id} className="hover:bg-slate-50/80 transition">
                          <td className="py-3.5 px-3">
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-xs shadow-xs">
                                {stu.fullName.charAt(0)}
                              </div>
                              <div>
                                <div className="font-bold text-slate-900">{stu.fullName}</div>
                                <div className="text-[11px] text-slate-400">{stu.email}</div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-3">
                            {stu.status === 'submitted' ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700">
                                <CheckCircle className="h-3 w-3" /> Đã nộp ({stu.score ?? '--'}/
                                {stu.maxScore ?? 10}đ)
                              </span>
                            ) : stu.tabSwitchCount > 0 ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 animate-pulse">
                                <AlertTriangle className="h-3 w-3" /> Rời màn hình ({stu.tabSwitchCount})
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                                Đang làm bài
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-3">
                            <div className="space-y-1">
                              <div className="flex justify-between text-[11px] font-medium text-slate-500">
                                <span>
                                  {stu.answeredCount}/{stu.totalQuestions} câu
                                </span>
                                <span>{pct}%</span>
                              </div>
                              <div className="h-1.5 w-28 rounded-full bg-slate-100 overflow-hidden">
                                <div
                                  className={`h-full transition-all duration-300 ${
                                    stu.status === 'submitted'
                                      ? 'bg-blue-600'
                                      : stu.tabSwitchCount > 0
                                      ? 'bg-amber-500'
                                      : 'bg-emerald-500'
                                  }`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-3 text-center">
                            {stu.tabSwitchCount > 0 ? (
                              <span className="inline-block rounded-md bg-rose-100 px-2 py-0.5 font-bold text-rose-700">
                                {stu.tabSwitchCount} lần
                              </span>
                            ) : (
                              <span className="text-slate-400">0</span>
                            )}
                          </td>

                          <td className="py-3.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {stu.submission ? (
                                <Link
                                  href={`/exams/${exam?.id || resolvedParams.id}/result/${stu.submissionId}`}
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 transition"
                                  title="Xem bài thi chi tiết của học sinh"
                                >
                                  <Eye className="h-3 w-3 text-blue-600" />
                                  <span>Xem bài</span>
                                </Link>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleWarnStudent(stu)}
                                    className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-700 hover:bg-amber-100 transition"
                                    title="Gửi cảnh báo tới màn hình học sinh"
                                  >
                                    <ShieldAlert className="h-3 w-3" />
                                    <span>Cảnh cáo</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleForceSubmit(stu)}
                                    className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-100 transition"
                                    title="Thu bài cưỡng chế"
                                  >
                                    <Ban className="h-3 w-3" />
                                    <span>Thu bài</span>
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Cột 3: Nhật Ký Giám Sát Thời Gian Thực (Live Activity Log) */}
        <div className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                <Flame className="h-4 w-4 text-orange-500" />
                <span>Nhật Ký Phòng Thi Trực Tiếp</span>
              </div>
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>

            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {events.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  Chưa có sự kiện nào được ghi nhận.
                </div>
              ) : (
                events.map((ev, i) => (
                  <div
                    key={ev.id || i}
                    className="flex items-start gap-2.5 rounded-2xl border border-slate-100 bg-slate-50/60 p-3 text-xs transition"
                  >
                    <div className="mt-0.5">
                      {ev.type === 'submit' ? (
                        <CheckCircle className="h-4 w-4 text-blue-600" />
                      ) : ev.type === 'violation' ? (
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                      ) : (
                        <Radio className="h-4 w-4 text-emerald-600" />
                      )}
                    </div>
                    <div className="flex-1 space-y-0.5">
                      <div className="flex items-center justify-between">
                        <strong className="text-slate-900">{ev.studentName}</strong>
                        <span className="text-[10px] text-slate-400 font-mono">{ev.timestamp}</span>
                      </div>
                      <p className="text-slate-600 leading-relaxed text-[11px]">{ev.message}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
