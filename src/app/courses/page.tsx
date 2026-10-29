'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { MOCK_COURSES } from '@/lib/supabase/mockStore';
import { Course } from '@/types/database';
import { createClient } from '@/lib/supabase/client';
import {
  BookOpen,
  Layers,
  PlayCircle,
  ArrowRight,
  Plus,
  Pencil,
  Trash2,
  Sparkles,
  Calendar,
  AlertCircle,
} from 'lucide-react';

export default function CoursesPage() {
  const { user, isTeacher, isStudent } = useAuth();
  const [courses, setCourses] = useState<Course[]>(() => {
    if (typeof window === 'undefined') return MOCK_COURSES;
    try {
      const saved = localStorage.getItem('lms_courses');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return MOCK_COURSES;
  });
  const [selectedGrade, setSelectedGrade] = useState<number | 'all'>('all');

  // Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);

  // Create Form State
  const [title, setTitle] = useState('');
  const [grade, setGrade] = useState<10 | 11 | 12>(12);
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [coverUrl, setCoverUrl] = useState('');

  // Edit Form State
  const [editTitle, setEditTitle] = useState('');
  const [editGrade, setEditGrade] = useState<10 | 11 | 12>(12);
  const [editSlug, setEditSlug] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCoverUrl, setEditCoverUrl] = useState('');

  // Tải danh sách khóa học từ localStorage hoặc Supabase
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('lms_courses');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setCourses(parsed);
            return;
          }
        } catch (e) {
          console.error(e);
        }
      }
    }

    const supabase = createClient();
    if (supabase) {
      supabase
        .from('courses')
        .select('*')
        .then(({ data, error }) => {
          if (!error && data && data.length > 0) {
            setCourses(data as any);
            if (typeof window !== 'undefined') {
              localStorage.setItem('lms_courses', JSON.stringify(data));
            }
          }
        });
    }
  }, []);

  const saveCoursesToStorage = (updated: Course[]) => {
    setCourses(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('lms_courses', JSON.stringify(updated));
    }
  };

  // Tạo Chuyên Đề Mới
  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const finalSlug =
      slug.trim().toLowerCase() ||
      title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '') ||
      `chuyen-de-${Date.now()}`;

    const newId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `course-${Date.now()}`;

    const newCourse: Course = {
      id: newId,
      title: title.trim(),
      slug: finalSlug,
      description: description.trim() || 'Chuyên đề bồi dưỡng môn Toán THPT Thầy Sơn.',
      grade,
      teacher_id: user?.id || '22222222-2222-2222-2222-222222222222',
      cover_url:
        coverUrl.trim() ||
        'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=600',
      is_published: true,
      chapters: [
        {
          id: `ch-1-${newId}`,
          course_id: newId,
          title: 'Phần 1: Lý Thuyết Trọng Tâm & Phương Pháp Giải',
          order_index: 1,
          lessons: [
            {
              id: `l-1-${newId}`,
              chapter_id: `ch-1-${newId}`,
              title: 'Bài 1: Định nghĩa, định lý và công thức nền tảng',
              order_index: 1,
              content: 'Nội dung kiến thức trọng tâm của chuyên đề...',
              video_url: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
              attachments: [],
              is_free_preview: true,
            },
          ],
        },
      ],
    };

    const updated = [newCourse, ...courses];
    saveCoursesToStorage(updated);

    try {
      const supabase = createClient();
      if (supabase && user) {
        await supabase.from('courses').insert([
          {
            id: newId,
            title: newCourse.title,
            slug: newCourse.slug,
            description: newCourse.description,
            grade: newCourse.grade,
            teacher_id: user.id,
            cover_url: newCourse.cover_url,
            is_published: true,
          },
        ]);
      }
    } catch (err) {
      console.warn('Lỗi thêm khóa học trên Supabase:', err);
    }

    setShowCreateModal(false);
    setTitle('');
    setSlug('');
    setDescription('');
    setCoverUrl('');
  };

  // Mở modal sửa chuyên đề
  const openEditModal = (c: Course) => {
    setEditingCourse(c);
    setEditTitle(c.title);
    setEditGrade(c.grade);
    setEditSlug(c.slug);
    setEditDescription(c.description || '');
    setEditCoverUrl(c.cover_url || '');
    setShowEditModal(true);
  };

  // Cập nhật chuyên đề
  const handleUpdateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCourse || !editTitle.trim()) return;

    const updated = courses.map((c) => {
      if (c.id === editingCourse.id) {
        return {
          ...c,
          title: editTitle.trim(),
          grade: editGrade,
          slug: editSlug.trim() || c.slug,
          description: editDescription.trim(),
          cover_url: editCoverUrl.trim() || c.cover_url,
        };
      }
      return c;
    });

    saveCoursesToStorage(updated);

    try {
      const supabase = createClient();
      if (supabase) {
        await supabase
          .from('courses')
          .update({
            title: editTitle.trim(),
            grade: editGrade,
            slug: editSlug.trim() || editingCourse.slug,
            description: editDescription.trim(),
            cover_url: editCoverUrl.trim() || editingCourse.cover_url,
          })
          .eq('id', editingCourse.id);
      }
    } catch (err) {
      console.warn('Lỗi cập nhật chuyên đề trên Supabase:', err);
    }

    setShowEditModal(false);
    setEditingCourse(null);
  };

  // Xóa chuyên đề
  const handleDeleteCourse = async (courseId: string, courseTitle: string) => {
    const isConfirmed = confirm(
      `Thầy có chắc chắn muốn xóa chuyên đề "${courseTitle}" không?\nToàn bộ bài giảng trong chuyên đề này sẽ bị gỡ bỏ.`
    );
    if (!isConfirmed) return;

    const updated = courses.filter((c) => c.id !== courseId);
    saveCoursesToStorage(updated);

    try {
      const supabase = createClient();
      if (supabase) {
        await supabase.from('courses').delete().eq('id', courseId);
      }
    } catch (err) {
      console.warn('Lỗi xóa chuyên đề trên Supabase:', err);
    }
  };

  const filtered = courses.filter((c) => {
    if (selectedGrade !== 'all' && c.grade !== selectedGrade) return false;
    return true;
  });

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <BookOpen className="h-8 w-8 text-blue-600 shrink-0" />
            Khóa Học & Chuyên Đề Toán THPT
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Hệ thống bài giảng video, lý thuyết trọng tâm và tài liệu bồi dưỡng Đại số, Giải tích, Hình học Oxyz.
          </p>
        </div>

        {isTeacher && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-500/20 hover:bg-blue-500 transition self-start sm:self-auto"
          >
            <Plus className="h-4 w-4" />
            Tạo Chuyên Đề Mới
          </button>
        )}
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
      {filtered.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-xs">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 mb-3">
            <BookOpen className="h-7 w-7" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Chưa có chuyên đề nào</h3>
          <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
            Thầy có thể bấm &quot;Tạo Chuyên Đề Mới&quot; để biên soạn bài giảng cho học sinh.
          </p>
        </div>
      ) : (
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

              {/* Bottom Actions */}
              <div className="p-6 pt-0 flex items-center gap-2">
                <Link
                  href={`/courses/${course.slug}`}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-xs font-semibold text-white group-hover:bg-blue-600 transition"
                >
                  <span>Vào học ngay</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>

                {isTeacher && (
                  <>
                    <button
                      type="button"
                      onClick={() => openEditModal(course)}
                      className="rounded-xl border border-slate-200 bg-white p-3 text-slate-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition shadow-2xs"
                      title="Chỉnh sửa chuyên đề"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCourse(course.id, course.title)}
                      className="rounded-xl border border-slate-200 bg-white p-3 text-slate-600 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition shadow-2xs"
                      title="Xóa chuyên đề"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Tạo Chuyên Đề Mới */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg my-8 rounded-3xl bg-white p-6 sm:p-8 shadow-2xl animate-in fade-in zoom-in-95">
            <h2 className="text-xl font-bold text-slate-900">Tạo Chuyên Đề & Khóa Học Mới</h2>
            <p className="mt-1 text-xs text-slate-500">
              Biên soạn chuyên đề bồi dưỡng môn Toán THPT của Thầy Sơn.
            </p>

            <form onSubmit={handleCreateCourse} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tên chuyên đề <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ví dụ: Chuyên Đề: Ứng Dụng Đạo Hàm Khảo Sát Đồ Thị Hàm Số"
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Khối lớp</label>
                  <select
                    value={grade}
                    onChange={(e) => setGrade(Number(e.target.value) as 10 | 11 | 12)}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                  >
                    <option value={12}>Toán Lớp 12</option>
                    <option value={11}>Toán Lớp 11</option>
                    <option value={10}>Toán Lớp 10</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Đường dẫn (Slug)
                  </label>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="ung-dung-dao-ham-12"
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Ảnh bìa chuyên đề (URL)
                </label>
                <input
                  type="url"
                  value={coverUrl}
                  onChange={(e) => setCoverUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/... (để trống sẽ dùng ảnh mặc định)"
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Mô tả chuyên đề</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Tổng quan về kiến thức, các dạng bài tập trọng tâm có trong chuyên đề..."
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition shadow-sm"
                >
                  Tạo Chuyên Đề
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Chỉnh Sửa Chuyên Đề */}
      {showEditModal && editingCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg my-8 rounded-3xl bg-white p-6 sm:p-8 shadow-2xl animate-in fade-in zoom-in-95">
            <h2 className="text-xl font-bold text-slate-900">Chỉnh Sửa Chuyên Đề</h2>
            <p className="mt-1 text-xs text-slate-500">
              Cập nhật thông tin chuyên đề & khóa học của Thầy Sơn.
            </p>

            <form onSubmit={handleUpdateCourse} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tên chuyên đề <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Ví dụ: Chuyên Đề Ứng Dụng Đạo Hàm..."
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Khối lớp</label>
                  <select
                    value={editGrade}
                    onChange={(e) => setEditGrade(Number(e.target.value) as 10 | 11 | 12)}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                  >
                    <option value={12}>Toán Lớp 12</option>
                    <option value={11}>Toán Lớp 11</option>
                    <option value={10}>Toán Lớp 10</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Đường dẫn (Slug)</label>
                  <input
                    type="text"
                    value={editSlug}
                    onChange={(e) => setEditSlug(e.target.value)}
                    placeholder="ung-dung-dao-ham-12"
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Ảnh bìa (URL)</label>
                <input
                  type="url"
                  value={editCoverUrl}
                  onChange={(e) => setEditCoverUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Mô tả chuyên đề</label>
                <textarea
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Tổng quan về kiến thức..."
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingCourse(null);
                  }}
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
