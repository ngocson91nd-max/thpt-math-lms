'use client';

import React, { useState, use } from 'react';
import Link from 'next/link';
import { MOCK_COURSES } from '@/lib/supabase/mockStore';
import { Lesson } from '@/types/database';
import MathRenderer from '@/components/math/MathRenderer';
import {
  BookOpen,
  ArrowLeft,
  PlayCircle,
  FileText,
  Download,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  ExternalLink,
} from 'lucide-react';

export default function CourseDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params);
  const course = MOCK_COURSES.find((c) => c.slug === resolvedParams.slug) || MOCK_COURSES[0];

  const allLessons: Lesson[] = [];
  course.chapters?.forEach((ch) => {
    ch.lessons?.forEach((l) => allLessons.push(l));
  });

  const [currentLesson, setCurrentLesson] = useState<Lesson>(allLessons[0]);

  const currentIndex = allLessons.findIndex((l) => l.id === currentLesson?.id);

  return (
    <div className="space-y-6 pb-12">
      {/* Back button */}
      <Link
        href="/courses"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition"
      >
        <ArrowLeft className="h-4 w-4" />
        Quay lại danh sách khóa học
      </Link>

      {/* Main Course Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Lesson Content Area (3 Cols) */}
        <div className="lg:col-span-3 space-y-6">
          {/* Video Player */}
          {currentLesson.video_url && (
            <div className="overflow-hidden rounded-3xl bg-slate-950 aspect-video shadow-md flex items-center justify-center relative">
              <iframe
                src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=0"
                title={currentLesson.title}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}

          {/* Lesson Text Content */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-10 shadow-xs">
            <div className="border-b border-slate-100 pb-4 mb-6">
              <span className="rounded-md bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
                Bài {currentLesson.order_index}
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2">
                {currentLesson.title}
              </h1>
            </div>

            {/* Render LaTeX Mathematics */}
            <div className="prose max-w-none text-slate-800 leading-relaxed text-sm">
              <MathRenderer content={currentLesson.content || 'Nội dung bài học đang được cập nhật...'} />
            </div>

            {/* Attachments & PDFs */}
            {currentLesson.attachments && currentLesson.attachments.length > 0 && (
              <div className="mt-8 pt-6 border-t border-slate-100">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                  Tài Liệu Đính Kèm Của Bài Học:
                </h4>
                <div className="space-y-2">
                  {currentLesson.attachments.map((att, idx) => (
                    <a
                      key={idx}
                      href={att.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4 hover:bg-blue-50/50 hover:border-blue-200 transition"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-blue-600" />
                        <div>
                          <div className="font-semibold text-xs text-slate-900">{att.name}</div>
                          <div className="text-[10px] text-slate-400 uppercase">
                            Định dạng {att.type} • {(att.size || 1048576) / 1024 / 1024} MB
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 text-xs font-semibold text-blue-600">
                        <Download className="h-4 w-4" />
                        <span>Tải về</span>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Next / Prev Navigation */}
            <div className="mt-10 pt-6 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                disabled={currentIndex <= 0}
                onClick={() => setCurrentLesson(allLessons[currentIndex - 1])}
                className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft className="h-4 w-4" />
                Bài trước
              </button>

              <button
                type="button"
                disabled={currentIndex >= allLessons.length - 1}
                onClick={() => setCurrentLesson(allLessons[currentIndex + 1])}
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed transition"
              >
                Bài tiếp theo
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Course Syllabus Sidebar (1 Col) */}
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs sticky top-24">
            <h3 className="font-bold text-base text-slate-900 mb-1">{course.title}</h3>
            <p className="text-xs text-slate-400 mb-4">Mục lục chuyên đề</p>

            <div className="space-y-4">
              {course.chapters?.map((ch) => (
                <div key={ch.id}>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    {ch.title}
                  </div>
                  <div className="space-y-1.5">
                    {ch.lessons?.map((l) => {
                      const isActive = l.id === currentLesson.id;
                      return (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => setCurrentLesson(l)}
                          className={`flex w-full items-start gap-2.5 rounded-xl p-2.5 text-left text-xs transition ${
                            isActive
                              ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200'
                              : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <PlayCircle className={`h-4 w-4 shrink-0 mt-0.5 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                          <span className="line-clamp-2">{l.title}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
