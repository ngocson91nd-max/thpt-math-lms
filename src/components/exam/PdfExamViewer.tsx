'use client';

import React, { useState, useEffect } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  FileText,
  RotateCcw,
  Scissors,
} from 'lucide-react';

interface PdfExamViewerProps {
  pdfUrl: string;
  title?: string;
  className?: string;
  onTrimLastPage?: () => void;
  canTrim?: boolean;
}

export const PdfExamViewer: React.FC<PdfExamViewerProps> = ({
  pdfUrl,
  title = 'Đề thi PDF',
  className = '',
  onTrimLastPage,
  canTrim = false,
}) => {
  const [zoomLevel, setZoomLevel] = useState(100);
  const [blobUrl, setBlobUrl] = useState<string>('');

  useEffect(() => {
    if (!pdfUrl) {
      setBlobUrl('');
      return;
    }

    if (pdfUrl.startsWith('blob:') || pdfUrl.startsWith('http://') || pdfUrl.startsWith('https://')) {
      setBlobUrl(pdfUrl);
      return;
    }

    if (pdfUrl.startsWith('data:application/pdf;base64,') || pdfUrl.startsWith('data:')) {
      try {
        const base64Data = pdfUrl.includes(',') ? pdfUrl.split(',')[1] : pdfUrl;
        const binary = atob(base64Data);
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'application/pdf' });
        const objUrl = URL.createObjectURL(blob);
        setBlobUrl(objUrl);
        return () => {
          URL.revokeObjectURL(objUrl);
        };
      } catch (e) {
        console.error('Lỗi chuyển đổi dataUrl sang blobUrl:', e);
        setBlobUrl(pdfUrl);
      }
    } else {
      setBlobUrl(pdfUrl);
    }
  }, [pdfUrl]);

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + 25, 200));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(prev - 25, 50));
  };

  const handleResetZoom = () => {
    setZoomLevel(100);
  };

  if (!pdfUrl) {
    return (
      <div className={`flex flex-col items-center justify-center p-12 bg-slate-50 border-2 border-dashed border-slate-300 rounded-3xl text-center text-slate-500 ${className}`}>
        <FileText className="h-12 w-12 text-slate-400 mb-3" />
        <p className="font-bold text-sm text-slate-700">Chưa có file PDF đề thi</p>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">
          Vui lòng tải lên file đề thi PDF trong phần cấu hình hoặc mở tab Đề PDF.
        </p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full bg-slate-900 rounded-2xl overflow-hidden shadow-xl border border-slate-800 ${className}`}>
      {/* THANH ĐIỀU KHIỂN PDF (PDF Toolbar) */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-slate-950/90 text-white border-b border-slate-800 select-none">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="h-4 w-4 text-rose-500 shrink-0" />
          <span className="font-semibold text-xs truncate max-w-[200px] sm:max-w-xs text-slate-200">
            {title}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          {/* Nút cắt trang đáp án nếu có */}
          {canTrim && onTrimLastPage && (
            <button
              type="button"
              onClick={onTrimLastPage}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-600/90 hover:bg-amber-600 text-white font-semibold text-xs transition cursor-pointer"
              title="Tự động che bảng đáp án ở đáy trang cuối để học sinh không nhìn thấy (giữ trọn vẹn câu hỏi)"
            >
              <Scissors className="h-3.5 w-3.5" />
              <span>Che bảng đáp án</span>
            </button>
          )}

          {/* Zoom controls */}
          <div className="flex items-center rounded-lg bg-slate-800/80 p-0.5 border border-slate-700">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={zoomLevel <= 50}
              className="p-1 rounded hover:bg-slate-700 disabled:opacity-40 text-slate-300 hover:text-white transition cursor-pointer"
              title="Thu nhỏ (-25%)"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <span className="px-2 font-mono text-[11px] text-slate-300 font-bold min-w-[42px] text-center">
              {zoomLevel}%
            </span>
            <button
              type="button"
              onClick={handleZoomIn}
              disabled={zoomLevel >= 200}
              className="p-1 rounded hover:bg-slate-700 disabled:opacity-40 text-slate-300 hover:text-white transition cursor-pointer"
              title="Phóng to (+25%)"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleResetZoom}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer"
            title="Kích thước gốc (100%)"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* KHUNG HIỂN THỊ FILE PDF TRỰC TIẾP */}
      <div className="flex-1 w-full h-full bg-slate-800/80 overflow-auto flex justify-center p-1 sm:p-2 min-h-[620px]">
        {blobUrl ? (
          <div
            className="w-full h-full transition-all duration-150 origin-top flex justify-center min-h-[620px]"
            style={{
              transform: zoomLevel !== 100 ? `scale(${zoomLevel / 100})` : undefined,
              transformOrigin: 'top center',
              height: zoomLevel !== 100 ? `${(100 / zoomLevel) * 100}%` : '100%',
            }}
          >
            <iframe
              src={`${blobUrl}#toolbar=0&navpanes=0&view=FitH`}
              title={title}
              className="w-full h-full min-h-[620px] rounded-xl border border-slate-700 bg-white shadow-2xl"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-8 text-slate-300">
            <FileText className="h-10 w-10 text-slate-400 animate-pulse mb-2" />
            <span className="text-xs">Đang nạp file PDF...</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default PdfExamViewer;