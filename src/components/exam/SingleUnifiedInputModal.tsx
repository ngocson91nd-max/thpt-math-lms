'use client';

import React, { useState, useRef } from 'react';
import { Question } from '@/types/database';
import { parseExamLatex } from '@/lib/latex/examParser';
import { loadExamAssets } from '@/lib/exam/assetRegistry';
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

async function safeParseJsonResponse(res: Response): Promise<any> {
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  if (!res.ok || (data && data.success === false)) {
    throw new Error(data?.error || `HTTP ${res.status}: Thao tác không thành công`);
  }
  return data;
}

function loadBrowserPdfJs(): Promise<any> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if ((window as any).pdfjsLib) return Promise.resolve((window as any).pdfjsLib);

  return new Promise((resolve) => {
    const existing = document.getElementById('pdfjs-cdn-script') as HTMLScriptElement | null;
    if (existing) {
      if ((window as any).pdfjsLib) return resolve((window as any).pdfjsLib);
      existing.addEventListener('load', () => resolve((window as any).pdfjsLib));
      existing.addEventListener('error', () => resolve(null));
      return;
    }

    const script = document.createElement('script');
    script.id = 'pdfjs-cdn-script';
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.async = true;
    script.onload = () => {
      const lib = (window as any).pdfjsLib;
      if (lib) {
        lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve(lib);
      } else {
        resolve(null);
      }
    };
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
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
  const [progressPercent, setProgressPercent] = useState(0);
  const [pageProgressText, setPageProgressText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  if (!isOpen) return null;

  const handleCancelProcess = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsProcessing(false);
    setStatusMessage('');
    setProgressPercent(0);
    setPageProgressText('');
  };

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

        const data = await safeParseJsonResponse(res);
        if (data.assets && Array.isArray(data.assets)) {
          loadExamAssets(data.assets);
          try {
            sessionStorage.setItem('exam_assets', JSON.stringify(data.assets));
          } catch {}
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

      // 3. FILE PDF (.PDF) - SỐ HÓA TỪNG TRANG VỚI PDF.JS & CONCURRENCY
      if (fileName.endsWith('.pdf')) {
        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        setStatusMessage('Đang khởi tạo bộ phân tích PDF đa trang...');
        setProgressPercent(5);
        setPageProgressText('Chuẩn bị nạp trang...');

        const arrayBuffer = await selectedFile.arrayBuffer();

        // Nạp pdfjs-dist động an toàn cho trình duyệt qua CDN
        const pdfjsLib = await loadBrowserPdfJs();

        let allQuestions: Question[] = [];
        const erroredPages: number[] = [];

        if (pdfjsLib && typeof window !== 'undefined') {
          const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
          const pdf = await loadingTask.promise;
          const totalPages = pdf.numPages;

          let completedCount = 0;

          // Render từng trang ra JPEG canvas ở độ nét cao (scale 1.8 ~ 170 DPI)
          const renderPageToJpeg = async (pageNumber: number): Promise<string> => {
            const page = await pdf.getPage(pageNumber);
            const viewport = page.getViewport({ scale: 1.8 });
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Canvas 2D context không khả dụng');
            await page.render({ canvasContext: ctx, viewport }).promise;
            return canvas.toDataURL('image/jpeg', 0.85);
          };

          // Gọi API cho 1 trang, thử lại tối đa 2 lần, timeout 25s
          const processPage = async (pageNumber: number): Promise<Question[]> => {
            let lastErr: any = null;
            for (let attempt = 1; attempt <= 3; attempt++) {
              if (abortController.signal.aborted) throw new Error('Đã hủy quá trình số hóa.');

              try {
                const jpegBase64 = await renderPageToJpeg(pageNumber);

                const timeoutCtrl = new AbortController();
                const timeoutId = setTimeout(() => timeoutCtrl.abort(), 25000);
                const onAbort = () => timeoutCtrl.abort();
                abortController.signal.addEventListener('abort', onAbort);

                let res: Response;
                try {
                  res = await fetch('/api/digitize-page', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      imageBase64: jpegBase64,
                      pageIndex: pageNumber,
                      mimeType: 'image/jpeg',
                    }),
                    signal: timeoutCtrl.signal,
                  });
                } finally {
                  clearTimeout(timeoutId);
                  abortController.signal.removeEventListener('abort', onAbort);
                }

                const data = await safeParseJsonResponse(res);
                if (data.questions && Array.isArray(data.questions)) {
                  return data.questions;
                }
                return [];
              } catch (err: any) {
                lastErr = err;
                if (abortController.signal.aborted) throw err;
                if (attempt < 3) {
                  await new Promise((r) => setTimeout(r, 1000));
                }
              }
            }
            console.warn(`Trang ${pageNumber} bị lỗi sau 2 lần thử lại:`, lastErr);
            erroredPages.push(pageNumber);
            return [];
          };

          // Chạy song song tối đa 3 trang một lúc
          const pageList = Array.from({ length: totalPages }, (_, i) => i + 1);
          const executingPool: Promise<any>[] = [];

          for (const pageNumber of pageList) {
            if (abortController.signal.aborted) break;

            const task = (async () => {
              try {
                const qs = await processPage(pageNumber);
                allQuestions.push(...qs);
              } finally {
                completedCount++;
                const pct = Math.round((completedCount / totalPages) * 100);
                setProgressPercent(pct);
                setPageProgressText(`Trang ${completedCount}/${totalPages} (${pct}%)`);
                setStatusMessage(`Đang số hóa AI: Trang ${completedCount}/${totalPages}`);
              }
            })();

            executingPool.push(task);

            if (executingPool.length >= 3) {
              await Promise.race(executingPool);
              for (let i = executingPool.length - 1; i >= 0; i--) {
                const status = await Promise.race([executingPool[i], Promise.resolve('pending')]);
                if (status !== 'pending') {
                  executingPool.splice(i, 1);
                }
              }
            }
          }

          await Promise.all(executingPool);
        } else {
          // Fallback một cổng nếu không render được canvas
          setStatusMessage('Đang truyền file PDF qua AI Multimodal Vision...');
          const formData = new FormData();
          formData.append('file', selectedFile);
          formData.append('grade', '12');

          const res = await fetch('/api/digitize-pdf', {
            method: 'POST',
            body: formData,
            signal: abortController.signal,
          });

          const data = await safeParseJsonResponse(res);
          allQuestions = data.questions || [];
        }

        if (allQuestions.length === 0) {
          throw new Error('AI không tìm thấy câu hỏi trắc nghiệm nào trong file PDF này.');
        }

        const examTitle = selectedFile.name.replace(/\.pdf$/i, '').trim();
        onApplyQuestions(allQuestions, examTitle);
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
            <div className="p-4 rounded-2xl bg-blue-50/90 border border-blue-200 text-blue-900 text-xs space-y-2.5 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 font-bold">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600 shrink-0" />
                  <span>{statusMessage || 'Đang xử lý dữ liệu đề thi...'}</span>
                </div>
                {pageProgressText && (
                  <span className="font-extrabold text-blue-700 bg-blue-100/80 px-2.5 py-0.5 rounded-full text-[11px]">
                    {pageProgressText}
                  </span>
                )}
              </div>

              {progressPercent > 0 && (
                <div className="w-full bg-blue-100/70 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-600 h-full rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              )}

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={handleCancelProcess}
                  className="px-2.5 py-1 text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-100/70 rounded-lg transition cursor-pointer"
                >
                  ✕ Dừng / Hủy tiến trình
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50">
          <button
            type="button"
            onClick={isProcessing ? handleCancelProcess : onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200/70 transition cursor-pointer"
          >
            {isProcessing ? 'Dừng lại' : 'Hủy bỏ'}
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
                <span>Đang xử lý ({progressPercent}%)...</span>
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
