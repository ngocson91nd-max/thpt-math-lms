'use client';

import React from 'react';
import Link from 'next/link';
import { Sigma, ShieldCheck, Cpu, Code2 } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-slate-200 bg-white pt-12 pb-8 mt-16 text-slate-600">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white font-bold shadow-md shadow-blue-500/20">
                <Sigma className="h-5 w-5" />
              </div>
              <span className="text-lg font-bold text-slate-900 tracking-tight">
                Hệ Thống LMS Toán THPT
              </span>
            </div>
            <p className="text-sm text-slate-500 max-w-md leading-relaxed">
              Giải pháp quản lý học tập và thi trực tuyến chuyên biệt cho môn Toán cấp THPT (Lớp 10, 11, 12). Tối ưu hóa render công thức Toán KaTeX, chuẩn format đề thi Bộ GD&ĐT 2025 và chấm tự động phía máy chủ.
            </p>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-3">
              Tính Năng Trọng Tâm
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/exams" className="hover:text-blue-600 transition">
                  Thi trực tuyến & Chấm máy chủ
                </Link>
              </li>
              <li>
                <Link href="/questions" className="hover:text-blue-600 transition">
                  5 dạng câu hỏi chuẩn THPT 2025
                </Link>
              </li>
              <li>
                <Link href="/gradebook" className="hover:text-blue-600 transition">
                  Sổ điểm & Chấm bài tự luận
                </Link>
              </li>
              <li>
                <Link href="/ai-assistant" className="hover:text-blue-600 transition">
                  Trợ lý AI tạo câu hỏi & Giải bài
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-3">
              Tiêu Chuẩn Kỹ Thuật
            </h4>
            <div className="space-y-2 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span>Bảo mật Supabase Row Level Security</span>
              </div>
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-indigo-600" />
                <span>Next.js App Router + KaTeX Math Engine</span>
              </div>
              <div className="flex items-center gap-2">
                <Code2 className="h-4 w-4 text-blue-600" />
                <span>Sẵn sàng Deploy Vercel & GitHub CI/CD</span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-3">
          <div>
            © 2026 LMS Toán THPT. Mã nguồn mở phục vụ Giáo Dục Việt Nam.
          </div>
          <div className="flex items-center gap-4">
            <span>Phiên bản 1.0 Production Ready</span>
            <span>•</span>
            <span>Chuẩn cấu trúc Bộ GD&ĐT 2025</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
