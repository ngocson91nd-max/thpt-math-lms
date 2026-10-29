'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Exam, Question, QuestionType, QuestionDifficulty, ClassItem } from '@/types/database';
import { MOCK_EXAMS, MOCK_QUESTIONS, MOCK_CLASSES } from '@/lib/supabase/mockStore';
import { parseExamLatex } from '@/lib/latex/examParser';
import MathRenderer from '@/components/math/MathRenderer';
import MathEditor from '@/components/math/MathEditor';
import { parseQuickAnswerKey, buildPdfExamQuestions, trimPdfPages, getPdfPageCount, maskPdfAnswerKey } from '@/lib/pdf/pdfExamHelper';
import { savePdfToIndexedDb, getPdfFromIndexedDb } from '@/lib/pdf/pdfStorage';

const PdfExamViewer = dynamic(() => import('@/components/exam/PdfExamViewer'), { ssr: false });
import {
  Sparkles,
  FileText,
  Save,
  Eye,
  Plus,
  Trash2,
  Copy,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  HelpCircle,
  Pencil,
  BookOpen,
  Download,
  Upload,
  RefreshCw,
  X,
  Search,
  Check,
  ArrowUpRight,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Printer,
  Table as TableIcon,
  Layers,
  Undo,
  Redo,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Superscript,
  Subscript,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Sigma,
  Image as ImageIcon,
  Wand2,
  Scissors,
  Lock,
  Unlock,
  ShieldAlert,
  Star,
  Sliders,
  Settings,
  Radio,
  Loader2,
  FileCode,
} from 'lucide-react';

function ExamEditorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const examIdParam = searchParams.get('id');
  const isNewParam = searchParams.get('new');

  const { user, isTeacher, isStudent } = useAuth();

  // BẢO VỆ ROUTE: Học sinh tuyệt đối không được phép vào trang soạn thảo / sửa đề thi!
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

  // 1. Thông tin tổng quát của đề thi
  const [examId, setExamId] = useState<string>(() => examIdParam || `exam-${Date.now()}`);
  const [title, setTitle] = useState('Đề Thi Thử Tốt Nghiệp THPT 2025 Môn Toán (Chuẩn Bộ GD&ĐT)');
  const [grade, setGrade] = useState<10 | 11 | 12>(12);
  const [duration, setDuration] = useState(42);
  const [description, setDescription] = useState('Đề kiểm tra thường, câu xếp theo loại (trắc nghiệm, Đúng/Sai, trả lời ngắn, tự luận), điểm cấu hình theo phần.');
  const [format, setFormat] = useState<'standard_3_parts' | 'periodic_4_parts' | 'custom'>('standard_3_parts');
  const [shuffleQuestions, setShuffleQuestions] = useState(true);

  // 3-Column panels state chuẩn iExam (Ảnh 1-4)
  const [showLeftSettings, setShowLeftSettings] = useState(true);
  const [showRightStructure, setShowRightStructure] = useState(true);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(true);
  const [code, setCode] = useState(() => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  });
  const [noTimeLimit, setNoTimeLimit] = useState(false);
  const [accessType, setAccessType] = useState<'public' | 'restricted'>('restricted');
  const [assignedClasses, setAssignedClasses] = useState<string[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [partPoints, setPartPoints] = useState({ part1: 3, part2: 4, part3: 3, part4: 0 });
  const [trueFalseScoring, setTrueFalseScoring] = useState<'standard_thpt' | 'equal'>('standard_thpt');
  const [maxAttempts, setMaxAttempts] = useState<number>(0);
  const [submissionRestriction, setSubmissionRestriction] = useState<'anytime' | 'min_time'>('anytime');
  const [submissionMinMinutes, setSubmissionMinMinutes] = useState<number>(10);
  const [violationAction, setViolationAction] = useState<'warning_only' | 'lock_exam'>('lock_exam');
  const [maxViolations, setMaxViolations] = useState<number>(3);
  const [viewAnswerPolicy, setViewAnswerPolicy] = useState<'immediately' | 'after_closed' | 'specific_time'>('immediately');
  const [viewScoreAllowed, setViewScoreAllowed] = useState(true);
  const [viewLeaderboardAllowed, setViewLeaderboardAllowed] = useState(true);
  const [shuffleOptions, setShuffleOptions] = useState(true);
  const [shuffleTrueFalse, setShuffleTrueFalse] = useState(true);
  const [autoRandomPick, setAutoRandomPick] = useState(false);
  const [openTime, setOpenTime] = useState('');
  const [closeTime, setCloseTime] = useState('');
  const [showUploadPopover, setShowUploadPopover] = useState(false);
  const [popoverFileMode, setPopoverFileMode] = useState<'thcs_thpt' | 'dinh_ky'>('thcs_thpt');
  const [activeQuestionSetTab, setActiveQuestionSetTab] = useState('set-1');
  const [questionSets, setQuestionSets] = useState([{ id: 'set-1', name: 'Bộ câu hỏi 1' }]);

  // 2. Danh sách câu hỏi trong đề thi
  const [questions, setQuestions] = useState<Question[]>([]);

  // 3. Quản lý trạng thái giao diện & Modal
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [tempQuestionEdit, setTempQuestionEdit] = useState<Question | null>(null);

  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [showAnswerMatrixModal, setShowAnswerMatrixModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showBankPickerModal, setShowBankPickerModal] = useState(false);

  // Import file Tab & State
  const [importTab, setImportTab] = useState<'word' | 'latex' | 'pdf'>('word');
  const [isParsingWord, setIsParsingWord] = useState(false);
  const [wordNotice, setWordNotice] = useState<string | null>(null);
  const [latexInput, setLatexInput] = useState('');
  const [latexNotice, setLatexNotice] = useState<string | null>(null);

  // Chế độ đề thi & File PDF
  const [examMode, setExamMode] = useState<'interactive' | 'pdf_view'>('interactive');
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [pdfFileName, setPdfFileName] = useState<string>('');
  const [solutionPdfUrl, setSolutionPdfUrl] = useState<string>('');
  const [solutionPdfFileName, setSolutionPdfFileName] = useState<string>('');
  const [quickAnswerText, setQuickAnswerText] = useState<string>(
    '1A 2B 3C 4D 5A 6B 7C 8D 9A 10B 11C 12D\n13: aD bS cD dS\n14: aS bD cD dS\n15: aD bD cS dS\n16: aD bD cS dD\n17: 1440\n18: -2.5\n19: 12\n20: 3/4\n21: 5\n22: 10'
  );
  const [pdfPart1Count, setPdfPart1Count] = useState(12);
  const [pdfPart2Count, setPdfPart2Count] = useState(4);
  const [pdfPart3Count, setPdfPart3Count] = useState(6);
  const [pdfTotalPages, setPdfTotalPages] = useState<number>(1);
  const [cutLastPage, setCutLastPage] = useState<boolean>(true);

  // Câu hỏi đang được chọn (focus) trên trang
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);

  // Lịch sử Undo / Redo
  const [history, setHistory] = useState<Question[][]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // AI Generation State
  const [aiTopic, setAiTopic] = useState('Khảo sát hàm số & Ứng dụng đạo hàm');
  const [aiCount, setAiCount] = useState(4);
  const [aiDifficulty, setAiDifficulty] = useState<QuestionDifficulty>('thong_hieu');
  const [isAiGenerating, setIsAiGenerating] = useState(false);

  // Ngân hàng câu hỏi gốc để chọn
  const [bankQuestions, setBankQuestions] = useState<Question[]>([]);
  const [bankSearch, setBankSearch] = useState('');
  const [bankPartFilter, setBankPartFilter] = useState<'all' | 1 | 2 | 3 | 4>('all');
  const [saveToBank, setSaveToBank] = useState<boolean>(false);

  // Lưu thông báo lưu thành công
  const [saveToast, setSaveToast] = useState<string | null>(null);

  // Tải dữ liệu đề thi và lớp học khi vào trang
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Tải danh sách lớp học thực tế & loại bỏ các lớp đã xóa vĩnh viễn
    const savedDeletedCls = localStorage.getItem('lms_deleted_class_ids');
    const deletedClassIds = new Set<string>(savedDeletedCls ? JSON.parse(savedDeletedCls) : []);

    const savedClasses = localStorage.getItem('lms_classes');
    let loadedClasses: ClassItem[] = [];
    if (savedClasses) {
      try {
        const parsedCls = JSON.parse(savedClasses);
        if (Array.isArray(parsedCls)) {
          loadedClasses = parsedCls.filter(
            (c: any) => !deletedClassIds.has(c.id) && !deletedClassIds.has(c.code)
          );
          setClasses(loadedClasses);
        }
      } catch {}
    } else {
      loadedClasses = MOCK_CLASSES.filter(
        (c) => !deletedClassIds.has(c.id) && !deletedClassIds.has(c.code)
      );
      setClasses(loadedClasses);
    }

    // Đọc class param từ URL nếu có (ví dụ khi tạo đề từ trang chi tiết lớp)
    const classFromUrl = searchParams.get('class');
    if (!examIdParam) {
      if (classFromUrl) {
        setAssignedClasses([classFromUrl]);
      } else if (loadedClasses.length > 0) {
        // Mặc định chọn các lớp hiện có của giáo viên
        setAssignedClasses(loadedClasses.map((c) => c.name));
      }
    }

    // Tải ngân hàng câu hỏi
    const savedBank = localStorage.getItem('lms_questions');
    if (savedBank) {
      try {
        const parsed = JSON.parse(savedBank);
        if (Array.isArray(parsed) && parsed.length > 0) setBankQuestions(parsed);
      } catch {}
    }

    // Nếu sửa đề thi đã có
    if (examIdParam) {
      // Kiểm tra xem đề này đã bị xóa vĩnh viễn chưa
      const savedDeleted = localStorage.getItem('lms_deleted_exam_ids');
      const deletedIds = new Set<string>(savedDeleted ? JSON.parse(savedDeleted) : []);
      if (deletedIds.has(examIdParam)) {
        alert('Đề thi này đã bị xóa vĩnh viễn khỏi hệ thống!');
        router.push('/exams');
        return;
      }

      const savedExams = localStorage.getItem('lms_exams');
      let found: Exam | undefined;
      if (savedExams) {
        try {
          const parsed = JSON.parse(savedExams);
          found = parsed.find((e: Exam) => e.id === examIdParam);
        } catch {}
      }

      if (found) {
        setExamId(found.id);
        if (found.code) setCode(found.code);
        setTitle(found.title);
        setGrade(found.grade);
        setDuration(found.duration_minutes);
        setDescription(found.description || '');
        setFormat(found.format || (found.questions?.some((q) => q.part === 4) ? 'periodic_4_parts' : 'standard_3_parts'));
        setShuffleQuestions(found.shuffle_questions !== undefined ? found.shuffle_questions : true);
        if (found.assigned_classes) setAssignedClasses(found.assigned_classes);
        if (found.part_points) setPartPoints({ ...partPoints, ...found.part_points });
        if (found.access_type) setAccessType(found.access_type);
        if (found.no_time_limit !== undefined) setNoTimeLimit(found.no_time_limit);
        if (found.true_false_scoring) setTrueFalseScoring(found.true_false_scoring);
        if (found.violation_action) setViolationAction(found.violation_action);
        if (found.max_violations) setMaxViolations(found.max_violations);
        if (found.view_answer_policy) setViewAnswerPolicy(found.view_answer_policy);
        if (found.start_time) setOpenTime(found.start_time);
        if (found.end_time) setCloseTime(found.end_time);
        if (found.max_attempts !== undefined) setMaxAttempts(found.max_attempts);
        if (found.exam_mode) setExamMode(found.exam_mode);
        if (found.pdf_url) {
          if (found.pdf_url.startsWith('idb:')) {
            const idbKey = found.pdf_url.replace('idb:', '');
            getPdfFromIndexedDb(idbKey).then((data) => {
              if (data) setPdfUrl(data);
            });
          } else {
            setPdfUrl(found.pdf_url);
          }
        }
        if (found.solution_pdf_url) {
          if (found.solution_pdf_url.startsWith('idb:')) {
            const idbKey = found.solution_pdf_url.replace('idb:', '');
            getPdfFromIndexedDb(idbKey).then((data) => {
              if (data) setSolutionPdfUrl(data);
            });
          } else {
            setSolutionPdfUrl(found.solution_pdf_url);
          }
        }

        const initialQuestions = found.questions && found.questions.length > 0 ? found.questions : MOCK_QUESTIONS.slice(0, 12);
        setQuestions(initialQuestions);
        setHistory([initialQuestions]);
        setHistoryIndex(0);
        if (initialQuestions.length > 0) setActiveQuestionId(initialQuestions[0].id);
        return;
      }
    }

    // Nếu tạo đề mới và chưa có câu hỏi
    if (questions.length === 0) {
      if (isNewParam === '1') {
        // Bắt đầu với đề thi mới để giáo viên dễ dàng nhập file Word / LaTeX / PDF
        setQuestions([]);
        setHistory([[]]);
        setHistoryIndex(0);
        setTitle('Đề Thi Toán THPT Mới Tạo');
      } else {
        const initial = MOCK_QUESTIONS.slice(0, 7);
        setQuestions(initial);
        setHistory([initial]);
        setHistoryIndex(0);
        setActiveQuestionId(initial[0].id);
      }
    }
  }, [examIdParam]);

  // Phân nhóm câu hỏi theo 4 phần
  const part1Questions = useMemo(() => questions.filter((q) => q.part === 1 || q.type === 'single_choice' || q.type === 'multiple_choice'), [questions]);
  const part2Questions = useMemo(() => questions.filter((q) => q.part === 2 || q.type === 'true_false'), [questions]);
  const part3Questions = useMemo(() => questions.filter((q) => q.part === 3 || q.type === 'short_answer'), [questions]);
  const part4Questions = useMemo(() => questions.filter((q) => q.part === 4 || q.type === 'essay'), [questions]);

  // Cập nhật câu hỏi có lưu vết lịch sử (phục vụ Undo / Redo)
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

  // Hoàn tác (Undo)
  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevQuestions = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      setQuestions(prevQuestions);
      setSaveToast('Đã hoàn tác (Undo)!');
      setTimeout(() => setSaveToast(null), 2000);
    }
  };

  // Làm lại (Redo)
  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextQuestions = history[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      setQuestions(nextQuestions);
      setSaveToast('Đã làm lại (Redo)!');
      setTimeout(() => setSaveToast(null), 2000);
    }
  };

  // Áp dụng định dạng từ Ribbon Toolbar trực tiếp vào câu hỏi đang chọn hoặc đang sửa
  const handleApplyFormatting = (type: 'bold' | 'italic' | 'underline' | 'math' | 'table' | 'tikz') => {
    let snippet = '';
    if (type === 'bold') snippet = '\\textbf{in đậm}';
    else if (type === 'italic') snippet = '\\textit{in nghiêng}';
    else if (type === 'underline') snippet = '\\underline{gạch chân}';
    else if (type === 'math') snippet = '$x = \\dfrac{-b \\pm \\sqrt{\\Delta}}{2a}$';
    else if (type === 'table') snippet = '\n\\begin{tabular}{|c|c|c|}\\hline Nhóm & [0;20) & [20;40) \\\\\\hline Số lượng & 5 & 10 \\\\\\hline\\end{tabular}\n';
    else if (type === 'tikz') snippet = '\n\\begin{tikzpicture}\n  \\tkzTabInit[nocadre=false,lgt=1.2,espcl=2.5,deltacl=0.6]{$x$/0.8,$y\'$/0.8,$y$/2}{$-\\infty$,-1,1,$+\\infty$}\n  \\tkzTabLine{,+,0,-,0,+,}\n  \\tkzTabVar{-/$-\\infty$,+/$5$,-/$-2$,+/$+\\infty$}\n\\end{tikzpicture}\n';

    // 1. Nếu đang mở khung soạn thảo chi tiết của một câu hỏi
    if (editingQuestionId && tempQuestionEdit) {
      setTempQuestionEdit({
        ...tempQuestionEdit,
        content: tempQuestionEdit.content ? `${tempQuestionEdit.content} ${snippet}` : snippet,
      });
      setSaveToast(`Đã chèn vào nội dung câu đang sửa!`);
      setTimeout(() => setSaveToast(null), 2500);
      return;
    }

    // 2. Nếu đã chọn một câu hỏi trên trang (activeQuestionId) hoặc lấy câu đầu tiên
    const targetQId = activeQuestionId || questions[0]?.id;
    if (!targetQId) {
      setSaveToast('Vui lòng thêm hoặc bấm chọn một câu hỏi để thao tác!');
      setTimeout(() => setSaveToast(null), 2500);
      return;
    }

    const targetQ = questions.find((q) => q.id === targetQId);
    if (targetQ) {
      setEditingQuestionId(targetQ.id);
      setTempQuestionEdit({
        ...targetQ,
        content: targetQ.content ? `${targetQ.content} ${snippet}` : snippet,
      });
      const qIndex = questions.findIndex((q) => q.id === targetQ.id) + 1;
      setSaveToast(`Đã mở và chèn vào Câu ${qIndex}!`);
      setTimeout(() => setSaveToast(null), 2500);
    }
  };

  // Xử lý nạp file PDF đề bài
  const handleUploadPdfFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      alert('Vui lòng chọn file định dạng .pdf!');
      return;
    }

    setPdfFileName(file.name);
    setTitle(file.name.replace(/\.[^/.]+$/, ''));
    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      const pages = await getPdfPageCount(dataUrl);
      setPdfTotalPages(pages);

      // Tự động che bảng đáp án ở đáy trang cuối ngay khi tải lên (không xóa cả trang, giữ trọn vẹn câu hỏi)
      try {
        const masked = await maskPdfAnswerKey(dataUrl, { bottomRatio: 0.32 });
        setPdfUrl(masked.maskedDataUrl);
      } catch (err) {
        setPdfUrl(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  // Tự động che bảng đáp án ở đáy trang cuối (không cắt cả trang)
  const handleMaskPdfExam = async (ratio: number = 0.32) => {
    if (!pdfUrl) return;
    try {
      const res = await maskPdfAnswerKey(pdfUrl, { bottomRatio: ratio });
      setPdfUrl(res.maskedDataUrl);
      setSaveToast('Đã tự động che bảng đáp án ở đáy trang cuối! (Giữ trọn vẹn câu hỏi)');
      setTimeout(() => setSaveToast(null), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  // Cắt bỏ trang cuối chứa bảng đáp án / lời giải (nếu là trang riêng biệt)
  const handleTrimPdfExam = async () => {
    if (!pdfUrl) return;
    const res = await trimPdfPages(pdfUrl, { removeLastPage: true });
    setPdfUrl(res.trimmedDataUrl);
    setPdfTotalPages(res.totalNew);
    setSaveToast(`Đã cắt bỏ trang cuối! Đề thi hiện còn ${res.totalNew} trang.`);
    setTimeout(() => setSaveToast(null), 3500);
  };

  // Xử lý nạp file PDF lời giải
  const handleUploadSolutionPdf = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSolutionPdfFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setSolutionPdfUrl(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  // Tạo đề thi PDF từ file và chuỗi đáp án
  const handleApplyPdfExam = async () => {
    if (!pdfUrl) {
      alert('Vui lòng tải lên file PDF đề thi trước khi tạo đề!');
      return;
    }

    let targetPdf = pdfUrl;
    let trimmedMsg = '';

    // Tự động che bảng đáp án ở đáy trang cuối nếu giáo viên bật (giữ trọn vẹn câu hỏi)
    if (cutLastPage) {
      try {
        const res = await maskPdfAnswerKey(targetPdf, { bottomRatio: 0.32 });
        targetPdf = res.maskedDataUrl;
        setPdfUrl(targetPdf);
        trimmedMsg = ' (Đã tự động che bảng đáp án)';
      } catch (err) {
        console.warn(err);
      }
    }

    const parsed = parseQuickAnswerKey(quickAnswerText);
    const generated = buildPdfExamQuestions(pdfPart1Count, pdfPart2Count, pdfPart3Count, parsed);

    setQuestionsWithHistory(generated);
    setActiveQuestionId(generated[0]?.id);
    setExamMode('pdf_view');
    setShowImportModal(false);
    setSaveToast(`Đã tạo đề thi PDF thành công với ${generated.length} câu hỏi!${trimmedMsg}`);
    setTimeout(() => setSaveToast(null), 3500);
  };

  // Tổng số câu & tổng điểm
  const totalQuestions = questions.length;
  const totalScore = useMemo(() => {
    return questions.reduce((sum, q) => sum + (q.points || 0), 0);
  }, [questions]);

  // Mở trình soạn thảo câu hỏi
  const handleStartEditQuestion = (q: Question) => {
    setActiveQuestionId(q.id);
    setEditingQuestionId(q.id);
    setTempQuestionEdit(JSON.parse(JSON.stringify(q)));
  };

  // Lưu chỉnh sửa câu hỏi
  const handleSaveQuestionEdit = () => {
    if (!tempQuestionEdit) return;
    setQuestionsWithHistory((prev) => prev.map((q) => (q.id === tempQuestionEdit.id ? tempQuestionEdit : q)));
    setEditingQuestionId(null);
    setTempQuestionEdit(null);
  };

  // Hủy chỉnh sửa câu hỏi
  const handleCancelQuestionEdit = () => {
    setEditingQuestionId(null);
    setTempQuestionEdit(null);
  };

  // Xóa câu hỏi khỏi đề
  const handleDeleteQuestion = (qId: string) => {
    setQuestionsWithHistory((prev) => prev.filter((q) => q.id !== qId));
    if (editingQuestionId === qId) {
      setEditingQuestionId(null);
      setTempQuestionEdit(null);
    }
  };

  // Nhân bản câu hỏi
  const handleDuplicateQuestion = (q: Question) => {
    const copy: Question = {
      ...JSON.parse(JSON.stringify(q)),
      id: `q-dup-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    };
    const idx = questions.findIndex((item) => item.id === q.id);
    const newArr = [...questions];
    newArr.splice(idx + 1, 0, copy);
    setQuestionsWithHistory(newArr);
    setActiveQuestionId(copy.id);
  };

  // Di chuyển thứ tự câu hỏi
  const handleMoveQuestion = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= questions.length) return;
    const newArr = [...questions];
    const temp = newArr[index];
    newArr[index] = newArr[targetIdx];
    newArr[targetIdx] = temp;
    setQuestionsWithHistory(newArr);
  };

  // Thêm câu hỏi rỗng vào một phần cụ thể
  const handleAddEmptyQuestion = (targetPart: 1 | 2 | 3 | 4) => {
    let type: QuestionType = 'single_choice';
    let points = 0.25;
    let options: any = [];
    let correctAnswer: any = 'A';

    if (targetPart === 1) {
      type = 'single_choice';
      points = 0.25;
      options = [
        { id: 'A', text: 'Phương án A' },
        { id: 'B', text: 'Phương án B' },
        { id: 'C', text: 'Phương án C' },
        { id: 'D', text: 'Phương án D' },
      ];
      correctAnswer = 'A';
    } else if (targetPart === 2) {
      type = 'true_false';
      points = 1.0;
      options = [
        { id: 'a', text: 'Mệnh đề phát biểu a' },
        { id: 'b', text: 'Mệnh đề phát biểu b' },
        { id: 'c', text: 'Mệnh đề phát biểu c' },
        { id: 'd', text: 'Mệnh đề phát biểu d' },
      ];
      correctAnswer = { a: true, b: false, c: true, d: false };
    } else if (targetPart === 3) {
      type = 'short_answer';
      points = 0.5;
      correctAnswer = ['0'];
    } else {
      type = 'essay';
      points = 2.0;
      correctAnswer = 'Hướng dẫn chấm bài tự luận';
    }

    const newQ: Question = {
      id: `q-new-${Date.now()}`,
      teacher_id: user?.id || '22222222-2222-2222-2222-222222222222',
      grade,
      topic: 'Giải tích & Hình học THPT',
      part: targetPart,
      difficulty: targetPart === 1 ? 'thong_hieu' : 'van_dung',
      type,
      content: `Nội dung câu hỏi mới phần ${targetPart}...`,
      options,
      correct_answer: correctAnswer,
      explanation: 'Lời giải chi tiết bài toán...',
      points,
      is_public: true,
    };

    setQuestionsWithHistory((prev) => [...prev, newQ]);
    setActiveQuestionId(newQ.id);
    handleStartEditQuestion(newQ);
  };

  // Format đề: Tự động sắp xếp câu hỏi theo thứ tự Phần I -> II -> III -> IV và chuẩn hóa điểm số
  const handleAutoFormatExam = () => {
    const sorted = [...questions].sort((a, b) => {
      const partA = a.part || 1;
      const partB = b.part || 1;
      return partA - partB;
    });

    const normalized = sorted.map((q) => {
      let p = q.points;
      if (q.part === 1) p = 0.25;
      else if (q.part === 2) p = 1.0;
      else if (q.part === 3) p = 0.5;
      else if (q.part === 4) p = 2.0;
      return { ...q, points: p };
    });

    setQuestionsWithHistory(normalized);
    setSaveToast('Đã tự động chuẩn hóa và phân chia các Phần I, II, III, IV thành công!');
    setTimeout(() => setSaveToast(null), 3500);
  };

  // Xử lý nạp file thông minh đa định dạng (Word .docx, LaTeX .tex, PDF .pdf)
  const handleUniversalFileUpload = async (file: File) => {
    if (!file) return;
    const name = file.name.toLowerCase();

    // 1. File Microsoft Word (.docx)
    if (name.endsWith('.docx')) {
      setIsParsingWord(true);
      setWordNotice(null);
      try {
        let extractedQuestions: Question[] = [];

        // Thử parse bằng bộ parser client (hỗ trợ MathType WMF vector, công thức OMML)
        try {
          const { parseWordDocx, convertWmfQuestionsToPng } = await import('@/lib/word/wordExamParser');
          const res = await parseWordDocx(file);
          if (res.questions && res.questions.length > 0) {
            extractedQuestions = convertWmfQuestionsToPng(res.questions);
          }
        } catch (clientErr) {
          console.warn('Client parser failed, falling back to API:', clientErr);
        }

        // Dự phòng API backend nếu client gặp sự cố
        if (extractedQuestions.length === 0) {
          try {
            const fd = new FormData();
            fd.append('file', file);
            const res = await fetch('/api/upload-docx', { method: 'POST', body: fd });
            if (res.ok) {
              const data = await res.json();
              if (data.success && Array.isArray(data.questions) && data.questions.length > 0) {
                extractedQuestions = data.questions;
              }
            }
          } catch (err) {
            console.warn('API upload-docx failed:', err);
          }
        }

        if (extractedQuestions.length > 0) {
          const { convertWmfQuestionsToPng } = await import('@/lib/word/wordExamParser');
          extractedQuestions = convertWmfQuestionsToPng(extractedQuestions);
          setQuestionsWithHistory(extractedQuestions);
          setActiveQuestionId(extractedQuestions[0]?.id);
          setExamMode('interactive');
          setTitle(file.name.replace(/\.[^/.]+$/, ''));
          setWordNotice(`Đã trích xuất thành công ${extractedQuestions.length} câu hỏi từ file "${file.name}"!`);
          setShowImportModal(false);
          setShowUploadPopover(false);
          setSaveToast(`Đã nạp thành công ${extractedQuestions.length} câu hỏi từ file Word "${file.name}"!`);
          setTimeout(() => setSaveToast(null), 3500);
        } else {
          const msg = 'Không tìm thấy câu hỏi nào hợp lệ trong file Word! Hệ thống hỗ trợ định dạng "Câu 1:", "Bài 1:" kèm phương án A, B, C, D hoặc [Đúng]/[Sai].';
          setWordNotice(msg);
          alert(msg);
        }
      } catch (err: any) {
        const msg = `Lỗi đọc file Word: ${err?.message || 'Không xác định'}`;
        setWordNotice(msg);
        alert(msg);
      } finally {
        setIsParsingWord(false);
      }
      return;
    }

    // 2. File LaTeX (.tex hoặc .txt)
    if (name.endsWith('.tex') || name.endsWith('.txt')) {
      setIsParsingWord(true);
      try {
        const text = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve((e.target?.result as string) || '');
          reader.onerror = reject;
          reader.readAsText(file, 'utf-8');
        });

        setLatexInput(text);
        const { questions: parsedQ, metadata } = parseExamLatex(text);
        if (parsedQ.length > 0) {
          if (metadata.title) setTitle(metadata.title);
          else setTitle(file.name.replace(/\.[^/.]+$/, ''));
          if (metadata.duration) setDuration(metadata.duration);

          setQuestionsWithHistory(parsedQ);
          setActiveQuestionId(parsedQ[0]?.id);
          setExamMode('interactive');
          setShowImportModal(false);
          setShowUploadPopover(false);
          setSaveToast(`Đã trích xuất thành công ${parsedQ.length} câu hỏi từ file LaTeX "${file.name}"!`);
          setTimeout(() => setSaveToast(null), 3500);
        } else {
          setImportTab('latex');
          setShowImportModal(true);
          setShowUploadPopover(false);
          setLatexNotice(`Đã nạp file "${file.name}". Không tìm thấy khối \\begin{ex}...\\end{ex}. Thầy/cô vui lòng kiểm tra mã nguồn.`);
        }
      } catch (err: any) {
        alert(`Lỗi đọc file LaTeX: ${err?.message || 'Không xác định'}`);
      } finally {
        setIsParsingWord(false);
      }
      return;
    }

    // 3. File PDF (.pdf)
    if (name.endsWith('.pdf')) {
      setIsParsingWord(true);
      try {
        setPdfFileName(file.name);
        setTitle(file.name.replace(/\.[^/.]+$/, ''));
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve((e.target?.result as string) || '');
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const pages = await getPdfPageCount(dataUrl);
        setPdfTotalPages(pages);

        let finalUrl = dataUrl;
        try {
          const masked = await maskPdfAnswerKey(dataUrl, { bottomRatio: 0.32 });
          finalUrl = masked.maskedDataUrl;
        } catch (err) {
          console.warn('PDF masking skipped:', err);
        }
        setPdfUrl(finalUrl);

        // Lưu vào IndexedDB
        const idbKey = `pdf_${Date.now()}`;
        savePdfToIndexedDb(idbKey, finalUrl).catch(() => {});

        // Sinh cấu trúc câu hỏi OMR mặc định (12 câu TN, 4 Đ/S, 6 Điền số = 22 câu)
        if (questions.length === 0 || questions.every((q) => q.id.startsWith('mock-'))) {
          const parsed = parseQuickAnswerKey(quickAnswerText);
          const generated = buildPdfExamQuestions(pdfPart1Count, pdfPart2Count, pdfPart3Count, parsed);
          setQuestionsWithHistory(generated);
          setActiveQuestionId(generated[0]?.id);
        }

        setExamMode('pdf_view');
        setShowImportModal(false);
        setShowUploadPopover(false);
        setSaveToast(`Đã nạp file PDF "${file.name}" (${pages} trang) thành công!`);
        setTimeout(() => setSaveToast(null), 3500);
      } catch (err: any) {
        alert(`Lỗi đọc file PDF: ${err?.message || 'Không xác định'}`);
      } finally {
        setIsParsingWord(false);
      }
      return;
    }

    alert('Định dạng file không được hỗ trợ! Vui lòng chọn file Word (.docx), LaTeX (.tex) hoặc PDF (.pdf).');
  };

  // Wrapper cho các input file
  const handleUploadDocx = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUniversalFileUpload(file);
    e.target.value = '';
  };

  // Xử lý nạp mã LaTeX
  const handleParseLatexInput = () => {
    if (!latexInput.trim()) {
      setLatexNotice('Vui lòng dán mã nguồn LaTeX gói ex_test vào ô bên dưới!');
      return;
    }

    try {
      const { questions: parsedQ, metadata } = parseExamLatex(latexInput);
      if (parsedQ.length === 0) {
        setLatexNotice('Không tìm thấy khối \\begin{ex}...\\end{ex} nào trong đoạn mã!');
        return;
      }

      if (metadata.title) setTitle(metadata.title);
      if (metadata.duration) setDuration(metadata.duration);

      setQuestionsWithHistory(parsedQ);
      setActiveQuestionId(parsedQ[0]?.id);
      setExamMode('interactive');
      setShowImportModal(false);
      setSaveToast(`Đã trích xuất thành công ${parsedQ.length} câu hỏi LaTeX vào trang soạn thảo!`);
      setTimeout(() => setSaveToast(null), 3500);
    } catch (err: any) {
      setLatexNotice(`Lỗi phân tích cú pháp LaTeX: ${err?.message || 'Không xác định'}`);
    }
  };

  // Sinh đề bằng AI
  const handleGenerateAiQuestions = () => {
    setIsAiGenerating(true);
    setTimeout(() => {
      // Giả lập sinh câu hỏi chất lượng cao THPT
      const generated: Question[] = [];
      for (let i = 1; i <= aiCount; i++) {
        generated.push({
          id: `ai-q-${Date.now()}-${i}`,
          teacher_id: user?.id || '22222222-2222-2222-2222-222222222222',
          grade,
          topic: aiTopic,
          part: 1,
          difficulty: aiDifficulty,
          type: 'single_choice',
          content: `Cho hàm số $y = f(x)$ xác định trên $\\mathbb{R}$ có bảng xét dấu đạo hàm. Điểm cực tiểu của hàm số $g(x) = f(x^2 - 2x + ${i})$ là:`,
          options: [
            { id: 'A', text: `$x = 1$` },
            { id: 'B', text: `$x = -1$` },
            { id: 'C', text: `$x = 2$` },
            { id: 'D', text: `$x = 0$` },
          ],
          correct_answer: 'A',
          explanation: `Xét $g'(x) = (2x - 2)f'(x^2 - 2x + ${i}) = 0 \\iff x = 1$. Lập bảng biến thiên kết luận điểm cực tiểu là $x = 1$.`,
          points: 0.25,
          is_public: true,
        });
      }
      setQuestionsWithHistory((prev) => [...prev, ...generated]);
      setIsAiGenerating(false);
      setShowAiModal(false);
      setSaveToast(`AI đã sinh thêm ${aiCount} câu hỏi chuẩn cấu trúc vào đề thi!`);
      setTimeout(() => setSaveToast(null), 3500);
    }, 1200);
  };

  // Lưu đề thi vào Storage & CSDL
  const handleSaveExam = () => {
    if (!title.trim()) {
      alert('Vui lòng nhập tiêu đề cho đề thi!');
      return;
    }

    // Nếu có file PDF lớn, lưu vào IndexedDB và lưu id tham chiếu
    let storedPdfUrl = pdfUrl;
    let storedSolutionPdfUrl = solutionPdfUrl;

    if (pdfUrl) {
      const idbKey = `pdf_${examId}`;
      savePdfToIndexedDb(idbKey, pdfUrl, pdfFileName);
      if (pdfUrl.length > 500000) {
        storedPdfUrl = `idb:${idbKey}`;
      }
    }

    if (solutionPdfUrl) {
      const idbSolKey = `sol_pdf_${examId}`;
      savePdfToIndexedDb(idbSolKey, solutionPdfUrl, solutionPdfFileName);
      if (solutionPdfUrl.length > 500000) {
        storedSolutionPdfUrl = `idb:${idbSolKey}`;
      }
    }

    const updatedExam: Exam = {
      id: examId,
      code,
      title: title.trim(),
      description: description.trim(),
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
      exam_mode: examMode,
      assigned_classes: assignedClasses,
      access_type: accessType,
      no_time_limit: noTimeLimit,
      part_points: partPoints,
      true_false_scoring: trueFalseScoring,
      submission_restriction: submissionRestriction,
      submission_min_minutes: submissionMinMinutes,
      violation_action: violationAction,
      max_violations: maxViolations,
      view_answer_policy: viewAnswerPolicy,
      view_score_allowed: viewScoreAllowed,
      view_leaderboard_allowed: viewLeaderboardAllowed,
      start_time: openTime || undefined,
      end_time: closeTime || undefined,
      pdf_url: storedPdfUrl,
      solution_pdf_url: storedSolutionPdfUrl,
      pdf_total_pages: pdfTotalPages,
      pdf_cut_last_page: cutLastPage,
      part_structure: {
        part1_count: part1Questions.length,
        part2_count: part2Questions.length,
        part3_count: part3Questions.length,
        part4_count: part4Questions.length,
      },
      is_view_answer_allowed: true,
      questions: questions.map((q, idx) => ({
        ...q,
        order_index: idx + 1,
        custom_points: q.points,
      })),
      updated_at: new Date().toISOString(),
    };

    if (typeof window !== 'undefined') {
      try {
        const savedDeleted = localStorage.getItem('lms_deleted_exam_ids');
        const deletedIds = new Set<string>(savedDeleted ? JSON.parse(savedDeleted) : []);
        // Xóa đề thi đang lưu khỏi blacklist (nếu có lỡ dính ID hoặc Code trùng với đề đã từng xóa)
        deletedIds.delete(examId);
        if (updatedExam.code) deletedIds.delete(updatedExam.code);
        localStorage.setItem('lms_deleted_exam_ids', JSON.stringify(Array.from(deletedIds)));

        const savedExams = localStorage.getItem('lms_exams');
        let examsList: Exam[] = savedExams ? JSON.parse(savedExams) : MOCK_EXAMS;
        examsList = examsList.filter((e) => !deletedIds.has(e.id) && !deletedIds.has(e.code || ''));
        const existIdx = examsList.findIndex((e) => e.id === examId);
        if (existIdx >= 0) {
          examsList[existIdx] = updatedExam;
        } else {
          examsList = [updatedExam, ...examsList];
        }
        localStorage.setItem('lms_exams', JSON.stringify(examsList));

        // Chỉ lưu câu hỏi vào ngân hàng nếu giáo viên chủ động tick chọn
        if (saveToBank && examMode !== 'pdf_view' && questions.length > 0) {
          try {
            const savedQ = localStorage.getItem('lms_questions');
            let qList: Question[] = savedQ ? JSON.parse(savedQ) : [];
            const qIds = new Set(qList.map((q) => q.id));
            const newItems = questions.filter((q) => !qIds.has(q.id));
            if (newItems.length > 0) {
              const combined = [...newItems, ...qList];
              localStorage.setItem('lms_questions', JSON.stringify(combined));
              fetch('/api/questions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ questions: newItems }),
              }).catch((err) => console.warn('Lỗi lưu câu hỏi vào ngân hàng:', err));
            }
          } catch (e) {
            console.warn(e);
          }
        }
        // Đồng bộ ngầm lên Supabase Cloud API
        fetch('/api/exams', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedExam),
        }).catch((err) => console.warn('Lỗi đồng bộ đề thi lên Cloud:', err));
      } catch (err) {
        console.warn('Lỗi khi lưu localStorage:', err);
      }
    }

    setSaveToast(examMode === 'pdf_view' ? 'Lưu đề thi PDF và bảng đáp án thành công!' : 'Lưu toàn bộ nội dung đề thi thành công!');
    setTimeout(() => {
      setSaveToast(null);
      router.push('/exams');
    }, 200);
  };

  // Cuộn tới phần cụ thể
  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Render một câu hỏi trên trang canvas A4
  const renderQuestionItem = (q: Question, qNum: number) => {
    const isEditing = editingQuestionId === q.id;

    if (isEditing && tempQuestionEdit) {
      return (
        <div
          key={q.id}
          className="rounded-2xl border-2 border-blue-500 bg-blue-50/40 p-5 space-y-4 shadow-md transition-all"
        >
          <div className="flex items-center justify-between border-b border-blue-200 pb-2">
            <span className="font-bold text-xs text-blue-900 uppercase">
              Đang sửa Câu {qNum} (Phần {tempQuestionEdit.part || 1})
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveQuestionEdit}
                className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-bold text-white hover:bg-blue-500 cursor-pointer"
              >
                Xong
              </button>
              <button
                type="button"
                onClick={handleCancelQuestionEdit}
                className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Hủy
              </button>
            </div>
          </div>

          {/* Soạn thảo nội dung câu hỏi */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">Nội dung đề bài:</label>
            <MathEditor
              value={tempQuestionEdit.content}
              onChange={(val) => setTempQuestionEdit({ ...tempQuestionEdit, content: val })}
              rows={3}
            />
          </div>

          {/* Soạn thảo các phương án A, B, C, D (cho Phần I) */}
          {tempQuestionEdit.type === 'single_choice' && Array.isArray(tempQuestionEdit.options) && (
            <div className="space-y-2 pt-2 border-t border-blue-100">
              <label className="block text-[11px] font-bold text-slate-700">4 Phương án (Tích chọn đáp án đúng):</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {tempQuestionEdit.options.map((opt: any, optIdx: number) => {
                  const isCorrect = tempQuestionEdit.correct_answer === opt.id;
                  return (
                    <div
                      key={opt.id}
                      className={`flex items-center gap-2 p-2 rounded-xl border ${
                        isCorrect ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`correct-radio-${tempQuestionEdit.id}`}
                        checked={isCorrect}
                        onChange={() => setTempQuestionEdit({ ...tempQuestionEdit, correct_answer: opt.id })}
                        className="h-4 w-4 text-emerald-600"
                      />
                      <span className="font-bold text-xs text-slate-800">{opt.id}.</span>
                      <input
                        type="text"
                        value={opt.text}
                        onChange={(e) => {
                          const newOpts = [...tempQuestionEdit.options];
                          newOpts[optIdx] = { ...newOpts[optIdx], text: e.target.value };
                          setTempQuestionEdit({ ...tempQuestionEdit, options: newOpts });
                        }}
                        className="flex-1 text-xs p-1 rounded-md border border-slate-200 bg-transparent focus:outline-none"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Soạn thảo các ý Đúng/Sai (cho Phần II) */}
          {tempQuestionEdit.type === 'true_false' && Array.isArray(tempQuestionEdit.options) && (
            <div className="space-y-2 pt-2 border-t border-amber-100">
              <label className="block text-[11px] font-bold text-slate-700">4 Mệnh đề phát biểu a, b, c, d:</label>
              <div className="space-y-2">
                {tempQuestionEdit.options.map((stmt: any, stmtIdx: number) => {
                  const correctMap = tempQuestionEdit.correct_answer || {};
                  const isTrue = !!correctMap[stmt.id];
                  return (
                    <div key={stmt.id} className="flex items-center gap-2 p-2 rounded-xl border border-slate-200 bg-white">
                      <span className="font-bold text-xs text-slate-800">{stmt.id})</span>
                      <input
                        type="text"
                        value={stmt.text}
                        onChange={(e) => {
                          const newOpts = [...tempQuestionEdit.options];
                          newOpts[stmtIdx] = { ...newOpts[stmtIdx], text: e.target.value };
                          setTempQuestionEdit({ ...tempQuestionEdit, options: newOpts });
                        }}
                        className="flex-1 text-xs p-1 rounded-md border border-slate-200 focus:outline-none"
                      />
                      <div className="flex items-center rounded-lg bg-slate-100 p-0.5 text-[11px]">
                        <button
                          type="button"
                          onClick={() => {
                            setTempQuestionEdit({
                              ...tempQuestionEdit,
                              correct_answer: { ...correctMap, [stmt.id]: true },
                            });
                          }}
                          className={`px-2 py-0.5 rounded-md font-bold transition ${
                            isTrue ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                              Đúng
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setTempQuestionEdit({
                              ...tempQuestionEdit,
                              correct_answer: { ...correctMap, [stmt.id]: false },
                            });
                          }}
                          className={`px-2 py-0.5 rounded-md font-bold transition ${
                            !isTrue ? 'bg-rose-600 text-white' : 'text-slate-600 hover:text-slate-900'
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

          {/* Soạn thảo đáp số điền ngắn (cho Phần III) */}
          {tempQuestionEdit.type === 'short_answer' && (
            <div className="pt-2 border-t border-emerald-100">
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Đáp số điền số:</label>
              <input
                type="text"
                value={Array.isArray(tempQuestionEdit.correct_answer) ? tempQuestionEdit.correct_answer[0] : tempQuestionEdit.correct_answer || ''}
                onChange={(e) => {
                  const val = e.target.value.trim();
                  setTempQuestionEdit({
                    ...tempQuestionEdit,
                    correct_answer: [val, val.replace(',', '.')],
                  });
                }}
                placeholder="VD: 5 hoặc 3.14"
                className="w-48 text-xs p-2 rounded-xl border border-slate-300 font-bold text-emerald-800 bg-white"
              />
            </div>
          )}

          {/* Lời giải chi tiết */}
          <div className="pt-2 border-t border-slate-200">
            <label className="block text-[11px] font-bold text-slate-700 mb-1">Lời giải chi tiết:</label>
            <MathEditor
              value={tempQuestionEdit.explanation || ''}
              onChange={(val) => setTempQuestionEdit({ ...tempQuestionEdit, explanation: val })}
              rows={2}
            />
          </div>
        </div>
      );
    }

    // CHẾ ĐỘ HIỂN THỊ CÂU HỎI TRÊN TRANG IN ẤN
    return (
      <div
        key={q.id}
        onClick={() => setActiveQuestionId(q.id)}
        className={`group relative rounded-xl border p-3.5 transition-all cursor-pointer ${
          activeQuestionId === q.id
            ? 'border-blue-500 bg-blue-50/30 shadow-xs ring-2 ring-blue-200'
            : 'border-transparent hover:border-slate-300 hover:bg-slate-50/50'
        }`}
      >
        {/* Thanh công cụ nổi khi hover vào câu hỏi */}
        <div className="absolute right-2 top-2 hidden group-hover:flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-2 py-1 shadow-sm z-10">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleStartEditQuestion(q);
            }}
            className="p-1 hover:bg-blue-50 text-blue-600 rounded-md transition cursor-pointer"
            title="Sửa câu hỏi này"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleDuplicateQuestion(q);
            }}
            className="p-1 hover:bg-slate-100 text-slate-600 rounded-md transition cursor-pointer"
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
            className="p-1 hover:bg-rose-50 text-rose-600 rounded-md transition cursor-pointer"
            title="Xóa câu hỏi"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Tiêu đề & Nội dung đề bài */}
        <div className="leading-relaxed text-base sm:text-[17px] text-slate-900 font-medium">
          <span className="font-extrabold text-blue-900 mr-2">Câu {qNum}.</span>
          <MathRenderer content={q.content} inline />
        </div>

        {/* Các phương án A, B, C, D (Phần I) */}
        {q.type === 'single_choice' && Array.isArray(q.options) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 pt-1 pl-3 text-sm sm:text-[15px] text-slate-800">
            {q.options.map((opt: any) => {
              const isCorrect = q.correct_answer === opt.id;
              return (
                <div
                  key={opt.id}
                  className={`flex items-start gap-2 p-1.5 rounded-lg ${
                    isCorrect ? 'text-emerald-800 font-semibold bg-emerald-50/70 border border-emerald-200' : ''
                  }`}
                >
                  <span className="font-bold text-slate-700">{opt.id}.</span>
                  <div className="flex-1">
                    <MathRenderer content={opt.text} inline />
                  </div>
                  {isCorrect && <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5 ml-auto" />}
                </div>
              );
            })}
          </div>
        )}

        {/* Các ý Đúng/Sai (Phần II) */}
        {q.type === 'true_false' && Array.isArray(q.options) && (
          <div className="space-y-2 mt-3 pt-1 pl-3 text-sm sm:text-[15px] text-slate-800">
            {q.options.map((stmt: any) => {
              const correctMap = q.correct_answer || {};
              const isTrue = !!correctMap[stmt.id];
              return (
                <div key={stmt.id} className="flex items-start justify-between gap-3 p-1.5 rounded-lg hover:bg-slate-50">
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-slate-700">{stmt.id})</span>
                    <MathRenderer content={stmt.text} inline />
                  </div>
                  <span
                    className={`shrink-0 px-2 py-0.5 rounded text-xs font-bold ${
                      isTrue ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {isTrue ? 'Đúng' : 'Sai'}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Điền số ngắn (Phần III) */}
        {q.type === 'short_answer' && (
          <div className="mt-3 pl-3 flex items-center gap-2 text-sm">
            <span className="font-semibold text-slate-500">Đáp số:</span>
            <span className="rounded-md bg-emerald-50 border border-emerald-300 px-3 py-1 font-bold text-emerald-800 font-mono text-base">
              {Array.isArray(q.correct_answer) ? q.correct_answer[0] : q.correct_answer || 'Chưa điền'}
            </span>
          </div>
        )}

        {/* Lời giải chi tiết rút gọn */}
        {q.explanation && (
          <div className="mt-3 pt-2.5 border-t border-dashed border-slate-200 text-sm text-slate-700 bg-slate-50/70 p-3 rounded-xl">
            <span className="font-bold text-slate-900 mr-1.5">Lời giải:</span>
            <MathRenderer content={q.explanation} inline />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-100/90 text-slate-800 flex flex-col font-sans">
      {/* 1. TOP HEADER BAR: Phỏng theo giao diện iExam */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 px-4 py-2.5 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Breadcrumb & Tiêu đề đề thi */}
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/exams"
              className="text-xs font-semibold text-slate-500 hover:text-blue-600 transition flex items-center gap-1"
            >
              <span>Đề của tôi</span>
              <ChevronRight className="h-3 w-3" />
            </Link>
            <div className="flex items-center gap-2 min-w-0">
              <span className="rounded-md bg-blue-100 text-blue-700 px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase">
                Toán Thầy Sơn
              </span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Nhập tiêu đề đề thi..."
                className="font-bold text-sm sm:text-base text-slate-900 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-600 focus:outline-none px-1 py-0.5 truncate max-w-xs sm:max-w-md"
              />
            </div>
          </div>

          {/* Nhóm nút tác vụ trên đầu (chuẩn Ảnh 1 & 9 iExam) */}
          <div className="flex flex-wrap items-center gap-2 relative">
            <button
              type="button"
              onClick={() => setShowLeftSettings(!showLeftSettings)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold shadow-2xs transition cursor-pointer ${
                showLeftSettings
                  ? 'bg-blue-50 border-blue-400 text-blue-700 font-bold'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <FileText className="h-3.5 w-3.5 text-blue-600" />
              <span>Thông tin đề</span>
            </button>

            <button
              type="button"
              onClick={() => setShowAiModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-100 shadow-2xs transition cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5 text-purple-600" />
              <span>Sinh đề AI</span>
            </button>

            {/* Nút Nhập file với Popover chuẩn Ảnh 9 iExam */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowUploadPopover(!showUploadPopover)}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold shadow-2xs transition cursor-pointer ${
                  showUploadPopover
                    ? 'bg-indigo-50 border-indigo-400 text-indigo-700 font-bold'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Upload className="h-3.5 w-3.5 text-indigo-600" />
                <span>Nhập file</span>
              </button>

              {/* Popover chọn loại đề của file (Ảnh 9 iExam) */}
              {showUploadPopover && (
                <div className="absolute left-0 sm:right-0 sm:left-auto top-full mt-2 w-72 rounded-2xl bg-white shadow-2xl border border-slate-200 p-4 z-50 animate-in fade-in zoom-in-95 text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
                    <span className="font-extrabold text-slate-800">Loại đề của file</span>
                    <button
                      type="button"
                      onClick={() => setShowUploadPopover(false)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Cấu trúc đề của file:</label>
                      <select
                        value={popoverFileMode}
                        onChange={(e) => setPopoverFileMode(e.target.value as any)}
                        className="w-full rounded-xl border border-slate-200 p-2 text-xs font-bold text-slate-800 bg-white focus:outline-none focus:border-blue-500"
                      >
                        <option value="thcs_thpt">THCS / THPT (3 phần)</option>
                        <option value="dinh_ky">Định kỳ / HSG (4 phần có tự luận)</option>
                      </select>
                    </div>

                    <label className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-500 cursor-pointer shadow-md shadow-blue-500/20 transition">
                      <Upload className="h-4 w-4" />
                      <span>Chọn file từ máy tính...</span>
                      <input
                        type="file"
                        accept=".docx,.tex,.txt,.pdf"
                        className="hidden"
                        onChange={(e) => {
                          setShowUploadPopover(false);
                          handleUploadDocx(e);
                        }}
                      />
                    </label>

                    <p className="text-[11px] text-slate-500 leading-relaxed text-center">
                      Hệ thống tự động nhận diện file Word (.docx), LaTeX (.tex) hoặc PDF (.pdf).
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Nút chuyển đổi Chế độ Đề Tương Tác vs Đề PDF */}
            <div className="flex items-center rounded-xl bg-slate-100 p-0.5 text-xs font-bold text-slate-600">
              <button
                type="button"
                onClick={() => setExamMode('interactive')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  examMode === 'interactive'
                    ? 'bg-white text-blue-600 shadow-2xs font-extrabold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Đề Tương Tác
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!pdfUrl) {
                    setImportTab('pdf');
                    setShowImportModal(true);
                  } else {
                    setExamMode('pdf_view');
                  }
                }}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  examMode === 'pdf_view'
                    ? 'bg-rose-600 text-white shadow-2xs font-extrabold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="h-3 w-3" />
                <span>Đề PDF</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowPreviewModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition cursor-pointer"
            >
              <Eye className="h-3.5 w-3.5 text-slate-600" />
              <span>Xem trước</span>
            </button>

            <Link
              href="/exams"
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
            >
              Hủy
            </Link>

            <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 hover:bg-slate-100 transition" title="Lưu các câu hỏi vào Ngân hàng câu hỏi để tái sử dụng cho các đề sau">
              <input
                type="checkbox"
                checked={saveToBank}
                onChange={(e) => setSaveToBank(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="hidden sm:inline">Lưu vào Ngân hàng</span>
            </label>

            <button
              type="button"
              onClick={handleSaveExam}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-1.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-500 active:scale-95 transition cursor-pointer"
            >
              <Save className="h-3.5 w-3.5" />
              <span>Cập nhật</span>
            </button>
          </div>
        </div>

        {/* 2. THANH CÔNG CỤ SOẠN THẢO TRỰC QUAN (Ribbon Toolbar) */}
        <div className="mt-2 pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={handleUndo}
              disabled={historyIndex <= 0}
              title="Hoàn tác (Undo)"
              className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-40 text-slate-600 transition cursor-pointer"
            >
              <Undo className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              title="Làm lại (Redo)"
              className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-40 text-slate-600 transition cursor-pointer"
            >
              <Redo className="h-3.5 w-3.5" />
            </button>

            <div className="h-4 w-px bg-slate-200 mx-1" />

            <button
              type="button"
              onClick={() => handleApplyFormatting('bold')}
              title="In đậm (Bold)"
              className="p-1.5 rounded-lg hover:bg-slate-100 font-bold transition cursor-pointer"
            >
              <Bold className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleApplyFormatting('italic')}
              title="In nghiêng (Italic)"
              className="p-1.5 rounded-lg hover:bg-slate-100 italic transition cursor-pointer"
            >
              <Italic className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleApplyFormatting('underline')}
              title="Gạch chân (Underline)"
              className="p-1.5 rounded-lg hover:bg-slate-100 underline transition cursor-pointer"
            >
              <Underline className="h-3.5 w-3.5" />
            </button>

            <div className="h-4 w-px bg-slate-200 mx-1" />

            {/* Phím tắt Toán THPT */}
            <button
              type="button"
              onClick={() => handleApplyFormatting('math')}
              className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 transition cursor-pointer"
            >
              <Sigma className="h-3.5 w-3.5" />
              <span>Chèn Công thức Toán</span>
            </button>

            <button
              type="button"
              onClick={() => handleApplyFormatting('table')}
              className="inline-flex items-center gap-1 rounded-lg bg-teal-50 px-2 py-1 text-[11px] font-semibold text-teal-700 hover:bg-teal-100 transition cursor-pointer"
            >
              <TableIcon className="h-3.5 w-3.5" />
              <span>Chèn Bảng số liệu</span>
            </button>

            <button
              type="button"
              onClick={() => handleApplyFormatting('tikz')}
              className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 transition cursor-pointer"
            >
              <ImageIcon className="h-3.5 w-3.5" />
              <span>Chèn Bảng biến thiên (tkz-tab)</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {activeQuestionId && (
              <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                Đang chọn: Câu {questions.findIndex((q) => q.id === activeQuestionId) + 1}
              </span>
            )}
            <button
              type="button"
              onClick={handleAutoFormatExam}
              className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700 hover:bg-indigo-100 shadow-2xs transition cursor-pointer"
            >
              <Wand2 className="h-3.5 w-3.5" />
              <span>Format Đề Tự Động</span>
            </button>
          </div>
        </div>
      </header>

      {/* THÔNG BÁO TOAST */}
      {saveToast && (
        <div className="fixed top-20 right-6 z-50 rounded-2xl bg-slate-900 text-white px-5 py-3 text-xs font-semibold shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>{saveToast}</span>
        </div>
      )}

      {/* 3. VÙNG NỘI DUNG CHÍNH: KHUNG CANVAS A4 (GIỮA) VÀ PANEL CẤU TRÚC (PHẢI) HOẶC ĐỀ PDF */}
      {examMode === 'pdf_view' ? (
        <div className="flex-1 flex flex-col xl:flex-row gap-5 p-4 sm:p-6 overflow-hidden bg-slate-100/60">
          {/* Cột trái: Xem trước PDF (58% width) */}
          <div className="w-full xl:w-[58%] flex flex-col h-full rounded-2xl bg-white border border-slate-200 shadow-sm p-4 overflow-hidden">
            <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-100">
              <div className="flex items-center gap-2 min-w-0">
                <span className="rounded-lg bg-rose-100 text-rose-700 px-2.5 py-1 text-xs font-bold uppercase tracking-wider shrink-0">
                  Đề PDF
                </span>
                <span className="font-bold text-xs sm:text-sm text-slate-800 truncate">
                  {pdfFileName || title}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleMaskPdfExam(0.32)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-300 bg-amber-50 text-amber-800 font-bold text-xs hover:bg-amber-100 transition cursor-pointer"
                  title="Tự động che bảng đáp án ở đáy trang cuối để học sinh không nhìn thấy (giữ trọn vẹn câu hỏi)"
                >
                  <Scissors className="h-3.5 w-3.5" />
                  <span>Che đáp án cuối trang</span>
                </button>
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 font-bold text-xs hover:bg-blue-100 transition cursor-pointer">
                  <Upload className="h-3.5 w-3.5" />
                  <span>Đổi file PDF</span>
                  <input type="file" accept=".pdf" className="hidden" onChange={handleUploadPdfFile} />
                </label>
              </div>
            </div>
            <div className="flex-1 min-h-[500px]">
              <PdfExamViewer
                pdfUrl={pdfUrl}
                title={pdfFileName || title}
                className="h-full"
                canTrim={true}
                onTrimLastPage={() => handleMaskPdfExam(0.32)}
              />
            </div>
          </div>

          {/* Cột phải: Phiếu Đáp Án Trực Quan OMR (42% width) */}
          <div className="w-full xl:w-[42%] flex flex-col h-full rounded-2xl bg-white border border-slate-200 shadow-sm p-5 overflow-y-auto space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 uppercase">
                  Bảng Đáp Án Chuẩn ({questions.length} câu)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Bấm trực tiếp vào các phương án để thiết lập đáp án đúng
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setImportTab('pdf');
                  setShowImportModal(true);
                }}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 text-xs font-bold hover:bg-purple-100 transition cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Dán chuỗi đáp án</span>
              </button>
            </div>

            {/* PHẦN I: TRẮC NGHIỆM 4 LỰA CHỌN */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-blue-100 pb-1.5">
                <span className="font-bold text-xs text-blue-900 uppercase">
                  Phần I. 12 câu trắc nghiệm (0.25đ/câu)
                </span>
                <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                  {part1Questions.length} câu
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {part1Questions.map((q, idx) => (
                  <div
                    key={q.id}
                    className="flex items-center justify-between p-2 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition"
                  >
                    <span className="font-extrabold text-xs text-slate-700 w-8">
                      Câu {idx + 1}:
                    </span>
                    <div className="flex items-center gap-1">
                      {['A', 'B', 'C', 'D'].map((opt) => {
                        const isCorrect = q.correct_answer === opt;
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => {
                              setQuestionsWithHistory((prev) =>
                                prev.map((item) => (item.id === q.id ? { ...item, correct_answer: opt } : item))
                              );
                            }}
                            className={`h-7 w-7 rounded-lg text-xs font-bold transition cursor-pointer ${
                              isCorrect
                                ? 'bg-blue-600 text-white shadow-xs scale-105'
                                : 'bg-white border border-slate-200 text-slate-700 hover:bg-blue-50 hover:border-blue-300'
                            }`}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* PHẦN II: TRẮC NGHIỆM ĐÚNG/SAI */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between border-b border-amber-100 pb-1.5">
                <span className="font-bold text-xs text-amber-900 uppercase">
                  Phần II. 4 câu Đúng/Sai (1.0đ/câu)
                </span>
                <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
                  {part2Questions.length} câu
                </span>
              </div>
              <div className="space-y-3">
                {part2Questions.map((q, qIdx) => {
                  const qNum = part1Questions.length + qIdx + 1;
                  const correctMap = (q.correct_answer as Record<string, boolean>) || {};
                  return (
                    <div key={q.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                      <span className="font-extrabold text-xs text-slate-800">
                        Câu {qNum} (4 ý a, b, c, d):
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {['a', 'b', 'c', 'd'].map((letter) => {
                          const isTrue = !!correctMap[letter];
                          return (
                            <div
                              key={letter}
                              className="flex flex-col items-center gap-1 p-1.5 rounded-lg bg-white border border-slate-200"
                            >
                              <span className="font-bold text-xs text-slate-600">{letter})</span>
                              <div className="flex items-center rounded-md bg-slate-100 p-0.5 text-[11px]">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setQuestionsWithHistory((prev) =>
                                      prev.map((item) =>
                                        item.id === q.id
                                          ? { ...item, correct_answer: { ...correctMap, [letter]: true } }
                                          : item
                                      )
                                    );
                                  }}
                                  className={`px-1.5 py-0.5 rounded font-bold transition cursor-pointer ${
                                    isTrue ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                                  }`}
                                >
                                  Đ
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setQuestionsWithHistory((prev) =>
                                      prev.map((item) =>
                                        item.id === q.id
                                          ? { ...item, correct_answer: { ...correctMap, [letter]: false } }
                                          : item
                                      )
                                    );
                                  }}
                                  className={`px-1.5 py-0.5 rounded font-bold transition cursor-pointer ${
                                    !isTrue ? 'bg-rose-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                                  }`}
                                >
                                  S
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* PHẦN III: TRẢ LỜI NGẮN (ĐIỀN SỐ) */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between border-b border-emerald-100 pb-1.5">
                <span className="font-bold text-xs text-emerald-900 uppercase">
                  Phần III. 6 câu Điền số (0.5đ/câu)
                </span>
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                  {part3Questions.length} câu
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {part3Questions.map((q, qIdx) => {
                  const qNum = part1Questions.length + part2Questions.length + qIdx + 1;
                  const ansVal = Array.isArray(q.correct_answer) ? q.correct_answer[0] : q.correct_answer || '';
                  return (
                    <div
                      key={q.id}
                      className="flex items-center gap-2 p-2 rounded-xl border border-slate-200 bg-slate-50/50"
                    >
                      <span className="font-extrabold text-xs text-slate-700 w-12 shrink-0">
                        Câu {qNum}:
                      </span>
                      <input
                        type="text"
                        value={ansVal}
                        onChange={(e) => {
                          const val = e.target.value.trim();
                          setQuestionsWithHistory((prev) =>
                            prev.map((item) =>
                              item.id === q.id
                                ? { ...item, correct_answer: [val, val.replace(',', '.')] }
                                : item
                            )
                          );
                        }}
                        placeholder="Đáp số..."
                        className="flex-1 min-w-0 p-1.5 text-xs font-bold text-emerald-800 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : (
      <div className="flex-1 flex overflow-hidden relative">
        {/* ============================================================== */}
        {/* CỘT 1 (TRÁI): THÔNG TIN ĐỀ THI & CÀI ĐẶT (Ảnh 1, 2, 3, 4 iExam) */}
        {/* ============================================================== */}
        {showLeftSettings && (
          <aside className="w-80 xl:w-88 shrink-0 border-r border-slate-200 bg-white flex flex-col h-full overflow-y-auto p-4 space-y-4 shadow-2xs z-20 text-xs">
            {/* Header Cột trái */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600" />
                <span className="font-extrabold text-sm text-slate-900">Thông tin đề</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="rounded-full bg-blue-50 text-blue-700 px-2 py-0.5 text-[10px] font-bold">
                  {totalQuestions} câu
                </span>
                <button
                  type="button"
                  onClick={() => setShowLeftSettings(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                  title="Thu gọn bảng cài đặt"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              {totalQuestions} câu trong bộ đang chỉnh. Đề kiểm tra thường, câu xếp theo loại (trắc nghiệm, Đúng/Sai, trả lời ngắn, tự luận), điểm cấu hình theo phần.
            </p>

            {/* 1. Tiêu đề đề thi */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">Tiêu đề đề thi</label>
              <textarea
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                rows={2}
                className="w-full rounded-xl border border-slate-200 p-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>

            {/* 2. Thời gian & Tổng số câu */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Thời gian (phút)</label>
                <input
                  type="number"
                  disabled={noTimeLimit}
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 p-2 text-xs font-bold text-slate-800 disabled:bg-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Tổng số câu</label>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs font-bold text-slate-800 text-center">
                  {totalQuestions} câu
                </div>
              </div>
            </div>

            {/* Checkbox Không giới hạn thời gian */}
            <div className="flex items-start gap-2 pt-1">
              <input
                type="checkbox"
                id="no-time-limit"
                checked={noTimeLimit}
                onChange={(e) => setNoTimeLimit(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded text-blue-600"
              />
              <label htmlFor="no-time-limit" className="text-[11px] text-slate-600 leading-snug cursor-pointer">
                <span className="font-bold block text-slate-800">Không giới hạn thời gian</span>
                Không đếm ngược, không tự nộp. Học sinh tự bấm Nộp bài khi xong.
              </label>
            </div>

            {/* 3. Quyền truy cập (Ảnh 1 iExam) */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100">
              <label className="block font-bold text-slate-700">Quyền truy cập</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAccessType('public')}
                  className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                    accessType === 'public'
                      ? 'border-blue-500 bg-blue-50/50 text-blue-900 shadow-2xs font-bold'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="block text-xs font-bold">Công khai</span>
                  <span className="text-[10px] text-slate-500 block">Không cần đăng nhập</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAccessType('restricted')}
                  className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                    accessType === 'restricted'
                      ? 'border-blue-500 bg-blue-50/50 text-blue-900 shadow-2xs font-bold'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="block text-xs font-bold flex items-center gap-1">
                    <span>Giới hạn lớp</span>
                    <Check className="h-3 w-3 text-blue-600" />
                  </span>
                  <span className="text-[10px] text-slate-500 block">Bắt buộc đăng nhập</span>
                </button>
              </div>
            </div>

            {/* Lớp được phép thi */}
            {accessType === 'restricted' && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <label className="block text-[11px] font-bold text-slate-700">Lớp được phép thi</label>
                    <span className="text-[10px] text-slate-400 font-semibold">({assignedClasses.length}/{classes.length})</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setAssignedClasses(classes.map((c) => c.name))}
                      className="text-blue-600 hover:underline cursor-pointer font-bold"
                    >
                      Chọn hết
                    </button>
                    <span className="text-slate-300">•</span>
                    <button
                      type="button"
                      onClick={() => setAssignedClasses([])}
                      className="text-slate-500 hover:underline cursor-pointer font-medium"
                    >
                      Bỏ chọn
                    </button>
                    <span className="text-slate-300">•</span>
                    <Link
                      href="/classes"
                      className="font-bold text-blue-600 hover:underline inline-flex items-center gap-0.5"
                      title="Mở trang Quản lý Lớp học"
                    >
                      <span>Quản lý</span>
                      <ArrowUpRight className="h-2.5 w-2.5" />
                    </Link>
                  </div>
                </div>

                {classes.length === 0 ? (
                  <p className="text-[11px] text-amber-600 italic bg-amber-50 p-2 rounded-lg border border-amber-200">
                    Chưa có lớp nào trong hệ thống. <Link href="/classes" className="underline font-bold">Bấm để tạo lớp mới</Link>
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {classes.map((cls) => {
                      const isSelected = assignedClasses.includes(cls.name);
                      return (
                        <button
                          key={cls.id}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setAssignedClasses(assignedClasses.filter((c) => c !== cls.name));
                            } else {
                              setAssignedClasses([...assignedClasses, cls.name]);
                            }
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer ${
                            isSelected
                              ? 'bg-blue-600 text-white font-bold shadow-xs'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          <span>{cls.name}</span>
                          {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                        </button>
                      );
                    })}
                  </div>
                )}
                {assignedClasses.length === 0 && classes.length > 0 && (
                  <p className="text-[10px] text-rose-500 italic mt-0.5">
                    * Chưa chọn lớp nào. Vui lòng bấm chọn lớp để học sinh được làm bài.
                  </p>
                )}
              </div>
            )}

            {/* 4. Cài đặt thêm (Collapsible) - Ảnh 2, 3, 4 iExam */}
            <div className="pt-2 border-t border-slate-100 space-y-3">
              <button
                type="button"
                onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                className="w-full flex items-center justify-between text-xs font-extrabold text-slate-800 hover:text-blue-600 cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <Sliders className="h-3.5 w-3.5 text-blue-600" />
                  Cài đặt thêm
                </span>
                {showAdvancedSettings ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>

              {showAdvancedSettings && (
                <div className="space-y-3.5 pt-1 pl-1">
                  {/* Điểm theo phần (Ảnh 2 iExam) */}
                  <div className="space-y-1.5">
                    <span className="font-bold text-slate-700 text-[11px] block">Điểm theo phần</span>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[10px] text-slate-500 block">Phần 1 · Trắc nghiệm</span>
                        <input
                          type="number"
                          step="0.5"
                          value={partPoints.part1}
                          onChange={(e) => setPartPoints({ ...partPoints, part1: Number(e.target.value) })}
                          className="w-full p-1.5 rounded-lg border border-slate-200 text-xs font-bold"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">Phần 2 · Đúng/Sai</span>
                        <input
                          type="number"
                          step="0.5"
                          value={partPoints.part2}
                          onChange={(e) => setPartPoints({ ...partPoints, part2: Number(e.target.value) })}
                          className="w-full p-1.5 rounded-lg border border-slate-200 text-xs font-bold"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">Phần 3 · Trả lời ngắn</span>
                        <input
                          type="number"
                          step="0.5"
                          value={partPoints.part3}
                          onChange={(e) => setPartPoints({ ...partPoints, part3: Number(e.target.value) })}
                          className="w-full p-1.5 rounded-lg border border-slate-200 text-xs font-bold"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">Phần 4 · Tự luận</span>
                        <input
                          type="number"
                          step="0.5"
                          value={partPoints.part4}
                          onChange={(e) => setPartPoints({ ...partPoints, part4: Number(e.target.value) })}
                          className="w-full p-1.5 rounded-lg border border-slate-200 text-xs font-bold"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Cách tính điểm câu Đúng/Sai (Ảnh 2 iExam) */}
                  <div>
                    <span className="font-bold text-slate-700 text-[11px] block mb-1">Cách tính điểm câu Đúng/Sai</span>
                    <select
                      value={trueFalseScoring}
                      onChange={(e) => setTrueFalseScoring(e.target.value as any)}
                      className="w-full rounded-xl border border-slate-200 p-2 text-xs font-semibold bg-white focus:outline-none"
                    >
                      <option value="standard_thpt">Chuẩn THPT - 1 ý 10% · 2 ý 25% · 3 ý 50% · 4 ý 100%</option>
                      <option value="equal">Chia đều (mỗi ý 0.25đ)</option>
                    </select>
                  </div>

                  {/* Khi học sinh vi phạm (Ảnh 2 iExam) */}
                  <div className="space-y-1.5">
                    <span className="font-bold text-slate-700 text-[11px] block">Khi học sinh vi phạm</span>
                    <div className="space-y-2">
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="violation_act"
                          checked={violationAction === 'warning_only'}
                          onChange={() => setViolationAction('warning_only')}
                          className="mt-0.5 text-blue-600"
                        />
                        <span className="text-[11px] text-slate-600 leading-snug">
                          <strong className="block text-slate-800">Chỉ cảnh báo</strong>
                          Vi phạm được ghi lại để giáo viên xem, học sinh vẫn làm bài tiếp.
                        </span>
                      </label>

                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="violation_act"
                          checked={violationAction === 'lock_exam'}
                          onChange={() => setViolationAction('lock_exam')}
                          className="mt-0.5 text-blue-600"
                        />
                        <span className="text-[11px] text-slate-600 leading-snug">
                          <strong className="block text-slate-800">
                            Khoá bài khi vi phạm quá{' '}
                            <input
                              type="number"
                              min={1}
                              max={10}
                              value={maxViolations}
                              onChange={(e) => setMaxViolations(Number(e.target.value))}
                              className="w-10 text-center font-bold border border-slate-300 rounded px-1 py-0.5 text-xs inline"
                            />{' '}
                            lần
                          </strong>
                          Tính chuyển tab, rời cửa sổ thi và sao chép đề. Lần vi phạm tiếp theo bài bị nộp ngay với những câu đã làm.
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Sau khi nộp bài (Ảnh 3 iExam) */}
                  <div className="space-y-1.5 pt-1 border-t border-slate-100">
                    <span className="font-bold text-slate-700 text-[11px] block">Sau khi nộp bài</span>
                    <div className="space-y-2">
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={true}
                          readOnly
                          className="mt-0.5 h-3.5 w-3.5 rounded text-blue-600"
                        />
                        <div className="text-[11px] text-slate-700">
                          <span className="font-bold block">Cho phép xem đáp án</span>
                          <div className="pl-3 mt-1 space-y-1 text-slate-500">
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="radio"
                                name="view_ans_pol"
                                checked={viewAnswerPolicy === 'immediately'}
                                onChange={() => setViewAnswerPolicy('immediately')}
                              />
                              <span>Ngay sau khi nộp bài</span>
                            </label>
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="radio"
                                name="view_ans_pol"
                                checked={viewAnswerPolicy === 'after_closed'}
                                onChange={() => setViewAnswerPolicy('after_closed')}
                              />
                              <span>Sau khi đề đóng</span>
                            </label>
                          </div>
                        </div>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={viewScoreAllowed}
                          onChange={(e) => setViewScoreAllowed(e.target.checked)}
                          className="h-3.5 w-3.5 rounded text-blue-600"
                        />
                        <span className="text-[11px] font-bold text-slate-800">Cho phép xem điểm</span>
                      </label>

                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={viewLeaderboardAllowed}
                          onChange={(e) => setViewLeaderboardAllowed(e.target.checked)}
                          className="mt-0.5 h-3.5 w-3.5 rounded text-blue-600"
                        />
                        <span className="text-[11px] text-slate-600 leading-snug">
                          <strong className="block text-slate-800">Cho học sinh xem bảng xếp hạng</strong>
                          Mỗi em xem được thứ hạng của mình và điểm của mọi người sau khi đã nộp bài.
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Xáo trộn (Ảnh 3 iExam) */}
                  <div className="space-y-1 pt-1 border-t border-slate-100">
                    <span className="font-bold text-slate-700 text-[11px] block">Xáo trộn</span>
                    <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-700">
                      <input
                        type="checkbox"
                        checked={shuffleQuestions}
                        onChange={(e) => setShuffleQuestions(e.target.checked)}
                        className="rounded text-blue-600"
                      />
                      <span>Xáo trộn thứ tự câu hỏi</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-700">
                      <input
                        type="checkbox"
                        checked={shuffleOptions}
                        onChange={(e) => setShuffleOptions(e.target.checked)}
                        className="rounded text-blue-600"
                      />
                      <span>Xáo trộn phương án trắc nghiệm</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-700">
                      <input
                        type="checkbox"
                        checked={shuffleTrueFalse}
                        onChange={(e) => setShuffleTrueFalse(e.target.checked)}
                        className="rounded text-blue-600"
                      />
                      <span>Xáo trộn phương án đúng sai</span>
                    </label>
                  </div>

                  {/* Ngân hàng câu hỏi */}
                  <div className="space-y-1 pt-1 border-t border-slate-100">
                    <span className="font-bold text-slate-700 text-[11px] block">Ngân hàng câu hỏi</span>
                    <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-700">
                      <input
                        type="checkbox"
                        checked={saveToBank}
                        onChange={(e) => setSaveToBank(e.target.checked)}
                        className="rounded text-blue-600"
                      />
                      <span>Đồng thời lưu các câu hỏi vào Ngân hàng đề</span>
                    </label>
                  </div>

                  {/* Lịch thi (Ảnh 4 iExam) */}
                  <div className="space-y-2 pt-1 border-t border-slate-100">
                    <span className="font-bold text-slate-700 text-[11px] block">Lịch thi</span>
                    <div>
                      <span className="text-[10px] text-slate-500 block mb-0.5">Mở đề lúc:</span>
                      <input
                        type="datetime-local"
                        value={openTime}
                        onChange={(e) => setOpenTime(e.target.value)}
                        className="w-full p-1.5 rounded-lg border border-slate-200 text-xs bg-white"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block mb-0.5">Khóa đề lúc:</span>
                      <input
                        type="datetime-local"
                        value={closeTime}
                        onChange={(e) => setCloseTime(e.target.value)}
                        className="w-full p-1.5 rounded-lg border border-slate-200 text-xs bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}

        {/* ============================================================== */}
        {/* CỘT 2 (GIỮA): KHUNG CANVAS A4 & TAB BỘ CÂU HỎI (Ảnh 1 iExam)  */}
        {/* ============================================================== */}
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-100/70">
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 flex justify-center">
            <div className="w-full max-w-[840px] bg-white rounded-xl shadow-md border border-slate-200 min-h-[1120px] p-8 sm:p-12 relative flex flex-col justify-between">
              {/* Danh sách các phần câu hỏi (Chuẩn bố cục trang giấy iExam) */}
              <div className="space-y-8 flex-1">
                {/* PHẦN I: TRẮC NGHIỆM */}
                  <section id="section-part1" className="space-y-4">
                    <div className="flex items-center justify-between border-b border-blue-200 pb-2">
                      <div>
                        <h3 className="font-extrabold text-sm text-blue-900 uppercase">
                          PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn.
                        </h3>
                        <p className="text-[11px] italic text-slate-500">
                          Thí sinh trả lời từ câu 1 đến câu {part1Questions.length}. Mỗi câu thí sinh chỉ chọn một phương án.
                        </p>
                      </div>
                      <span className="rounded-md bg-blue-100 text-blue-700 px-2 py-0.5 text-xs font-bold">
                        {part1Questions.length} câu ({(part1Questions.length * 0.25).toFixed(2)}đ)
                      </span>
                    </div>

                    {part1Questions.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-blue-200 p-6 text-center text-xs text-slate-400">
                        Chưa có câu hỏi trong Phần I. Bấm "+ Thêm câu hỏi" để bổ sung.
                      </div>
                    ) : (
                      <div className="space-y-5">
                        {part1Questions.map((q, idx) => (
                          <div id={`q-${q.id}`} key={q.id}>
                            {renderQuestionItem(q, idx + 1)}
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  {/* PHẦN II: ĐÚNG SAI */}
                  <section id="section-part2" className="space-y-4 pt-4 border-t border-slate-200">
                    <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                      <div>
                        <h3 className="font-extrabold text-sm text-amber-900 uppercase">
                          PHẦN II. Câu trắc nghiệm đúng sai.
                        </h3>
                        <p className="text-[11px] italic text-slate-500">
                          Thí sinh trả lời từ câu 1 đến câu {part2Questions.length}. Trong mỗi ý a), b), c), d) ở mỗi câu, thí sinh chọn đúng hoặc sai.
                        </p>
                      </div>
                      <span className="rounded-md bg-amber-100 text-amber-800 px-2 py-0.5 text-xs font-bold">
                        {part2Questions.length} câu ({(part2Questions.length * 1.0).toFixed(2)}đ)
                      </span>
                    </div>

                    {part2Questions.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-amber-200 p-6 text-center text-xs text-slate-400">
                        Chưa có câu hỏi trong Phần II.
                      </div>
                    ) : (
                      <div className="space-y-5">
                        {part2Questions.map((q, idx) => (
                          <div id={`q-${q.id}`} key={q.id}>
                            {renderQuestionItem(q, part1Questions.length + idx + 1)}
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  {/* PHẦN III: TRẢ LỜI NGẮN */}
                  <section id="section-part3" className="space-y-4 pt-4 border-t border-slate-200">
                    <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
                      <div>
                        <h3 className="font-extrabold text-sm text-emerald-900 uppercase">
                          PHẦN III. Câu hỏi trả lời ngắn.
                        </h3>
                        <p className="text-[11px] italic text-slate-500">
                          Thí sinh trả lời từ câu 1 đến câu {part3Questions.length}. Điền kết quả số vào ô trả lời.
                        </p>
                      </div>
                      <span className="rounded-md bg-emerald-100 text-emerald-800 px-2 py-0.5 text-xs font-bold">
                        {part3Questions.length} câu ({(part3Questions.length * 0.5).toFixed(2)}đ)
                      </span>
                    </div>

                    {part3Questions.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-emerald-200 p-6 text-center text-xs text-slate-400">
                        Chưa có câu hỏi trong Phần III.
                      </div>
                    ) : (
                      <div className="space-y-5">
                        {part3Questions.map((q, idx) => (
                          <div id={`q-${q.id}`} key={q.id}>
                            {renderQuestionItem(q, part1Questions.length + part2Questions.length + idx + 1)}
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  {/* PHẦN IV: TỰ LUẬN (CHO ĐỀ ĐỊNH KỲ) */}
                  {(format === 'periodic_4_parts' || part4Questions.length > 0) && (
                    <section id="section-part4" className="space-y-4 pt-4 border-t border-slate-200">
                      <div className="flex items-center justify-between border-b border-purple-200 pb-2">
                        <div>
                          <h3 className="font-extrabold text-sm text-purple-900 uppercase">
                            PHẦN IV. Câu hỏi tự luận.
                          </h3>
                          <p className="text-[11px] italic text-slate-500">
                            Thí sinh trình bày lời giải chi tiết theo các bước sư phạm.
                          </p>
                        </div>
                        <span className="rounded-md bg-purple-100 text-purple-800 px-2 py-0.5 text-xs font-bold">
                          {part4Questions.length} câu ({(part4Questions.length * 2.0).toFixed(2)}đ)
                        </span>
                      </div>

                      {part4Questions.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-purple-200 p-6 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                          <span>Chưa có câu hỏi trong Phần IV.</span>
                          <button
                            type="button"
                            onClick={() => handleAddEmptyQuestion(4)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 text-purple-800 font-bold hover:bg-purple-100 transition cursor-pointer"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            <span>Thêm câu tự luận</span>
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-5">
                          {part4Questions.map((q, idx) => (
                            <div id={`q-${q.id}`} key={q.id}>
                              {renderQuestionItem(q, part1Questions.length + part2Questions.length + part3Questions.length + idx + 1)}
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  )}
                </div>

              {/* Chân trang đề thi */}
              <div className="border-t border-slate-300 pt-4 mt-8 flex justify-between items-center text-[11px] text-slate-500 italic">
                <span>Đề thi gồm {totalQuestions} câu hỏi • Thầy Sơn Toán THPT</span>
                <span>----------------- HẾT -----------------</span>
              </div>
            </div>
          </main>

          {/* TAB BAR DƯỚI ĐÁY: BỘ CÂU HỎI (Ảnh 1 & 8 iExam) */}
          <div className="bg-white border-t border-slate-200 px-4 py-2 flex items-center justify-between text-xs text-slate-600 shadow-xs shrink-0">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-300 text-blue-700 font-extrabold shadow-2xs"
              >
                <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                <span>Bộ câu hỏi 1</span>
                <span className="rounded-full bg-blue-200/80 px-1.5 py-0.2 text-[10px] text-blue-900">
                  {totalQuestions}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSaveToast('Đã tạo thêm bộ câu hỏi mới (mã đề hoán vị)!');
                  setTimeout(() => setSaveToast(null), 2500);
                }}
                className="p-1.5 rounded-xl border border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50 text-slate-500 hover:text-blue-600 transition cursor-pointer"
                title="Thêm bộ câu hỏi hoán vị mới"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center gap-3 text-slate-500">
              <button
                type="button"
                onClick={() => {
                  setSaveToast('Đã lưu vào danh sách yêu thích!');
                  setTimeout(() => setSaveToast(null), 2000);
                }}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-amber-500"
                title="Đánh dấu yêu thích"
              >
                <Star className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setSaveToast('Đã nhân bản bộ câu hỏi hiện tại!');
                  setTimeout(() => setSaveToast(null), 2000);
                }}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-blue-600"
                title="Sao chép bộ câu hỏi"
              >
                <Copy className="h-4 w-4" />
              </button>
              <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-slate-600">
                <input type="checkbox" className="rounded text-blue-600" />
                <span>Nhiều bộ</span>
              </label>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* CỘT 3 (PHẢI): CẤU TRÚC CÂU HỎI & CÂY ĐIỀU HƯỚNG (Ảnh 1 iExam) */}
        {/* ============================================================== */}
        {showRightStructure && (
          <aside className="w-72 xl:w-80 shrink-0 border-l border-slate-200 bg-white flex flex-col h-full overflow-hidden shadow-2xs z-20">
            {/* Header Cột phải */}
            <div className="p-3.5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-blue-600" />
                <div>
                  <span className="font-extrabold text-sm text-slate-900 block leading-tight">Cấu trúc câu hỏi</span>
                  <span className="text-[10px] text-slate-500">
                    {totalQuestions} câu · {[part1Questions, part2Questions, part3Questions, part4Questions].filter((p) => p.length > 0).length} phần
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRightStructure(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                title="Thu gọn cây câu hỏi"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Hai nút hành động: + Thêm câu hỏi & Đáp án */}
            <div className="p-3 grid grid-cols-2 gap-2 border-b border-slate-100">
              <div className="relative group">
                <button
                  type="button"
                  className="w-full inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-500 shadow-sm cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Thêm câu hỏi</span>
                  <ChevronDown className="h-3 w-3" />
                </button>
                <div className="absolute left-0 top-full mt-1 w-48 rounded-xl bg-white shadow-xl border border-slate-200 p-1.5 hidden group-hover:block z-50 text-xs">
                  <button
                    type="button"
                    onClick={() => handleAddEmptyQuestion(1)}
                    className="w-full text-left px-2.5 py-1.5 text-slate-700 hover:bg-blue-50 hover:text-blue-700 rounded-lg font-medium"
                  >
                    + Phần I: Trắc nghiệm
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddEmptyQuestion(2)}
                    className="w-full text-left px-2.5 py-1.5 text-slate-700 hover:bg-amber-50 hover:text-amber-700 rounded-lg font-medium"
                  >
                    + Phần II: Đúng / Sai
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddEmptyQuestion(3)}
                    className="w-full text-left px-2.5 py-1.5 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 rounded-lg font-medium"
                  >
                    + Phần III: Điền số
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddEmptyQuestion(4)}
                    className="w-full text-left px-2.5 py-1.5 text-slate-700 hover:bg-purple-50 hover:text-purple-700 rounded-lg font-medium"
                  >
                    + Phần IV: Tự luận
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowAnswerMatrixModal(true)}
                className="w-full inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 font-bold text-xs hover:bg-slate-100 shadow-2xs cursor-pointer"
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                <span>Đáp án</span>
              </button>
            </div>

            {/* Cây danh sách câu hỏi chi tiết (Ảnh 1 iExam) */}
            <div className="flex-1 overflow-y-auto p-3 space-y-4 text-xs">
              {/* PHẦN I */}
              <div className="space-y-1">
                <div
                  onClick={() => scrollToSection('section-part1')}
                  className="flex items-center justify-between p-2 rounded-xl bg-blue-50/70 border border-blue-200 cursor-pointer hover:bg-blue-100/60"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-blue-600" />
                    <span className="font-extrabold text-[11px] text-blue-900">PHẦN I (Trắc nghiệm)</span>
                  </div>
                  <span className="text-[10px] font-bold text-blue-700">{part1Questions.length} câu</span>
                </div>

                <div className="space-y-0.5 pl-1.5 pt-1">
                  {part1Questions.map((q, idx) => (
                    <div
                      key={q.id}
                      onClick={() => {
                        setActiveQuestionId(q.id);
                        const el = document.getElementById(`q-${q.id}`);
                        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-lg cursor-pointer transition text-[11px] ${
                        activeQuestionId === q.id
                          ? 'bg-blue-100 text-blue-900 font-bold'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <Radio className={`h-2.5 w-2.5 shrink-0 ${activeQuestionId === q.id ? 'text-blue-600' : 'text-slate-400'}`} />
                      <span className="font-bold shrink-0">Câu {idx + 1}:</span>
                      <span className="truncate text-slate-500">
                        {q.content.replace(/[\$\\]/g, '').slice(0, 26)}...
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* PHẦN II */}
              <div className="space-y-1">
                <div
                  onClick={() => scrollToSection('section-part2')}
                  className="flex items-center justify-between p-2 rounded-xl bg-amber-50/70 border border-amber-200 cursor-pointer hover:bg-amber-100/60"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-amber-600" />
                    <span className="font-extrabold text-[11px] text-amber-900">PHẦN II (Đúng/Sai)</span>
                  </div>
                  <span className="text-[10px] font-bold text-amber-800">{part2Questions.length} câu</span>
                </div>

                <div className="space-y-0.5 pl-1.5 pt-1">
                  {part2Questions.map((q, idx) => (
                    <div
                      key={q.id}
                      onClick={() => {
                        setActiveQuestionId(q.id);
                        const el = document.getElementById(`q-${q.id}`);
                        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-lg cursor-pointer transition text-[11px] ${
                        activeQuestionId === q.id
                          ? 'bg-amber-100 text-amber-900 font-bold'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <Radio className={`h-2.5 w-2.5 shrink-0 ${activeQuestionId === q.id ? 'text-amber-600' : 'text-slate-400'}`} />
                      <span className="font-bold shrink-0">Câu {part1Questions.length + idx + 1}:</span>
                      <span className="truncate text-slate-500">
                        {q.content.replace(/[\$\\]/g, '').slice(0, 26)}...
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* PHẦN III */}
              <div className="space-y-1">
                <div
                  onClick={() => scrollToSection('section-part3')}
                  className="flex items-center justify-between p-2 rounded-xl bg-emerald-50/70 border border-emerald-200 cursor-pointer hover:bg-emerald-100/60"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-600" />
                    <span className="font-extrabold text-[11px] text-emerald-900">PHẦN III (Trả lời ngắn)</span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-800">{part3Questions.length} câu</span>
                </div>

                <div className="space-y-0.5 pl-1.5 pt-1">
                  {part3Questions.map((q, idx) => (
                    <div
                      key={q.id}
                      onClick={() => {
                        setActiveQuestionId(q.id);
                        const el = document.getElementById(`q-${q.id}`);
                        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-lg cursor-pointer transition text-[11px] ${
                        activeQuestionId === q.id
                          ? 'bg-emerald-100 text-emerald-900 font-bold'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <Radio className={`h-2.5 w-2.5 shrink-0 ${activeQuestionId === q.id ? 'text-emerald-600' : 'text-slate-400'}`} />
                      <span className="font-bold shrink-0">Câu {part1Questions.length + part2Questions.length + idx + 1}:</span>
                      <span className="truncate text-slate-500">
                        {q.content.replace(/[\$\\]/g, '').slice(0, 26)}...
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* PHẦN IV (Tự luận) */}
              {(format === 'periodic_4_parts' || part4Questions.length > 0) && (
                <div className="space-y-1">
                  <div
                    onClick={() => scrollToSection('section-part4')}
                    className="flex items-center justify-between p-2 rounded-xl bg-purple-50/70 border border-purple-200 cursor-pointer hover:bg-purple-100/60"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-purple-600" />
                      <span className="font-extrabold text-[11px] text-purple-900">PHẦN IV (Tự luận)</span>
                    </div>
                    <span className="text-[10px] font-bold text-purple-800">{part4Questions.length} câu</span>
                  </div>

                  <div className="space-y-0.5 pl-1.5 pt-1">
                    {part4Questions.map((q, idx) => (
                      <div
                        key={q.id}
                        onClick={() => {
                          setActiveQuestionId(q.id);
                          const el = document.getElementById(`q-${q.id}`);
                          el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }}
                        className={`flex items-center gap-1.5 px-2 py-1 rounded-lg cursor-pointer transition text-[11px] ${
                          activeQuestionId === q.id
                            ? 'bg-purple-100 text-purple-900 font-bold'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                      >
                        <Radio className={`h-2.5 w-2.5 shrink-0 ${activeQuestionId === q.id ? 'text-purple-600' : 'text-slate-400'}`} />
                        <span className="font-bold shrink-0">Câu {part1Questions.length + part2Questions.length + part3Questions.length + idx + 1}:</span>
                        <span className="truncate text-slate-500">
                          {q.content.replace(/[\$\\]/g, '').slice(0, 26)}...
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
      )}

      {/* 5. MODAL 1: THÔNG TIN ĐỀ THI */}
      {showInfoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                Thông Tin Chi Tiết Đề Thi
              </h3>
              <button
                type="button"
                onClick={() => setShowInfoModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Tên đề thi:</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 font-semibold text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Khối lớp:</label>
                  <select
                    value={grade}
                    onChange={(e) => setGrade(Number(e.target.value) as any)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 font-semibold text-slate-800"
                  >
                    <option value={10}>Lớp 10</option>
                    <option value={11}>Lớp 11</option>
                    <option value={12}>Lớp 12 (Ôn thi tốt nghiệp THPT)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Thời gian làm bài:</label>
                  <select
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl border border-slate-300 font-semibold text-slate-800"
                  >
                    <option value={15}>15 phút</option>
                    <option value={45}>45 phút (1 tiết)</option>
                    <option value={90}>90 phút (Chuẩn Bộ GD&ĐT)</option>
                    <option value={150}>150 phút (Đề HSG Huế / Chuyên)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Mô tả / Ghi chú đề thi:</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-slate-800"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowInfoModal(false)}
                className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-500 cursor-pointer"
              >
                Xác Nhận
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. MODAL 2: NHẬP FILE WORD (.DOCX) HOẶC LATEX (.TEX) */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Upload className="h-5 w-5 text-indigo-600" />
                Nhập Đề Thi Từ File Word, LaTeX Hoặc PDF
              </h3>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Chuyển tab Word / LaTeX / PDF */}
            <div className="flex border-b border-slate-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => setImportTab('word')}
                className={`flex-1 py-2.5 text-center border-b-2 transition ${
                  importTab === 'word' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                File Word (.docx)
              </button>
              <button
                type="button"
                onClick={() => setImportTab('latex')}
                className={`flex-1 py-2.5 text-center border-b-2 transition ${
                  importTab === 'latex' ? 'border-purple-600 text-purple-600' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Mã LaTeX (.tex)
              </button>
              <button
                type="button"
                onClick={() => setImportTab('pdf')}
                className={`flex-1 py-2.5 text-center border-b-2 transition ${
                  importTab === 'pdf' ? 'border-rose-600 text-rose-600' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                File Đề Thi PDF (.pdf)
              </button>
            </div>

            {importTab === 'word' ? (
              <div className="space-y-4 py-2">
                <div className="flex flex-col items-center justify-center border-2 border-dashed border-blue-300 rounded-2xl p-8 bg-blue-50/20 hover:bg-blue-50/50 transition">
                  <BookOpen className="h-10 w-10 text-blue-600 mb-2" />
                  <p className="font-bold text-sm text-slate-800 mb-1">Chọn file Word (.docx) đề thi Toán</p>
                  <p className="text-xs text-slate-500 text-center max-w-md mb-4">
                    Hỗ trợ đầy đủ công thức MathType, Word Equation OMML, ảnh hình vẽ đồ thị và các bảng số liệu.
                  </p>
                  <label className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-blue-500 transition cursor-pointer">
                    <span>{isParsingWord ? 'Đang trích xuất câu hỏi...' : 'Tải File Word Từ Máy'}</span>
                    <input
                      type="file"
                      accept=".docx"
                      disabled={isParsingWord}
                      onChange={handleUploadDocx}
                      className="hidden"
                    />
                  </label>
                </div>
                {wordNotice && (
                  <div className={`p-3 rounded-xl text-xs font-medium border ${wordNotice.includes('Lỗi') ? 'bg-rose-50 text-rose-800 border-rose-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'}`}>
                    {wordNotice}
                  </div>
                )}
              </div>
            ) : importTab === 'latex' ? (
              <div className="space-y-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="inline-flex items-center gap-1.5 rounded-xl border border-purple-300 bg-purple-50 text-purple-700 px-3.5 py-1.5 text-xs font-bold hover:bg-purple-100 transition cursor-pointer">
                    <FileCode className="h-3.5 w-3.5" />
                    <span>Tải file .tex / .txt từ máy</span>
                    <input
                      type="file"
                      accept=".tex,.txt"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUniversalFileUpload(file);
                        e.target.value = '';
                      }}
                    />
                  </label>
                  <span className="text-[11px] text-slate-500 italic">Hoặc dán trực tiếp mã nguồn vào ô bên dưới</span>
                </div>
                <p className="text-xs text-slate-600">Dán mã nguồn các câu hỏi gói <code className="bg-slate-100 px-1 py-0.5 rounded text-purple-700 font-mono">ex_test</code> (chứa các khối <code className="bg-slate-100 px-1 py-0.5 rounded text-purple-700 font-mono">\begin&#123;ex&#125;...\end&#123;ex&#125;</code>):</p>
                <textarea
                  rows={8}
                  value={latexInput}
                  onChange={(e) => setLatexInput(e.target.value)}
                  placeholder="Dán mã LaTeX câu hỏi vào đây..."
                  className="w-full font-mono text-xs rounded-xl border border-slate-300 p-3 bg-slate-50"
                />
                {latexNotice && (
                  <div className="p-3 rounded-xl text-xs font-medium bg-blue-50 text-blue-800 border border-blue-200">
                    {latexNotice}
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleParseLatexInput}
                    className="rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white hover:bg-purple-500 cursor-pointer"
                  >
                    Bóc Tách Câu Hỏi LaTeX
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 py-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* File PDF Đề Bài */}
                  <div className="flex flex-col items-center justify-center border-2 border-dashed border-rose-300 rounded-2xl p-5 bg-rose-50/20 hover:bg-rose-50/50 transition text-center">
                    <FileText className="h-8 w-8 text-rose-600 mb-2" />
                    <p className="font-bold text-xs text-slate-800 mb-1">1. File PDF Đề Bài (*)</p>
                    <p className="text-[11px] text-slate-500 mb-3 truncate max-w-full">
                      {pdfFileName ? `Đã chọn: ${pdfFileName}` : 'Đề thi trọn vẹn gồm công thức & hình vẽ'}
                    </p>
                    <label className="rounded-xl bg-rose-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-rose-500 transition cursor-pointer">
                      <span>{pdfFileName ? 'Đổi File PDF' : 'Tải File PDF Đề Thi'}</span>
                      <input type="file" accept=".pdf" onChange={handleUploadPdfFile} className="hidden" />
                    </label>
                  </div>

                  {/* File PDF Lời Giải Chi Tiết (Tùy chọn) */}
                  <div className="flex flex-col items-center justify-center border-2 border-dashed border-indigo-200 rounded-2xl p-5 bg-indigo-50/20 hover:bg-indigo-50/50 transition text-center">
                    <BookOpen className="h-8 w-8 text-indigo-600 mb-2" />
                    <p className="font-bold text-xs text-slate-800 mb-1">2. File Lời Giải PDF (Tùy chọn)</p>
                    <p className="text-[11px] text-slate-500 mb-3 truncate max-w-full">
                      {solutionPdfFileName ? `Đã chọn: ${solutionPdfFileName}` : 'Hiển thị sau khi học sinh nộp bài'}
                    </p>
                    <label className="rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-500 transition cursor-pointer">
                      <span>{solutionPdfFileName ? 'Đổi Lời Giải' : 'Tải File Lời Giải PDF'}</span>
                      <input type="file" accept=".pdf" onChange={handleUploadSolutionPdf} className="hidden" />
                    </label>
                  </div>
                </div>

                {/* Hiển thị số trang & Tùy chọn tự động che bảng đáp án ở đáy trang cuối */}
                {pdfUrl && (
                  <div className="rounded-2xl border border-amber-300 bg-amber-50/70 p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-900">
                        📄 File PDF gồm: <strong>{pdfTotalPages} trang</strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleMaskPdfExam(0.32)}
                        className="rounded-lg bg-amber-600 px-3 py-1 text-[11px] font-bold text-white hover:bg-amber-500 transition cursor-pointer"
                        title="Tự động che bảng đáp án ở đáy trang cuối để học sinh không nhìn thấy"
                      >
                        Tự động che đáp án ngay
                      </button>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-amber-900 select-none">
                      <input
                        type="checkbox"
                        checked={cutLastPage}
                        onChange={(e) => setCutLastPage(e.target.checked)}
                        className="rounded text-amber-600 focus:ring-amber-500 h-4 w-4"
                      />
                      <span>✂️ Tự động che bảng đáp án ở đáy trang cuối (Giữ trọn vẹn 100% câu hỏi, không cắt cả trang)</span>
                    </label>
                  </div>
                )}

                {/* Chuỗi Đáp Án Nhanh 1 Chạm */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-800">
                      Bảng Đáp Án Chuẩn (Dán chuỗi đáp án 1 chạm):
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setQuickAnswerText(
                          '1A 2B 3C 4D 5A 6B 7C 8D 9A 10B 11C 12D\n13: aD bS cD dS\n14: aS bD cD dS\n15: aD bD cS dS\n16: aD bD cS dD\n17: 1440\n18: -2.5\n19: 12\n20: 3/4\n21: 5\n22: 10'
                        )
                      }
                      className="text-[11px] font-semibold text-purple-700 hover:underline cursor-pointer"
                    >
                      Dán mẫu chuẩn 22 câu
                    </button>
                  </div>
                  <textarea
                    rows={4}
                    value={quickAnswerText}
                    onChange={(e) => setQuickAnswerText(e.target.value)}
                    placeholder="VD: 1A 2B 3C... &#10;13: aD bS cD dS &#10;17: 1440..."
                    className="w-full font-mono text-xs rounded-xl border border-slate-300 p-2.5 bg-slate-50 text-slate-900"
                  />
                  <p className="text-[10.5px] text-slate-500 italic">
                    Hỗ trợ: Phần I (1A 2B...), Phần II (13: aD bS cD dS hoặc D S D S), Phần III (17: 1440, 18: -2.5).
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleApplyPdfExam}
                    disabled={!pdfUrl}
                    className="rounded-xl bg-rose-600 disabled:opacity-50 px-5 py-2 text-xs font-bold text-white hover:bg-rose-500 shadow-sm transition cursor-pointer"
                  >
                    Tạo Đề Thi PDF Ngay
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 7. MODAL 3: MA TRẬN ĐÁP ÁN NHANH */}
      {showAnswerMatrixModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-3xl max-h-[85vh] rounded-3xl bg-white p-6 shadow-2xl flex flex-col animate-in fade-in zoom-in-95 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  Bảng Ma Trận Đáp Án Toàn Đề
                </h3>
                <p className="text-xs text-slate-500">
                  Kiểm tra và đổi đáp án đúng của từng câu hỏi cực nhanh bằng 1 cú nhấp chuột.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAnswerMatrixModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-6">
              {/* Phần I: Trắc nghiệm 4 phương án */}
              <div>
                <h4 className="font-bold text-xs text-blue-900 mb-2 uppercase">PHẦN I. Trắc nghiệm 4 lựa chọn ({part1Questions.length} câu)</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                  {part1Questions.map((q, idx) => (
                    <div key={q.id} className="p-2 rounded-xl border border-slate-200 bg-slate-50/50 text-center text-xs">
                      <div className="font-bold text-slate-600 mb-1">Câu {idx + 1}</div>
                      <div className="flex justify-center gap-1">
                        {['A', 'B', 'C', 'D'].map((optId) => {
                          const isSel = q.correct_answer === optId;
                          return (
                            <button
                              key={optId}
                              type="button"
                              onClick={() => {
                                setQuestions((prev) => prev.map((item) => (item.id === q.id ? { ...item, correct_answer: optId } : item)));
                              }}
                              className={`h-6 w-6 rounded-lg text-xs font-bold transition ${
                                isSel ? 'bg-blue-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              {optId}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Phần II: Đúng / Sai */}
              <div>
                <h4 className="font-bold text-xs text-amber-900 mb-2 uppercase">PHẦN II. Đúng / Sai ({part2Questions.length} câu)</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {part2Questions.map((q, idx) => {
                    const cMap = q.correct_answer || {};
                    return (
                      <div key={q.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 text-xs">
                        <div className="font-bold text-slate-700 mb-1.5">Câu {idx + 1} (Đúng/Sai):</div>
                        <div className="grid grid-cols-4 gap-2 text-center">
                          {['a', 'b', 'c', 'd'].map((lbl) => {
                            const isT = !!cMap[lbl];
                            return (
                              <div key={lbl} className="space-y-1">
                                <span className="font-semibold text-slate-500">{lbl})</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = { ...cMap, [lbl]: !isT };
                                    setQuestions((prev) => prev.map((item) => (item.id === q.id ? { ...item, correct_answer: updated } : item)));
                                  }}
                                  className={`w-full py-1 rounded-lg text-[11px] font-bold transition ${
                                    isT ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                                  }`}
                                >
                                  {isT ? 'Đúng' : 'Sai'}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Phần III: Điền số ngắn */}
              <div>
                <h4 className="font-bold text-xs text-emerald-900 mb-2 uppercase">PHẦN III. Điền số ngắn ({part3Questions.length} câu)</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {part3Questions.map((q, idx) => {
                    const ansVal = Array.isArray(q.correct_answer) ? q.correct_answer[0] : q.correct_answer || '';
                    return (
                      <div key={q.id} className="p-2 rounded-xl border border-slate-200 bg-slate-50/50 text-xs">
                        <div className="font-bold text-slate-600 mb-1">Câu {idx + 1}:</div>
                        <input
                          type="text"
                          value={ansVal}
                          onChange={(e) => {
                            const val = e.target.value.trim();
                            setQuestions((prev) => prev.map((item) => (item.id === q.id ? { ...item, correct_answer: [val, val.replace(',', '.')] } : item)));
                          }}
                          placeholder="Điền đáp số..."
                          className="w-full text-center p-1 font-bold text-emerald-800 rounded-lg border border-slate-300 bg-white"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Phần IV: Tự luận */}
              {part4Questions.length > 0 && (
                <div>
                  <h4 className="font-bold text-xs text-purple-900 mb-2 uppercase">PHẦN IV. Tự luận ({part4Questions.length} câu)</h4>
                  <div className="space-y-2">
                    {part4Questions.map((q, idx) => (
                      <div key={q.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 text-xs">
                        <div className="font-bold text-slate-700 mb-1">Câu {idx + 1} (Tự luận - {q.points || 2.0}đ):</div>
                        <div className="text-slate-600 line-clamp-2 italic">
                          {q.explanation || 'Đã có hướng dẫn chấm / đáp án tự luận.'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowAnswerMatrixModal(false)}
                className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white hover:bg-slate-800 cursor-pointer"
              >
                Xong
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. MODAL 4: SINH ĐỀ AI */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-600" />
                Trợ Lý AI Sinh Câu Hỏi
              </h3>
              <button
                type="button"
                onClick={() => setShowAiModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Chủ đề bài toán:</label>
                <input
                  type="text"
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 font-semibold text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Số lượng câu:</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={aiCount}
                    onChange={(e) => setAiCount(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl border border-slate-300 font-bold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Độ khó:</label>
                  <select
                    value={aiDifficulty}
                    onChange={(e) => setAiDifficulty(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 font-semibold text-slate-800"
                  >
                    <option value="nhan_biet">Nhận biết</option>
                    <option value="thong_hieu">Thông hiểu</option>
                    <option value="van_dung">Vận dụng</option>
                    <option value="van_dung_cao">Vận dụng cao</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isAiGenerating}
                onClick={handleGenerateAiQuestions}
                className="w-full rounded-xl bg-purple-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-purple-500 shadow-md transition cursor-pointer flex items-center justify-center gap-2"
              >
                <Sparkles className="h-4 w-4" />
                <span>{isAiGenerating ? 'AI đang biên soạn câu hỏi...' : 'Sinh Câu Hỏi Ngay'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. MODAL 5: XEM TRƯỚC BẢN IN ẤN / HỌC SINH */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-4xl max-h-[92vh] rounded-3xl bg-white p-6 shadow-2xl flex flex-col animate-in fade-in zoom-in-95 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Printer className="h-5 w-5 text-blue-600" />
                Xem Trước Đề Thi Bản In Ấn (A4)
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-500 cursor-pointer flex items-center gap-1.5"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>In / Xuất PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowPreviewModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-slate-50 rounded-xl my-3">
              <div className="bg-white p-8 rounded-lg shadow-sm border border-slate-200 text-sm space-y-6">
                <div className="text-center font-bold pb-4 border-b border-slate-300">
                  <h2 className="text-base uppercase">{title}</h2>
                  <p className="text-xs text-slate-500">Môn: Toán THPT • Thời gian: {duration} phút</p>
                </div>

                <div className="space-y-4">
                  {questions.map((q, idx) => (
                    <div key={q.id} className="text-xs leading-relaxed">
                      <span className="font-bold mr-1">Câu {idx + 1}.</span>
                      <MathRenderer content={q.content} inline />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* 10. OVERLAY LOADING KHI ĐANG PHÂN TÍCH FILE */}
      {isParsingWord && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="rounded-3xl bg-white p-6 shadow-2xl flex flex-col items-center gap-3 max-w-sm text-center border border-slate-200">
            <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
            <h4 className="font-extrabold text-slate-800 text-sm">Đang phân tích & trích xuất câu hỏi...</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Hệ thống đang bóc tách công thức toán, MathType và hình vẽ từ file. Vui lòng đợi trong giây lát.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ExamEditorPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-xs font-bold text-slate-500">Đang tải trình soạn thảo đề thi...</div>}>
      <ExamEditorContent />
    </Suspense>
  );
}
