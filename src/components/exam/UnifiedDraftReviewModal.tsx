'use client';

import React, { useState, useMemo } from 'react';
import { Question, QuestionType, QuestionDifficulty } from '@/types/database';
import MathRenderer from '@/components/math/MathRenderer';
import {
  CheckCircle2,
  AlertTriangle,
  FileCode,
  FileText,
  Sparkles,
  BookOpen,
  X,
  Check,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Trash2,
  Save,
  HelpCircle,
  Eye,
  Sliders,
  Filter,
} from 'lucide-react';

export interface UnifiedDraftReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceType: 'latex' | 'word' | 'pdf_ai' | 'pdf_quick';
  sourceName: string;
  initialQuestions: Question[];
  warnings?: string[];
  onApplyToExam: (questions: Question[]) => void;
  onSaveToBank?: (questions: Question[]) => void;
}

export default function UnifiedDraftReviewModal({
  isOpen,
  onClose,
  sourceType,
  sourceName,
  initialQuestions,
  warnings = [],
  onApplyToExam,
  onSaveToBank,
}: UnifiedDraftReviewModalProps) {
  const [questions, setQuestions] = useState<Question[]>(initialQuestions);
  const [activeIdx, setActiveIdx] = useState<number>(0);
  const [filterPart, setFilterPart] = useState<'all' | 1 | 2 | 3 | 4 | 'warning'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditingContent, setIsEditingContent] = useState(false);

  // Cập nhật khi initialQuestions thay đổi
  React.useEffect(() => {
    setQuestions(initialQuestions);
    setActiveIdx(0);
  }, [initialQuestions]);

  if (!isOpen) return null;

  // Thống kê câu hỏi
  const part1Count = questions.filter((q) => q.part === 1).length;
  const part2Count = questions.filter((q) => q.part === 2).length;
  const part3Count = questions.filter((q) => q.part === 3).length;
  const part4Count = questions.filter((q) => q.part === 4).length;

  const totalPoints = questions.reduce((sum, q) => sum + (q.points || 0), 0);

  // Kiểm tra cảnh báo cho từng câu
  const getQuestionWarning = (q: Question): string | null => {
    if (!q.content || q.content.trim().length === 0) return 'Nội dung đề bài đang trống';
    if (q.part === 1) {
      if (!q.options || q.options.length < 2) return 'Thiếu các phương án lựa chọn';
      if (!q.correct_answer) return 'Chưa chọn đáp án đúng';
    } else if (q.part === 2) {
      if (!q.options || q.options.length < 2) return 'Thiếu các mệnh đề a, b, c, d';
      if (!q.correct_answer || typeof q.correct_answer !== 'object') return 'Chưa cấu hình Đúng/Sai';
    } else if (q.part === 3) {
      if (!q.correct_answer) return 'Chưa có đáp số điền ngắn';
    }
    return null;
  };

  const questionsWithWarningsCount = questions.filter((q) => getQuestionWarning(q) !== null).length;

  // Lọc câu hỏi theo bộ lọc
  const filteredQuestions = questions.filter((q, idx) => {
    if (filterPart === 'warning') return getQuestionWarning(q) !== null;
    if (filterPart !== 'all' && q.part !== filterPart) return false;
    if (searchQuery.trim()) {
      const qText = `${idx + 1} ${q.content} ${q.explanation || ''}`.toLowerCase();
      return qText.includes(searchQuery.toLowerCase());
    }
    return true;
  });

  const currentQ = questions[activeIdx] || questions[0];

  // Xử lý đổi đáp án trắc nghiệm đơn (Phần I)
  const handleSelectSingleChoice = (choiceId: string) => {
    if (!currentQ) return;
    const updated = [...questions];
    updated[activeIdx] = {
      ...currentQ,
      correct_answer: choiceId,
    };
    setQuestions(updated);
  };

  // Xử lý toggle Đúng/Sai (Phần II)
  const handleToggleTrueFalse = (label: string, isTrue: boolean) => {
    if (!currentQ) return;
    const prevMap: Record<string, boolean> =
      typeof currentQ.correct_answer === 'object' && currentQ.correct_answer !== null
        ? { ...currentQ.correct_answer }
        : { a: false, b: false, c: false, d: false };

    prevMap[label.toLowerCase()] = isTrue;

    const updated = [...questions];
    updated[activeIdx] = {
      ...currentQ,
      correct_answer: prevMap,
    };
    setQuestions(updated);
  };

  // Xử lý đổi đáp số Phần III
  const handleChangeShortAns = (val: string) => {
    if (!currentQ) return;
    const updated = [...questions];
    const clean = val.trim();
    updated[activeIdx] = {
      ...currentQ,
      correct_answer: [clean, clean.replace(',', '.')],
    };
    setQuestions(updated);
  };

  // Xóa câu hỏi
  const handleDeleteCurrent = () => {
    if (questions.length <= 1) {
      alert('Đề thi phải có ít nhất 1 câu hỏi!');
      return;
    }
    const updated = questions.filter((_, i) => i !== activeIdx);
    setQuestions(updated);
    setActiveIdx(Math.max(0, activeIdx - 1));
  };

  // Di chuyển câu hỏi lên / xuống
  const handleMove = (direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? activeIdx - 1 : activeIdx + 1;
    if (targetIdx < 0 || targetIdx >= questions.length) return;

    const updated = [...questions];
    const temp = updated[activeIdx];
    updated[activeIdx] = updated[targetIdx];
    updated[targetIdx] = temp;
    setQuestions(updated);
    setActiveIdx(targetIdx);
  };

  const getSourceBadge = () => {
    switch (sourceType) {
      case 'latex':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
            <FileCode className="h-3.5 w-3.5" /> Nguồn LaTeX (ex_test)
          </span>
        );
      case 'word':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
            <FileText className="h-3.5 w-3.5" /> Nguồn Word (.docx)
          </span>
        );
      case 'pdf_ai':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
            <Sparkles className="h-3.5 w-3.5 text-rose-600 animate-pulse" /> Nguồn PDF Số hóa bằng AI Vision
          </span>
        );
      case 'pdf_quick':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <BookOpen className="h-3.5 w-3.5" /> Nguồn Đề PDF Thi Nhanh
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-3 sm:p-5">
      <div className="w-full max-w-7xl h-[92vh] max-h-[92vh] rounded-3xl bg-white shadow-2xl flex flex-col border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
        {/* 1. HEADER DUYỆT NHÁP */}
        <div className="px-6 py-3.5 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            {getSourceBadge()}
            <div className="truncate max-w-md">
              <h2 className="text-sm font-extrabold text-slate-900 truncate">
                Màn hình Duyệt Nháp: {sourceName || 'Đề thi nhập khẩu'}
              </h2>
              <p className="text-[11px] text-slate-500">
                Kiểm tra câu hỏi, công thức toán và đáp án trước khi lưu vào đề thi chính thức.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 text-xs font-semibold px-3 py-1 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-slate-600">Tổng cộng:</span>
              <strong className="text-indigo-600 font-extrabold">{questions.length} câu</strong>
              <span className="text-slate-300">|</span>
              <span className="text-slate-600">Tổng điểm:</span>
              <strong className="text-emerald-600 font-extrabold">{totalPoints.toFixed(2)}đ</strong>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
              title="Đóng màn hình duyệt nháp"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* 2. CHIP THỐNG KÊ & BỘ LỌC NHANH */}
        <div className="px-6 py-2.5 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setFilterPart('all')}
              className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                filterPart === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Tất cả ({questions.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterPart(1)}
              className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                filterPart === 1
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
              }`}
            >
              Phần I: TN 4 Lựa chọn ({part1Count})
            </button>
            <button
              type="button"
              onClick={() => setFilterPart(2)}
              className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                filterPart === 2
                  ? 'bg-purple-600 text-white'
                  : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
              }`}
            >
              Phần II: Đúng / Sai ({part2Count})
            </button>
            <button
              type="button"
              onClick={() => setFilterPart(3)}
              className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                filterPart === 3
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              }`}
            >
              Phần III: Điền số ({part3Count})
            </button>
            {part4Count > 0 && (
              <button
                type="button"
                onClick={() => setFilterPart(4)}
                className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                  filterPart === 4
                    ? 'bg-amber-600 text-white'
                    : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                }`}
              >
                Phần IV: Tự luận ({part4Count})
              </button>
            )}
            {questionsWithWarningsCount > 0 && (
              <button
                type="button"
                onClick={() => setFilterPart('warning')}
                className={`px-3 py-1 rounded-lg font-bold flex items-center gap-1 transition cursor-pointer ${
                  filterPart === 'warning'
                    ? 'bg-rose-600 text-white'
                    : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                }`}
              >
                <AlertTriangle className="h-3 w-3" />
                Cần kiểm tra ({questionsWithWarningsCount})
              </button>
            )}
          </div>

          <div className="w-56">
            <input
              type="text"
              placeholder="Tìm kiếm nội dung câu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>

        {/* 3. VÙNG NỘI DUNG 2 CỘT CHIA ĐÔI */}
        <div className="flex-1 flex overflow-hidden">
          {/* CỘT TRÁI: DANH SÁCH CÂU HỎI */}
          <div className="w-2/5 min-w-[340px] max-w-md border-r border-slate-200 bg-slate-50/50 flex flex-col h-full overflow-hidden">
            <div className="p-3 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider flex justify-between items-center bg-slate-100/60">
              <span>Danh Sách Câu Hỏi ({filteredQuestions.length})</span>
              <span className="text-[11px] font-normal normal-case text-slate-400">
                Click để xem và sửa
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {filteredQuestions.map((q) => {
                const realIdx = questions.indexOf(q);
                const isSelected = realIdx === activeIdx;
                const warning = getQuestionWarning(q);

                return (
                  <div
                    key={q.id || `q-${realIdx}`}
                    onClick={() => setActiveIdx(realIdx)}
                    className={`p-3 rounded-2xl border transition cursor-pointer select-none ${
                      isSelected
                        ? 'bg-white border-blue-500 shadow-md ring-2 ring-blue-500/10'
                        : 'bg-white/80 border-slate-200 hover:border-slate-300 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-xs text-slate-900">
                          Câu {realIdx + 1}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                            q.part === 1
                              ? 'bg-blue-100 text-blue-700'
                              : q.part === 2
                              ? 'bg-purple-100 text-purple-700'
                              : q.part === 3
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          Phần {q.part} ({q.points || 0.25}đ)
                        </span>
                      </div>

                      {warning ? (
                        <span
                          className="flex items-center gap-1 text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md"
                          title={warning}
                        >
                          <AlertTriangle className="h-3 w-3" /> Cảnh báo
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                          <CheckCircle2 className="h-3 w-3" /> Hợp lệ
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-600 line-clamp-2 font-serif">
                      {q.content.replace(/<[^>]+>/g, '').replace(/\\begin\{[^}]+\}[\s\S]*?\\end\{[^}]+\}/g, '[Hình vẽ/TikZ]')}
                    </p>

                    <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                      <span>
                        Đáp án:{' '}
                        <strong className="text-slate-800">
                          {q.part === 1
                            ? String(q.correct_answer || 'Chưa có')
                            : q.part === 2
                            ? 'Đúng/Sai (4 ý)'
                            : q.part === 3
                            ? Array.isArray(q.correct_answer)
                              ? q.correct_answer[0]
                              : String(q.correct_answer || 'Chưa có')
                            : 'Tự luận'}
                        </strong>
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* CỘT PHẢI: CHI TIẾT & XEM TRƯỚC THỜI GIAN THỰC */}
          <div className="flex-1 flex flex-col h-full bg-white overflow-hidden">
            {currentQ ? (
              <div className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Thanh điều khiển câu hỏi hiện tại */}
                <div className="px-6 py-3 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-slate-900">
                      Chi tiết Câu {activeIdx + 1} / {questions.length}
                    </span>
                    <span className="text-xs text-slate-500">({currentQ.type})</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleMove('up')}
                      disabled={activeIdx === 0}
                      className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                      title="Chuyển lên trên"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMove('down')}
                      disabled={activeIdx === questions.length - 1}
                      className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                      title="Chuyển xuống dưới"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteCurrent}
                      className="p-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 cursor-pointer"
                      title="Xóa câu này"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Nội dung xem trước và cấu hình câu hỏi */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {/* Cảnh báo nếu có */}
                  {getQuestionWarning(currentQ) && (
                    <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                      <span>
                        <strong>Cảnh báo:</strong> {getQuestionWarning(currentQ)}. Thầy/cô có thể chọn
                        hoặc nhập đáp án chính xác ngay tại bảng bên dưới.
                      </span>
                    </div>
                  )}

                  {/* 1. NỘI DUNG ĐỀ BÀI */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                        1. Nội dung đề bài (Hỗ trợ KaTeX, TikZ & Đồ thị):
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsEditingContent(!isEditingContent)}
                        className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
                      >
                        {isEditingContent ? 'Xem chế độ hiển thị' : 'Sửa mã nguồn'}
                      </button>
                    </div>

                    {isEditingContent ? (
                      <textarea
                        rows={6}
                        value={currentQ.content}
                        onChange={(e) => {
                          const updated = [...questions];
                          updated[activeIdx] = { ...currentQ, content: e.target.value };
                          setQuestions(updated);
                        }}
                        className="w-full font-mono text-xs rounded-2xl border border-slate-300 p-3 bg-slate-50 focus:bg-white"
                      />
                    ) : (
                      <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/40 text-sm leading-relaxed">
                        <MathRenderer content={currentQ.content} />
                      </div>
                    )}
                  </div>

                  {/* 2. CẤU HÌNH ĐÁP ÁN THEO TỪNG DẠNG CÂU HỎI */}
                  {currentQ.part === 1 && (
                    <div className="space-y-3">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                        <span>2. Các phương án lựa chọn (Click để chọn đáp án đúng):</span>
                        <span className="text-[11px] font-normal normal-case text-blue-600">
                          Đang chọn: <strong>{String(currentQ.correct_answer || 'Chưa có')}</strong>
                        </span>
                      </label>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {(currentQ.options || []).map((opt: any) => {
                          const isCorrect = currentQ.correct_answer === opt.id;
                          return (
                            <div
                              key={opt.id}
                              onClick={() => handleSelectSingleChoice(opt.id)}
                              className={`p-3 rounded-2xl border-2 transition cursor-pointer flex items-start gap-2.5 ${
                                isCorrect
                                  ? 'border-emerald-500 bg-emerald-50/50 shadow-2xs'
                                  : 'border-slate-200 bg-white hover:border-slate-300'
                              }`}
                            >
                              <div
                                className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-extrabold shrink-0 ${
                                  isCorrect
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {opt.id}
                              </div>
                              <div className="flex-1 min-w-0 text-xs pt-0.5 leading-relaxed">
                                <MathRenderer content={opt.text} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {currentQ.part === 2 && (
                    <div className="space-y-3">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                        2. Các mệnh đề Đúng / Sai (Click nút Đúng hoặc Sai của từng ý):
                      </label>

                      <div className="space-y-2">
                        {(currentQ.options || []).map((opt: any) => {
                          const label = opt.id.toLowerCase();
                          const correctMap: Record<string, boolean> =
                            typeof currentQ.correct_answer === 'object' && currentQ.correct_answer !== null
                              ? currentQ.correct_answer
                              : {};
                          const isTrue = correctMap[label] === true;
                          const isFalse = correctMap[label] === false;

                          return (
                            <div
                              key={opt.id}
                              className="p-3 rounded-2xl border border-slate-200 bg-white flex items-center justify-between gap-4"
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <span className="font-extrabold text-xs text-purple-700 uppercase shrink-0">
                                  Ý {opt.id})
                                </span>
                                <div className="text-xs min-w-0 flex-1">
                                  <MathRenderer content={opt.text} />
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleToggleTrueFalse(label, true)}
                                  className={`px-3 py-1 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                                    isTrue
                                      ? 'bg-emerald-600 text-white shadow-2xs'
                                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                  }`}
                                >
                                  ĐÚNG
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleToggleTrueFalse(label, false)}
                                  className={`px-3 py-1 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                                    isFalse
                                      ? 'bg-rose-600 text-white shadow-2xs'
                                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                  }`}
                                >
                                  SAI
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {currentQ.part === 3 && (
                    <div className="space-y-3">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                        2. Đáp số điền ngắn (Số nguyên hoặc số thập phân):
                      </label>
                      <div className="max-w-xs">
                        <input
                          type="text"
                          value={
                            Array.isArray(currentQ.correct_answer)
                              ? currentQ.correct_answer[0]
                              : String(currentQ.correct_answer || '')
                          }
                          onChange={(e) => handleChangeShortAns(e.target.value)}
                          placeholder="Nhập đáp số (VD: 1440 hoặc -2.5)"
                          className="w-full font-mono text-sm font-bold text-emerald-800 px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        />
                      </div>
                    </div>
                  )}

                  {/* 3. LỜI GIẢI CHI TIẾT */}
                  {currentQ.explanation && (
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                        3. Lời giải chi tiết:
                      </label>
                      <div className="p-4 rounded-2xl border border-blue-200/80 bg-blue-50/30 text-xs leading-relaxed">
                        <MathRenderer content={currentQ.explanation} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-400 text-xs">
                Vui lòng chọn một câu hỏi ở danh sách bên trái.
              </div>
            )}
          </div>
        </div>

        {/* 4. FOOTER HÀNH ĐỘNG DUYỆT BÀI */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            Quay lại / Chọn file khác
          </button>

          <div className="flex items-center gap-3">
            {onSaveToBank && (
              <button
                type="button"
                onClick={() => onSaveToBank(questions)}
                className="px-4 py-2.5 rounded-xl border border-purple-300 bg-purple-50 text-xs font-bold text-purple-700 hover:bg-purple-100 transition flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="h-4 w-4" />
                Lưu vào Ngân hàng câu hỏi
              </button>
            )}

            <button
              type="button"
              onClick={() => onApplyToExam(questions)}
              className="px-6 py-2.5 rounded-xl bg-blue-600 text-xs font-bold text-white shadow-md hover:bg-blue-500 transition flex items-center gap-2 cursor-pointer"
            >
              <Check className="h-4 w-4" />
              Áp dụng toàn bộ ({questions.length} câu) vào Đề thi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
