'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { MOCK_COURSES } from '@/lib/supabase/mockStore';
import { Course } from '@/types/database';
import { BookOpen, Layers, PlayCircle, ArrowRight, Clock, Award } from 'lucide-react';

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>(MOCK_COURSES);
  const [selectedGrade, setSelectedGrade] = useState<number | 'all'>('all');

  const filtered = courses.filter((c) => {
    if (selectedGrade !== 'all' && c.grade !== selectedGrade) return false;
    return true;
  });

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Khóa Học & Chuyên Đề Toán THPT
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Hệ thống bài giảng video, lý thuyết trọng tâm và tài liệu bồi dưỡng Đại số, Giải tích, Hình học Oxyz.
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {(['all', 12, 11, 10] as const).map((g) => (
          <button
            key={g}
            onClick={() => setSelectedGrade(g)}
            className={`rounded-xl px-4 py-2 text-xs font-semibold transition ${
              selectedGrade === g
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {g === 'all' ? 'Tất cả các lớp' : `Toán Lớp ${g}`}
          </button>
        ))}
      </div>

      {/* Courses Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {filtered.map((course) => (
          <div
            key={course.id}
            className="group flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xs hover:shadow-lg transition duration-200"
          >
            <div>
              {/* Cover Image */}
              <div className="relative h-48 w-full overflow-hidden bg-slate-100">
                <img
                  src={course.cover_url || 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=600'}
                  alt={course.title}
                  className="h-full w-full object-cover group-hover:scale-105 transition duration-300"
                />
                <span className="absolute top-4 left-4 rounded-lg bg-blue-600/90 backdrop-blur-md px-3 py-1 text-xs font-bold text-white shadow-sm">
                  Lớp {course.grade}
                </span>
              </div>

              {/* Course Info */}
              <div className="p-6">
                <h3 className="text-xl font-bold text-slate-900 leading-snug group-hover:text-blue-600 transition">
                  {course.title}
                </h3>
                <p className="mt-2 text-xs text-slate-500 leading-relaxed line-clamp-2">
                  {course.description}
                </p>

                <div className="mt-5 flex items-center gap-4 text-xs text-slate-500 pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <Layers className="h-4 w-4 text-slate-400" />
                    <span>{course.chapters?.length || 2} Chương</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <PlayCircle className="h-4 w-4 text-slate-400" />
                    <span>Đầy đủ video & tài liệu PDF</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 pt-0">
              <Link
                href={`/courses/${course.slug}`}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-xs font-semibold text-white group-hover:bg-blue-600 transition"
              >
                Vào học ngay <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
