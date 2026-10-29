'use client';

import React, { useState, useEffect } from 'react';
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
  Pencil,
  Trash2,
} from 'lucide-react';

export default function MaterialsPage() {
  const { isTeacher } = useAuth();
  const [materials, setMaterials] = useState<Material[]>(() => {
    if (typeof window === 'undefined') return MOCK_MATERIALS;
    try {
      const saved = localStorage.getItem('lms_materials');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return MOCK_MATERIALS;
  });
  const [filterType, setFilterType] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingMat, setEditingMat] = useState<Material | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'pdf' | 'video' | 'image' | 'latex_doc'>('pdf');
  const [fileUrl, setFileUrl] = useState('');
  const [grade, setGrade] = useState<10 | 11 | 12>(12);
  const [desc, setDesc] = useState('');

  // Edit Form State
  const [editTitle, setEditTitle] = useState('');
  const [editType, setEditType] = useState<'pdf' | 'video' | 'image' | 'latex_doc'>('pdf');
  const [editFileUrl, setEditFileUrl] = useState('');
  const [editGrade, setEditGrade] = useState<10 | 11 | 12>(12);
  const [editDesc, setEditDesc] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('lms_materials');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMaterials(parsed);
          }
        } catch (e) {
          console.error(e);
        }
      }
    }
  }, []);

  const saveMaterials = (updated: Material[]) => {
    setMaterials(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('lms_materials', JSON.stringify(updated));
    }
  };

  const handleAddMaterial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !fileUrl.trim()) return;

    const newMat: Material = {
      id: `mat-${Date.now()}`,
      teacher_id: '22222222-2222-2222-2222-222222222222',
      title: title.trim(),
      type,
      file_url: fileUrl.trim(),
      grade,
      description: desc.trim(),
      file_size: 1500000,
    };

    const updated = [newMat, ...materials];
    saveMaterials(updated);
    setShowModal(false);
    setTitle('');
    setFileUrl('');
    setDesc('');
  };

  const openEditModal = (mat: Material) => {
    setEditingMat(mat);
    setEditTitle(mat.title);
    setEditType(mat.type as any);
    setEditFileUrl(mat.file_url);
    setEditGrade((mat.grade as any) || 12);
    setEditDesc(mat.description || '');
    setShowEditModal(true);
  };

  const handleUpdateMaterial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMat || !editTitle.trim() || !editFileUrl.trim()) return;

    const updated = materials.map((m) => {
      if (m.id === editingMat.id) {
        return {
          ...m,
          title: editTitle.trim(),
          type: editType,
          file_url: editFileUrl.trim(),
          grade: editGrade,
          description: editDesc.trim(),
        };
      }
      return m;
    });

    saveMaterials(updated);
    setShowEditModal(false);
    setEditingMat(null);
  };

  const handleDeleteMaterial = (id: string, matTitle: string) => {
    const isConfirmed = confirm(`Thầy có chắc chắn muốn xóa tài liệu "${matTitle}" không?`);
    if (!isConfirmed) return;

    const updated = materials.filter((m) => m.id !== id);
    saveMaterials(updated);
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

  const filtered = materials.filter((m) => {
    if (filterType !== 'all' && m.type !== filterType) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        m.title.toLowerCase().includes(q) ||
        (m.description && m.description.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <FolderDown className="h-8 w-8 text-blue-600 shrink-0" />
            Học Liệu & Tài Liệu Toán THPT
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Kho tài liệu chuyên đề PDF, đề thi thử có giải chi tiết và tài nguyên học tập môn Toán THPT.
          </p>
        </div>

        {isTeacher && (
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-500/20 hover:bg-blue-500 transition self-start sm:self-auto"
          >
            <Plus className="h-4 w-4" />
            Đăng Tải Tài Liệu
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Type Filter */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {[
            { id: 'all', label: 'Tất cả' },
            { id: 'pdf', label: 'Tài liệu PDF' },
            { id: 'video', label: 'Video bài giảng' },
            { id: 'latex_doc', label: 'Mã nguồn LaTeX' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setFilterType(t.id)}
              className={`rounded-xl px-4 py-2 text-xs font-semibold transition ${
                filterType === t.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm kiếm tài liệu..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Materials Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((mat) => (
          <div
            key={mat.id}
            className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-6 shadow-xs hover:shadow-md transition hover:border-blue-200"
          >
            <div>
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-50 border border-slate-100">
                    {getTypeIcon(mat.type)}
                  </div>
                  <div>
                    <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase text-blue-700">
                      {mat.type}
                    </span>
                    <div className="text-[11px] text-slate-400 mt-0.5">Lớp {mat.grade || 12}</div>
                  </div>
                </div>

                {isTeacher && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditModal(mat)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition"
                      title="Sửa tài liệu"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteMaterial(mat.id, mat.title)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                      title="Xóa tài liệu"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
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
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Mô tả ngắn</label>
                <textarea
                  rows={2}
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="Ghi chú về nội dung tài liệu..."
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition shadow-sm"
                >
                  Lưu Tài Liệu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingMat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <h2 className="text-xl font-bold text-slate-900">Chỉnh Sửa Tài Liệu</h2>
            <p className="text-xs text-slate-500 mt-1">Cập nhật thông tin học liệu của Thầy Sơn.</p>

            <form onSubmit={handleUpdateMaterial} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tiêu đề tài liệu <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Tiêu đề tài liệu..."
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Loại file</label>
                  <select
                    value={editType}
                    onChange={(e) => setEditType(e.target.value as any)}
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
                    value={editGrade}
                    onChange={(e) => setEditGrade(Number(e.target.value) as any)}
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
                  Đường dẫn URL file <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editFileUrl}
                  onChange={(e) => setEditFileUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Mô tả ngắn</label>
                <textarea
                  rows={2}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  placeholder="Ghi chú về nội dung tài liệu..."
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingMat(null);
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
