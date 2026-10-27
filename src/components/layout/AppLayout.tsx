'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { Footer } from './Footer';

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname();
  const isTakeExamPage = pathname.includes('/take');

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans">
      {!isTakeExamPage && <Sidebar />}
      <div className={`flex-1 flex flex-col min-h-screen transition-all ${isTakeExamPage ? 'w-full' : 'lg:pl-64'}`}>
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>
        {!isTakeExamPage && <Footer />}
      </div>
    </div>
  );
};

export default AppLayout;
