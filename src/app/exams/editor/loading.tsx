import React from 'react';
import { Loader2, Sparkles, BookOpen } from 'lucide-react';

export default function ExamEditorLoading() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Header Skeleton */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-6 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-blue-100 animate-pulse flex items-center justify-center text-blue-600">
            <BookOpen className="h-5 w-5 animate-spin" />
          </div>
          <div>
            <div className="h-4 w-48 rounded bg-slate-200 animate-pulse mb-1.5" />
            <div className="h-3 w-28 rounded bg-slate-100 animate-pulse" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="h-8 w-24 rounded-xl bg-slate-200 animate-pulse" />
          <div className="h-8 w-28 rounded-xl bg-blue-500/30 animate-pulse" />
        </div>
      </header>

      {/* Main 3-Column Skeleton Layout */}
      <div className="flex-1 flex overflow-hidden p-6 gap-6 max-w-7xl mx-auto w-full">
        {/* Left Settings Skeleton */}
        <div className="w-80 shrink-0 hidden lg:block rounded-3xl bg-white border border-slate-200 p-5 space-y-4 shadow-2xs">
          <div className="h-5 w-32 rounded bg-slate-200 animate-pulse" />
          <div className="space-y-3 pt-2">
            <div className="h-9 rounded-xl bg-slate-100 animate-pulse" />
            <div className="h-9 rounded-xl bg-slate-100 animate-pulse" />
            <div className="h-9 rounded-xl bg-slate-100 animate-pulse" />
            <div className="h-20 rounded-xl bg-slate-100 animate-pulse" />
          </div>
        </div>

        {/* Center Canvas Skeleton */}
        <div className="flex-1 space-y-4">
          <div className="rounded-3xl bg-white border border-slate-200 p-8 shadow-xs space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                <span className="text-sm font-bold text-slate-800">
                  Đang khởi tạo trình soạn thảo đề thi Toán THPT...
                </span>
              </div>
              <span className="text-xs text-slate-400">Vui lòng chờ giây lát</span>
            </div>

            {/* Simulated Question Cards */}
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-2xl border border-slate-100 bg-slate-50/50 p-5 space-y-3 animate-pulse"
              >
                <div className="flex items-center justify-between">
                  <div className="h-4 w-20 rounded bg-blue-100" />
                  <div className="h-3 w-16 rounded bg-slate-200" />
                </div>
                <div className="h-4 w-3/4 rounded bg-slate-200" />
                <div className="h-4 w-1/2 rounded bg-slate-200" />
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="h-8 rounded-xl bg-slate-200" />
                  <div className="h-8 rounded-xl bg-slate-200" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Sidebar Skeleton */}
        <div className="w-64 shrink-0 hidden xl:block rounded-3xl bg-white border border-slate-200 p-5 space-y-4 shadow-2xs">
          <div className="h-5 w-28 rounded bg-slate-200 animate-pulse" />
          <div className="grid grid-cols-4 gap-2 pt-2">
            {Array.from({ length: 16 }).map((_, idx) => (
              <div key={idx} className="h-9 rounded-xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
