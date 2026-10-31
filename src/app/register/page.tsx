'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import VnsLogo from '@/components/brand/VnsLogo';
import {
  Sigma,
  Mail,
  Lock,
  User,
  School,
  Phone,
  ArrowRight,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  GraduationCap,
  Sparkles,
  Key,
} from 'lucide-react';
import { joinClassWithCode } from '@/lib/auth/enrollment';

export default function RegisterPage() {
  const router = useRouter();
  const { signUpWithPassword, isLoading } = useAuth();

  const [step, setStep] = useState<1 | 2>(1);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [candidateNumber, setCandidateNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [grade, setGrade] = useState<10 | 11 | 12>(12);
  const [schoolName, setSchoolName] = useState('THPT Chuyên Lê Hồng Phong');
  const [phone, setPhone] = useState('');
  const [classCode, setClassCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Step 2 State
  const [step2Code, setStep2Code] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [joinMsg, setJoinMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [registeredProfile, setRegisteredProfile] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!fullName.trim()) {
      setErrorMessage('Vui lòng nhập họ và tên của học sinh.');
      return;
    }
    const cleanUser = username.trim().toLowerCase().replace(/[^a-zA-Z0-9_]/g, '');
    const cleanPhone = phone.trim().replace(/[^0-9]/g, '');

    if (!cleanUser && !cleanPhone && !email.trim()) {
      setErrorMessage('Vui lòng nhập Tên đăng nhập hoặc Số điện thoại để tạo tài khoản.');
      return;
    }

    if (password.length < 4) {
      setErrorMessage('Mật khẩu cần tối thiểu 4 ký tự để đảm bảo an toàn.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Mật khẩu xác nhận không khớp. Vui lòng kiểm tra lại!');
      return;
    }

    const res = await signUpWithPassword({
      username: cleanUser || cleanPhone,
      email: email.trim(),
      candidateNumber: candidateNumber.trim(),
      password,
      fullName: fullName.trim(),
      grade,
      schoolName: schoolName.trim() || 'THPT Chuyên Lê Hồng Phong',
      phone: phone.trim(),
      role: 'student',
    });

    if (!res.success) {
      setErrorMessage(res.error || 'Đăng ký không thành công. Hãy thử lại!');
    } else {
      // Đăng ký thành công!
      const currentSavedId = typeof window !== 'undefined' ? localStorage.getItem('lms_current_user_id') : null;
      const createdUser = {
        id: currentSavedId || `student-${Date.now()}`,
        full_name: fullName.trim(),
        username: cleanUser || cleanPhone,
        email: email.trim() || `${cleanUser || cleanPhone}@thpt.sontoan.vn`,
        grade,
        school_name: schoolName.trim() || 'THPT Chuyên Lê Hồng Phong',
        phone: phone.trim(),
        candidate_number: candidateNumber.trim(),
        role: 'student' as const,
      };
      setRegisteredProfile(createdUser);

      // Nếu học sinh đã điền mã lớp ngay ở form -> tự động join luôn!
      if (classCode.trim()) {
        const joinRes = joinClassWithCode(createdUser, classCode.trim());
        setSuccessMessage(joinRes.message || 'Đăng ký và tham gia lớp thành công! Đang chuyển hướng...');
        setTimeout(() => {
          router.push('/exams');
        }, 1200);
      } else {
        // Chưa có mã lớp -> Chuyển sang Bước 2 để nhập mã lớp
        setStep(2);
      }
    }
  };

  const handleJoinStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!step2Code.trim()) {
      setJoinMsg({ type: 'error', text: 'Vui lòng nhập mã lớp do Thầy Sơn cung cấp!' });
      return;
    }

    setIsJoining(true);
    setJoinMsg(null);

    const targetUser = registeredProfile || {
      id: typeof window !== 'undefined' ? (localStorage.getItem('lms_current_user_id') || 'student') : 'student',
      full_name: fullName,
      role: 'student',
      grade,
    };

    const res = joinClassWithCode(targetUser, step2Code.trim());
    setIsJoining(false);

    if (res.success) {
      setJoinMsg({ type: 'success', text: res.message });
      setTimeout(() => {
        router.push('/exams');
      }, 1200);
    } else {
      setJoinMsg({ type: 'error', text: res.message });
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-12rem)] items-center justify-center py-10 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-lg space-y-7">
        {/* Header */}
        <div className="text-center flex flex-col items-center">
          <Link href="/" className="inline-block hover:opacity-95 transition">
            <VnsLogo size="lg" showText={true} />
          </Link>
          <h2 className="mt-4 text-xl font-bold tracking-tight text-slate-800">
            Đăng Ký Tài Khoản Học Sinh
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Tham gia lớp học trực tuyến và làm bài kiểm tra Toán
          </p>
        </div>

        {/* Card Form: Bước 2 Nhập mã lớp nếu học sinh chưa điền ở bước 1 */}
        {step === 2 ? (
          <div className="rounded-3xl border border-blue-200 bg-white p-6 sm:p-8 shadow-xl shadow-blue-500/10 text-center space-y-5 animate-in fade-in zoom-in-95">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25">
              <CheckCircle2 className="h-8 w-8" />
            </div>

            <div>
              <span className="inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 border border-emerald-200 mb-2">
                Bước 2 / 2: Kích hoạt vào lớp học
              </span>
              <h3 className="text-xl font-extrabold text-slate-900">Đăng Ký Tài Khoản Thành Công!</h3>
              <p className="mt-1.5 text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                Chào mừng <strong className="text-slate-900">{fullName}</strong>! Em hãy nhập Mã lớp học của Thầy Sơn (hoặc mã lớp thầy cô gửi) để tham gia lớp và bắt đầu làm đề:
              </p>
            </div>

            {joinMsg && (
              <div
                className={`flex items-center gap-2 rounded-xl p-3 text-xs font-semibold ${
                  joinMsg.type === 'error'
                    ? 'border border-rose-200 bg-rose-50 text-rose-700'
                    : 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                }`}
              >
                {joinMsg.type === 'error' ? (
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                )}
                <span>{joinMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleJoinStep2} className="space-y-4 max-w-sm mx-auto pt-2">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 text-left">
                  Mã tham gia lớp học
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-blue-500">
                    <Key className="h-5 w-5" />
                  </div>
                  <input
                    type="text"
                    value={step2Code}
                    onChange={(e) => setStep2Code(e.target.value.toUpperCase())}
                    placeholder="VD: TOAN12-6084"
                    required
                    autoFocus
                    className="w-full text-center text-lg tracking-widest font-mono font-black uppercase rounded-2xl border-2 border-blue-500 bg-blue-50/40 py-3 pl-10 pr-4 text-blue-900 placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-blue-500/20 shadow-inner"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isJoining}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-xs font-bold text-white shadow-md shadow-blue-500/25 hover:bg-blue-500 active:scale-[0.99] transition cursor-pointer"
              >
                {isJoining ? (
                  <span>Đang kết nối vào lớp...</span>
                ) : (
                  <>
                    <span>Vào Lớp Học Ngay</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => router.push('/exams')}
                className="w-full text-xs font-semibold text-slate-400 hover:text-slate-600 py-1 transition cursor-pointer"
              >
                Tôi chưa có mã lớp (Vào trang chủ sau)
              </button>
            </form>
          </div>
        ) : (
          /* Card Form Bước 1 */
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xl shadow-slate-200/40">
          {errorMessage && (
            <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-700 animate-in fade-in">
              <AlertCircle className="h-5 w-5 shrink-0 text-rose-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm text-emerald-700 animate-in fade-in">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
              <span>{successMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Họ và tên */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Họ và tên học sinh <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <User className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ví dụ: Nguyễn Văn An"
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition"
                />
              </div>
            </div>

            {/* Tên đăng nhập & Số báo danh (không cần email) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Tên đăng nhập <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    Không cần email
                  </span>
                </div>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                    <User className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="VD: vanan12 hoặc SĐT"
                    required={!phone.trim() && !email.trim()}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 py-2.5 text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Số Báo Danh (SBD - Nếu có)
                </label>
                <input
                  type="text"
                  value={candidateNumber}
                  onChange={(e) => setCandidateNumber(e.target.value)}
                  placeholder="VD: 12001 (hoặc để trống)"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-mono font-bold text-blue-700 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition"
                />
              </div>
            </div>

            {/* Chọn Khối Lớp */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Khối lớp học hiện tại <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                {([10, 11, 12] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGrade(g)}
                    className={`flex items-center justify-center gap-1.5 rounded-xl py-2 px-3 text-xs font-bold transition border cursor-pointer ${
                      grade === g
                        ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-2xs'
                        : 'border-slate-200 bg-slate-50/50 text-slate-600 hover:bg-slate-100/70'
                    }`}
                  >
                    <GraduationCap className="h-3.5 w-3.5" />
                    <span>Lớp {g}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Trường THPT */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Trường THPT
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <School className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  placeholder="THPT Chuyên Lê Hồng Phong, THPT Kim Liên..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition"
                />
              </div>
            </div>

            {/* Số điện thoại */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Số điện thoại (Dùng đăng nhập hoặc nhận điểm)
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Phone className="h-4 w-4" />
                </div>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="VD: 0987654321"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 py-2.5 text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition"
                />
              </div>
            </div>

            {/* Email (Không bắt buộc) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Địa chỉ Email (Không bắt buộc)
                </label>
                <span className="text-[11px] text-slate-400">Có thể để trống</span>
              </div>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="an.toan12@gmail.com (hoặc để trống)"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition"
                />
              </div>
            </div>

            {/* Mã lớp học tham gia (Nếu có) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Mã lớp học của Thầy Sơn (Nếu có)
                </label>
                <span className="text-[11px] text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                  Vào lớp ngay sau khi tạo tài khoản
                </span>
              </div>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Key className="h-4 w-4 text-blue-600" />
                </div>
                <input
                  type="text"
                  value={classCode}
                  onChange={(e) => setClassCode(e.target.value.toUpperCase())}
                  placeholder="VD: TOAN12-6084 (hoặc để trống để điền sau)"
                  className="w-full rounded-xl border border-blue-200 bg-blue-50/20 pl-10 pr-4 py-2.5 text-sm font-mono uppercase font-bold text-blue-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition"
                />
              </div>
            </div>

            {/* Mật khẩu & Nhập lại mật khẩu */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Mật khẩu <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Tối thiểu 4 ký tự"
                    required
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-9 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Xác nhận lại mật khẩu <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Nhập lại chính xác"
                    required
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-blue-500/25 hover:from-blue-700 hover:to-indigo-700 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-blue-500/25 active:scale-[0.99] transition disabled:opacity-50"
              >
                {isLoading ? (
                  <span>Đang đăng ký tài khoản...</span>
                ) : (
                  <>
                    <span>Đăng Ký & Vào Luyện Đề Ngay</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
        )}

        {/* Footer Link to Login */}
        <div className="text-center">
          <p className="text-sm text-slate-600">
            Học sinh đã có tài khoản rồi?{' '}
            <Link
              href="/login"
              className="font-bold text-blue-600 hover:text-blue-700 underline underline-offset-4"
            >
              Đăng nhập tại đây
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
