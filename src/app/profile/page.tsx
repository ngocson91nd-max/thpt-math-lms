'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import {
  User,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  School,
  Phone,
  Mail,
  BadgePercent,
  Calendar,
  Lock,
  ArrowLeft,
  Save,
} from 'lucide-react';
import Link from 'next/link';

export default function ProfilePage() {
  const { user, isTeacher, isAdmin, updateProfile, changePassword, signOut } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'info' | 'password'>('info');

  // Form State: Thông tin cá nhân
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [candidateNumber, setCandidateNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [grade, setGrade] = useState<10 | 11 | 12>(12);
  const [email, setEmail] = useState('');
  const [birthDate, setBirthDate] = useState('');

  // Form State: Đổi mật khẩu
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Status message
  const [infoMsg, setInfoMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [passMsg, setPassMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setUsername(user.username || user.email?.split('@')[0] || '');
      setCandidateNumber(user.candidate_number || '');
      setPhone(user.phone || '');
      setSchoolName(user.school_name || 'THPT Chuyên Lê Hồng Phong');
      setGrade(user.grade || 12);
      setEmail(user.email?.endsWith('@thpt.sontoan.vn') ? '' : (user.email || ''));
      setBirthDate(user.birth_date || '');
    }
  }, [user]);

  if (!user) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="h-14 w-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
          <User className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Vui lòng đăng nhập</h2>
        <p className="text-sm text-slate-500 max-w-sm">
          Thầy/Học sinh vui lòng đăng nhập vào hệ thống để xem và cập nhật hồ sơ cá nhân.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-600/20 hover:bg-blue-500 transition"
        >
          Đăng nhập ngay
        </Link>
      </div>
    );
  }

  // Cập nhật thông tin cá nhân
  const handleUpdateInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    setInfoMsg(null);
    setIsSubmitting(true);

    try {
      const cleanUser = username.trim().toLowerCase().replace(/[^a-zA-Z0-9_]/g, '');
      const cleanEmail = email.trim() ? email.trim().toLowerCase() : (user.email || `${cleanUser}@thpt.sontoan.vn`);

      const res = await updateProfile({
        full_name: fullName.trim(),
        username: cleanUser,
        candidate_number: candidateNumber.trim(),
        phone: phone.trim(),
        school_name: schoolName.trim(),
        grade: Number(grade) as 10 | 11 | 12,
        email: cleanEmail,
        birth_date: birthDate,
      });

      if (res.success) {
        setInfoMsg({ type: 'success', text: 'Đã lưu thông tin tài khoản thành công!' });
      } else {
        setInfoMsg({ type: 'error', text: res.error || 'Có lỗi khi lưu thông tin.' });
      }
    } catch {
      setInfoMsg({ type: 'error', text: 'Có lỗi xảy ra, vui lòng thử lại sau.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Đổi mật khẩu
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassMsg(null);

    if (newPassword.trim().length < 4) {
      setPassMsg({ type: 'error', text: 'Mật khẩu mới phải có ít nhất 4 ký tự!' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPassMsg({ type: 'error', text: 'Mật khẩu xác nhận không khớp với mật khẩu mới!' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await changePassword(oldPassword, newPassword);
      if (res.success) {
        setPassMsg({ type: 'success', text: 'Đổi mật khẩu thành công! Vui lòng ghi nhớ mật khẩu mới.' });
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPassMsg({ type: 'error', text: res.error || 'Đổi mật khẩu thất bại.' });
      }
    } catch {
      setPassMsg({ type: 'error', text: 'Có lỗi xảy ra khi đổi mật khẩu.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header & Back button */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition mb-1"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Trang chủ</span>
          </Link>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Hồ Sơ & Tài Khoản</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Quản lý thông tin cá nhân, số báo danh và cập nhật mật khẩu bảo mật
          </p>
        </div>

        {/* Badge vai trò */}
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold border ${
              isAdmin
                ? 'bg-purple-50 text-purple-700 border-purple-200'
                : isTeacher
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
            <span>{isAdmin ? 'Quản Trị Viên' : isTeacher ? 'Giáo Viên' : 'Học Sinh'}</span>
          </span>
        </div>
      </div>

      {/* Tabs chuyển đổi */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('info')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition cursor-pointer ${
            activeTab === 'info'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <User className="h-4 w-4" />
          <span>Thông Tin Cá Nhân</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('password')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition cursor-pointer ${
            activeTab === 'password'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <KeyRound className="h-4 w-4" />
          <span>Đổi Mật Khẩu</span>
        </button>
      </div>

      {/* TAB 1: THÔNG TIN CÁ NHÂN */}
      {activeTab === 'info' && (
        <form onSubmit={handleUpdateInfo} className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 shadow-xs space-y-6">
          {infoMsg && (
            <div
              className={`p-4 rounded-2xl flex items-center gap-3 text-xs font-semibold ${
                infoMsg.type === 'success'
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border border-rose-200 text-rose-800'
              }`}
            >
              {infoMsg.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
              )}
              <span>{infoMsg.text}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Họ và tên */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Họ và tên <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="VD: Nguyễn Văn An"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Tên đăng nhập */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Tên đăng nhập (Username)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="VD: vanan12 hoặc an_toan"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-mono text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
                />
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">Dùng để đăng nhập nhanh không cần Email</span>
            </div>

            {/* Số báo danh (SBD) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Số Báo Danh (SBD)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={candidateNumber}
                  onChange={(e) => setCandidateNumber(e.target.value)}
                  placeholder="VD: 12001 hoặc SBD-12"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-mono font-bold text-blue-700 focus:bg-white focus:border-blue-500 focus:outline-none"
                />
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">Hiển thị trên phiếu thi và bảng điểm lớp học</span>
            </div>

            {/* Số điện thoại */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Số điện thoại liên hệ
              </label>
              <div className="relative">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="VD: 0987654321"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-mono text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
                />
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">Có thể dùng Số điện thoại để đăng nhập</span>
            </div>

            {/* Trường THPT */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Trường THPT
              </label>
              <input
                type="text"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                placeholder="VD: THPT Chuyên Lê Hồng Phong"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
              />
            </div>

            {/* Khối lớp */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Khối lớp
              </label>
              <select
                value={grade}
                onChange={(e) => setGrade(Number(e.target.value) as 10 | 11 | 12)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
              >
                <option value={10}>Lớp 10 (Chương trình mới 2025)</option>
                <option value={11}>Lớp 11 (Chương trình mới 2025)</option>
                <option value={12}>Lớp 12 (Luyện thi Tốt nghiệp THPT 2025)</option>
              </select>
            </div>

            {/* Email liên kết */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Email liên kết (Không bắt buộc)
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="VD: hocsinh@gmail.com (hoặc để trống)"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
              />
            </div>

            {/* Ngày sinh */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Ngày sinh
              </label>
              <input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-600/20 hover:bg-blue-500 transition cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              <span>{isSubmitting ? 'Đang lưu...' : 'Lưu Thay Đổi'}</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: ĐỔI MẬT KHẨU */}
      {activeTab === 'password' && (
        <form onSubmit={handleChangePassword} className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 shadow-xs space-y-6 max-w-xl">
          {passMsg && (
            <div
              className={`p-4 rounded-2xl flex items-center gap-3 text-xs font-semibold ${
                passMsg.type === 'success'
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border border-rose-200 text-rose-800'
              }`}
            >
              {passMsg.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
              )}
              <span>{passMsg.text}</span>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Mật khẩu hiện tại <span className="text-rose-500">*</span>
              </label>
              <input
                type="password"
                required
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="Nhập mật khẩu đang dùng"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Mật khẩu mới <span className="text-rose-500">*</span>
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Tối thiểu 4 ký tự"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Xác nhận mật khẩu mới <span className="text-rose-500">*</span>
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Nhập lại mật khẩu mới"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-600/20 hover:bg-blue-500 transition cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <Lock className="h-4 w-4" />
              <span>{isSubmitting ? 'Đang cập nhật...' : 'Cập Nhật Mật Khẩu'}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
