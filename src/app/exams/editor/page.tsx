'use client';

import React, { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Exam, Question, QuestionType, QuestionDifficulty, ClassItem } from '@/types/database';
import { MOCK_EXAMS, MOCK_QUESTIONS, MOCK_CLASSES } from '@/lib/supabase/mockStore';
import MathRenderer from '@/components/math/MathRenderer';
import MathEditor from '@/components/math/MathEditor';
import SingleUnifiedInputModal from '@/components/exam/SingleUnifiedInputModal';
import ExamSettingsDrawer from '@/components/exam/ExamSettingsDrawer';
import {
  Upload,
  Save,
  Undo,
  Redo,
  Bold,
  Italic,
  Underline,
  Sigma,
  Plus,
  Trash2,
  Copy,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  Sliders,
  ChevronLeft,
  Columns,
  Eye,
  FileText,
  Printer,
  Table as TableIcon,
  HelpCircle,
  Pencil,
  Check,
  Lock,
} from 'lucide-react';

function ExamEditorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const examIdParam = searchParams.get('id');
  const isNewParam = searchParams.get('new');
  const { user, isStudent } = useAuth();

  // Bảo vệ route cho học sinh
  useEffect(() => {
    if (user && isStudent) {
      alert('Tài khoản học sinh không có quyền chỉnh sửa đề thi!');
      router.replace('/exams');
    }
  }, [user, isStudent, router]);

  if (user && isStudent) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 p-4">
        <div className="text-center max-w-md bg-white p-8 rounded-3xl border border-slate-200 shadow-xl space-y-4">
          <div className="h-12 w-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <Lock className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-extrabold text-slate-900">Không có quyền truy cập</h2>
          <p className="text-xs text-slate-500">
            Trang soạn thảo đề thi chỉ dành riêng cho Giáo viên và Quản trị viên.
          </p>
          <Link
            href="/exams"
            className="inline-block px-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-500 transition"
          >
            Quay lại danh sách đề thi
          </Link>
        </div>
      </div>
    );
  }

  // 1. THÔNG TIN ĐỀ THI
  const [examId, setExamId] = useState<string>(() => examIdParam || `exam-${Date.now()}`);
  const [title, setTitle] = useState('Đề Thi Thử Tốt Nghiệp THPT 2025 Môn Toán (Chuẩn Bộ GD&ĐT)');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [grade, setGrade] = useState<10 | 11 | 12>(12);
  const [duration, setDuration] = useState(45);
  const [noTimeLimit, setNoTimeLimit] = useState(false);
  const [code, setCode] = useState(() => Math.random().toString(36).substring(2, 8).toUpperCase());
  const [description, setDescription] = useState('Đề thi toán THPT chuẩn định dạng.');
  const [format, setFormat] = useState<'standard_3_parts' | 'periodic_4_parts' | 'custom'>('standard_3_parts');
  const [category, setCategory] = useState<'exam' | 'practice'>('exam');
  const [accessType, setAccessType] = useState<'public' | 'restricted'>('restricted');
  const [assignedClasses, setAssignedClasses] = useState<string[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);

  // 2. CÀI ĐẶT ĐIỂM SỐ & THI CỬ
  const [partPoints, setPartPoints] = useState({ part1: 3, part2: 4, part3: 3, part4: 0 });
  const [trueFalseScoring, setTrueFalseScoring] = useState<'standard_thpt' | 'equal'>('standard_thpt');
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [shuffleOptions, setShuffleOptions] = useState(true);
  const [shuffleTrueFalse, setShuffleTrueFalse] = useState(true);
  const [maxAttempts, setMaxAttempts] = useState<number>(0);
  const [submissionMinMinutes, setSubmissionMinMinutes] = useState<number>(10);
  const [maxViolations, setMaxViolations] = useState<number>(3);
  const [viewAnswerPolicy, setViewAnswerPolicy] = useState<'immediately' | 'after_closed' | 'specific_time'>('immediately');

  // 3. DANH SÁCH CÂU HỎI & LỊCH SỬ UNDO / REDO
  const [questions, setQuestions] = useState<Question[]>([]);
  const [history, setHistory] = useState<Question[][]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);

  // 4. ĐIỀU KHIỂN GIAO DIỆN 2 TRANG
  const [splitView, setSplitView] = useState<'both' | 'editor' | 'preview'>('both');
  const [showAnswerInPreview, setShowAnswerInPreview] = useState(true);
  const [showSingleInputModal, setShowSingleInputModal] = useState(false);
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);

  // Tải đề thi từ cache hoặc params
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Tải danh sách lớp
    try {
      const savedClasses = localStorage.getItem('lms_classes');
      if (savedClasses) setClasses(JSON.parse(savedClasses));
    } catch {}

    // Tải đề thi cần sửa
    if (examIdParam) {
      const savedExams = localStorage.getItem('lms_exams');
      const examsList: Exam[] = savedExams ? JSON.parse(savedExams) : MOCK_EXAMS;
      const found = examsList.find((e) => e.id === examIdParam);

      if (found) {
        setExamId(found.id);
        setTitle(found.title);
        setCode(found.code || '');
        setGrade(found.grade as any);
        setDuration(found.duration_minutes);
        setDescription(found.description || '');
        setFormat(found.format || 'standard_3_parts');
        if (found.part_points) {
          setPartPoints({
            part1: found.part_points.part1 ?? 3,
            part2: found.part_points.part2 ?? 4,
            part3: found.part_points.part3 ?? 3,
            part4: found.part_points.part4 ?? 0,
          });
        }
        if (found.true_false_scoring) setTrueFalseScoring(found.true_false_scoring);
        if (found.assigned_classes) setAssignedClasses(found.assigned_classes);

        const initialQ = found.questions && found.questions.length > 0 ? found.questions : MOCK_QUESTIONS.slice(0, 12);
        setQuestions(initialQ);
        setHistory([initialQ]);
        setHistoryIndex(0);
        if (initialQ.length > 0) setActiveQuestionId(initialQ[0].id);
        return;
      }
    }

    // Đề mới hoàn toàn
    if (questions.length === 0) {
      if (isNewParam === '1') {
        setQuestions([]);
        setHistory([[]]);
        setHistoryIndex(0);
        setTitle('Đề Thi Toán THPT Mới Tạo');
        // Mở ngay Cổng nạp một cửa để giáo viên chọn file nạp
        setShowSingleInputModal(true);
      } else {
        const initial = MOCK_QUESTIONS.slice(0, 6);
        setQuestions(initial);
        setHistory([initial]);
        setHistoryIndex(0);
        setActiveQuestionId(initial[0].id);
      }
    }
  }, [examIdParam]);

  // Phân nhóm câu hỏi
  const part1Questions = useMemo(() => questions.filter((q) => q.part === 1 || q.type === 'single_choice' || q.type === 'multiple_choice'), [questions]);
  const part2Questions = useMemo(() => questions.filter((q) => q.part === 2 || q.type === 'true_false'), [questions]);
  const part3Questions = useMemo(() => questions.filter((q) => q.part === 3 || q.type === 'short_answer'), [questions]);
  const part4Questions = useMemo(() => questions.filter((q) => q.part === 4 || q.type === 'essay'), [questions]);

  // Cập nhật câu hỏi có lịch sử Undo / Redo
  const setQuestionsWithHistory = (newQuestions: Question[] | ((prev: Question[]) => Question[])) => {
    setQuestions((prev) => {
      const resolved = typeof newQuestions === 'function' ? newQuestions(prev) : newQuestions;
      setHistory((h) => {
        const nextH = h.slice(0, historyIndex + 1);
        return [...nextH, resolved];
      });
      setHistoryIndex((idx) => idx + 1);
      return resolved;
    });
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevQ = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      setQuestions(prevQ);
      setSaveToast('Đã hoàn tác (Undo)!');
      setTimeout(() => setSaveToast(null), 1800);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextQ = history[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      setQuestions(nextQ);
      setSaveToast('Đã làm lại (Redo)!');
      setTimeout(() => setSaveToast(null), 1800);
    }
  };

  // Cuộn đồng bộ sang câu hỏi bên trang Preview
  const scrollToPreviewQuestion = (qId: string) => {
    setActiveQuestionId(qId);
    if (typeof document !== 'undefined') {
      const targetElem = document.getElementById(`preview-q-${qId}`);
      if (targetElem) {
        targetElem.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  // Thêm câu hỏi mới
  const handleAddQuestion = (type: QuestionType) => {
    let partNum: 1 | 2 | 3 | 4 = 1;
    let initialOptions: any[] = [];
    let initialAnswer: any = 'A';

    if (type === 'single_choice') {
      partNum = 1;
      initialOptions = [
        { id: 'A', text: '$0$' },
        { id: 'B', text: '$1$' },
        { id: 'C', text: '$2$' },
        { id: 'D', text: '$3$' },
      ];
      initialAnswer = 'A';
    } else if (type === 'true_false') {
      partNum = 2;
      initialOptions = [
        { id: 'a', text: 'Mệnh đề a' },
        { id: 'b', text: 'Mệnh đề b' },
        { id: 'c', text: 'Mệnh đề c' },
        { id: 'd', text: 'Mệnh đề d' },
      ];
      initialAnswer = { a: true, b: false, c: true, d: false };
    } else if (type === 'short_answer') {
      partNum = 3;
      initialOptions = [];
      initialAnswer = ['12'];
    } else if (type === 'essay') {
      partNum = 4;
      initialOptions = [];
      initialAnswer = '';
    }

    const newQ: Question = {
      id: `q-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      teacher_id: user?.id || '22222222-2222-2222-2222-222222222222',
      grade,
      topic: 'Toán THPT',
      part: partNum,
      type,
      difficulty: 'nhan_biet',
      content: 'Nhập nội dung câu hỏi mới tại đây...',
      options: initialOptions,
      correct_answer: initialAnswer,
      explanation: 'Lời giải chi tiết...',
      points: 0.25,
      is_public: true,
    };

    setQuestionsWithHistory((prev) => [...prev, newQ]);
    scrollToPreviewQuestion(newQ.id);
  };

  // Xóa câu hỏi
  const handleDeleteQuestion = (qId: string) => {
    setQuestionsWithHistory((prev) => prev.filter((q) => q.id !== qId));
  };

  // Di chuyển câu hỏi lên / xuống
  const handleMoveQuestion = (index: number, direction: 'up' | 'down') => {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === questions.length - 1)) return;
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    const newArr = [...questions];
    const temp = newArr[index];
    newArr[index] = newArr[targetIdx];
    newArr[targetIdx] = temp;
    setQuestionsWithHistory(newArr);
    scrollToPreviewQuestion(temp.id);
  };

  // Nhân bản câu hỏi
  const handleDuplicateQuestion = (q: Question) => {
    const dup: Question = {
      ...q,
      id: `q-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    };
    const idx = questions.findIndex((item) => item.id === q.id);
    const newArr = [...questions];
    newArr.splice(idx + 1, 0, dup);
    setQuestionsWithHistory(newArr);
    scrollToPreviewQuestion(dup.id);
  };

  // Chèn định dạng từ thanh công cụ Ribbon
  const handleInsertSnippet = (snippet: string) => {
    const targetQId = activeQuestionId || questions[0]?.id;
    if (!targetQId) {
      setSaveToast('Vui lòng chọn hoặc thêm câu hỏi để thao tác!');
      setTimeout(() => setSaveToast(null), 2000);
      return;
    }
    setQuestionsWithHistory((prev) =>
      prev.map((q) => (q.id === targetQId ? { ...q, content: `${q.content} ${snippet}` } : q))
    );
  };

  // Lưu đề thi vào localStorage và đồng bộ Supabase Cloud
  const handleSaveExam = () => {
    if (!title.trim()) {
      alert('Vui lòng nhập tiêu đề cho đề thi!');
      return;
    }

    const updatedExam: Exam = {
      id: examId,
      code,
      title: title.trim(),
      description: description.trim(),
      category,
      teacher_id: user?.id || '22222222-2222-2222-2222-222222222222',
      grade,
      duration_minutes: Number(duration),
      passing_score: 5.0,
      shuffle_questions: shuffleQuestions,
      shuffle_options: shuffleOptions,
      shuffle_true_false: shuffleTrueFalse,
      max_attempts: maxAttempts,
      status: 'published',
      format,
      exam_mode: 'interactive',
      assigned_classes: assignedClasses,
      access_type: accessType,
      no_time_limit: noTimeLimit,
      part_points: partPoints,
      true_false_scoring: trueFalseScoring,
      submission_min_minutes: submissionMinMinutes,
      max_violations: maxViolations,
      view_answer_policy: viewAnswerPolicy,
      view_score_allowed: true,
      view_leaderboard_allowed: true,
      is_view_answer_allowed: true,
      questions: questions.map((q, idx) => ({
        ...q,
        order_index: idx + 1,
      })),
      updated_at: new Date().toISOString(),
    };

    if (typeof window !== 'undefined') {
      try {
        const savedExams = localStorage.getItem('lms_exams');
        let examsList: Exam[] = savedExams ? JSON.parse(savedExams) : MOCK_EXAMS;
        const existIdx = examsList.findIndex((e) => e.id === examId);
        if (existIdx >= 0) {
          examsList[existIdx] = updatedExam;
        } else {
          examsList = [updatedExam, ...examsList];
        }
        localStorage.setItem('lms_exams', JSON.stringify(examsList));
        window.dispatchEvent(new Event('lms_exams_updated'));

        fetch('/api/exams', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedExam),
        }).catch((err) => console.warn('Lỗi đồng bộ Cloud:', err));

        setSaveToast('Đã lưu đề thi thành công vào hệ thống!');
        setTimeout(() => setSaveToast(null), 3000);
      } catch (err) {
        console.warn(err);
      }
    }
  };

  return (
    <div className="h-screen w-full flex flex-col bg-slate-100 overflow-hidden select-text text-slate-900 font-sans">
      {/* 1. THANH TIÊU ĐỀ TRÊN CÙNG (Edge-to-Edge Top Navigation Bar) */}
      <header className="h-14 px-4 bg-white border-b border-slate-200 flex items-center justify-between gap-3 shrink-0 z-30 shadow-2xs">
        {/* Nhóm nút bên trái: Quay lại, Nạp đề một cửa, Tiêu đề */}
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/exams"
            className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-600 transition cursor-pointer shrink-0"
            title="Quay lại danh sách đề thi"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>

          {/* NÚT DUY NHẤT: Nạp Đề Thi (Single Ingestion Hub) */}
          <button
            type="button"
            onClick={() => setShowSingleInputModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold shadow-md shadow-blue-500/20 hover:from-blue-500 hover:to-indigo-500 active:scale-95 transition cursor-pointer shrink-0"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>Nạp đề thi</span>
          </button>

          <div className="h-4 w-px bg-slate-200 shrink-0" />

          {/* Tiêu đề đề thi có thể sửa trực tiếp */}
          <div className="flex items-center gap-2 min-w-0">
            {isEditingTitle ? (
              <input
                type="text"
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => setIsEditingTitle(false)}
                onKeyDown={(e) => e.key === 'Enter' && setIsEditingTitle(false)}
                className="rounded-lg border border-blue-400 px-2 py-0.5 text-sm font-extrabold text-blue-950 focus:outline-none bg-blue-50/50"
              />
            ) : (
              <div
                onClick={() => setIsEditingTitle(true)}
                className="flex items-center gap-1.5 cursor-pointer group hover:bg-slate-50 px-2 py-1 rounded-lg transition"
                title="Nhấp để sửa tiêu đề đề thi"
              >
                <h1 className="text-sm font-extrabold text-slate-900 truncate max-w-xs sm:max-w-md">
                  {title}
                </h1>
                <Pencil className="h-3 w-3 text-slate-400 group-hover:text-blue-600 transition shrink-0" />
              </div>
            )}

            <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-bold shrink-0">
              {questions.length} câu • {grade}
            </span>
          </div>
        </div>

        {/* Nhóm nút bên phải: Chuyển bố cục, Cài đặt Drawer, Lưu đề */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Nút chuyển đổi chế độ xem 2 trang */}
          <div className="hidden sm:flex items-center p-0.5 rounded-xl bg-slate-100 text-xs font-bold text-slate-600">
            <button
              type="button"
              onClick={() => setSplitView('both')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                splitView === 'both' ? 'bg-white text-blue-700 shadow-2xs font-extrabold' : 'hover:text-slate-900'
              }`}
              title="Xem song song 2 bên (50/50)"
            >
              2 Trang (50/50)
            </button>
            <button
              type="button"
              onClick={() => setSplitView('editor')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                splitView === 'editor' ? 'bg-white text-blue-700 shadow-2xs font-extrabold' : 'hover:text-slate-900'
              }`}
              title="Chỉ mở trang biên tập dữ liệu"
            >
              Chỉ Biên tập
            </button>
            <button
              type="button"
              onClick={() => setSplitView('preview')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                splitView === 'preview' ? 'bg-white text-blue-700 shadow-2xs font-extrabold' : 'hover:text-slate-900'
              }`}
              title="Chỉ mở trang xem trước tờ đề thi"
            >
              Chỉ Xem trước
            </button>
          </div>

          {/* NÚT DUY NHẤT: Mở Cài Đặt Đề Thi Nâng Cao (Slide-out Drawer) */}
          <button
            type="button"
            onClick={() => setShowSettingsDrawer(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 shadow-2xs transition cursor-pointer"
            title="Mở ma trận điểm, thời gian & chống gian lận"
          >
            <Sliders className="h-3.5 w-3.5 text-slate-600" />
            <span className="hidden md:inline">Cài đặt đề</span>
          </button>

          {/* NÚT LƯU ĐỀ THI */}
          <button
            type="button"
            onClick={handleSaveExam}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-extrabold shadow-md shadow-blue-500/20 hover:bg-blue-500 active:scale-95 transition cursor-pointer"
          >
            <Save className="h-3.5 w-3.5" />
            <span>Cập nhật</span>
          </button>
        </div>
      </header>

      {/* 2. KHÔNG GIAN LÀM VIỆC 2 TRANG Ở 2 BÊN (Split-Screen 50/50 Workspace) */}
      <div className="flex-1 flex overflow-hidden w-full relative">
        {/* ======================================================== */}
        {/* TRANG BÊN TRÁI: DỮ LIỆU & CÔNG CỤ SOẠN THẢO (Editor Pane) */}
        {/* ======================================================== */}
        <div
          className={`flex flex-col bg-slate-50 border-r border-slate-200 h-full overflow-hidden transition-all duration-200 ${
            splitView === 'both' ? 'w-full lg:w-1/2' : splitView === 'editor' ? 'w-full' : 'hidden'
          }`}
        >
          {/* Thanh thông tin đề rút gọn */}
          <div className="px-4 py-2 bg-white border-b border-slate-100 flex items-center justify-between text-xs text-slate-600 shrink-0">
            <div className="flex items-center gap-3">
              <span className="font-bold text-slate-700">Khối:</span>
              <select
                value={grade}
                onChange={(e) => setGrade(Number(e.target.value) as any)}
                className="rounded-md border border-slate-200 px-1.5 py-0.5 font-bold text-slate-800 bg-white"
              >
                <option value={10}>Lớp 10</option>
                <option value={11}>Lớp 11</option>
                <option value={12}>Lớp 12</option>
              </select>

              <span className="font-bold text-slate-700">Thời gian:</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="5"
                  max="180"
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value) || 45)}
                  className="w-14 rounded-md border border-slate-200 px-1.5 py-0.5 text-center font-bold text-slate-800"
                />
                <span>phút</span>
              </div>
            </div>

            <div className="text-[11px] font-bold text-blue-700">
              Phần I: {part1Questions.length}c • Phần II: {part2Questions.length}c • Phần III: {part3Questions.length}c
            </div>
          </div>

          {/* Thanh công cụ Editor (Ribbon Toolbar) */}
          <div className="px-4 py-2 bg-slate-100/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleUndo}
                disabled={historyIndex <= 0}
                className="p-1.5 rounded-lg hover:bg-white text-slate-700 disabled:opacity-30 transition cursor-pointer"
                title="Hoàn tác (Undo)"
              >
                <Undo className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={handleRedo}
                disabled={historyIndex >= history.length - 1}
                className="p-1.5 rounded-lg hover:bg-white text-slate-700 disabled:opacity-30 transition cursor-pointer"
                title="Làm lại (Redo)"
              >
                <Redo className="h-3.5 w-3.5" />
              </button>

              <div className="h-4 w-px bg-slate-300 mx-1" />

              <button
                type="button"
                onClick={() => handleInsertSnippet('\\textbf{in đậm}')}
                className="p-1.5 rounded-lg hover:bg-white text-slate-700 transition cursor-pointer"
                title="In đậm"
              >
                <Bold className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleInsertSnippet('\\textit{in nghiêng}')}
                className="p-1.5 rounded-lg hover:bg-white text-slate-700 transition cursor-pointer"
                title="In nghiêng"
              >
                <Italic className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleInsertSnippet('\\underline{gạch chân}')}
                className="p-1.5 rounded-lg hover:bg-white text-slate-700 transition cursor-pointer"
                title="Gạch chân"
              >
                <Underline className="h-3.5 w-3.5" />
              </button>

              <div className="h-4 w-px bg-slate-300 mx-1" />

              <button
                type="button"
                onClick={() => handleInsertSnippet('$x = \\dfrac{-b \\pm \\sqrt{\\Delta}}{2a}$')}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:text-blue-600 transition cursor-pointer"
              >
                <Sigma className="h-3.5 w-3.5 text-blue-600" />
                <span>Công thức</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  handleInsertSnippet(
                    '\n\\begin{tikzpicture}\n  \\tkzTabInit[lgt=1.2,espcl=2.5]{$x$/0.8,$y\'$/0.8,$y$/2}{$-\\infty$,-1,1,$+\\infty$}\n  \\tkzTabLine{,+,0,-,0,+,}\n  \\tkzTabVar{-/$-\\infty$,+/$2$,-/$-2$,+/$+\\infty$}\n\\end{tikzpicture}\n'
                  )
                }
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:text-indigo-600 transition cursor-pointer"
              >
                <span>Bảng biến thiên</span>
              </button>
            </div>

            {/* Nút thêm câu hỏi nhanh */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleAddQuestion('single_choice')}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold hover:bg-blue-100 transition cursor-pointer"
              >
                <Plus className="h-3 w-3" />
                <span>+ Trắc nghiệm</span>
              </button>
              <button
                type="button"
                onClick={() => handleAddQuestion('true_false')}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold hover:bg-emerald-100 transition cursor-pointer"
              >
                <Plus className="h-3 w-3" />
                <span>+ Đúng/Sai</span>
              </button>
              <button
                type="button"
                onClick={() => handleAddQuestion('short_answer')}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 text-xs font-bold hover:bg-purple-100 transition cursor-pointer"
              >
                <Plus className="h-3 w-3" />
                <span>+ Điền số</span>
              </button>
            </div>
          </div>

          {/* Vùng danh sách câu hỏi chỉnh sửa */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {questions.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-white rounded-3xl border border-dashed border-slate-300">
                <FileText className="h-10 w-10 text-slate-300 mb-2" />
                <p className="font-extrabold text-sm text-slate-700">Chưa có câu hỏi nào trong đề thi</p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  Thầy có thể bấm nút "Nạp đề thi" trên thanh tiêu đề để tải file Word, TeX, PDF hoặc thêm câu hỏi thủ công.
                </p>
                <button
                  type="button"
                  onClick={() => setShowSingleInputModal(true)}
                  className="mt-4 px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs shadow-md shadow-blue-500/20 hover:bg-blue-500 transition cursor-pointer"
                >
                  📁 Nạp file đề thi ngay
                </button>
              </div>
            ) : (
              questions.map((q, idx) => {
                const isActive = activeQuestionId === q.id;
                return (
                  <div
                    key={q.id}
                    onClick={() => scrollToPreviewQuestion(q.id)}
                    className={`p-4 rounded-2xl bg-white border transition-all duration-200 ${
                      isActive
                        ? 'border-blue-500 shadow-md ring-2 ring-blue-100'
                        : 'border-slate-200 shadow-2xs hover:border-slate-300'
                    }`}
                  >
                    {/* Header Thẻ Câu Hỏi */}
                    <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-slate-100 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md text-xs">
                          Câu {idx + 1}
                        </span>

                        <select
                          value={q.type}
                          onChange={(e) => {
                            const newType = e.target.value as QuestionType;
                            setQuestionsWithHistory((prev) =>
                              prev.map((item) => (item.id === q.id ? { ...item, type: newType } : item))
                            );
                          }}
                          className="font-bold text-slate-700 border border-slate-200 rounded-md px-1.5 py-0.5 bg-slate-50 text-[11px]"
                        >
                          <option value="single_choice">Trắc nghiệm 4 lựa chọn</option>
                          <option value="true_false">Trắc nghiệm Đúng / Sai</option>
                          <option value="short_answer">Trả lời ngắn (Điền số)</option>
                          <option value="essay">Tự luận</option>
                        </select>

                        <select
                          value={q.difficulty || 'nhan_biet'}
                          onChange={(e) => {
                            const newDiff = e.target.value as QuestionDifficulty;
                            setQuestionsWithHistory((prev) =>
                              prev.map((item) => (item.id === q.id ? { ...item, difficulty: newDiff } : item))
                            );
                          }}
                          className="text-[11px] font-medium text-slate-600 border border-slate-200 rounded-md px-1.5 py-0.5 bg-slate-50"
                        >
                          <option value="nhan_biet">Nhận biết</option>
                          <option value="thong_hieu">Thông hiểu</option>
                          <option value="van_dung">Vận dụng</option>
                          <option value="van_dung_cao">Vận dụng cao</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-1 text-slate-500">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMoveQuestion(idx, 'up');
                          }}
                          disabled={idx === 0}
                          className="p-1 hover:bg-slate-100 rounded disabled:opacity-20 cursor-pointer"
                          title="Chuyển lên"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMoveQuestion(idx, 'down');
                          }}
                          disabled={idx === questions.length - 1}
                          className="p-1 hover:bg-slate-100 rounded disabled:opacity-20 cursor-pointer"
                          title="Chuyển xuống"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDuplicateQuestion(q);
                          }}
                          className="p-1 hover:bg-slate-100 rounded cursor-pointer"
                          title="Nhân bản"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteQuestion(q.id);
                          }}
                          className="p-1 hover:bg-rose-50 text-rose-600 rounded cursor-pointer"
                          title="Xóa câu hỏi"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Nội dung đề bài */}
                    <div className="space-y-1.5 mb-3">
                      <label className="text-[11px] font-bold text-slate-600 block">Nội dung câu hỏi (hỗ trợ LaTeX / TikZ):</label>
                      <textarea
                        rows={3}
                        value={q.content}
                        onChange={(e) => {
                          const val = e.target.value;
                          setQuestionsWithHistory((prev) =>
                            prev.map((item) => (item.id === q.id ? { ...item, content: val } : item))
                          );
                        }}
                        className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-mono text-slate-800 focus:outline-none focus:border-blue-500 bg-slate-50/50 leading-relaxed resize-none"
                      />
                    </div>

                    {/* Phương án A, B, C, D (Nếu là Single Choice) */}
                    {q.type === 'single_choice' && Array.isArray(q.options) && (
                      <div className="space-y-2 mb-3 pt-1">
                        <label className="text-[11px] font-bold text-slate-600 block">
                          Phương án lựa chọn (Click nút tròn để chọn đáp án đúng):
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {q.options.map((opt) => {
                            const isCorrect = q.correct_answer === opt.id;
                            return (
                              <div
                                key={opt.id}
                                className={`flex items-center gap-2 p-1.5 rounded-xl border transition ${
                                  isCorrect ? 'bg-emerald-50/60 border-emerald-300' : 'bg-slate-50/60 border-slate-200'
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    setQuestionsWithHistory((prev) =>
                                      prev.map((item) => (item.id === q.id ? { ...item, correct_answer: opt.id } : item))
                                    );
                                  }}
                                  className={`h-5 w-5 rounded-full flex items-center justify-center font-bold text-xs shrink-0 cursor-pointer transition ${
                                    isCorrect
                                      ? 'bg-emerald-600 text-white shadow-xs'
                                      : 'bg-white border border-slate-300 text-slate-700 hover:border-blue-500'
                                  }`}
                                >
                                  {opt.id}
                                </button>
                                <input
                                  type="text"
                                  value={opt.text}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setQuestionsWithHistory((prev) =>
                                      prev.map((item) =>
                                        item.id === q.id
                                          ? {
                                              ...item,
                                              options: item.options?.map((o: any) => (o.id === opt.id ? { ...o, text: val } : o)),
                                            }
                                          : item
                                      )
                                    );
                                  }}
                                  className="w-full text-xs font-mono bg-transparent border-0 p-0 focus:outline-none text-slate-800"
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Mệnh đề Đúng / Sai (Nếu là True/False) */}
                    {q.type === 'true_false' && Array.isArray(q.options) && (
                      <div className="space-y-2 mb-3 pt-1">
                        <label className="text-[11px] font-bold text-slate-600 block">
                          Mệnh đề xét tính Đúng/Sai (Click Đúng/Sai 1 chạm):
                        </label>
                        <div className="space-y-1.5">
                          {q.options.map((opt) => {
                            const tfAnswer = (q.correct_answer as any) || {};
                            const currentVal = tfAnswer[opt.id];
                            return (
                              <div
                                key={opt.id}
                                className="flex items-center justify-between gap-2 p-2 rounded-xl border border-slate-200 bg-slate-50/50"
                              >
                                <div className="flex items-center gap-2 flex-1">
                                  <span className="font-extrabold text-xs text-slate-700">{opt.id})</span>
                                  <input
                                    type="text"
                                    value={opt.text}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setQuestionsWithHistory((prev) =>
                                        prev.map((item) =>
                                          item.id === q.id
                                            ? {
                                                ...item,
                                                options: item.options?.map((o: any) => (o.id === opt.id ? { ...o, text: val } : o)),
                                              }
                                            : item
                                        )
                                      );
                                    }}
                                    className="w-full text-xs font-mono bg-transparent border-0 p-0 focus:outline-none text-slate-800"
                                  />
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = { ...tfAnswer, [opt.id]: true };
                                      setQuestionsWithHistory((prev) =>
                                        prev.map((item) => (item.id === q.id ? { ...item, correct_answer: updated } : item))
                                      );
                                    }}
                                    className={`px-2 py-0.5 rounded-md font-bold text-[11px] transition cursor-pointer ${
                                      currentVal === true
                                        ? 'bg-emerald-600 text-white shadow-2xs'
                                        : 'bg-white border border-slate-200 text-slate-600 hover:text-emerald-700'
                                    }`}
                                  >
                                    Đúng
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = { ...tfAnswer, [opt.id]: false };
                                      setQuestionsWithHistory((prev) =>
                                        prev.map((item) => (item.id === q.id ? { ...item, correct_answer: updated } : item))
                                      );
                                    }}
                                    className={`px-2 py-0.5 rounded-md font-bold text-[11px] transition cursor-pointer ${
                                      currentVal === false
                                        ? 'bg-rose-600 text-white shadow-2xs'
                                        : 'bg-white border border-slate-200 text-slate-600 hover:text-rose-700'
                                    }`}
                                  >
                                    Sai
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Điền đáp số (Nếu là Short Answer) */}
                    {q.type === 'short_answer' && (
                      <div className="space-y-1.5 mb-3 pt-1">
                        <label className="text-[11px] font-bold text-slate-600 block">Đáp số đúng (ví dụ: 12 hoặc -2.5):</label>
                        <input
                          type="text"
                          value={Array.isArray(q.correct_answer) ? q.correct_answer[0] : (q.correct_answer as any) || ''}
                          onChange={(e) => {
                            const val = e.target.value.trim();
                            setQuestionsWithHistory((prev) =>
                              prev.map((item) => (item.id === q.id ? { ...item, correct_answer: [val, val.replace(',', '.')] } : item))
                            );
                          }}
                          placeholder="Nhập giá trị đáp số..."
                          className="w-48 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-800 bg-slate-50/70"
                        />
                      </div>
                    )}

                    {/* Lời giải chi tiết */}
                    <div className="pt-2 border-t border-slate-100">
                      <details className="text-xs group">
                        <summary className="text-[11px] font-bold text-slate-500 hover:text-blue-600 cursor-pointer select-none">
                          Lời giải chi tiết (bấm để mở rộng / chỉnh sửa)
                        </summary>
                        <textarea
                          rows={2}
                          value={q.explanation || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setQuestionsWithHistory((prev) =>
                              prev.map((item) => (item.id === q.id ? { ...item, explanation: val } : item))
                            );
                          }}
                          placeholder="Nhập lời giải hoặc hướng dẫn chấm..."
                          className="w-full mt-2 rounded-xl border border-slate-200 p-2 text-xs font-mono text-slate-800 bg-slate-50/50 leading-relaxed resize-none"
                        />
                      </details>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ======================================================== */}
        {/* TRANG BÊN PHẢI: HIỂN THỊ THỜI GIAN THỰC (Live Preview Pane) */}
        {/* ======================================================== */}
        <div
          className={`flex flex-col bg-slate-200/70 h-full overflow-hidden transition-all duration-200 ${
            splitView === 'both' ? 'w-full lg:w-1/2' : splitView === 'preview' ? 'w-full' : 'hidden'
          }`}
        >
          {/* Thanh điều khiển Live Preview */}
          <div className="px-5 py-2.5 bg-white border-b border-slate-200 flex items-center justify-between gap-3 shrink-0 shadow-2xs">
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                <Eye className="h-4 w-4 text-blue-600" />
                <span>Xem Trước Tờ Đề Thi</span>
              </span>
              <span className="text-[11px] font-semibold text-slate-500">
                (Tự động đồng bộ thời gian thực 0ms)
              </span>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={showAnswerInPreview}
                  onChange={(e) => setShowAnswerInPreview(e.target.checked)}
                  className="rounded text-blue-600"
                />
                <span>Hiện đáp án & lời giải</span>
              </label>

              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition cursor-pointer"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>In đề A4</span>
              </button>
            </div>
          </div>

          {/* Khung tờ đề thi A4 trực quan */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
            <div className="max-w-3xl mx-auto bg-white rounded-3xl shadow-xl border border-slate-200/90 p-8 sm:p-10 space-y-6 min-h-full">
              {/* Tiêu đề đầu đề thi chuẩn sư phạm THPT */}
              <div className="border-b-2 border-slate-900 pb-5 text-center space-y-1.5">
                <div className="grid grid-cols-2 gap-4 text-xs font-bold text-slate-700 mb-2">
                  <div className="text-left">
                    <p className="uppercase tracking-wider">SỞ GD&ĐT NAM ĐỊNH</p>
                    <p className="text-slate-500 font-medium">TRƯỜNG THPT CHUYÊN LÊ HỒNG PHONG</p>
                  </div>
                  <div className="text-right">
                    <p className="uppercase tracking-wider">KỲ THI THỬ TỐT NGHIỆP THPT</p>
                    <p className="text-blue-700 font-extrabold">MÃ ĐỀ THI: {code}</p>
                  </div>
                </div>

                <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 uppercase tracking-wide">
                  {title}
                </h2>
                <p className="text-xs text-slate-600 font-medium">
                  Thời gian làm bài: <span className="font-bold">{duration} phút</span> (Không kể thời gian phát đề)
                </p>

                <div className="pt-2 text-xs text-slate-500 italic text-left flex justify-between">
                  <span>Họ và tên thí sinh: ................................................................</span>
                  <span>Số báo danh: .......................</span>
                </div>
              </div>

              {/* PHẦN I: TRẮC NGHIỆM 4 PHƯƠNG ÁN */}
              {part1Questions.length > 0 && (
                <div className="space-y-4">
                  <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-extrabold text-slate-800 uppercase tracking-wide">
                    PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn (Thí sinh trả lời từ câu 1 đến câu {part1Questions.length})
                  </div>

                  <div className="space-y-6">
                    {part1Questions.map((q, pIdx) => {
                      const globalIdx = questions.findIndex((item) => item.id === q.id) + 1;
                      return (
                        <div
                          key={q.id}
                          id={`preview-q-${q.id}`}
                          className="space-y-2 text-sm text-slate-900 leading-relaxed scroll-mt-20"
                        >
                          <div className="font-medium">
                            <span className="font-extrabold text-blue-900 mr-2">Câu {globalIdx}.</span>
                            <MathRenderer content={q.content} inline />
                          </div>

                          {/* Các phương án A, B, C, D */}
                          {Array.isArray(q.options) && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-1 pl-4">
                              {q.options.map((opt) => {
                                const isCorrect = q.correct_answer === opt.id;
                                return (
                                  <div
                                    key={opt.id}
                                    className={`flex items-start gap-1.5 p-1 rounded-lg ${
                                      showAnswerInPreview && isCorrect
                                        ? 'bg-emerald-50 text-emerald-800 font-bold border border-emerald-300'
                                        : 'text-slate-800'
                                    }`}
                                  >
                                    <span className="font-extrabold text-slate-700">{opt.id}.</span>
                                    <MathRenderer content={opt.text} inline />
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Lời giải */}
                          {showAnswerInPreview && q.explanation && (
                            <div className="mt-2 p-3 rounded-xl bg-amber-50/60 border border-amber-200/70 text-xs text-amber-950 space-y-1">
                              <span className="font-bold flex items-center gap-1 text-amber-800">
                                <HelpCircle className="h-3.5 w-3.5" />
                                <span>Lời giải chi tiết:</span>
                              </span>
                              <MathRenderer content={q.explanation} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* PHẦN II: TRẮC NGHIỆM ĐÚNG / SAI */}
              {part2Questions.length > 0 && (
                <div className="space-y-4 pt-4 border-t border-slate-200">
                  <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-extrabold text-slate-800 uppercase tracking-wide">
                    PHẦN II. Câu trắc nghiệm đúng sai (Thí sinh trả lời từ câu 1 đến câu {part2Questions.length})
                  </div>

                  <div className="space-y-6">
                    {part2Questions.map((q, pIdx) => {
                      const globalIdx = questions.findIndex((item) => item.id === q.id) + 1;
                      const tfAnswer = (q.correct_answer as any) || {};
                      return (
                        <div
                          key={q.id}
                          id={`preview-q-${q.id}`}
                          className="space-y-2 text-sm text-slate-900 leading-relaxed scroll-mt-20"
                        >
                          <div className="font-medium">
                            <span className="font-extrabold text-blue-900 mr-2">Câu {globalIdx}.</span>
                            <MathRenderer content={q.content} inline />
                          </div>

                          {Array.isArray(q.options) && (
                            <div className="space-y-1.5 pl-4 pt-1">
                              {q.options.map((opt) => {
                                const val = tfAnswer[opt.id];
                                return (
                                  <div
                                    key={opt.id}
                                    className="flex items-center justify-between p-1.5 rounded-lg border border-slate-100 bg-slate-50/50 text-xs"
                                  >
                                    <div className="flex items-start gap-2">
                                      <span className="font-bold text-slate-700">{opt.id})</span>
                                      <MathRenderer content={opt.text} inline />
                                    </div>
                                    {showAnswerInPreview && val !== undefined && (
                                      <span
                                        className={`font-extrabold px-2 py-0.5 rounded text-[11px] ${
                                          val ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                        }`}
                                      >
                                        {val ? 'ĐÚNG' : 'SAI'}
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {showAnswerInPreview && q.explanation && (
                            <div className="mt-2 p-3 rounded-xl bg-amber-50/60 border border-amber-200/70 text-xs text-amber-950 space-y-1">
                              <span className="font-bold flex items-center gap-1 text-amber-800">
                                <HelpCircle className="h-3.5 w-3.5" />
                                <span>Lời giải chi tiết:</span>
                              </span>
                              <MathRenderer content={q.explanation} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* PHẦN III: TRẢ LỜI NGẮN */}
              {part3Questions.length > 0 && (
                <div className="space-y-4 pt-4 border-t border-slate-200">
                  <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-extrabold text-slate-800 uppercase tracking-wide">
                    PHẦN III. Câu trắc nghiệm trả lời ngắn (Thí sinh trả lời từ câu 1 đến câu {part3Questions.length})
                  </div>

                  <div className="space-y-6">
                    {part3Questions.map((q, pIdx) => {
                      const globalIdx = questions.findIndex((item) => item.id === q.id) + 1;
                      const ansStr = Array.isArray(q.correct_answer) ? q.correct_answer[0] : String(q.correct_answer || '');
                      return (
                        <div
                          key={q.id}
                          id={`preview-q-${q.id}`}
                          className="space-y-2 text-sm text-slate-900 leading-relaxed scroll-mt-20"
                        >
                          <div className="font-medium">
                            <span className="font-extrabold text-blue-900 mr-2">Câu {globalIdx}.</span>
                            <MathRenderer content={q.content} inline />
                          </div>

                          {showAnswerInPreview && ansStr && (
                            <div className="pl-4 text-xs font-bold text-emerald-800 flex items-center gap-2">
                              <span>Đáp số:</span>
                              <span className="px-2.5 py-1 bg-emerald-100 rounded-lg border border-emerald-300 font-mono text-sm">
                                {ansStr}
                              </span>
                            </div>
                          )}

                          {showAnswerInPreview && q.explanation && (
                            <div className="mt-2 p-3 rounded-xl bg-amber-50/60 border border-amber-200/70 text-xs text-amber-950 space-y-1">
                              <span className="font-bold flex items-center gap-1 text-amber-800">
                                <HelpCircle className="h-3.5 w-3.5" />
                                <span>Lời giải chi tiết:</span>
                              </span>
                              <MathRenderer content={q.explanation} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Chân đề thi */}
              <div className="pt-8 text-center text-xs text-slate-400 font-bold border-t border-slate-200">
                ------------- HẾT -------------
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. CỔNG NẠP ĐỀ THI MỘT CỬA DUY NHẤT (Single Unified Ingestion Modal) */}
      <SingleUnifiedInputModal
        isOpen={showSingleInputModal}
        onClose={() => setShowSingleInputModal(false)}
        onApplyQuestions={(newQuestions, detectedTitle) => {
          if (detectedTitle) setTitle(detectedTitle);
          setQuestionsWithHistory(newQuestions);
          if (newQuestions.length > 0) setActiveQuestionId(newQuestions[0].id);
          setSaveToast(`Đã nạp thành công ${newQuestions.length} câu hỏi vào đề thi!`);
          setTimeout(() => setSaveToast(null), 3000);
        }}
      />

      {/* 4. NGĂN KÉO CÀI ĐẶT ĐỀ THI TỰ ẨN (Slide-out Drawer) */}
      <ExamSettingsDrawer
        isOpen={showSettingsDrawer}
        onClose={() => setShowSettingsDrawer(false)}
        title={title}
        setTitle={setTitle}
        grade={grade}
        setGrade={setGrade}
        duration={duration}
        setDuration={setDuration}
        noTimeLimit={noTimeLimit}
        setNoTimeLimit={setNoTimeLimit}
        code={code}
        setCode={setCode}
        description={description}
        setDescription={setDescription}
        partPoints={partPoints}
        setPartPoints={setPartPoints}
        trueFalseScoring={trueFalseScoring}
        setTrueFalseScoring={setTrueFalseScoring}
        shuffleQuestions={shuffleQuestions}
        setShuffleQuestions={setShuffleQuestions}
        shuffleOptions={shuffleOptions}
        setShuffleOptions={setShuffleOptions}
        shuffleTrueFalse={shuffleTrueFalse}
        setShuffleTrueFalse={setShuffleTrueFalse}
        maxAttempts={maxAttempts}
        setMaxAttempts={setMaxAttempts}
        submissionMinMinutes={submissionMinMinutes}
        setSubmissionMinMinutes={setSubmissionMinMinutes}
        maxViolations={maxViolations}
        setMaxViolations={setMaxViolations}
        viewAnswerPolicy={viewAnswerPolicy}
        setViewAnswerPolicy={setViewAnswerPolicy}
        assignedClasses={assignedClasses}
        setAssignedClasses={setAssignedClasses}
        classes={classes}
      />

      {/* Toast thông báo nổi */}
      {saveToast && (
        <div className="fixed bottom-5 right-5 z-50 rounded-2xl bg-slate-900/95 text-white px-4 py-2.5 text-xs font-extrabold shadow-2xl flex items-center gap-2 border border-slate-700 animate-in fade-in slide-in-from-bottom-3">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>{saveToast}</span>
        </div>
      )}
    </div>
  );
}

export default function ExamEditorPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen flex items-center justify-center bg-slate-50">
          <div className="text-xs font-bold text-slate-500">Đang khởi tạo không gian soạn thảo đề thi...</div>
        </div>
      }
    >
      <ExamEditorContent />
    </Suspense>
  );
}
