'use client';

import React, { useState, useEffect, use, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import MathRenderer from '@/components/math/MathRenderer';
import { loadExamAssets } from '@/lib/exam/assetRegistry';
import { Exam, Question } from '@/types/database';
import { MOCK_EXAMS } from '@/lib/supabase/mockStore';
import {
  ArrowLeft,
  Sparkles,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Shuffle,
  RefreshCw,
  ArrowRight,
  BookOpen,
  Award,
  Lightbulb,
  Check,
  Flame,
  Bookmark,
  Share2,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  ListOrdered,
  AlertCircle,
  Zap,
} from 'lucide-react';

interface QuestionState {
  userAnswer: string | null;
  isCorrect: boolean | null;
  isChecked: boolean;
  isFlagged: boolean;
  variantCount: number;
}

export default function ExamPracticePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();

  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Trạng thái từng câu hỏi
  const [questionStates, setQuestionStates] = useState<Record<string, QuestionState>>({});

  // Cấu hình trộn đề & đáp án
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [shuffleOptions, setShuffleOptions] = useState(false);

  // Bộ lọc câu hỏi: 'all' | 'wrong' | 'flagged'
  const [filterMode, setFilterMode] = useState<'all' | 'wrong' | 'flagged'>('all');

  // Đang gọi AI sinh bài tương tự
  const [isGeneratingSimilar, setIsGeneratingSimilar] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modal tổng kết
  const [showSummaryModal, setShowSummaryModal] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Nạp toàn bộ tài nguyên đồ họa (đồ thị, hình vẽ, SVG MathType) của đề thi vào Registry
  useEffect(() => {
    if (exam?.assets && Array.isArray(exam.assets) && exam.assets.length > 0) {
      loadExamAssets(exam.assets);
    } else if (exam?.id && typeof window !== 'undefined') {
      try {
        const cachedExamAssets = localStorage.getItem(`exam_assets_${exam.id}`);
        if (cachedExamAssets) {
          const list = JSON.parse(cachedExamAssets);
          if (Array.isArray(list)) loadExamAssets(list);
        }
      } catch {}
    }
  }, [exam]);

  // 1. Tải đề thi
  useEffect(() => {
    const loadExam = async () => {
      try {
        let loadedExam: Exam | null = null;

        // A. Thử nạp từ cache cục bộ
        if (typeof window !== 'undefined') {
          const cached = localStorage.getItem('lms_exams');
          if (cached) {
            try {
              const list = JSON.parse(cached);
              const found = list.find(
                (e: any) =>
                  e.id === resolvedParams.id ||
                  e.code === resolvedParams.id ||
                  e.id?.toLowerCase() === resolvedParams.id?.toLowerCase()
              );
              if (found && Array.isArray(found.questions) && found.questions.length > 0) {
                loadedExam = found;
              }
            } catch {}
          }
        }

        // B. Nạp từ Cloud API
        if (!loadedExam) {
          const res = await fetch(`/api/exams?id=${encodeURIComponent(resolvedParams.id)}`);
          const data = await res.json();
          if (data.success && data.exam && Array.isArray(data.exam.questions) && data.exam.questions.length > 0) {
            loadedExam = data.exam;
          }
        }

        // C. Fallback: Full list
        if (!loadedExam) {
          const res2 = await fetch('/api/exams?full=true');
          const data2 = await res2.json();
          if (data2.success && Array.isArray(data2.exams)) {
            const found = data2.exams.find(
              (e: any) =>
                e.id === resolvedParams.id ||
                e.code === resolvedParams.id ||
                e.id?.toLowerCase() === resolvedParams.id?.toLowerCase()
            );
            if (found && Array.isArray(found.questions) && found.questions.length > 0) {
              loadedExam = found;
            }
          }
        }

        // D. Fallback MOCK_EXAMS
        if (!loadedExam) {
          const mock = MOCK_EXAMS.find((e) => e.id === resolvedParams.id || e.code === resolvedParams.id);
          if (mock) loadedExam = mock;
        }

        if (loadedExam) {
          setExam(loadedExam);
          const rawQ = loadedExam.questions || [];
          setQuestions(rawQ);

          // Khởi tạo trạng thái
          const initialStates: Record<string, QuestionState> = {};
          rawQ.forEach((q) => {
            initialStates[q.id] = {
              userAnswer: null,
              isCorrect: null,
              isChecked: false,
              isFlagged: false,
              variantCount: 0,
            };
          });
          setQuestionStates(initialStates);
        }
      } catch (err) {
        console.error('Lỗi nạp đề thi luyện tập:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadExam();
  }, [resolvedParams.id]);

  // Danh sách câu hỏi hiển thị sau bộ lọc
  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      const state = questionStates[q.id];
      if (filterMode === 'wrong') return state?.isCorrect === false;
      if (filterMode === 'flagged') return state?.isFlagged === true;
      return true;
    });
  }, [questions, questionStates, filterMode]);

  const currentQuestion: Question | undefined = filteredQuestions[currentIndex] || questions[currentIndex];
  const currentState: QuestionState = currentQuestion
    ? questionStates[currentQuestion.id] || {
        userAnswer: null,
        isCorrect: null,
        isChecked: false,
        isFlagged: false,
        variantCount: 0,
      }
    : {
        userAnswer: null,
        isCorrect: null,
        isChecked: false,
        isFlagged: false,
        variantCount: 0,
      };

  // Thống kê nhanh
  const stats = useMemo(() => {
    let correct = 0;
    let wrong = 0;
    let unchecked = 0;
    questions.forEach((q) => {
      const st = questionStates[q.id];
      if (st?.isChecked) {
        if (st.isCorrect) correct++;
        else wrong++;
      } else {
        unchecked++;
      }
    });
    return { correct, wrong, unchecked, total: questions.length };
  }, [questions, questionStates]);

  // Chọn phương án
  const handleSelectOption = (optId: string) => {
    if (!currentQuestion || currentState.isChecked) return;
    setQuestionStates((prev) => ({
      ...prev,
      [currentQuestion.id]: {
        ...prev[currentQuestion.id],
        userAnswer: optId,
      },
    }));
  };

  // Bấm nút "Kiểm tra đáp án"
  const handleCheckAnswer = () => {
    if (!currentQuestion || !currentState.userAnswer) return;

    const isRight =
      currentState.userAnswer.trim().toUpperCase() ===
      (currentQuestion.correct_answer || 'A').trim().toUpperCase();

    setQuestionStates((prev) => ({
      ...prev,
      [currentQuestion.id]: {
        ...prev[currentQuestion.id],
        isCorrect: isRight,
        isChecked: true,
      },
    }));

    if (isRight) {
      showToast('🎉 Chính xác! Bạn giải rất chuẩn.');
    } else {
      showToast('❌ Chưa chính xác. Xem phân tích lời giải chi tiết bên dưới nhé!');
    }
  };

  // Làm lại câu hiện tại
  const handleResetCurrentQuestion = () => {
    if (!currentQuestion) return;
    setQuestionStates((prev) => ({
      ...prev,
      [currentQuestion.id]: {
        ...prev[currentQuestion.id],
        userAnswer: null,
        isCorrect: null,
        isChecked: false,
      },
    }));
  };

  // Bấm nút "🎯 Làm bài tương tự (AI đổi số)"
  const handleGenerateSimilarQuestion = async () => {
    if (!currentQuestion) return;
    setIsGeneratingSimilar(true);

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_similar_question',
          questionContent: currentQuestion.content,
          options: currentQuestion.options,
          correctAnswer: currentQuestion.correct_answer,
          explanation: currentQuestion.explanation,
          topic: currentQuestion.topic,
          grade: currentQuestion.grade || 12,
        }),
      });

      const data = await res.json();
      if (data.success && data.similarQuestion) {
        const sq = data.similarQuestion;
        const newVariantCount = (currentState.variantCount || 0) + 1;

        // Cập nhật câu hỏi hiện tại với bộ số liệu mới
        const updatedQuestion: Question = {
          ...currentQuestion,
          content: sq.content,
          options: sq.options || currentQuestion.options,
          correct_answer: sq.correct_answer || 'A',
          explanation: sq.explanation || currentQuestion.explanation,
        };

        // Thay thế câu hỏi trong mảng questions
        setQuestions((prev) =>
          prev.map((q) => (q.id === currentQuestion.id ? updatedQuestion : q))
        );

        // Reset trạng thái câu hỏi để học sinh giải mới hoàn toàn
        setQuestionStates((prev) => ({
          ...prev,
          [currentQuestion.id]: {
            userAnswer: null,
            isCorrect: null,
            isChecked: false,
            isFlagged: prev[currentQuestion.id]?.isFlagged || false,
            variantCount: newVariantCount,
          },
        }));

        showToast(`✨ Đã sinh bài toán mới (Phiên bản đổi số #${newVariantCount})! Hãy thử sức nhé.`);
      } else {
        showToast('⚠️ Không thể tạo bài tương tự lúc này. Hãy thử lại sau!');
      }
    } catch (err) {
      console.error('Lỗi sinh bài tương tự:', err);
      showToast('⚠️ Có lỗi xảy ra khi gọi AI sinh đề.');
    } finally {
      setIsGeneratingSimilar(false);
    }
  };

  // Cắm cờ / Bỏ cắm cờ
  const toggleFlag = (qId: string) => {
    setQuestionStates((prev) => ({
      ...prev,
      [qId]: {
        ...prev[qId],
        isFlagged: !prev[qId]?.isFlagged,
      },
    }));
  };

  // Điều hướng câu tiếp theo / câu trước
  const handleNext = () => {
    if (currentIndex < filteredQuestions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setShowSummaryModal(true);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  // Đảo ngẫu nhiên thứ tự câu hỏi
  const handleToggleShuffleQuestions = () => {
    const nextVal = !shuffleQuestions;
    setShuffleQuestions(nextVal);
    if (nextVal) {
      const shuffled = [...questions].sort(() => Math.random() - 0.5);
      setQuestions(shuffled);
      setCurrentIndex(0);
      showToast('🔀 Đã đảo ngẫu nhiên thứ tự các câu hỏi!');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-3 border-blue-600 border-t-transparent" />
          <p className="text-xs font-bold text-slate-600">Đang khởi tạo Phòng Luyện Tập Thông Minh...</p>
        </div>
      </div>
    );
  }

  if (!exam || questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full rounded-3xl bg-white p-8 text-center space-y-4 border border-slate-200 shadow-xl">
          <AlertCircle className="h-12 w-12 text-rose-500 mx-auto" />
          <h2 className="text-lg font-bold text-slate-800">Không tìm thấy câu hỏi luyện tập</h2>
          <p className="text-xs text-slate-500">Đề thi này chưa có câu hỏi trắc nghiệm hoặc đang được cập nhật.</p>
          <Link
            href="/exams"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-500 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Về danh sách đề thi</span>
          </Link>
        </div>
      </div>
    );
  }

  // Danh sách đáp án của câu hiện tại (có hỗ trợ đảo ngẫu nhiên A, B, C, D nếu bật)
  const displayOptions = currentQuestion?.options || [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-blue-50/20 text-slate-900 pb-16">
      {/* Toast thông báo */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-2xl bg-slate-900/90 text-white px-5 py-2.5 text-xs font-bold shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-4">
          <Sparkles className="h-4 w-4 text-amber-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. THANH ĐIỀU HƯỚNG TRÊN CÙNG */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/exams"
              className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition"
              title="Quay lại danh sách đề thi"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 text-amber-700 border border-amber-500/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider">
                  <Zap className="h-3 w-3 fill-amber-500 text-amber-500" />
                  Luyện tập tương tác
                </span>
                <span className="text-xs font-bold text-slate-700 truncate max-w-[200px] sm:max-w-xs">
                  {exam.title}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 hidden sm:block">
                Học sâu nhớ lâu • Kiểm tra đúng/sai tức thì • AI đổi số liệu
              </p>
            </div>
          </div>

          {/* Thống kê nhanh */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold">
              <span className="text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {stats.correct}
              </span>
              <span className="text-slate-300">|</span>
              <span className="text-rose-500 flex items-center gap-1">
                <XCircle className="h-3.5 w-3.5" />
                {stats.wrong}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShowSummaryModal(true)}
              className="rounded-xl bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-1.5 text-xs font-bold shadow-sm transition cursor-pointer"
            >
              Tổng kết
            </button>
          </div>
        </div>

        {/* Thanh tiến độ */}
        <div className="w-full bg-slate-100 h-1">
          <div
            className="bg-blue-600 h-1 transition-all duration-300"
            style={{
              width: `${((currentIndex + 1) / filteredQuestions.length) * 100}%`,
            }}
          />
        </div>
      </header>

      {/* 2. KHUNG NỘI DUNG CHÍNH */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Thanh công cụ phụ: Bộ lọc & Nút trộn đề */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
            <button
              type="button"
              onClick={() => {
                setFilterMode('all');
                setCurrentIndex(0);
              }}
              className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                filterMode === 'all' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Tất cả ({questions.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setFilterMode('wrong');
                setCurrentIndex(0);
              }}
              className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer flex items-center gap-1 ${
                filterMode === 'wrong'
                  ? 'bg-rose-600 text-white'
                  : 'text-rose-600 hover:bg-rose-50'
              }`}
            >
              <XCircle className="h-3 w-3" />
              Câu làm sai ({stats.wrong})
            </button>
            <button
              type="button"
              onClick={() => {
                setFilterMode('flagged');
                setCurrentIndex(0);
              }}
              className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer flex items-center gap-1 ${
                filterMode === 'flagged'
                  ? 'bg-amber-600 text-white'
                  : 'text-amber-700 hover:bg-amber-50'
              }`}
            >
              <Bookmark className="h-3 w-3" />
              Đã cắm cờ
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleShuffleQuestions}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                shuffleQuestions
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
              title="Đảo ngẫu nhiên thứ tự các câu"
            >
              <Shuffle className="h-3.5 w-3.5" />
              <span>Đảo câu hỏi</span>
            </button>
          </div>
        </div>

        {/* THẺ BÀI TẬP TƯƠNG TÁC (FLASHCARD CARD) */}
        {currentQuestion && (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6 transition">
            {/* Header Thẻ: Số câu, Topic, Cắm cờ */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white font-black text-sm">
                  {currentIndex + 1}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">
                      Câu {currentIndex + 1} / {filteredQuestions.length}
                    </span>
                    {currentQuestion.topic && (
                      <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                        {currentQuestion.topic}
                      </span>
                    )}
                    {currentState.variantCount > 0 && (
                      <span className="text-[10px] font-black bg-gradient-to-r from-purple-500 to-indigo-500 text-white px-2 py-0.5 rounded-md shadow-2xs">
                        🎯 Phiên bản đổi số #{currentState.variantCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleFlag(currentQuestion.id)}
                  className={`p-2 rounded-xl border transition cursor-pointer ${
                    currentState.isFlagged
                      ? 'bg-amber-50 border-amber-300 text-amber-600'
                      : 'border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                  }`}
                  title={currentState.isFlagged ? 'Bỏ cắm cờ' : 'Cắm cờ lưu ý câu này'}
                >
                  <Bookmark className={`h-4 w-4 ${currentState.isFlagged ? 'fill-amber-500' : ''}`} />
                </button>
              </div>
            </div>

            {/* Nội dung đề bài */}
            <div className="text-sm sm:text-base text-slate-900 leading-relaxed font-medium">
              <MathRenderer content={currentQuestion.content} />
            </div>

            {/* Danh sách các phương án A, B, C, D */}
            <div className="grid grid-cols-1 gap-3 pt-2">
              {displayOptions.map((opt: any) => {
                const isSelected = currentState.userAnswer === opt.id;
                const isCorrectOpt =
                  (currentQuestion.correct_answer || 'A').trim().toUpperCase() === opt.id.toUpperCase();

                // Style tính toán dựa trên trạng thái đã bấm "Kiểm tra" hay chưa
                let optStyle =
                  'border-slate-200 hover:border-blue-300 hover:bg-blue-50/30 bg-white text-slate-800';

                if (currentState.isChecked) {
                  if (isSelected && currentState.isCorrect) {
                    // Chọn đúng
                    optStyle =
                      'border-emerald-500 bg-emerald-50/80 text-emerald-950 ring-2 ring-emerald-500/20 font-bold';
                  } else if (isSelected && !currentState.isCorrect) {
                    // Chọn sai
                    optStyle =
                      'border-rose-500 bg-rose-50/80 text-rose-950 ring-2 ring-rose-500/20 font-bold';
                  } else if (isCorrectOpt) {
                    // Phương án đúng được làm nổi bật khi học sinh chọn sai
                    optStyle =
                      'border-emerald-500 bg-emerald-50/40 text-emerald-950 font-bold border-dashed';
                  } else {
                    optStyle = 'border-slate-100 bg-slate-50/40 text-slate-400 opacity-60';
                  }
                } else if (isSelected) {
                  optStyle = 'border-blue-600 bg-blue-50/80 ring-2 ring-blue-500/20 text-blue-950 font-bold';
                }

                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={currentState.isChecked}
                    onClick={() => handleSelectOption(opt.id)}
                    className={`w-full text-left flex items-start gap-3.5 p-4 rounded-2xl border transition-all cursor-pointer ${optStyle}`}
                  >
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-xl text-xs font-black shrink-0 transition ${
                        currentState.isChecked && isCorrectOpt
                          ? 'bg-emerald-600 text-white'
                          : currentState.isChecked && isSelected && !currentState.isCorrect
                          ? 'bg-rose-600 text-white'
                          : isSelected
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {currentState.isChecked && isCorrectOpt ? (
                        <Check className="h-4 w-4 stroke-[3]" />
                      ) : currentState.isChecked && isSelected && !currentState.isCorrect ? (
                        <XCircle className="h-4 w-4" />
                      ) : (
                        opt.id
                      )}
                    </span>
                    <div className="flex-1 text-sm pt-0.5 leading-snug">
                      <MathRenderer content={opt.text} />
                    </div>
                  </button>
                );
              })}
            </div>

            {/* THANH TÁC VỤ DƯỚI CÂU HỎI */}
            <div className="pt-4 border-t border-slate-100">
              {!currentState.isChecked ? (
                /* CHƯA KIỂM TRA -> HIỆN NÚT "KIỂM TRA ĐÁP ÁN" */
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs text-slate-400 font-medium">
                    {currentState.userAnswer
                      ? `Đã chọn phương án ${currentState.userAnswer}. Bấm kiểm tra để xem kết quả!`
                      : 'Hãy chọn 1 phương án ở trên.'}
                  </div>
                  <button
                    type="button"
                    disabled={!currentState.userAnswer}
                    onClick={handleCheckAnswer}
                    className={`rounded-2xl px-6 py-3 text-xs sm:text-sm font-black text-white shadow-md transition active:scale-95 cursor-pointer flex items-center gap-2 ${
                      currentState.userAnswer
                        ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/25'
                        : 'bg-slate-300 cursor-not-allowed shadow-none'
                    }`}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Kiểm tra đáp án</span>
                  </button>
                </div>
              ) : (
                /* ĐÃ KIỂM TRA -> BUNG LỜI GIẢI + NÚT "LÀM BÀI TƯƠNG TỰ" & "CÂU TIẾP THEO" */
                <div className="space-y-5 animate-in fade-in slide-in-from-top-2">
                  {/* Khung Thông Báo Kết Quả */}
                  <div
                    className={`p-4 rounded-2xl border flex items-center justify-between gap-4 ${
                      currentState.isCorrect
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        : 'bg-rose-50 border-rose-200 text-rose-900'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                          currentState.isCorrect ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
                        }`}
                      >
                        {currentState.isCorrect ? <CheckCircle2 className="h-6 w-6" /> : <XCircle className="h-6 w-6" />}
                      </div>
                      <div>
                        <div className="font-black text-sm">
                          {currentState.isCorrect ? 'CHÍNH XÁC! XUẤT SẮC' : 'CHƯA CHÍNH XÁC'}
                        </div>
                        <div className="text-xs opacity-85">
                          Đáp án đúng là: <strong>{currentQuestion.correct_answer || 'A'}</strong>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleResetCurrentQuestion}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 transition cursor-pointer shadow-2xs"
                      title="Làm lại câu hỏi này"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Thử lại</span>
                    </button>
                  </div>

                  {/* Khung Lời Giải Chi Tiết KaTeX */}
                  {currentQuestion.explanation && (
                    <div className="p-5 sm:p-6 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-3">
                      <div className="flex items-center gap-2 text-xs font-black text-blue-700 uppercase tracking-wider">
                        <Lightbulb className="h-4 w-4 text-amber-500" />
                        <span>Lời giải chi tiết & Phương pháp tư duy:</span>
                      </div>
                      <div className="text-xs sm:text-sm text-slate-800 leading-relaxed font-serif pl-2 border-l-2 border-blue-500/50">
                        <MathRenderer content={currentQuestion.explanation} />
                      </div>
                    </div>
                  )}

                  {/* HÀNG NÚT CHIẾN LƯỢC: LÀM BÀI TƯƠNG TỰ (ĐỔI SỐ) & CÂU TIẾP THEO */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
                    {/* NÚT AI SINH BÀI TƯƠNG TỰ ĐỔI SỐ (CƠ CHẾ 1) */}
                    <button
                      type="button"
                      disabled={isGeneratingSimilar}
                      onClick={handleGenerateSimilarQuestion}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white px-5 py-3 text-xs sm:text-sm font-black shadow-lg shadow-purple-500/25 transition active:scale-95 cursor-pointer disabled:opacity-50"
                      title="AI sẽ đổi số liệu của đề bài này để bạn thử sức lại"
                    >
                      {isGeneratingSimilar ? (
                        <>
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          <span>AI đang tính toán đổi số liệu...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 text-amber-300 animate-pulse" />
                          <span>🎯 Làm bài tương tự (AI đổi số liệu)</span>
                        </>
                      )}
                    </button>

                    {/* NÚT SANG CÂU TIẾP THEO */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handlePrev}
                        disabled={currentIndex === 0}
                        className="px-3.5 py-3 rounded-2xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition disabled:opacity-30 cursor-pointer"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        onClick={handleNext}
                        className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 text-xs sm:text-sm font-black shadow-md shadow-blue-500/25 transition active:scale-95 cursor-pointer"
                      >
                        <span>
                          {currentIndex < filteredQuestions.length - 1 ? 'Câu tiếp theo' : 'Xem tổng kết'}
                        </span>
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 3. MA TRẬN ĐIỀU HƯỚNG NHANH TẤT CẢ CÁC CÂU */}
        <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700">
            <span className="flex items-center gap-1.5">
              <ListOrdered className="h-4 w-4 text-blue-600" />
              Danh sách câu hỏi ({filteredQuestions.length} câu)
            </span>
            <div className="flex items-center gap-3 text-[11px] text-slate-500">
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Đúng
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Sai
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-slate-200" /> Chưa làm
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1">
            {filteredQuestions.map((q, idx) => {
              const st = questionStates[q.id];
              const isCurrent = idx === currentIndex;

              let pillColor = 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200';
              if (st?.isChecked) {
                if (st.isCorrect) {
                  pillColor = 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold';
                } else {
                  pillColor = 'bg-rose-100 text-rose-800 border-rose-300 font-bold';
                }
              }

              if (isCurrent) {
                pillColor += ' ring-2 ring-blue-500 shadow-xs';
              }

              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  className={`h-8 min-w-[32px] px-1.5 rounded-xl border text-xs transition cursor-pointer flex items-center justify-center gap-0.5 ${pillColor}`}
                  title={`Câu ${idx + 1}`}
                >
                  <span>{idx + 1}</span>
                  {st?.isFlagged && <span className="text-[10px] text-amber-600">★</span>}
                </button>
              );
            })}
          </div>
        </div>
      </main>

      {/* 4. MODAL TỔNG KẾT BUỔI LUYỆN TẬP */}
      {showSummaryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 sm:p-7 shadow-2xl space-y-5 border border-slate-200 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-100 text-blue-600 mx-auto">
              <Award className="h-9 w-9" />
            </div>

            <div>
              <h3 className="text-xl font-black text-slate-900">Tổng Kết Buổi Luyện Tập</h3>
              <p className="text-xs text-slate-500 mt-1">{exam.title}</p>
            </div>

            {/* Các thông số */}
            <div className="grid grid-cols-3 gap-2.5 p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <div>
                <div className="text-xs text-slate-400 font-semibold">Đúng</div>
                <div className="text-lg font-black text-emerald-600">{stats.correct}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400 font-semibold">Sai</div>
                <div className="text-lg font-black text-rose-500">{stats.wrong}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400 font-semibold">Tỉ lệ đúng</div>
                <div className="text-lg font-black text-blue-600">
                  {stats.correct + stats.wrong > 0
                    ? `${Math.round((stats.correct / (stats.correct + stats.wrong)) * 100)}%`
                    : '0%'}
                </div>
              </div>
            </div>

            {/* Lựa chọn tiếp theo */}
            <div className="space-y-2 pt-2">
              {stats.wrong > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setFilterMode('wrong');
                    setCurrentIndex(0);
                    setShowSummaryModal(false);
                    showToast('🎯 Đã mở chế độ ôn lại các câu làm sai!');
                  }}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black py-3 text-xs sm:text-sm shadow-md shadow-rose-600/20 transition active:scale-95 cursor-pointer"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>Luyện tập lại các câu làm sai ({stats.wrong} câu)</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowSummaryModal(false)}
                className="w-full rounded-2xl border border-slate-200 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                Tiếp tục xem lại bài
              </button>

              <Link
                href="/exams"
                className="w-full block rounded-2xl bg-slate-100 hover:bg-slate-200 py-2.5 text-xs font-bold text-slate-700 transition"
              >
                Trở về danh sách đề thi
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
