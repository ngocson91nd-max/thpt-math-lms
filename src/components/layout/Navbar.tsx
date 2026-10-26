'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  BookOpen,
  FileQuestion,
  GraduationCap,
  Sparkles,
  ClipboardList,
  FolderDown,
  Award,
  ChevronDown,
  Menu,
  X,
  Sigma,
  LogIn,
  UserPlus,
  LogOut,
  User,
  School,
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, role, isAdmin, isTeacher, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const navLinks = [
    { href: '/classes', label: 'Lớp học', icon: GraduationCap },
    { href: '/courses', label: 'Khóa học', icon: BookOpen },
    { href: '/exams', label: 'Đề thi & Luyện tập', icon: ClipboardList },
    ...(isTeacher
      ? [
          { href: '/questions', label: 'Ngân hàng câu hỏi', icon: FileQuestion },
          { href: '/gradebook', label: 'Sổ điểm & Chấm thi', icon: Award },
        ]
      : [{ href: '/gradebook', label: 'Điểm số của tôi', icon: Award }]),
    { href: '/materials', label: 'Học liệu & PDF', icon: FolderDown },
    { href: '/ai-assistant', label: 'AI Trợ lý Toán', icon: Sparkles, badge: 'Mới' },
  ];

  const handleSignOut = async () => {
    setUserDropdownOpen(false);
    await signOut();
    router.push('/login');
  };

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
              TOÁN THẦY SƠN
              <span className="rounded-md bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                THPT
              </span>
            </div>
            <div className="text-[11px] text-slate-500 -mt-0.5">Lớp Học Trực Tuyến & Luyện Thi 2025</div>
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

        {/* User Auth Buttons or Profile Menu */}
        <div className="flex items-center gap-3">
          {user ? (
            /* Khi đã đăng nhập */
            <div className="relative">
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 transition shadow-2xs"
              >
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-lg text-xs font-bold text-white ${
                    role === 'admin'
                      ? 'bg-purple-600'
                      : role === 'teacher'
                      ? 'bg-blue-600'
                      : 'bg-emerald-600'
                  }`}
                >
                  {user.full_name.charAt(0)}
                </div>
                <div className="text-left hidden sm:block">
                  <div className="font-semibold text-slate-900 leading-tight truncate max-w-[120px]">
                    {user.full_name}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {role === 'admin'
                      ? 'Quản trị viên'
                      : role === 'teacher'
                      ? 'Giáo viên'
                      : `Học sinh Lớp ${user.grade || 12}`}
                  </div>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </button>

              {userDropdownOpen && (
                <div
                  className="absolute right-0 mt-2 w-80 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-xl z-50 animate-in fade-in slide-in-from-top-2"
                  onClick={() => setUserDropdownOpen(false)}
                >
                  {/* User Profile Card */}
                  <div className="p-3 bg-slate-50 rounded-xl mb-2 border border-slate-100">
                    <div className="font-bold text-sm text-slate-900">{user.full_name}</div>
                    <div className="text-xs text-slate-500 truncate">{user.email}</div>
                    <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-600">
                      <School className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{user.school_name || 'THPT Chuyên Lê Hồng Phong'}</span>
                      <span className="rounded bg-blue-100 text-blue-700 px-1 font-semibold">
                        Lớp {user.grade || 12}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="space-y-1">
                    <Link
                      href="/gradebook"
                      className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                    >
                      <Award className="h-4 w-4 text-blue-600" />
                      <span>{isTeacher ? 'Sổ điểm & Quản lý bài nộp' : 'Lịch sử thi & Điểm số của tôi'}</span>
                    </Link>

                    {isAdmin && (
                      <Link
                        href="/questions"
                        className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-purple-700 hover:bg-purple-50 transition"
                      >
                        <FileQuestion className="h-4 w-4 text-purple-600" />
                        <span>Quản trị ngân hàng câu hỏi</span>
                      </Link>
                    )}

                    <div className="pt-2 mt-1 border-t border-slate-100">
                      <button
                        onClick={handleSignOut}
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 transition"
                      >
                        <LogOut className="h-4 w-4" />
                        <span>Đăng xuất</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Khi chưa đăng nhập */
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-blue-600 transition"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>Đăng nhập</span>
              </Link>
              <Link
                href="/register"
                className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition"
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>Đăng ký học sinh</span>
              </Link>
            </div>
          )}

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
        <div className="border-b border-slate-200 bg-white px-4 py-4 lg:hidden animate-in slide-in-from-top-2">
          <nav className="flex flex-col gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                    isActive
                      ? 'bg-blue-50 text-blue-600 font-semibold'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5" />
                    <span>{link.label}</span>
                  </div>
                  {link.badge && (
                    <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-700">
                      {link.badge}
                    </span>
                  )}
                </Link>
              );
            })}

            {!user && (
              <div className="pt-3 mt-2 border-t border-slate-100 flex flex-col gap-2">
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-700"
                >
                  <LogIn className="h-4 w-4" />
                  <span>Đăng nhập</span>
                </Link>
                <Link
                  href="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white"
                >
                  <UserPlus className="h-4 w-4" />
                  <span>Đăng ký học sinh</span>
                </Link>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
};

export default Navbar;
