import React from 'react';
import { Users, Loader2 } from 'lucide-react';

export default function ClassesLoading() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 animate-in fade-in duration-200">
      {/* Top Banner Skeleton */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="h-7 w-48 rounded-xl bg-slate-200 animate-pulse mb-2" />
          <div className="h-4 w-72 rounded-lg bg-slate-100 animate-pulse" />
        </div>
        <div className="h-10 w-36 rounded-2xl bg-blue-600/30 animate-pulse" />
      </div>

      {/* Grid of Class Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4 animate-pulse"
          >
            <div className="flex items-center justify-between">
              <div className="h-6 w-20 rounded-full bg-blue-100" />
              <div className="h-6 w-16 rounded-full bg-slate-100" />
            </div>
            <div className="h-6 w-3/4 rounded-xl bg-slate-200" />
            <div className="h-4 w-full rounded-lg bg-slate-100" />
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <div className="h-4 w-24 rounded bg-slate-100" />
              <div className="h-8 w-20 rounded-xl bg-slate-200" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
