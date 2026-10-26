'use client';

import React, { useState, use } from 'react';
import Link from 'next/link';
import { MOCK_CLASSES, MOCK_CLASS_MEMBERS, MOCK_EXAMS } from '@/lib/supabase/mockStore';
import { useAuth } from '@/context/AuthContext';
import {
  GraduationCap,
  Users,
  Copy,
  Check,
  ClipboardList,
  Calendar,
  UserCheck,
  Play,
  ArrowLeft,
  Mail,
  Clock,
} from 'lucide-react';

export default function ClassDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { isTeacher } = useAuth();
  const currentClass = MOCK_CLASSES.find((c) => c.id === resolvedParams.id) || MOCK_CLASSES[0];
  const [activeTab, setActiveTab] = useState<'members' | 'exams'>('members');
  const [copied, setCopied] = useState(false);

  const members = MOCK_CLASS_MEMBERS.filter((m) => m.class_id === currentClass.id);
  const classExams = MOCK_EXAMS.filter((e) => e.class_id === currentClass.id || !e.class_id);

  const copyCode = () => {
    navigator.clipboard.writeText(currentClass.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Back button */}
      <Link
        href="/classes"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition"
      >
        <ArrowLeft className="h-4 w-4" />
        Quay lại danh sách lớp
      </Link>

      {/* Class Banner */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="rounded-md bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-700">
                Toán Lớp {currentClass.grade}
              </span>
              <span className="text-xs text-slate-400">Năm học {currentClass.academic_year}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              {currentClass.name}
            </h1>
            <p className="mt-1 text-xs text-slate-500">{currentClass.description}</p>
          </div>

          {/* Class Code */}
          <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4 border border-slate-100">
            <div>
              <div className="text-[10px] font-semibold text-slate-400 uppercase">Mã tham gia:</div>
              <div className="font-mono text-base font-black text-slate-900">{currentClass.code}</div>
            </div>
            <button
              onClick={copyCode}
              className="rounded-xl bg-white p-2 text-slate-600 border border-slate-200 hover:bg-slate-50 shadow-2xs"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="mt-8 flex items-center gap-2 border-b border-slate-100 pb-px">
          <button
            onClick={() => setActiveTab('members')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition ${
              activeTab === 'members'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Users className="h-4 w-4" />
            Danh Sách Học Sinh ({members.length})
          </button>

          <button
            onClick={() => setActiveTab('exams')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition ${
              activeTab === 'exams'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <ClipboardList className="h-4 w-4" />
            Bài Kiểm Tra Lớp ({classExams.length})
          </button>
        </div>
      </div>

      {/* Tab: Members List */}
      {activeTab === 'members' && (
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase font-semibold">
              <tr>
                <th className="py-3.5 px-6">Học Sinh</th>
                <th className="py-3.5 px-6">Email</th>
                <th className="py-3.5 px-6">Trường</th>
                <th className="py-3.5 px-6">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {members.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50/50 transition">
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700">
                        {m.profile?.full_name?.charAt(0) || 'H'}
                      </div>
                      <span className="font-semibold text-slate-900">
                        {m.profile?.full_name || 'Học sinh'}
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-slate-600 flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-slate-400" />
                    {m.profile?.email}
                  </td>
                  <td className="py-4 px-6 text-slate-600">
                    {m.profile?.school_name || 'THPT Chuyên Lê Hồng Phong'}
                  </td>
                  <td className="py-4 px-6">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 font-semibold text-emerald-700">
                      <UserCheck className="h-3 w-3" /> Đang học
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab: Exams */}
      {activeTab === 'exams' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {classExams.map((e) => (
            <div
              key={e.id}
              className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs"
            >
              <div>
                <h3 className="font-bold text-sm text-slate-900">{e.title}</h3>
                <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                    {e.duration_minutes} phút
                  </span>
                  <span>•</span>
                  <span>{e.questions?.length || 7} câu hỏi</span>
                </div>
              </div>

              <Link
                href={`/exams/${e.id}/take`}
                className="flex items-center gap-1 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-500 transition"
              >
                <Play className="h-3.5 w-3.5" />
                Làm bài
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
