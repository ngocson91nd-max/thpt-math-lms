'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { MOCK_CLASSES, MOCK_CLASS_MEMBERS, MOCK_EXAMS } from '@/lib/supabase/mockStore';
import { useAuth } from '@/context/AuthContext';
import { ClassMember, Exam } from '@/types/database';
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
  Plus,
  Trash2,
  Pencil,
  Phone,
  School,
  AlertCircle,
} from 'lucide-react';

export default function ClassDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { isTeacher } = useAuth();

  let initialClass = MOCK_CLASSES.find((c) => c.id === resolvedParams.id);
  if (!initialClass && typeof window !== 'undefined') {
    const saved = localStorage.getItem('lms_classes');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        initialClass = parsed.find((c: any) => c.id === resolvedParams.id);
      } catch {}
    }
  }
  if (!initialClass) initialClass = MOCK_CLASSES[0];

  const [currentClass] = useState(initialClass);
  const [activeTab, setActiveTab] = useState<'members' | 'exams'>('members');
  const [copied, setCopied] = useState(false);

  // Members state
  const [members, setMembers] = useState<ClassMember[]>(() => {
    return MOCK_CLASS_MEMBERS.filter((m) => m.class_id === currentClass.id);
  });

  // Exams state
  const [classExams, setClassExams] = useState<Exam[]>(() => {
    return MOCK_EXAMS.filter((e) => e.class_id === currentClass.id || !e.class_id);
  });

  // Modal States
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showEditMemberModal, setShowEditMemberModal] = useState(false);
  const [editingMember, setEditingMember] = useState<ClassMember | null>(null);

  // Add Member Form
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentEmail, setNewStudentEmail] = useState('');
  const [newStudentSchool, setNewStudentSchool] = useState('THPT Chuyên Lê Hồng Phong');
  const [newStudentPhone, setNewStudentPhone] = useState('');

  // Edit Member Form
  const [editStudentName, setEditStudentName] = useState('');
  const [editStudentEmail, setEditStudentEmail] = useState('');
  const [editStudentSchool, setEditStudentSchool] = useState('');
  const [editStudentPhone, setEditStudentPhone] = useState('');

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedMembers = localStorage.getItem(`lms_class_members_${currentClass.id}`);
      if (savedMembers) {
        try {
          const parsed = JSON.parse(savedMembers);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMembers(parsed);
          }
        } catch (e) {
          console.error(e);
        }
      }
    }
  }, [currentClass.id]);

  const saveMembersToStorage = (updated: ClassMember[]) => {
    setMembers(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`lms_class_members_${currentClass.id}`, JSON.stringify(updated));
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(currentClass.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Thêm học sinh vào lớp
  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentName.trim() || !newStudentEmail.trim()) return;

    const newId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `cm-${Date.now()}`;

    const newMember: ClassMember = {
      id: newId,
      class_id: currentClass.id,
      user_id: `stu-${Date.now()}`,
      role: 'student',
      status: 'active',
      joined_at: new Date().toISOString(),
      profile: {
        id: `stu-${Date.now()}`,
        email: newStudentEmail.trim().toLowerCase(),
        full_name: newStudentName.trim(),
        role: 'student',
        grade: currentClass.grade,
        school_name: newStudentSchool.trim() || 'THPT Chuyên Lê Hồng Phong',
        phone: newStudentPhone.trim(),
      },
    };

    const updated = [newMember, ...members];
    saveMembersToStorage(updated);
    setShowAddMemberModal(false);
    setNewStudentName('');
    setNewStudentEmail('');
    setNewStudentPhone('');
  };

  // Mở modal sửa học sinh
  const openEditMemberModal = (m: ClassMember) => {
    setEditingMember(m);
    setEditStudentName(m.profile?.full_name || '');
    setEditStudentEmail(m.profile?.email || '');
    setEditStudentSchool(m.profile?.school_name || '');
    setEditStudentPhone(m.profile?.phone || '');
    setShowEditMemberModal(true);
  };

  // Cập nhật thông tin học sinh
  const handleUpdateMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember || !editStudentName.trim()) return;

    const updated = members.map((m) => {
      if (m.id === editingMember.id) {
        return {
          ...m,
          profile: {
            ...m.profile,
            id: m.profile?.id || m.user_id,
            email: editStudentEmail.trim().toLowerCase() || m.profile?.email || '',
            full_name: editStudentName.trim(),
            role: 'student' as const,
            grade: currentClass.grade,
            school_name: editStudentSchool.trim() || 'THPT Chuyên Lê Hồng Phong',
            phone: editStudentPhone.trim(),
          },
        };
      }
      return m;
    });

    saveMembersToStorage(updated);
    setShowEditMemberModal(false);
    setEditingMember(null);
  };

  // Xóa học sinh khỏi lớp
  const handleDeleteMember = (memberId: string, studentName: string) => {
    const isConfirmed = confirm(
      `Thầy có chắc chắn muốn xóa học sinh "${studentName}" ra khỏi lớp này không?`
    );
    if (!isConfirmed) return;

    const updated = members.filter((m) => m.id !== memberId);
    saveMembersToStorage(updated);
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
              <span className="text-xs text-slate-400">Năm học {currentClass.academic_year || '2025-2026'}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              {currentClass.name}
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              {currentClass.description || 'Lớp bồi dưỡng và luyện thi THPT Thầy Sơn.'}
            </p>
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

        {/* Tab Switcher & Actions */}
        <div className="mt-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-px">
          <div className="flex items-center gap-2">
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

          {isTeacher && activeTab === 'members' && (
            <button
              onClick={() => setShowAddMemberModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-500 transition mb-2 sm:mb-0"
            >
              <Plus className="h-3.5 w-3.5" />
              Thêm Học Sinh Vào Lớp
            </button>
          )}
        </div>
      </div>

      {/* Tab: Members List */}
      {activeTab === 'members' && (
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xs">
          {members.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              Chưa có học sinh nào trong lớp. Thầy có thể bấm &quot;Thêm Học Sinh Vào Lớp&quot; hoặc gửi mã vào lớp cho học sinh.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase font-semibold">
                <tr>
                  <th className="py-3.5 px-6">Học Sinh</th>
                  <th className="py-3.5 px-6">Email & SĐT</th>
                  <th className="py-3.5 px-6">Trường</th>
                  <th className="py-3.5 px-6">Trạng thái</th>
                  {isTeacher && <th className="py-3.5 px-6 text-right">Thao Tác</th>}
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
                    <td className="py-4 px-6 text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5 text-slate-400" />
                        <span>{m.profile?.email}</span>
                      </div>
                      {m.profile?.phone && (
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                          <Phone className="h-3 w-3 text-slate-400" />
                          <span>{m.profile.phone}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-6 text-slate-600">
                      {m.profile?.school_name || 'THPT Chuyên Lê Hồng Phong'}
                    </td>
                    <td className="py-4 px-6">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 font-semibold text-emerald-700">
                        <UserCheck className="h-3 w-3" /> Đang học
                      </span>
                    </td>
                    {isTeacher && (
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditMemberModal(m)}
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 transition"
                            title="Chỉnh sửa thông tin học sinh"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span>Sửa</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteMember(m.id, m.profile?.full_name || 'Học sinh')}
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition"
                            title="Xóa học sinh khỏi lớp"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Xóa</span>
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
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

      {/* Modal Thêm Học Sinh Vào Lớp */}
      {showAddMemberModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <h2 className="text-xl font-bold text-slate-900">Thêm Học Sinh Vào Lớp</h2>
            <p className="mt-1 text-xs text-slate-500">
              Thêm học sinh trực tiếp vào {currentClass.name}.
            </p>

            <form onSubmit={handleAddMember} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Họ và tên học sinh <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                  placeholder="Ví dụ: Nguyễn Văn An"
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email đăng nhập học sinh <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={newStudentEmail}
                  onChange={(e) => setNewStudentEmail(e.target.value)}
                  placeholder="nguyenvanan@gmail.com"
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Trường THPT</label>
                  <input
                    type="text"
                    value={newStudentSchool}
                    onChange={(e) => setNewStudentSchool(e.target.value)}
                    placeholder="THPT Chuyên Lê Hồng Phong"
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Số điện thoại</label>
                  <input
                    type="text"
                    value={newStudentPhone}
                    onChange={(e) => setNewStudentPhone(e.target.value)}
                    placeholder="0912345678"
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddMemberModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition shadow-sm"
                >
                  Thêm Học Sinh
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Chỉnh Sửa Học Sinh */}
      {showEditMemberModal && editingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <h2 className="text-xl font-bold text-slate-900">Chỉnh Sửa Thông Tin Học Sinh</h2>
            <p className="mt-1 text-xs text-slate-500">
              Cập nhật thông tin học sinh trong {currentClass.name}.
            </p>

            <form onSubmit={handleUpdateMember} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Họ và tên học sinh <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editStudentName}
                  onChange={(e) => setEditStudentName(e.target.value)}
                  placeholder="Ví dụ: Nguyễn Văn An"
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email đăng nhập <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={editStudentEmail}
                  onChange={(e) => setEditStudentEmail(e.target.value)}
                  placeholder="nguyenvanan@gmail.com"
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Trường THPT</label>
                  <input
                    type="text"
                    value={editStudentSchool}
                    onChange={(e) => setEditStudentSchool(e.target.value)}
                    placeholder="THPT Chuyên"
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Số điện thoại</label>
                  <input
                    type="text"
                    value={editStudentPhone}
                    onChange={(e) => setEditStudentPhone(e.target.value)}
                    placeholder="0912345678"
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditMemberModal(false);
                    setEditingMember(null);
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
