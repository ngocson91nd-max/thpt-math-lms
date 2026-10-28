'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Exam, Question, QuestionType, QuestionDifficulty } from '@/types/database';
import { MOCK_EXAMS, MOCK_QUESTIONS } from '@/lib/supabase/mockStore';
import { parseExamLatex } from '@/lib/latex/examParser';
import { parseWordDocx, convertWmfQuestionsToPng } from '@/lib/word/wordExamParser';
import MathRenderer from '@/components/math/MathRenderer';
import MathEditor from '@/components/math/MathEditor';
import PdfExamViewer from '@/components/exam/PdfExamViewer';
import { parseQuickAnswerKey, buildPdfExamQuestions } from '@/lib/pdf/pdfExamHelper';
import { savePdfToIndexedDb, getPdfFromIndexedDb } from '@/lib/pdf/pdfStorage';
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
  ChevronRight,
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
} from 'lucide-react';

function ExamEditorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const examIdParam = searchParams.get('id');
  const isNewParam = searchParams.get('new');

  const { user } = useAuth();

  // 1. Thông tin tổng quát của đề thi
  const [examId, setExamId] = useState<string>(() => examIdParam || `exam-${Date.now()}`);
  const [title, setTitle] = useState('Đề Thi Thử Tốt Nghiệp THPT 2025 Môn Toán (Chuẩn Bộ GD&ĐT)');
  const [grade, setGrade] = useState<10 | 11 | 12>(12);
  const [duration, setDuration] = useState(90);
  const [description, setDescription] = useState('Đề thi theo cấu trúc đề minh họa mới nhất gồm các phần Trắc nghiệm, Đúng/Sai, Điền số.');
  const [format, setFormat] = useState<'standard_3_parts' | 'periodic_4_parts' | 'custom'>('standard_3_parts');
  const [shuffleQuestions, setShuffleQuestions] = useState(false);

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
  const [bankQuestions, setBankQuestions] = useState<Question[]>(MOCK_QUESTIONS);
  const [bankSearch, setBankSearch] = useState('');
  const [bankPartFilter, setBankPartFilter] = useState<'all' | 1 | 2 | 3 | 4>('all');

  // Lưu thông báo lưu thành công
  const [saveToast, setSaveToast] = useState<string | null>(null);

  // Tải dữ liệu đề thi khi vào trang
  useEffect(() => {
    if (typeof window === 'undefined') return;

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
      const savedExams = localStorage.getItem('lms_exams');
      let found: Exam | undefined;
      if (savedExams) {
        try {
          const parsed = JSON.parse(savedExams);
          found = parsed.find((e: Exam) => e.id === examIdParam);
        } catch {}
      }
      if (!found) {
        found = MOCK_EXAMS.find((e) => e.id === examIdParam);
      }

      if (found) {
        setExamId(found.id);
        setTitle(found.title);
        setGrade(found.grade);
        setDuration(found.duration_minutes);
        setDescription(found.description || '');
        setFormat(found.format || (found.questions?.some((q) => q.part === 4) ? 'periodic_4_parts' : 'standard_3_parts'));
        setShuffleQuestions(found.shuffle_questions || false);
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
      const initial = MOCK_QUESTIONS.slice(0, 7);
      setQuestions(initial);
      setHistory([initial]);
      setHistoryIndex(0);
      setActiveQuestionId(initial[0].id);
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
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setPdfUrl(dataUrl);
    };
    reader.readAsDataURL(file);
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
  const handleApplyPdfExam = () => {
    if (!pdfUrl) {
      alert('Vui lòng tải lên file PDF đề thi trước khi tạo đề!');
      return;
    }

    const parsed = parseQuickAnswerKey(quickAnswerText);
    const generated = buildPdfExamQuestions(pdfPart1Count, pdfPart2Count, pdfPart3Count, parsed);

    setQuestionsWithHistory(generated);
    setActiveQuestionId(generated[0]?.id);
    setExamMode('pdf_view');
    setShowImportModal(false);
    setSaveToast(`Đã tạo đề thi PDF thành công với ${generated.length} câu hỏi!`);
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

  // Xử lý nạp file Word (.docx)
  const handleUploadDocx = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsingWord(true);
    setWordNotice(null);

    try {
      let extractedQuestions: Question[] = [];

      // 1. Phân tích trực tiếp phía client (chuyển đổi WMF MathType sang PNG siêu nét trên Canvas)
      try {
        const res = await parseWordDocx(file);
        if (res.questions && res.questions.length > 0) {
          extractedQuestions = res.questions;
        }
      } catch (clientErr) {
        console.warn('Client parser failed, falling back to API:', clientErr);
      }

      // 2. Dự phòng qua API backend nếu client gặp sự cố
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

      // Chuyển đổi mọi ảnh WMF sang PNG hiển thị được trên mọi trình duyệt
      if (extractedQuestions.length > 0) {
        extractedQuestions = convertWmfQuestionsToPng(extractedQuestions);
      }

      if (extractedQuestions.length === 0) {
        setWordNotice('Không tìm thấy câu hỏi nào (định dạng "Câu 1:", "Bài 1:", v.v.) trong file Word!');
      } else {
        setQuestionsWithHistory(extractedQuestions);
        setActiveQuestionId(extractedQuestions[0]?.id);
        setExamMode('interactive');
        setTitle(file.name.replace(/\.[^/.]+$/, ''));
        setWordNotice(`Đã trích xuất thành công ${extractedQuestions.length} câu hỏi từ file "${file.name}"!`);
        setShowImportModal(false);
        setSaveToast(`Đã nạp ${extractedQuestions.length} câu hỏi từ Word vào trang soạn thảo!`);
        setTimeout(() => setSaveToast(null), 3500);
      }
    } catch (err: any) {
      setWordNotice(`Lỗi đọc file Word: ${err?.message || 'Không xác định'}`);
    } finally {
      setIsParsingWord(false);
    }
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
      title: title.trim(),
      description: description.trim(),
      teacher_id: user?.id || '22222222-2222-2222-2222-222222222222',
      grade,
      duration_minutes: Number(duration),
      passing_score: 5.0,
      shuffle_questions: shuffleQuestions,
      shuffle_options: !shuffleQuestions,
      max_attempts: 2,
      status: 'published',
      format,
      exam_mode: examMode,
      pdf_url: storedPdfUrl,
      solution_pdf_url: storedSolutionPdfUrl,
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
        const savedExams = localStorage.getItem('lms_exams');
        let examsList: Exam[] = savedExams ? JSON.parse(savedExams) : MOCK_EXAMS;
        const existIdx = examsList.findIndex((e) => e.id === examId);
        if (existIdx >= 0) {
          examsList[existIdx] = updatedExam;
        } else {
          examsList = [updatedExam, ...examsList];
        }
        localStorage.setItem('lms_exams', JSON.stringify(examsList));

        // Cập nhật cả ngân hàng câu hỏi nếu ở chế độ tương tác
        if (examMode !== 'pdf_view') {
          const savedQ = localStorage.getItem('lms_questions');
          let qList: Question[] = savedQ ? JSON.parse(savedQ) : MOCK_QUESTIONS;
          const qIds = new Set(qList.map((q) => q.id));
          const newItems = questions.filter((q) => !qIds.has(q.id));
          localStorage.setItem('lms_questions', JSON.stringify([...newItems, ...qList]));
        }
      } catch (err) {
        console.warn('Lỗi khi lưu localStorage:', err);
      }
    }

    setSaveToast(examMode === 'pdf_view' ? 'Lưu đề thi PDF và bảng đáp án thành công!' : 'Lưu toàn bộ nội dung đề thi thành công!');
    setTimeout(() => {
      setSaveToast(null);
      router.push('/exams');
    }, 1200);
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
                iExam Editor
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

          {/* Nhóm nút tác vụ trên đầu */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowInfoModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition cursor-pointer"
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

            <button
              type="button"
              onClick={() => setShowImportModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition cursor-pointer"
            >
              <Upload className="h-3.5 w-3.5 text-indigo-600" />
              <span>Nhập file</span>
            </button>

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

            <button
              type="button"
              onClick={handleSaveExam}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-blue-500 active:scale-95 transition cursor-pointer"
            >
              <Save className="h-3.5 w-3.5" />
              <span>Lưu đề</span>
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
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 font-bold text-xs hover:bg-blue-100 transition cursor-pointer">
                  <Upload className="h-3.5 w-3.5" />
                  <span>Đổi file PDF</span>
                  <input type="file" accept=".pdf" className="hidden" onChange={handleUploadPdfFile} />
                </label>
              </div>
            </div>
            <div className="flex-1 min-h-[500px]">
              <PdfExamViewer pdfUrl={pdfUrl} title={pdfFileName || title} className="h-full" />
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
      <div className="flex-1 flex overflow-hidden">
        {/* KHUNG SOẠN THẢO TRANG GIẤY A4 Ở TRUNG TÂM */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-8 flex justify-center">
          <div className="w-full max-w-[860px] bg-white rounded-md shadow-xl border border-slate-300 min-h-[1120px] p-8 sm:p-14 relative flex flex-col justify-between">
            {/* Tít đề chuẩn Bộ GD&ĐT */}
            <div className="border-b-2 border-slate-900 pb-4 mb-6">
              <div className="flex justify-between items-start text-xs sm:text-sm font-bold text-slate-900">
                <div className="text-center">
                  <div>SỞ GIÁO DỤC VÀ ĐÀO TẠO</div>
                  <div className="text-blue-700 uppercase">TOÁN THẦY SƠN - THPT</div>
                  <div className="text-[11px] font-normal text-slate-500 mt-1">MÃ ĐỀ: 101</div>
                </div>
                <div className="text-center">
                  <div className="uppercase">KỲ THI TỐT NGHIỆP THPT NĂM 2025</div>
                  <div className="text-red-700 font-extrabold text-sm sm:text-base">MÔN TOÁN - LỚP {grade}</div>
                  <div className="text-[11px] font-normal text-slate-500 mt-1">
                    Thời gian làm bài: {duration} phút (không kể thời gian phát đề)
                  </div>
                </div>
              </div>
            </div>

            {/* DANH SÁCH CÁC CÂU HỎI TRÊN TRANG A4 */}
            <div className="space-y-8 flex-1">
              {/* PHẦN I: TRẮC NGHIỆM 4 LỰA CHỌN */}
              <section id="section-part1" className="space-y-4">
                <div className="flex items-center justify-between border-b border-blue-200 pb-2">
                  <div>
                    <h3 className="font-extrabold text-sm text-blue-900 uppercase">
                      PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn
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
                    Chưa có câu hỏi nào trong Phần I. Bấm "+ Thêm câu hỏi" để bổ sung.
                  </div>
                ) : (
                  <div className="space-y-5">
                    {part1Questions.map((q, idx) => renderQuestionItem(q, idx + 1))}
                  </div>
                )}
              </section>

              {/* PHẦN II: TRẮC NGHIỆM ĐÚNG SAI */}
              <section id="section-part2" className="space-y-4 pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                  <div>
                    <h3 className="font-extrabold text-sm text-amber-900 uppercase">
                      PHẦN II. Câu trắc nghiệm đúng sai
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
                    Chưa có câu hỏi nào trong Phần II.
                  </div>
                ) : (
                  <div className="space-y-5">
                    {part2Questions.map((q, idx) => renderQuestionItem(q, idx + 1))}
                  </div>
                )}
              </section>

              {/* PHẦN III: TRẢ LỜI NGẮN */}
              <section id="section-part3" className="space-y-4 pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
                  <div>
                    <h3 className="font-extrabold text-sm text-emerald-900 uppercase">
                      PHẦN III. Câu trắc nghiệm trả lời ngắn (Điền số)
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
                    Chưa có câu hỏi nào trong Phần III.
                  </div>
                ) : (
                  <div className="space-y-5">
                    {part3Questions.map((q, idx) => renderQuestionItem(q, idx + 1))}
                  </div>
                )}
              </section>

              {/* PHẦN IV: TỰ LUẬN (CHO ĐỀ ĐỊNH KỲ & HSG) */}
              {(format === 'periodic_4_parts' || part4Questions.length > 0) && (
                <section id="section-part4" className="space-y-4 pt-4 border-t border-slate-200">
                  <div className="flex items-center justify-between border-b border-purple-200 pb-2">
                    <div>
                      <h3 className="font-extrabold text-sm text-purple-900 uppercase">
                        PHẦN IV. Câu hỏi tự luận (Vận dụng cao)
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
                    <div className="rounded-xl border border-dashed border-purple-200 p-6 text-center text-xs text-slate-400">
                      Chưa có câu hỏi nào trong Phần IV.
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {part4Questions.map((q, idx) => renderQuestionItem(q, idx + 1))}
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

        {/* 4. CỘT ĐIỀU HƯỚNG CẤU TRÚC CÂU HỎI BÊN PHẢI (Right Navigation Panel) */}
        <aside className="w-80 border-l border-slate-200 bg-white p-4 overflow-y-auto hidden lg:flex flex-col justify-between">
          <div className="space-y-4">
            {/* Header thống kê */}
            <div className="border-b border-slate-100 pb-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-blue-600" />
                  Cấu trúc câu hỏi
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  {totalQuestions} câu • {totalScore.toFixed(2)} điểm
                </span>
              </div>
            </div>

            {/* Hai nút hành động: Thêm câu hỏi & Ma trận đáp án */}
            <div className="grid grid-cols-2 gap-2">
              <div className="relative group">
                <button
                  type="button"
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-500 transition cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Thêm câu hỏi</span>
                </button>
                <div className="absolute left-0 top-full mt-1 w-48 rounded-xl bg-white shadow-xl border border-slate-200 p-1.5 hidden group-hover:block z-50 animate-in fade-in zoom-in-95">
                  <button
                    type="button"
                    onClick={() => handleAddEmptyQuestion(1)}
                    className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition"
                  >
                    + Phần I: Trắc nghiệm 4 lựa chọn
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddEmptyQuestion(2)}
                    className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-amber-50 hover:text-amber-700 rounded-lg transition"
                  >
                    + Phần II: Đúng / Sai
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddEmptyQuestion(3)}
                    className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 rounded-lg transition"
                  >
                    + Phần III: Điền số ngắn
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddEmptyQuestion(4)}
                    className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-purple-50 hover:text-purple-700 rounded-lg transition"
                  >
                    + Phần IV: Tự luận VDC
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowAnswerMatrixModal(true)}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-2xs transition cursor-pointer"
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                <span>Ma trận Đáp án</span>
              </button>
            </div>

            {/* Các thẻ chỉ mục 4 Phần (Matching screenshot) */}
            <div className="space-y-3 pt-2">
              {/* Thẻ Phần I */}
              <div
                onClick={() => scrollToSection('section-part1')}
                className="rounded-2xl border border-blue-200 bg-blue-50/50 p-3.5 cursor-pointer hover:bg-blue-50 transition"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
                    <span className="font-bold text-xs text-blue-900">PHẦN I - Trắc nghiệm</span>
                  </div>
                  <span className="text-[11px] font-bold text-blue-700">{part1Questions.length} câu</span>
                </div>
                <div className="text-[10px] text-slate-500">4 lựa chọn • 0.25đ/câu</div>
              </div>

              {/* Thẻ Phần II */}
              <div
                onClick={() => scrollToSection('section-part2')}
                className="rounded-2xl border border-amber-200 bg-amber-50/50 p-3.5 cursor-pointer hover:bg-amber-50 transition"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-600" />
                    <span className="font-bold text-xs text-amber-900">PHẦN II - Đúng / Sai</span>
                  </div>
                  <span className="text-[11px] font-bold text-amber-800">{part2Questions.length} câu</span>
                </div>
                <div className="text-[10px] text-slate-500">4 ý a, b, c, d • 1.0đ/câu</div>
              </div>

              {/* Thẻ Phần III */}
              <div
                onClick={() => scrollToSection('section-part3')}
                className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3.5 cursor-pointer hover:bg-emerald-50 transition"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
                    <span className="font-bold text-xs text-emerald-900">PHẦN III - Trả lời ngắn</span>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-800">{part3Questions.length} câu</span>
                </div>
                <div className="text-[10px] text-slate-500">Điền số • 0.5đ/câu</div>
              </div>

              {/* Thẻ Phần IV */}
              <div
                onClick={() => scrollToSection('section-part4')}
                className="rounded-2xl border border-purple-200 bg-purple-50/50 p-3.5 cursor-pointer hover:bg-purple-50 transition"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-purple-600" />
                    <span className="font-bold text-xs text-purple-900">PHẦN IV - Tự luận</span>
                  </div>
                  <span className="text-[11px] font-bold text-purple-800">{part4Questions.length} câu</span>
                </div>
                <div className="text-[10px] text-slate-500">Vận dụng cao • 2.0đ/câu</div>
              </div>
            </div>
          </div>

          {/* Nút lưu đề ở chân aside */}
          <div className="pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={handleSaveExam}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <Save className="h-4 w-4" />
              <span>Lưu Đề Vào Hệ Thống</span>
            </button>
          </div>
        </aside>
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
                Nhập Đề Thi Từ File Word Hoặc LaTeX
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
    </div>
  );
}

export default function ExamEditorPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-xs font-bold text-slate-500">Đang tải iExam Editor...</div>}>
      <ExamEditorContent />
    </Suspense>
  );
}
