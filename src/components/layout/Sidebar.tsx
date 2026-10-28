'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  Home,
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
  PanelLeftClose,
} from 'lucide-react';

interface NavLinkItem {
  href: string;
  label: string;
  icon: any;
  exact?: boolean;
  badge?: string;
}

interface NavGroup {
  title: string;
  links: NavLinkItem[];
}

interface SidebarProps {
  isCollapsed?: boolean;
  onToggle?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isCollapsed = false, onToggle }) => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, role, isTeacher, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  // Đóng sidebar di động khi chuyển route
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Nếu đang ở màn hình làm bài thi (/take), ẩn sidebar để học sinh tập trung 100% vào bài làm
  const isTakeExamPage = pathname.includes('/take');
  if (isTakeExamPage) {
    return null;
  }

  const navGroups: NavGroup[] = [
    {
      title: 'HỌC TẬP & LUYỆN THI',
      links: [
        { href: '/', label: 'Trang chủ', icon: Home, exact: true },
        { href: '/exams', label: 'Đề thi & Luyện tập', icon: ClipboardList },
        ...(isTeacher
          ? [
              { href: '/questions', label: 'Ngân hàng câu hỏi', icon: FileQuestion },
              { href: '/gradebook', label: 'Sổ điểm & Chấm thi', icon: Award },
            ]
          : [{ href: '/gradebook', label: 'Điểm số của tôi', icon: Award }]),
      ],
    },
    {
      title: isTeacher ? 'LỚP HỌC & HỌC LIỆU' : 'HỌC LIỆU & TÀI LIỆU',
      links: [
        ...(isTeacher ? [{ href: '/classes', label: 'Quản lý lớp học', icon: GraduationCap }] : []),
        { href: '/courses', label: 'Khóa học THPT', icon: BookOpen },
        { href: '/materials', label: 'Học liệu & PDF', icon: FolderDown },
      ],
    },
    {
      title: 'TRỢ LÝ THÔNG MINH',
      links: [
        { href: '/ai-assistant', label: 'AI Trợ lý Toán', icon: Sparkles, badge: 'AI 2025' },
      ],
    },
  ];

  const handleSignOut = async () => {
    setUserDropdownOpen(false);
    await signOut();
    router.push('/login');
  };

  const SidebarContent = () => (
    <div className="flex h-full flex-col justify-between bg-white text-slate-800">
      {/* 1. Header / Logo */}
      <div>
        <div className="flex h-20 items-center justify-between border-b border-slate-100 px-5">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition">
              <Sigma className="h-6 w-6 stroke-[2.5]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 font-bold text-base text-slate-900 tracking-tight">
                <span>TOÁN THẦY SƠN</span>
                <span className="rounded-md bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
                  THPT
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">Luyện Thi Tốt Nghiệp 2025</p>
            </div>
          </Link>

          {/* Nút thu gọn thanh bên trên Desktop */}
          {onToggle && (
            <button
              type="button"
              onClick={onToggle}
              className="hidden lg:flex items-center justify-center rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition cursor-pointer"
              title="Ẩn thanh bên"
              aria-label="Ẩn thanh bên"
            >
              <PanelLeftClose className="h-5 w-5" />
            </button>
          )}

          {/* Nút đóng trên mobile */}
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="lg:hidden rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition cursor-pointer"
            aria-label="Đóng menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 2. Menu Điều Hướng Dọc */}
        <nav className="p-4 space-y-6 overflow-y-auto max-h-[calc(100vh-160px)]">
          {navGroups.map((group) => (
            <div key={group.title} className="space-y-1.5">
              <div className="px-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                {group.title}
              </div>
              <div className="space-y-1">
                {group.links.map((link) => {
                  const Icon = link.icon;
                  const isActive = link.exact
                    ? pathname === link.href
                    : pathname === link.href || pathname.startsWith(`${link.href}/`);

                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      prefetch={true}
                      className={`group flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/20 font-bold'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon
                          className={`h-4.5 w-4.5 transition ${
                            isActive ? 'text-white' : 'text-slate-400 group-hover:text-blue-600'
                          }`}
                        />
                        <span>{link.label}</span>
                      </div>

                      {link.badge && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                            isActive ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-700'
                          }`}
                        >
                          {link.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* 3. Footer / User Profile & Logout */}
      <div className="border-t border-slate-100 p-4 bg-slate-50/50">
        {user ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-2.5 text-left shadow-2xs hover:border-slate-300 transition cursor-pointer"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-sm font-bold text-white shadow-xs">
                  {user.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-bold text-slate-900">
                    {user.full_name || 'Người dùng'}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-slate-500">
                    <span
                      className={`inline-block h-1.5 w-1.5 rounded-full ${
                        isTeacher ? 'bg-purple-500' : 'bg-emerald-500'
                      }`}
                    />
                    <span>{isTeacher ? 'Quản trị viên / Thầy' : 'Học sinh'}</span>
                  </div>
                </div>
              </div>
              <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
            </button>

            {userDropdownOpen && (
              <div className="absolute bottom-full left-0 mb-2 w-full rounded-2xl border border-slate-200 bg-white p-2 shadow-xl animate-in fade-in zoom-in-95 space-y-1">
                <div className="px-3 py-1.5 text-[11px] text-slate-400 border-b border-slate-100">
                  {user.email}
                </div>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Đăng xuất</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Link
              href="/login"
              className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>Đăng nhập</span>
            </Link>
            <Link
              href="/register"
              className="flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 py-2 text-xs font-bold text-white shadow-sm shadow-blue-600/20 hover:bg-blue-500 transition"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>Đăng ký</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Thanh Bar trên cùng cho điện thoại / Tablet (< lg) */}
      <div className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur-md lg:hidden">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
            <Sigma className="h-5 w-5 stroke-[2.5]" />
          </div>
          <span className="font-bold text-slate-900 text-sm">TOÁN THẦY SƠN</span>
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
          aria-label="Mở menu"
        >
          <Menu className="h-4 w-4" />
          <span>Menu</span>
        </button>
      </div>

      {/* Drawer trượt trên Mobile */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 w-72 bg-white shadow-2xl animate-in slide-in-from-left duration-200">
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Sidebar cố định bên trái trên Màn hình máy tính (Desktop >= lg) */}
      <aside
        className={`hidden lg:flex fixed inset-y-0 left-0 z-40 w-64 flex-col border-r border-slate-200 bg-white shadow-xs transition-transform duration-300 ease-in-out ${
          isCollapsed ? '-translate-x-full' : 'translate-x-0'
        }`}
      >
        <SidebarContent />
      </aside>
    </>
  );
};

export default Sidebar;
