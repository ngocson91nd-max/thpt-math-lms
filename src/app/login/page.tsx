'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  Sigma,
  Mail,
  Lock,
  ArrowRight,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  GraduationCap,
  Award,
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { signInWithPassword, isLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!email || !password) {
      setErrorMessage('Vui lòng nhập đầy đủ Email và Mật khẩu.');
      return;
    }

    const res = await signInWithPassword(email, password);
    if (!res.success) {
      setErrorMessage(res.error || 'Đăng nhập không thành công.');
    } else {
      setSuccessMessage('Đăng nhập thành công! Đang chuyển hướng...');
      setTimeout(() => {
        router.push('/exams');
      }, 700);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-12rem)] items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        {/* Header & Logo */}
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25">
            <Sigma className="h-8 w-8 stroke-[2.5]" />
          </div>
          <h2 className="mt-5 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            Đăng Nhập LMS Toán THPT
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Học tập, luyện thi trắc nghiệm & tự luận chuẩn cấu trúc Bộ GD&ĐT 2025
          </p>
        </div>

        {/* Card Form */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-7 sm:p-8 shadow-xl shadow-slate-200/40">
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

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Địa chỉ Email
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="hocsinh@thpt.edu.vn"
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Mật khẩu
                </label>
                <button
                  type="button"
                  className="text-xs font-medium text-blue-600 hover:text-blue-700"
                  onClick={() => alert('Vui lòng liên hệ Thầy Sơn để được hỗ trợ cấp lại mật khẩu.')}
                >
                  Quên mật khẩu?
                </button>
              </div>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-10 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-blue-500/25 active:scale-[0.99] transition disabled:opacity-50"
            >
              {isLoading ? (
                <span>Đang xử lý...</span>
              ) : (
                <>
                  <span>Đăng Nhập</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer Link to Register */}
        <div className="text-center">
          <p className="text-sm text-slate-600">
            Học sinh chưa có tài khoản?{' '}
            <Link
              href="/register"
              className="font-bold text-blue-600 hover:text-blue-700 underline underline-offset-4"
            >
              Đăng ký tài khoản mới ngay
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
