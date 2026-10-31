'use client';

import React, { useState, useRef } from 'react';
import { Question } from '@/types/database';
import { parseExamLatex } from '@/lib/latex/examParser';
import {
  Upload,
  FileText,
  FileCode,
  Sparkles,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  ClipboardPaste,
} from 'lucide-react';

export interface SingleUnifiedInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyQuestions: (questions: Question[], detectedTitle?: string) => void;
}

export default function SingleUnifiedInputModal({
  isOpen,
  onClose,
  onApplyQuestions,
}: SingleUnifiedInputModalProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [fileMode, setPopoverFileMode] = useState<'thcs_thpt' | 'dinh_ky'>('thcs_thpt');
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelected = (file: File) => {
    setSelectedFile(file);
    setErrorMessage(null);
  };

  const handleProcess = async () => {
    setErrorMessage(null);

    // TH 1: Người dùng dán văn bản / mã TeX trực tiếp
    if (!selectedFile && pastedText.trim()) {
      setIsProcessing(true);
      setStatusMessage('Đang phân tích cú pháp LaTeX & trích xuất câu hỏi...');
      try {
        const parsed = parseExamLatex(pastedText);
        const questionsList = parsed?.questions || [];
        if (!questionsList || questionsList.length === 0) {
          throw new Error('Không tìm thấy câu hỏi hợp lệ trong nội dung đã dán. Vui lòng kiểm tra định dạng!');
        }
        onApplyQuestions(questionsList, parsed.metadata?.title);
        onClose();
      } catch (err: any) {
        setErrorMessage(err.message || 'Lỗi khi phân tích nội dung');
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    if (!selectedFile) {
      setErrorMessage('Vui lòng chọn 1 file (Word, LaTeX, PDF) hoặc dán văn bản đề thi vào ô bên dưới!');
      return;
    }

    setIsProcessing(true);
    const fileName = selectedFile.name.toLowerCase();

    try {
      // 1. FILE WORD (.DOCX)
      if (fileName.endsWith('.docx')) {
        setStatusMessage('Đang tải file Word và giải mã công thức MathType...');
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('fileMode', fileMode);

        const res = await fetch('/api/upload-docx', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Không thể bóc tách file Word');
        }

        if (!data.questions || data.questions.length === 0) {
          throw new Error('File Word không chứa câu hỏi nào nhận diện được.');
        }

        const examTitle = selectedFile.name.replace(/\.docx$/i, '').trim();
        onApplyQuestions(data.questions, examTitle);
        onClose();
        return;
      }

      // 2. FILE LATEX (.TEX HOẶC .TXT)
      if (fileName.endsWith('.tex') || fileName.endsWith('.txt')) {
        setStatusMessage('Đang đọc mã nguồn LaTeX và phân tích các môi trường bài tập...');
        const text = await selectedFile.text();
        const parsed = parseExamLatex(text);
        const questionsList = parsed?.questions || [];

        if (!questionsList || questionsList.length === 0) {
          throw new Error('Không bóc tách được câu hỏi nào từ file LaTeX. Vui lòng đảm bảo các câu theo cấu trúc chuẩn!');
        }

        const examTitle = parsed.metadata?.title || selectedFile.name.replace(/\.(tex|txt)$/i, '').trim();
        onApplyQuestions(questionsList, examTitle);
        onClose();
        return;
      }

      // 3. FILE PDF (.PDF)
      if (fileName.endsWith('.pdf')) {
        setStatusMessage('Đang truyền file PDF qua AI Multimodal Vision để nhận diện công thức & hình vẽ...');
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('grade', '12');

        const res = await fetch('/api/digitize-pdf', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Quá trình số hóa AI PDF gặp sự cố');
        }

        if (!data.questions || data.questions.length === 0) {
          throw new Error('AI không tìm thấy câu hỏi trắc nghiệm nào trong file PDF');
        }

        const examTitle = selectedFile.name.replace(/\.pdf$/i, '').trim();
        onApplyQuestions(data.questions, examTitle);
        onClose();
        return;
      }

      throw new Error('Định dạng file không được hỗ trợ. Vui lòng chọn file .docx, .tex, .txt hoặc .pdf!');
    } catch (err: any) {
      setErrorMessage(err.message || 'Xảy ra lỗi trong quá trình xử lý đề thi');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-white">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <span>Cổng Nạp Đề Thi Một Cửa</span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                  Tự động nhận diện
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Hỗ trợ file Word (.docx), Mã TeX (.tex), File PDF (.pdf) hoặc dán văn bản trực tiếp
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nội dung chính */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Cấu hình cấu trúc đề */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs">
            <span className="font-bold text-slate-700">Cấu trúc đề mục tiêu:</span>
            <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
              <button
                type="button"
                onClick={() => setPopoverFileMode('thcs_thpt')}
                className={`px-3 py-1 rounded-lg font-bold text-xs transition cursor-pointer ${
                  fileMode === 'thcs_thpt'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Chuẩn THPT 2025 (3 Phần)
              </button>
              <button
                type="button"
                onClick={() => setPopoverFileMode('dinh_ky')}
                className={`px-3 py-1 rounded-lg font-bold text-xs transition cursor-pointer ${
                  fileMode === 'dinh_ky'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Định kỳ / HSG (4 Phần)
              </button>
            </div>
          </div>

          {/* VÙNG KÉO THẢ DUY NHẤT (Single Dropzone) */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-3xl p-6 text-center cursor-pointer transition-all ${
              dragActive
                ? 'border-blue-500 bg-blue-50/70 scale-[0.99]'
                : selectedFile
                ? 'border-emerald-400 bg-emerald-50/40 hover:bg-emerald-50/70'
                : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50/80'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx,.tex,.txt,.pdf"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileSelected(e.target.files[0]);
                }
              }}
            />

            {selectedFile ? (
              <div className="flex flex-col items-center gap-2 animate-in zoom-in-95">
                <div className="h-12 w-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-xs">
                  <FileCheck className="h-6 w-6" />
                </div>
                <div className="text-center">
                  <p className="font-extrabold text-sm text-emerald-950 truncate max-w-md">
                    {selectedFile.name}
                  </p>
                  <p className="text-xs text-emerald-700 font-medium mt-0.5">
                    {(selectedFile.size / 1024).toFixed(1)} KB • Sẵn sàng xử lý
                  </p>
                </div>
                <span className="text-[11px] font-semibold text-blue-600 hover:underline mt-1">
                  Nhấp để chọn file khác
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="p-2.5 rounded-xl bg-blue-100 text-blue-700" title="File Word">
                    <FileText className="h-5 w-5" />
                  </span>
                  <span className="p-2.5 rounded-xl bg-purple-100 text-purple-700" title="File LaTeX TeX">
                    <FileCode className="h-5 w-5" />
                  </span>
                  <span className="p-2.5 rounded-xl bg-rose-100 text-rose-700" title="File PDF">
                    <Sparkles className="h-5 w-5" />
                  </span>
                </div>
                <div>
                  <p className="font-bold text-sm text-slate-800">
                    Kéo thả file đề thi vào đây, hoặc <span className="text-blue-600 underline">chọn từ máy</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Hỗ trợ file Word (.docx), mã nguồn TeX (.tex, .txt) và file PDF đề thi (.pdf)
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* DÁN NỘI DUNG VĂN BẢN TRỰC TIẾP */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-bold text-slate-700 flex items-center gap-1.5">
                <ClipboardPaste className="h-3.5 w-3.5 text-slate-500" />
                <span>Hoặc dán trực tiếp mã LaTeX / văn bản đề thi:</span>
              </label>
              {pastedText && (
                <button
                  type="button"
                  onClick={() => setPastedText('')}
                  className="text-slate-400 hover:text-slate-600 font-semibold"
                >
                  Xóa nội dung
                </button>
              )}
            </div>
            <textarea
              rows={4}
              value={pastedText}
              onChange={(e) => {
                setPastedText(e.target.value);
                if (e.target.value.trim()) setSelectedFile(null);
              }}
              placeholder="Ví dụ dán mã \begin{ex} Cho hàm số... \choice{A}{B}{C}{D} \loigiai{...} \end{ex}"
              className="w-full rounded-2xl border border-slate-200 p-3 text-xs font-mono text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 bg-slate-50/50 leading-relaxed resize-none"
            />
          </div>

          {/* Thông báo lỗi nếu có */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="leading-relaxed font-medium">{errorMessage}</div>
            </div>
          )}

          {/* Trạng thái xử lý */}
          {isProcessing && (
            <div className="p-4 rounded-2xl bg-blue-50/80 border border-blue-200 text-blue-800 text-xs flex items-center gap-3 animate-pulse">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600 shrink-0" />
              <span className="font-bold">{statusMessage || 'Đang xử lý dữ liệu đề thi...'}</span>
            </div>
          )}
        </div>

        {/* Footer Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200/70 transition cursor-pointer"
          >
            Hủy bỏ
          </button>

          <button
            type="button"
            onClick={handleProcess}
            disabled={isProcessing || (!selectedFile && !pastedText.trim())}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-extrabold shadow-md shadow-blue-500/20 hover:bg-blue-500 disabled:opacity-50 transition cursor-pointer active:scale-95"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Đang xử lý đề thi...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                <span>🚀 Nạp & Chuyển Sang Soạn Thảo 2 Trang</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
