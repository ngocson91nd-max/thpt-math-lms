import type { Metadata } from 'next';
import { Suspense } from 'react';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import AppLayout from '@/components/layout/AppLayout';

export const metadata: Metadata = {
  title: {
    default: 'VNS- Học tập và kiểm tra Toán',
    template: '%s | VNS- Học tập và kiểm tra Toán',
  },
  description:
    'VNS Math - Hệ thống học tập, luyện thi trắc nghiệm và tự luận Toán THPT chuẩn cấu trúc Bộ GD&ĐT 2025.',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: '32x32' },
    ],
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className="h-full antialiased scroll-smooth">
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
