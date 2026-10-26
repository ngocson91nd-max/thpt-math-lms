'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { MOCK_MATERIALS } from '@/lib/supabase/mockStore';
import { Material } from '@/types/database';
import {
  FolderDown,
  Plus,
  FileText,
  Video,
  Image as ImageIcon,
  Code,
  Download,
  ExternalLink,
  Search,
} from 'lucide-react';

export default function MaterialsPage() {
  const { isTeacher } = useAuth();
  const [materials, setMaterials] = useState<Material[]>(MOCK_MATERIALS);
  const [filterType, setFilterType] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'pdf' | 'video' | 'image' | 'latex_doc'>('pdf');
  const [fileUrl, setFileUrl] = useState('');
  const [grade, setGrade] = useState<10 | 11 | 12>(12);
  const [desc, setDesc] = useState('');

  const filtered = materials.filter((m) => {
    if (filterType !== 'all' && m.type !== filterType) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return m.title.toLowerCase().includes(q) || (m.description && m.description.toLowerCase().includes(q));
    }
    return true;
  });

  const handleAddMaterial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !fileUrl.trim()) return;

    const newMat: Material = {
      id: `mat-${Date.now()}`,
      teacher_id: '22222222-2222-2222-2222-222222222222',
      title,
      type,
      file_url: fileUrl,
      grade,
      description: desc,
      file_size: 1500000,
    };

    setMaterials([newMat, ...materials]);
    setShowModal(false);
    setTitle('');
    setFileUrl('');
    setDesc('');
  };

  const getTypeIcon = (t: string) => {
    switch (t) {
      case 'pdf':
        return <FileText className="h-5 w-5 text-rose-600" />;
      case 'video':
        return <Video className="h-5 w-5 text-blue-600" />;
      case 'image':
        return <ImageIcon className="h-5 w-5 text-emerald-600" />;
      default:
        return <Code className="h-5 w-5 text-indigo-600" />;
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Kho Học Liệu & Tài Liệu Toán THPT
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Tổng hợp tài liệu PDF, video bài giảng, sơ đồ tư duy và tài liệu mã nguồn LaTeX/TikZ.
          </p>
        </div>

        {isTeacher && (
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-500/20 hover:bg-blue-500 transition"
          >
            <Plus className="h-4 w-4" />
            Tải Lên Tài Liệu
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {[
            { id: 'all', label: 'Tất cả học liệu' },
            { id: 'pdf', label: 'Tài liệu PDF' },
            { id: 'video', label: 'Video bài giảng' },
            { id: 'latex_doc', label: 'Mã nguồn LaTeX' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setFilterType(item.id)}
              className={`rounded-xl px-4 py-2 text-xs font-semibold transition ${
                filterType === item.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="w-full sm:w-72">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm tài liệu..."
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 bg-white focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Materials Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((mat) => (
          <div
            key={mat.id}
            className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-6 shadow-xs hover:shadow-md transition"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 border border-slate-100">
                    {getTypeIcon(mat.type)}
                  </div>
                  <div>
                    <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 uppercase">
                      {mat.type}
                    </span>
                    <div className="text-[11px] text-slate-400 mt-0.5">Lớp {mat.grade || 12}</div>
                  </div>
                </div>
              </div>

              <h3 className="font-bold text-sm text-slate-900 line-clamp-2 leading-snug">
                {mat.title}
              </h3>
              <p className="mt-2 text-xs text-slate-500 line-clamp-2 leading-relaxed">
                {mat.description || 'Tài liệu ôn thi Toán THPT.'}
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                {mat.file_size ? `${(mat.file_size / 1024 / 1024).toFixed(1)} MB` : 'Trực tuyến'}
              </span>

              <a
                href={mat.file_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-600 transition"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Xem / Tải về</span>
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* Upload Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <h2 className="text-xl font-bold text-slate-900">Thêm Tài Liệu Học Liệu</h2>
            <p className="text-xs text-slate-500 mt-1">Đăng tải file PDF, video bài giảng hoặc mã LaTeX.</p>

            <form onSubmit={handleAddMaterial} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tiêu đề tài liệu <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ví dụ: Công thức tính nhanh đạo hàm..."
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Loại file</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-200 p-2 text-xs text-slate-900 focus:outline-none"
                  >
                    <option value="pdf">Tài liệu PDF</option>
                    <option value="video">Video bài giảng</option>
                    <option value="image">Hình ảnh / Sơ đồ</option>
                    <option value="latex_doc">Mã nguồn LaTeX</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Khối lớp</label>
                  <select
                    value={grade}
                    onChange={(e) => setGrade(Number(e.target.value) as any)}
                    className="w-full rounded-xl border border-slate-200 p-2 text-xs text-slate-900 focus:outline-none"
                  >
                    <option value={12}>Lớp 12</option>
                    <option value={11}>Lớp 11</option>
                    <option value={10}>Lớp 10</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Đường dẫn URL file / Supabase Storage <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={fileUrl}
                  onChange={(e) => setFileUrl(e.target.value)}
                  placeholder="https://... hoặc /docs/file.pdf"
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Mô tả ngắn</label>
                <textarea
                  rows={2}
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="Tóm tắt nội dung tài liệu..."
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-blue-500"
                >
                  Thêm tài liệu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
