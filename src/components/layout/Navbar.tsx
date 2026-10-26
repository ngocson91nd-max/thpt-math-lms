'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { MOCK_USERS } from '@/lib/supabase/mockStore';
import {
  BookOpen,
  FileQuestion,
  GraduationCap,
  Sparkles,
  ClipboardList,
  FolderDown,
  Award,
  ChevronDown,
  UserCheck,
  Menu,
  X,
  Sigma,
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const pathname = usePathname();
  const { user, role, switchDemoUser, isTeacher } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const navLinks = [
    { href: '/classes', label: 'Lớp học', icon: GraduationCap },
    { href: '/courses', label: 'Khóa học', icon: BookOpen },
    { href: '/exams', label: 'Đề thi & Kiểm tra', icon: ClipboardList },
    ...(isTeacher
      ? [
          { href: '/questions', label: 'Ngân hàng câu hỏi', icon: FileQuestion },
          { href: '/gradebook', label: 'Sổ điểm & Chấm thi', icon: Award },
        ]
      : [{ href: '/gradebook', label: 'Điểm số của tôi', icon: Award }]),
    { href: '/materials', label: 'Học liệu & PDF', icon: FolderDown },
    { href: '/ai-assistant', label: 'AI Trợ lý Toán', icon: Sparkles, badge: 'Mới' },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 h-16">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition">
            <Sigma className="h-6 w-6 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 font-bold text-lg text-slate-900 tracking-tight">
              LMS TOÁN THPT
              <span className="rounded-md bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                2025
              </span>
            </div>
            <div className="text-[11px] text-slate-500 -mt-0.5">Nền tảng Dạy & Học Toán Chuẩn Bộ GD&ĐT</div>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'bg-blue-50 text-blue-600 font-semibold'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                <span>{link.label}</span>
                {link.badge && (
                  <span className="rounded-full bg-indigo-100 px-1.5 py-0.2 text-[10px] font-bold text-indigo-700 animate-pulse">
                    {link.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Role Switcher & User Profile */}
        <div className="flex items-center gap-3">
          {/* Chuyển đổi vai trò Demo */}
          <div className="relative">
            <button
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 transition shadow-2xs"
            >
              <div
                className={`h-2 w-2 rounded-full ${
                  role === 'admin'
                    ? 'bg-purple-500'
                    : role === 'teacher'
                    ? 'bg-blue-500'
                    : 'bg-emerald-500'
                }`}
              />
              <span className="font-semibold text-slate-900">{user?.full_name || 'Khách'}</span>
              <span className="text-[11px] text-slate-500 font-normal">
                ({role === 'admin' ? 'Admin' : role === 'teacher' ? 'Giáo viên' : 'Học sinh'})
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </button>

            {userDropdownOpen && (
              <div
                className="absolute right-0 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl z-50 animate-in fade-in slide-in-from-top-2"
                onClick={() => setUserDropdownOpen(false)}
              >
                <div className="px-3 py-2 border-b border-slate-100">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Đổi vai trò trải nghiệm nhanh:
                  </div>
                </div>
                <div className="py-1">
                  {MOCK_USERS.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => switchDemoUser(u.id)}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition ${
                        user?.id === u.id
                          ? 'bg-blue-50 text-blue-700 font-semibold'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold text-white ${
                            u.role === 'admin'
                              ? 'bg-purple-600'
                              : u.role === 'teacher'
                              ? 'bg-blue-600'
                              : 'bg-emerald-600'
                          }`}
                        >
                          {u.full_name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-medium text-slate-900">{u.full_name}</div>
                          <div className="text-[10px] text-slate-400 capitalize">{u.role}</div>
                        </div>
                      </div>
                      {user?.id === u.id && <UserCheck className="h-4 w-4 text-blue-600" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-1">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${
                  isActive
                    ? 'bg-blue-50 text-blue-600 font-semibold'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span>{link.label}</span>
                {link.badge && (
                  <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700 ml-auto">
                    {link.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </header>
  );
};

export default Navbar;
