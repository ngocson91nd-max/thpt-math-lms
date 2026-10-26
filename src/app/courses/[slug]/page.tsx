'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { MOCK_COURSES } from '@/lib/supabase/mockStore';
import { Course, Lesson, Chapter } from '@/types/database';
import MathRenderer from '@/components/math/MathRenderer';
import { useAuth } from '@/context/AuthContext';
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
  Plus,
  Pencil,
  Trash2,
} from 'lucide-react';

export default function CourseDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params);
  const { isTeacher } = useAuth();

  // Find course from localStorage or MOCK_COURSES
  let foundCourse = MOCK_COURSES.find((c) => c.slug === resolvedParams.slug);
  if (!foundCourse && typeof window !== 'undefined') {
    const saved = localStorage.getItem('lms_courses');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        foundCourse = parsed.find((c: any) => c.slug === resolvedParams.slug);
      } catch {}
    }
  }
  if (!foundCourse) foundCourse = MOCK_COURSES[0];

  const [course, setCourse] = useState<Course>(foundCourse);

  const allLessons: Lesson[] = [];
  course.chapters?.forEach((ch) => {
    ch.lessons?.forEach((l) => allLessons.push(l));
  });

  const [currentLesson, setCurrentLesson] = useState<Lesson>(
    allLessons[0] || {
      id: 'default-lesson',
      title: 'Bài 1: Giới thiệu chuyên đề',
      order_index: 1,
      content: 'Nội dung bài học đang được cập nhật...',
    }
  );

  // Lesson CRUD Modals
  const [showAddLessonModal, setShowAddLessonModal] = useState(false);
  const [showEditLessonModal, setShowEditLessonModal] = useState(false);

  // Form State
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonVideo, setLessonVideo] = useState('');
  const [lessonContent, setLessonContent] = useState('');

  const [editLessonTitle, setEditLessonTitle] = useState('');
  const [editLessonVideo, setEditLessonVideo] = useState('');
  const [editLessonContent, setEditLessonContent] = useState('');

  const currentIndex = allLessons.findIndex((l) => l.id === currentLesson?.id);

  const saveCourse = (updatedCourse: Course) => {
    setCourse(updatedCourse);
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('lms_courses');
      let courseList: Course[] = saved ? JSON.parse(saved) : [...MOCK_COURSES];
      const idx = courseList.findIndex((c) => c.id === updatedCourse.id);
      if (idx >= 0) courseList[idx] = updatedCourse;
      else courseList.push(updatedCourse);
      localStorage.setItem('lms_courses', JSON.stringify(courseList));
    }
  };

  // Thêm bài học mới vào chương 1
  const handleAddLesson = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lessonTitle.trim()) return;

    const newId = `l-${Date.now()}`;
    const chapterId = course.chapters?.[0]?.id || `ch-1-${Date.now()}`;
    const newLesson: Lesson = {
      id: newId,
      chapter_id: chapterId,
      title: lessonTitle.trim(),
      order_index: allLessons.length + 1,
      content: lessonContent.trim() || 'Nội dung lý thuyết và bài tập...',
      video_url: lessonVideo.trim() || undefined,
      attachments: [],
      is_free_preview: true,
    };

    const chapters = [...(course.chapters || [])];
    if (chapters.length === 0) {
      chapters.push({
        id: chapterId,
        course_id: course.id,
        title: 'Chương 1: Kiến thức trọng tâm',
        order_index: 1,
        lessons: [newLesson],
      });
    } else {
      chapters[0] = {
        ...chapters[0],
        lessons: [...(chapters[0].lessons || []), newLesson],
      };
    }

    const updated = { ...course, chapters };
    saveCourse(updated);
    setCurrentLesson(newLesson);
    setShowAddLessonModal(false);
    setLessonTitle('');
    setLessonVideo('');
    setLessonContent('');
  };

  // Mở modal sửa bài học
  const openEditLesson = () => {
    setEditLessonTitle(currentLesson.title);
    setEditLessonVideo(currentLesson.video_url || '');
    setEditLessonContent(currentLesson.content || '');
    setShowEditLessonModal(true);
  };

  // Cập nhật bài học
  const handleUpdateLesson = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editLessonTitle.trim()) return;

    const chapters = (course.chapters || []).map((ch) => ({
      ...ch,
      lessons: (ch.lessons || []).map((l) => {
        if (l.id === currentLesson.id) {
          return {
            ...l,
            title: editLessonTitle.trim(),
            video_url: editLessonVideo.trim() || undefined,
            content: editLessonContent.trim(),
          };
        }
        return l;
      }),
    }));

    const updatedLesson = {
      ...currentLesson,
      title: editLessonTitle.trim(),
      video_url: editLessonVideo.trim() || undefined,
      content: editLessonContent.trim(),
    };

    const updated = { ...course, chapters };
    saveCourse(updated);
    setCurrentLesson(updatedLesson);
    setShowEditLessonModal(false);
  };

  // Xóa bài học hiện tại
  const handleDeleteLesson = () => {
    const isConfirmed = confirm(
      `Thầy có chắc chắn muốn xóa bài học "${currentLesson.title}" không?`
    );
    if (!isConfirmed) return;

    const chapters = (course.chapters || []).map((ch) => ({
      ...ch,
      lessons: (ch.lessons || []).filter((l) => l.id !== currentLesson.id),
    }));

    const updated = { ...course, chapters };
    saveCourse(updated);

    const remaining: Lesson[] = [];
    chapters.forEach((ch) => ch.lessons?.forEach((l) => remaining.push(l)));
    if (remaining.length > 0) {
      setCurrentLesson(remaining[0]);
    }
  };

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
                src={currentLesson.video_url}
                title={currentLesson.title}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}

          {/* Lesson Text Content */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-10 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-6">
              <div>
                <span className="rounded-md bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
                  Bài {currentLesson.order_index}
                </span>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2">
                  {currentLesson.title}
                </h1>
              </div>

              {isTeacher && (
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={openEditLesson}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 transition"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    <span>Sửa bài học</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteLesson}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Xóa bài học</span>
                  </button>
                </div>
              )}
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
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-base text-slate-900">{course.title}</h3>
            </div>
            <p className="text-xs text-slate-400 mb-4">Mục lục chuyên đề</p>

            {isTeacher && (
              <button
                type="button"
                onClick={() => setShowAddLessonModal(true)}
                className="w-full mb-4 flex items-center justify-center gap-2 rounded-xl bg-blue-50 border border-blue-200 py-2.5 text-xs font-bold text-blue-700 hover:bg-blue-100 transition"
              >
                <Plus className="h-4 w-4" />
                Thêm Bài Học Mới
              </button>
            )}

            <div className="space-y-4">
              {course.chapters?.map((ch) => (
                <div key={ch.id}>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    {ch.title}
                  </div>
                  <div className="space-y-1.5">
                    {ch.lessons?.map((l) => {
                      const isActive = l.id === currentLesson?.id;
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
                          <PlayCircle
                            className={`h-4 w-4 shrink-0 mt-0.5 ${
                              isActive ? 'text-blue-600' : 'text-slate-400'
                            }`}
                          />
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

      {/* Modal Thêm Bài Học */}
      {showAddLessonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg my-8 rounded-3xl bg-white p-6 sm:p-8 shadow-2xl animate-in fade-in zoom-in-95">
            <h2 className="text-xl font-bold text-slate-900">Thêm Bài Học Mới</h2>
            <p className="mt-1 text-xs text-slate-500">
              Thêm bài giảng vào chuyên đề {course.title}.
            </p>

            <form onSubmit={handleAddLesson} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tiêu đề bài học <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={lessonTitle}
                  onChange={(e) => setLessonTitle(e.target.value)}
                  placeholder="Ví dụ: Bài 2: Cực trị của hàm số và bài toán chứa tham số m"
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Link Video Youtube (Embed URL)
                </label>
                <input
                  type="url"
                  value={lessonVideo}
                  onChange={(e) => setLessonVideo(e.target.value)}
                  placeholder="https://www.youtube-nocookie.com/embed/..."
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nội dung lý thuyết & Công thức Toán (Hỗ trợ LaTeX KaTeX)
                </label>
                <textarea
                  rows={6}
                  value={lessonContent}
                  onChange={(e) => setLessonContent(e.target.value)}
                  placeholder="Nhập nội dung bài giảng, công thức toán trong dấu $ $..."
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddLessonModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition shadow-sm"
                >
                  Thêm Bài Học
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Chỉnh Sửa Bài Học */}
      {showEditLessonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg my-8 rounded-3xl bg-white p-6 sm:p-8 shadow-2xl animate-in fade-in zoom-in-95">
            <h2 className="text-xl font-bold text-slate-900">Chỉnh Sửa Bài Học</h2>
            <p className="mt-1 text-xs text-slate-500">
              Cập nhật nội dung bài giảng và công thức Toán.
            </p>

            <form onSubmit={handleUpdateLesson} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tiêu đề bài học <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editLessonTitle}
                  onChange={(e) => setEditLessonTitle(e.target.value)}
                  placeholder="Tiêu đề bài học"
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Link Video Youtube (Embed URL)
                </label>
                <input
                  type="url"
                  value={editLessonVideo}
                  onChange={(e) => setEditLessonVideo(e.target.value)}
                  placeholder="https://www.youtube-nocookie.com/embed/..."
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nội dung lý thuyết & Công thức Toán (KaTeX)
                </label>
                <textarea
                  rows={6}
                  value={editLessonContent}
                  onChange={(e) => setEditLessonContent(e.target.value)}
                  placeholder="Nội dung bài giảng..."
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditLessonModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition shadow-sm"
                >
                  Lưu Thay Đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
