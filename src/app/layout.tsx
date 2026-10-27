import type { Metadata } from 'next';
import { Suspense } from 'react';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import AppLayout from '@/components/layout/AppLayout';

export const metadata: Metadata = {
  title: 'Toán Thầy Sơn - Nền Tảng Dạy & Học Toán THPT Trực Tuyến',
  description:
    'Lớp học Toán trực tuyến Thầy Sơn (Lớp 10, 11, 12). Hỗ trợ KaTeX, 5 dạng câu hỏi chuẩn Bộ GD&ĐT 2025, thi tính giờ và chấm tự động.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className="h-full antialiased scroll-smooth">
      <head>
        <link rel="stylesheet" type="text/css" href="https://unpkg.com/@rod2ik/tikzjax@1.6.0/dist/fonts.css" />
        <script src="https://unpkg.com/@rod2ik/tikzjax@1.6.0/dist/tikzjax.min.js" async defer></script>
      </head>
      <body className="min-h-full bg-slate-50 text-slate-900 font-sans">
        <AuthProvider>
          <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-slate-400">Đang khởi tạo hệ thống...</div>}>
            <AppLayout>{children}</AppLayout>
          </Suspense>
        </AuthProvider>
      </body>
    </html>
  );
}
