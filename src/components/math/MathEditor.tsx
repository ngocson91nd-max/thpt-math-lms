'use client';

import React, { useState } from 'react';
import MathRenderer from './MathRenderer';
import { THPT_MATH_SYMBOLS } from '@/lib/math/katexRenderer';
import { Eye, Code, Sparkles } from 'lucide-react';

interface MathEditorProps {
  value: string;
  onChange: (val: string) => void;
  label?: string;
  placeholder?: string;
  rows?: number;
  showAiHelper?: boolean;
  onAiHelpClick?: () => void;
}

export const MathEditor: React.FC<MathEditorProps> = ({
  value,
  onChange,
  label,
  placeholder = 'Nhập nội dung câu hỏi hoặc công thức Toán học...',
  rows = 4,
  showAiHelper = false,
  onAiHelpClick,
}) => {
  const [activeTab, setActiveTab] = useState<'edit' | 'preview' | 'split'>('split');

  const insertSymbol = (latex: string) => {
    // Tabular là môi trường bảng văn bản, không bọc $; các môi trường toán khác bọc $$ hoặc $
    const formatted = latex.startsWith('\\begin{tabular}')
      ? `\n${latex}\n`
      : latex.startsWith('\\begin')
      ? `$$\n${latex}\n$$`
      : `$${latex}$`;
    onChange(value ? `${value} ${formatted}` : formatted);
  };

  return (
    <div className="w-full rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden transition-all focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
      {/* Thanh tiêu đề & Công cụ điều khiển */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-100 bg-slate-50/80 px-4 py-2.5">
        <div className="flex items-center gap-2">
          {label && <span className="font-semibold text-sm text-slate-700">{label}</span>}
          <div className="flex items-center rounded-lg bg-slate-200/60 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('edit')}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 font-medium transition ${
                activeTab === 'edit'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Code className="h-3.5 w-3.5" />
              Soạn thảo
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('split')}
              className={`hidden sm:flex items-center gap-1 rounded-md px-2.5 py-1 font-medium transition ${
                activeTab === 'split'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Xem song song
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 font-medium transition ${
                activeTab === 'preview'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Eye className="h-3.5 w-3.5" />
              Xem trước
            </button>
          </div>
        </div>

        {showAiHelper && onAiHelpClick && (
          <button
            type="button"
            onClick={onAiHelpClick}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-100 transition"
          >
            <Sparkles className="h-3.5 w-3.5" />
            AI Gợi ý Toán
          </button>
        )}
      </div>

      {/* Thanh phím tắt công thức Toán THPT */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-100 bg-white px-3 py-1.5 scrollbar-thin">
        <span className="shrink-0 text-[11px] font-semibold text-slate-400 mr-1 uppercase tracking-wider">
          Chèn nhanh:
        </span>
        {THPT_MATH_SYMBOLS.map((sym, i) => (
          <button
            key={i}
            type="button"
            title={`${sym.label} (${sym.latex})`}
            onClick={() => insertSymbol(sym.latex)}
            className="shrink-0 rounded px-2 py-1 text-xs font-mono text-slate-700 hover:bg-blue-50 hover:text-blue-600 border border-transparent hover:border-blue-200 transition"
          >
            {sym.preview}
          </button>
        ))}
      </div>

      {/* Khung nội dung soạn thảo và hiển thị */}
      <div className={`p-3 ${activeTab === 'split' ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : ''}`}>
        {(activeTab === 'edit' || activeTab === 'split') && (
          <div className="flex flex-col">
            <textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              rows={rows}
              placeholder={placeholder}
              className="w-full resize-y rounded-lg border border-slate-200 p-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 font-sans"
            />
            <span className="mt-1 text-[11px] text-slate-400">
              Gõ công thức giữa <code>$f(x)$</code> cho cùng dòng và <code>$$...$$</code> cho khối riêng.
            </span>
          </div>
        )}

        {(activeTab === 'preview' || activeTab === 'split') && (
          <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-4 min-h-[100px] overflow-y-auto">
            <div className="text-xs font-semibold uppercase text-slate-400 mb-2">Xem trước KaTeX:</div>
            {value ? (
              <MathRenderer content={value} />
            ) : (
              <div className="text-xs italic text-slate-400">Chưa có nội dung để xem trước...</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MathEditor;
