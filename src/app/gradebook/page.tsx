'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { MOCK_SUBMISSIONS } from '@/lib/supabase/mockStore';
import { Submission } from '@/types/database';
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
} from 'lucide-react';

export default function GradebookPage() {
  const { isTeacher } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>(MOCK_SUBMISSIONS);
  const [search, setSearch] = useState('');

  const filtered = submissions.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      s.student?.full_name.toLowerCase().includes(q) ||
      s.student?.email.toLowerCase().includes(q) ||
      s.exam?.title.toLowerCase().includes(q)
    );
  });

  // Thống kê sổ điểm
  const scores = submissions.map((s) => s.score ?? 0);
  const avgScore =
    scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2) : '0';
  const maxScore = scores.length > 0 ? Math.max(...scores).toFixed(2) : '0';
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
      `"${s.submitted_at ? new Date(s.submitted_at).toLocaleString('vi-VN') : '25/10/2026'}"`,
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
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Sổ Điểm & Báo Cáo Kết Quả Lớp
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Tổng hợp kết quả làm bài thi, phân tích phổ điểm và công cụ chấm điểm tự luận.
          </p>
        </div>

        <button
          onClick={exportCsv}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
        >
          <Download className="h-4 w-4 text-emerald-600" />
          Xuất Sổ Điểm (Excel / CSV)
        </button>
      </div>

      {/* Analytics Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase">
            <span>Điểm trung bình lớp</span>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </div>
          <div className="mt-2 text-3xl font-black text-slate-900">{avgScore}</div>
          <p className="mt-1 text-[11px] text-slate-400">Trên thang điểm 10.0</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase">
            <span>Điểm cao nhất</span>
            <Award className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 text-3xl font-black text-slate-900">{maxScore}</div>
          <p className="mt-1 text-[11px] text-slate-400">Thủ khoa bài thi</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase">
            <span>Tỷ lệ trên trung bình</span>
            <CheckCircle className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-3xl font-black text-emerald-600">{passRate}%</div>
          <p className="mt-1 text-[11px] text-slate-400">Học sinh đạt từ 5.0 trở lên</p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-3 bg-white p-4 rounded-2xl border border-slate-200">
        <Search className="h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm kiếm theo tên học sinh, email hoặc tên đề thi..."
          className="w-full text-xs text-slate-900 focus:outline-none"
        />
      </div>

      {/* Submissions Table */}
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase font-semibold">
            <tr>
              <th className="py-3.5 px-6">Học Sinh</th>
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
                    {s.student?.full_name || 'Học sinh'}
                  </div>
                  <div className="text-[11px] text-slate-400">{s.student?.email}</div>
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
                  {s.submitted_at ? new Date(s.submitted_at).toLocaleDateString('vi-VN') : '25/10/2026'}
                </td>
                <td className="py-4 px-6 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      href={`/exams/${s.exam_id}/result/${s.id}`}
                      className="rounded-lg border border-slate-200 px-2.5 py-1 text-slate-700 hover:bg-slate-50 transition"
                    >
                      Chi tiết
                    </Link>

                    {isTeacher && s.status === 'grading' && (
                      <Link
                        href={`/gradebook/grade/${s.id}`}
                        className="flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1 font-semibold text-white shadow-2xs hover:bg-indigo-500 transition"
                      >
                        <Pencil className="h-3 w-3" />
                        Chấm tự luận
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
