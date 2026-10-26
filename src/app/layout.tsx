import type { Metadata } from 'next';
import { Suspense } from 'react';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';

export const metadata: Metadata = {
  title: 'Hệ Thống LMS Toán THPT - Nền Tảng Dạy & Học Toán Trực Tuyến',
  description:
    'LMS chuyên biệt cho môn Toán THPT (Lớp 10, 11, 12). Hỗ trợ KaTeX, 5 dạng câu hỏi chuẩn Bộ GD&ĐT 2025, chấm tự động máy chủ và tích hợp AI.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className="h-full antialiased scroll-smooth">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 font-sans">
        <AuthProvider>
          <Suspense fallback={<div className="h-16 bg-white border-b border-slate-200" />}>
            <Navbar />
          </Suspense>
          <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <Suspense fallback={<div className="p-8 text-center text-slate-400">Đang tải dữ liệu...</div>}>
              {children}
            </Suspense>
          </main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
