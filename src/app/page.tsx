'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import MathRenderer from '@/components/math/MathRenderer';
import TeacherDashboard from '@/components/dashboard/TeacherDashboard';
import StudentDashboard from '@/components/dashboard/StudentDashboard';
import {
  GraduationCap,
  Sparkles,
  ClipboardList,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  BrainCircuit,
  Calculator,
  Award,
  Layers,
} from 'lucide-react';

export default function HomePage() {
  const { user, isTeacher } = useAuth();

  // 1. Nếu là Giáo viên / Quản trị viên: Hiển thị ngay Dashboard Giáo viên chuyên nghiệp
  if (user && isTeacher) {
    return <TeacherDashboard />;
  }

  // 2. Nếu là Học sinh đã đăng nhập: Hiển thị ngay Bàn học Học sinh (Student Dashboard)
  if (user && !isTeacher) {
    return <StudentDashboard />;
  }

  const previewMathFormula =
    '\\int_0^1 \\frac{2x + 1}{x^2 + x + 1} \\, \\mathrm{d}x = \\ln 3, \\quad \\lim_{x \\to +\\infty} \\left( \\sqrt{x^2 + 2x} - x \\right) = 1';

  return (
    <div className="space-y-12 pb-8">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-900 via-indigo-900 to-slate-900 px-6 py-14 text-white shadow-xl sm:px-12 sm:py-20">
        <div className="absolute inset-0 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:24px_24px] opacity-20 pointer-events-none" />

        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-500/10 px-3.5 py-1.5 text-xs font-semibold text-blue-200 backdrop-blur-md mb-6">
            <Sparkles className="h-4 w-4 text-amber-300" />
            Cấu Trúc Đề Thi Tốt Nghiệp THPT 2025 Mới Nhất
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl leading-tight">
            VNS Math - Nền Tảng Học Tập & Kiểm Tra <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 via-teal-200 to-indigo-200">Toán THPT</span>
          </h1>

          <p className="mt-5 text-base sm:text-lg text-slate-300 leading-relaxed">
            Hệ thống bồi dưỡng kiến thức Toán 10, 11, 12 và luyện đề Tốt nghiệp THPT 2025. Hỗ trợ hiển thị công thức LaTeX siêu tốc, 5 dạng câu hỏi chuẩn Bộ GD&ĐT và chấm tự động tức thì.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href="/exams"
              prefetch={true}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 transition active:scale-95"
            >
              <ClipboardList className="h-4 w-4" />
              Luyện Thi Ngay
              <ArrowRight className="h-4 w-4" />
            </Link>

            <Link
              href="/courses"
              prefetch={true}
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-6 py-3.5 text-sm font-semibold text-white backdrop-blur-md hover:bg-white/20 transition active:scale-95"
            >
              <BookOpen className="h-4 w-4" />
              Khóa Học Toán 10, 11, 12
            </Link>

            {isTeacher && (
              <Link
                href="/questions"
                prefetch={true}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-500/20 border border-amber-400/30 px-5 py-3.5 text-sm font-semibold text-amber-200 hover:bg-amber-500/30 transition"
              >
                <Calculator className="h-4 w-4" />
                Ngân Hàng Câu Hỏi
              </Link>
            )}
          </div>

          <div className="mt-8 pt-6 border-t border-white/10 flex flex-wrap items-center gap-6 text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span>Chấm điểm máy chủ chuẩn Bộ GD&ĐT</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-blue-400" />
              <span>Supabase RLS & PostgreSQL</span>
            </div>
            <div className="flex items-center gap-2">
              <BrainCircuit className="h-4 w-4 text-purple-400" />
              <span>Tích hợp AI Sư Phạm Toán</span>
            </div>
          </div>
        </div>

        {/* Math KaTeX Banner Floating Preview */}
        <div className="mt-8 sm:mt-12 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md max-w-2xl">
          <div className="text-[11px] font-semibold text-blue-300 uppercase tracking-wider mb-1">
            Xem trước công thức Toán hiển thị bằng KaTeX:
          </div>
          <div className="text-white">
            <MathRenderer content={`$$${previewMathFormula}$$`} className="text-white" />
          </div>
        </div>
      </section>

      {/* Quick Overview Cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs hover:shadow-md transition">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 mb-4">
            <GraduationCap className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Quản Lý Lớp Học & Mã Tham Gia</h3>
          <p className="mt-2 text-sm text-slate-500 leading-relaxed">
            Tạo lớp, cấp mã lớp (ví dụ: <code>TOAN12A1-2026</code>), duyệt học sinh và theo dõi tiến độ từng học sinh theo năm học.
          </p>
          <Link
            href="/classes"
            prefetch={true}
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700"
          >
            Vào danh sách lớp <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs hover:shadow-md transition">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 mb-4">
            <Layers className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">5 Dạng Câu Hỏi Chuẩn THPT 2025</h3>
          <p className="mt-2 text-sm text-slate-500 leading-relaxed">
            Trắc nghiệm 4 lựa chọn, Trắc nghiệm nhiều lựa chọn, Đúng/Sai 4 ý chuẩn tỷ lệ điểm Bộ GD&ĐT, Điền số và Tự luận.
          </p>
          <Link
            href="/questions"
            prefetch={true}
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
          >
            Khám phá ngân hàng đề <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs hover:shadow-md transition">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 mb-4">
            <Award className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Sổ Điểm Lớp & Báo Cáo Phân Tích</h3>
          <p className="mt-2 text-sm text-slate-500 leading-relaxed">
            Xem phổ điểm bài thi, chấm bài tự luận với gợi ý thông minh từ AI và xuất danh sách kết quả ra file Excel/CSV.
          </p>
          <Link
            href="/gradebook"
            prefetch={true}
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-700"
          >
            Mở sổ điểm <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>

      {/* Featured Exam Section */}
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-md bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-600 mb-2">
              Đề thi đề xuất hôm nay
            </div>
            <h2 className="text-2xl font-bold text-slate-900">
              Đề Khảo Sát Toán 12: Đạo Hàm, Tích Phân & Oxyz (Format 2025)
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Mã đề 101 • 7 câu hỏi đại diện cả 5 dạng • Thời gian: 45 phút • Thang điểm 10
            </p>
          </div>

          <Link
            href="/exams/e1111111-1111-1111-1111-111111111111/take"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-semibold text-white shadow-md shadow-blue-500/20 hover:bg-blue-500 transition"
          >
            Bắt Đầu Làm Bài Thi
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Question Type Breakdown */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
            <div className="text-xs text-slate-400 font-medium">Phần I: Trắc nghiệm 4 chọn</div>
            <div className="text-lg font-bold text-slate-800 mt-1">2 Câu (0.5đ)</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Khảo sát & Tích phân</div>
          </div>
          <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
            <div className="text-xs text-slate-400 font-medium">Phần II: Đúng/Sai 4 ý</div>
            <div className="text-lg font-bold text-slate-800 mt-1">1 Câu (1.0đ)</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Quy đổi 0.1 - 0.25 - 0.5 - 1đ</div>
          </div>
          <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
            <div className="text-xs text-slate-400 font-medium">Phần III: Điền đáp số</div>
            <div className="text-lg font-bold text-slate-800 mt-1">2 Câu (1.0đ)</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Min/Max & Oxyz</div>
          </div>
          <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
            <div className="text-xs text-slate-400 font-medium">Phần IV: Tự luận thực tế</div>
            <div className="text-lg font-bold text-slate-800 mt-1">1 Câu (1.0đ)</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Tối ưu hóa Inox</div>
          </div>
        </div>
      </section>
    </div>
  );
}
