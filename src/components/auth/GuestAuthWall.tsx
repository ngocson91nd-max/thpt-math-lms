'use client';

import React from 'react';
import Link from 'next/link';
import { Lock, LogIn, UserPlus, ShieldCheck, ArrowRight, BookOpen, Sigma } from 'lucide-react';

export const GuestAuthWall: React.FC = () => {
  return (
    <div className="min-h-[75vh] flex items-center justify-center p-4">
      <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-8 sm:p-10 shadow-xl text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Icon & Brand Badge */}
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25">
          <Lock className="h-10 w-10 stroke-[2.2]" />
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
            <ShieldCheck className="h-4 w-4" />
            <span>Khu Vực Học Tập Nội Bộ • VNS Math</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Nội Dung Yêu Cầu Đăng Nhập
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed max-w-md mx-auto">
            Hệ thống bài giảng, đề thi trắc nghiệm chuẩn Bộ GD&ĐT 2025 và học liệu chuyên sâu chỉ dành cho học sinh đã có tài khoản.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <Link
            href="/login"
            className="flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3.5 text-sm font-bold text-white shadow-md shadow-blue-600/25 hover:bg-blue-500 transition active:scale-95"
          >
            <LogIn className="h-4 w-4" />
            <span>Đăng Nhập Ngay</span>
          </Link>

          <Link
            href="/register"
            className="flex items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 bg-white px-5 py-3.5 text-sm font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition active:scale-95"
          >
            <UserPlus className="h-4 w-4 text-blue-600" />
            <span>Đăng Ký Tài Khoản</span>
          </Link>
        </div>

        {/* Back to Home preview */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-blue-600 transition"
          >
            <Sigma className="h-3.5 w-3.5" />
            <span>Quay lại Trang chủ giới thiệu VNS Math</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default GuestAuthWall;
