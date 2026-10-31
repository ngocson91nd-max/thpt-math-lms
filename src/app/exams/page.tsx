'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { MOCK_EXAMS, MOCK_CLASSES } from '@/lib/supabase/mockStore';
import { Exam, Question, ClassItem } from '@/types/database';
import { parseExamLatex } from '@/lib/latex/examParser';
import MathRenderer from '@/components/math/MathRenderer';
import { createClient } from '@/lib/supabase/client';
import { savePdfToIndexedDb } from '@/lib/pdf/pdfStorage';
import { isExamPermittedForStudent, isUserEnrolledInAnyClass } from '@/lib/auth/enrollment';
import { autoRecoverAllSubmissionsFromBrowser } from '@/lib/realtime/syncService';
import { StudentPendingApprovalView } from '@/components/auth/StudentPendingApprovalView';
import {
  ClipboardList,
  Clock,
  Award,
  Plus,
  Play,
  CheckCircle,
  HelpCircle,
  Shuffle,
  Sparkles,
  BookOpen,
  Filter,
  Pencil,
  Trash2,
  FileText,
  FileCode,
  Layers,
  CheckSquare,
  X,
  Search,
  RefreshCw,
  Copy,
  Link2,
  Radio,
  Lock,
  Unlock,
  BarChart3,
  FileUp,
  Upload,
  CheckCircle2,
  Grid,
  List,
  Eye,
  ArrowUpRight,
  ExternalLink,
  GraduationCap,
  Users,
  Zap,
} from 'lucide-react';

export default function ExamsPage() {
  const router = useRouter();
  const { user, isTeacher, isStudent } = useAuth();
  
  // Nạp tức thì danh sách đề thi từ cache trình duyệt (0ms) để không bị chớp màn hình trống
  const [exams, setExams] = useState<Exam[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const savedDeleted = localStorage.getItem('lms_deleted_exam_ids');
      const deletedIds = new Set<string>(savedDeleted ? JSON.parse(savedDeleted) : []);
      const savedExams = localStorage.getItem('lms_exams');
      if (savedExams) {
        const parsed = JSON.parse(savedExams);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.filter((e: any) => !deletedIds.has(e.id) && !deletedIds.has(e.code));
        }
      }
    } catch {}
    return [];
  });

  const [isLoading, setIsLoading] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      const savedExams = localStorage.getItem('lms_exams');
      if (savedExams && JSON.parse(savedExams).length > 0) return false;
    } catch {}
    return true;
  });

  const [classes, setClasses] = useState<ClassItem[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem('lms_classes');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [];
  });
  const [questionsPool, setQuestionsPool] = useState<Question[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem('lms_questions');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });
  const [allSubmissions, setAllSubmissions] = useState<any[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      // 1. Quét và gom toàn bộ bài thi đã nộp trên máy
      const recovered = autoRecoverAllSubmissionsFromBrowser();
      if (recovered && recovered.length > 0) return recovered;

      const saved = localStorage.getItem('lms_all_submissions');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });
  const [selectedGrade, setSelectedGrade] = useState<number | 'all'>('all');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [categoryTab, setCategoryTab] = useState<'all' | 'exam' | 'practice'>('all');
  const [filterType, setFilterType] = useState<'all' | 'timed' | 'practice'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [copyToast, setCopyToast] = useState<string | null>(null);

  // Nhận diện danh mục Đề thi vs Bài tập & Tự luyện
  const getExamCategory = (e: Exam): 'exam' | 'practice' => {
    if (e.category === 'practice' || e.category === 'exam') return e.category;
    const title = (e.title || '').toLowerCase();
    if (
      title.includes('bài tập') ||
      title.includes('luyện tập') ||
      title.includes('tự luyện') ||
      title.includes('về nhà') ||
      title.includes('ôn tập')
    ) {
      return 'practice';
    }
    return 'exam';
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const tabParam = urlParams.get('tab');
      if (tabParam === 'exam' || tabParam === 'practice' || tabParam === 'all') {
        setCategoryTab(tabParam);
      }
    }
  }, []);

  // Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPdfCreateModal, setShowPdfCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);

  // Modal Giao đề thi cho lớp học
  const [assigningExam, setAssigningExam] = useState<Exam | null>(null);
  const [assignClassesSelection, setAssignClassesSelection] = useState<string[]>([]);
  const [assignAccessType, setAssignAccessType] = useState<'public' | 'restricted'>('restricted');

  // Tạo đề từ PDF
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfExamTitle, setPdfExamTitle] = useState('');
  const [pdfGrade, setPdfGrade] = useState<10 | 11 | 12>(12);
  const [pdfDuration, setPdfDuration] = useState<number>(45);
  const [pdfAssignedClass, setPdfAssignedClass] = useState<string>('12 Toán 1');
  const [pdfP1Count, setPdfP1Count] = useState<number>(12);
  const [pdfP2Count, setPdfP2Count] = useState<number>(4);
  const [pdfP3Count, setPdfP3Count] = useState<number>(6);
  const [pdfSmartMask, setPdfSmartMask] = useState<boolean>(true);
  const [isCreatingPdfExam, setIsCreatingPdfExam] = useState<boolean>(false);

  // Creator Modal Tabs: 'matrix' | 'manual' | 'latex' | 'word'
  const [creatorMode, setCreatorMode] = useState<'matrix' | 'manual' | 'latex' | 'word'>('matrix');
  const [selectedFormat, setSelectedFormat] = useState<'standard_3_parts' | 'periodic_4_parts' | 'custom'>('standard_3_parts');
  const [isParsingWord, setIsParsingWord] = useState(false);
  const [wordNotice, setWordNotice] = useState<string | null>(null);

  // Form tạo đề mới
  const [newTitle, setNewTitle] = useState('Đề Thi Thử Tốt Nghiệp THPT 2025 Môn Toán (Chuẩn Bộ GD&ĐT)');
  const [newGrade, setNewGrade] = useState<10 | 11 | 12>(12);
  const [newDuration, setNewDuration] = useState(90);
  const [newDescription, setNewDescription] = useState('Đề thi theo đúng cấu trúc đề minh họa mới nhất của Bộ GD&ĐT gồm 3 phần.');
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [saveNewExamQuestionsToBank, setSaveNewExamQuestionsToBank] = useState(false);

  // Danh sách câu hỏi được chọn cho đề mới
  const [selectedQuestions, setSelectedQuestions] = useState<Question[]>([]);

  // State cho Tab Ma Trận / Tự Động
  const [matrixTopic, setMatrixTopic] = useState('all');
  const [matrixP1Count, setMatrixP1Count] = useState(12);
  const [matrixP2Count, setMatrixP2Count] = useState(4);
  const [matrixP3Count, setMatrixP3Count] = useState(6);
  const [matrixP4Count, setMatrixP4Count] = useState(0);

  // State cho Tab Chọn Thủ Công
  const [manualSearch, setManualSearch] = useState('');
  const [manualPartFilter, setManualPartFilter] = useState<'all' | 1 | 2 | 3 | 4>('all');
  const [manualTopicFilter, setManualTopicFilter] = useState('all');

  // State cho Tab Dán LaTeX
  const [latexInput, setLatexInput] = useState('');
  const [latexParseNotice, setLatexParseNotice] = useState<string | null>(null);

  // Form sửa đề
  const [editTitle, setEditTitle] = useState('');
  const [editGrade, setEditGrade] = useState<10 | 11 | 12>(12);
  const [editDuration, setEditDuration] = useState(45);
  const [editDescription, setEditDescription] = useState('');
  const [editShuffle, setEditShuffle] = useState(true);

  // Tải danh sách đề thi, lớp học & ngân hàng câu hỏi
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // 0. Đọc URL query param nếu có ?class=...
      const params = new URLSearchParams(window.location.search);
      const classQuery = params.get('class');
      if (classQuery) {
        setSelectedClass(classQuery);
      }

      // 1. Tải Danh sách Lớp học thực tế & lọc bỏ các lớp đã xóa vĩnh viễn
      const savedDeletedCls = localStorage.getItem('lms_deleted_class_ids');
      const deletedClassIds = new Set<string>(savedDeletedCls ? JSON.parse(savedDeletedCls) : []);

      const savedClasses = localStorage.getItem('lms_classes');
      if (savedClasses) {
        try {
          const parsedCls = JSON.parse(savedClasses);
          if (Array.isArray(parsedCls)) {
            const filteredCls = parsedCls.filter(
              (c: any) => !deletedClassIds.has(c.id) && !deletedClassIds.has(c.code)
            );
            setClasses(filteredCls);
            localStorage.setItem('lms_classes', JSON.stringify(filteredCls));
          }
        } catch (e) {
          console.error('Lỗi tải danh sách lớp học:', e);
        }
      } else {
        const initialCls = MOCK_CLASSES.filter(
          (c) => !deletedClassIds.has(c.id) && !deletedClassIds.has(c.code)
        );
        setClasses(initialCls);
        localStorage.setItem('lms_classes', JSON.stringify(initialCls));
      }

      // 2. Ngân hàng câu hỏi chỉ nạp từ cache, không fetch chặn luồng giao diện danh sách đề thi
      const savedQuestions = localStorage.getItem('lms_questions');
      if (savedQuestions) {
        try {
          const parsed = JSON.parse(savedQuestions);
          if (Array.isArray(parsed)) {
            setQuestionsPool(parsed);
          }
        } catch (e) {
          console.error(e);
        }
      }

      // 3. Tải Danh sách đề thi siêu tốc (metadata siêu nhẹ 15ms) từ Supabase Cloud API
      fetchExams();

      // 4. Tải danh sách bài nộp để đếm số HS đã thi và hiển thị bài chờ chấm
      if (typeof window !== 'undefined') {
        localStorage.removeItem('lms_deleted_submission_ids');
      }
      fetchSubmissions();
    }
  }, []);

  const fetchSubmissions = async () => {
    try {
      const res = await fetch(`/api/submissions?t=${Date.now()}`, { cache: 'no-store' });
      const d = await res.json();
      if (d.success && Array.isArray(d.submissions)) {
        setAllSubmissions(d.submissions);
        if (typeof window !== 'undefined') {
          localStorage.setItem('lms_all_submissions', JSON.stringify(d.submissions));
        }
      }
    } catch (e) {
      console.warn('Lỗi tải danh sách bài nộp:', e);
    }
  };

  const fetchExams = async () => {
    try {
      const res = await fetch('/api/exams');
      const data = await res.json();
      if (data.success && Array.isArray(data.exams)) {
        if (data.exams.length > 0) {
          setExams(data.exams);
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem('lms_exams', JSON.stringify(data.exams));
              localStorage.removeItem('lms_deleted_exam_ids');
            } catch {}
          }
          return;
        }
      }
    } catch (e) {
      console.error('Fetch exams error:', e);
    } finally {
      setIsLoading(false);
    }

    // Fallback nếu mất kết nối mạng hoặc Cloud chưa có đề
    if (typeof window !== 'undefined') {
      try {
        const savedExams = localStorage.getItem('lms_exams');
        if (savedExams) {
          const parsed = JSON.parse(savedExams);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setExams(parsed);
            return;
          }
        }
      } catch {}
    }
    setExams(MOCK_EXAMS);
  };

  useEffect(() => {
    const handleSync = () => fetchExams();
    window.addEventListener('lms_exams_updated', handleSync);

    // Đồng bộ tức thì 0ms giữa tất cả các tab trình duyệt
    let bc: BroadcastChannel | null = null;
    const handleSubmissionsSync = () => {
      fetchSubmissions();
      fetchExams();
    };

    window.addEventListener('lms_submissions_updated', handleSubmissionsSync);

    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      bc = new BroadcastChannel('lms_realtime_sync');
      bc.onmessage = (event) => {
        if (event.data?.type === 'EXAMS_UPDATED' || event.data?.type === 'ALL_UPDATED') {
          fetchExams();
        }
        if (event.data?.type === 'SUBMISSIONS_UPDATED') {
          handleSubmissionsSync();
        }
      };
    }

    // Polling thông minh định kỳ 2.5s để cập nhật kết quả thi thời gian thực từ Cloud
    // Đảm bảo học sinh nộp bài trên điện thoại/máy tính khác thì màn hình Thầy Sơn cập nhật ngay!
    const pollInterval = setInterval(() => {
      fetchSubmissions();
    }, 2500);

    return () => {
      window.removeEventListener('lms_exams_updated', handleSync);
      window.removeEventListener('lms_submissions_updated', handleSubmissionsSync);
      if (bc) bc.close();
      clearInterval(pollInterval);
    };
  }, []);

  const saveExamsToStorage = (updated: Exam[]) => {
    setExams(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('lms_exams', JSON.stringify(updated));
    }
  };

  const handleCopyExamCode = (code: string) => {
    if (typeof window !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(code);
      setCopyToast(`Đã sao chép mã đề: ${code}`);
      setTimeout(() => setCopyToast(null), 2500);
    }
  };

  const handleCopyExamLink = (examId: string) => {
    if (typeof window !== 'undefined' && navigator.clipboard) {
      const origin = window.location.origin;
      const link = `${origin}/exams/${examId}/take`;
      navigator.clipboard.writeText(link);
      setCopyToast('Đã sao chép link làm bài thi của học sinh!');
      setTimeout(() => setCopyToast(null), 2500);
    }
  };

  const handleToggleLockExam = (examId: string) => {
    let changedExam: Exam | null = null;
    const updated = exams.map((e) => {
      if (e.id === examId) {
        const isLocked = !e.is_locked;
        changedExam = {
          ...e,
          is_locked: isLocked,
          status: isLocked ? ('closed' as const) : ('published' as const),
          updated_at: new Date().toISOString(),
        };
        return changedExam;
      }
      return e;
    });
    saveExamsToStorage(updated);
    setCopyToast('Đã cập nhật trạng thái đề thi!');
    setTimeout(() => setCopyToast(null), 2500);

    if (changedExam) {
      fetch('/api/exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changedExam),
      }).catch((err) => console.warn('Lỗi đồng bộ trạng thái khóa đề thi:', err));
    }
  };

  const handleDuplicateExam = (exam: Exam) => {
    const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const duplicated: Exam = {
      ...exam,
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `exam-${Date.now()}`,
      code: newCode,
      title: `${exam.title} (Bản sao)`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      submissions_count: 0,
    };
    const updated = [duplicated, ...exams];
    saveExamsToStorage(updated);
    setCopyToast(`Đã nhân bản đề thi! Mã đề mới: ${newCode}`);
    setTimeout(() => setCopyToast(null), 2500);

    fetch('/api/exams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(duplicated),
    }).catch((err) => console.warn('Lỗi đồng bộ đề thi nhân bản:', err));
  };

  const handleCreatePdfExamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pdfFile) {
      alert('Vui lòng chọn 1 file PDF đề thi!');
      return;
    }
    setIsCreatingPdfExam(true);
    try {
      let dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Không thể đọc file PDF'));
        reader.readAsDataURL(pdfFile);
      });

      const { maskPdfAnswerKey, buildPdfExamQuestions } = await import('@/lib/pdf/pdfExamHelper');
      let totalPages = 1;
      if (pdfSmartMask) {
        try {
          const maskResult = await maskPdfAnswerKey(dataUrl, { bottomRatio: 0.80 });
          dataUrl = maskResult.maskedDataUrl;
          totalPages = maskResult.totalPages;
        } catch (err) {
          console.warn('Lỗi tự động che đáp án PDF:', err);
        }
      }

      const newId = `pdf-exam-${Date.now()}`;
      const idbKey = `pdf_${newId}`;
      await savePdfToIndexedDb(idbKey, dataUrl);

      const generatedQuestions = buildPdfExamQuestions(pdfP1Count, pdfP2Count, pdfP3Count);
      const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();

      const newExam: Exam = {
        id: newId,
        code: newCode,
        title: pdfExamTitle.trim() || pdfFile.name.replace(/\.[^/.]+$/, ''),
        grade: pdfGrade,
        duration_minutes: pdfDuration,
        passing_score: 5.0,
        shuffle_questions: false,
        shuffle_options: false,
        max_attempts: 1,
        status: 'published',
        format: 'standard_3_parts',
        exam_mode: 'pdf_view',
        pdf_url: `idb:${idbKey}`,
        pdf_total_pages: 1,
        pdf_cut_last_page: pdfSmartMask,
        assigned_classes: [pdfAssignedClass],
        part_points: { part1: 3, part2: 4, part3: 3, part4: 0 },
        part_structure: {
          part1_count: pdfP1Count,
          part2_count: pdfP2Count,
          part3_count: pdfP3Count,
          part4_count: 0,
        },
        true_false_scoring: 'standard_thpt',
        violation_action: 'lock_exam',
        max_violations: 3,
        view_answer_policy: 'immediately',
        view_score_allowed: true,
        view_leaderboard_allowed: true,
        is_view_answer_allowed: true,
        teacher_id: user?.id || '22222222-2222-2222-2222-222222222222',
        submissions_count: 0,
        created_at: new Date().toISOString(),
        questions: generatedQuestions,
      };

      const updated = [newExam, ...exams];
      saveExamsToStorage(updated);
      setIsCreatingPdfExam(false);
      setShowPdfCreateModal(false);
      router.push(`/exams/editor?id=${newId}&mode=pdf`);
    } catch (err: any) {
      alert(`Lỗi tạo đề thi PDF: ${err?.message || 'Không xác định'}`);
      setIsCreatingPdfExam(false);
    }
  };

  // Cập nhật cấu hình khi đổi định dạng mẫu
  const handleSelectFormat = (format: 'standard_3_parts' | 'periodic_4_parts' | 'custom') => {
    setSelectedFormat(format);
    if (format === 'standard_3_parts') {
      setNewTitle('Đề Thi Thử Tốt Nghiệp THPT 2025 Môn Toán (Chuẩn Bộ GD&ĐT)');
      setNewDuration(90);
      setNewDescription('Đề thi chuẩn cấu trúc Bộ GD&ĐT 2025: 12 câu TN nhiều lựa chọn (3.0đ), 4 câu Đúng/Sai (4.0đ), 6 câu Trả lời ngắn (3.0đ).');
      setMatrixP1Count(12);
      setMatrixP2Count(4);
      setMatrixP3Count(6);
      setMatrixP4Count(0);
    } else if (format === 'periodic_4_parts') {
      setNewTitle('Đề Kiểm Tra Định Kỳ / Chọn HSG Toán 12 (Chuẩn 4 Phần TP. Huế)');
      setNewDuration(150);
      setNewDescription('Đề thi định kỳ / HSG THPT gồm 4 phần: 12 câu TN (3.0đ), 4 câu Đúng/Sai (4.0đ), 6 câu Trả lời ngắn (3.0đ) và 5 câu Tự luận VDC (10.0đ).');
      setMatrixP1Count(12);
      setMatrixP2Count(4);
      setMatrixP3Count(6);
      setMatrixP4Count(5);
    } else {
      setNewTitle('Đề Kiểm Tra Ôn Tập Toán THPT Thầy Sơn');
      setNewDuration(45);
      setNewDescription('Đề ôn tập tùy chỉnh cấu trúc câu hỏi.');
    }
  };

  // 1. Tự động sinh đề ngẫu nhiên từ Ngân hàng câu hỏi
  const handleGenerateRandomMatrix = () => {
    let pool = questionsPool;
    if (matrixTopic !== 'all') {
      pool = pool.filter((q) => q.topic === matrixTopic);
      if (pool.length === 0) pool = questionsPool; // Fallback nếu chuyên đề này chưa đủ
    }

    const p1Questions = pool.filter((q) => q.part === 1 || q.type === 'single_choice' || q.type === 'multiple_choice');
    const p2Questions = pool.filter((q) => q.part === 2 || q.type === 'true_false');
    const p3Questions = pool.filter((q) => q.part === 3 || q.type === 'short_answer');
    const p4Questions = pool.filter((q) => q.part === 4 || q.type === 'essay');

    const shuffleArr = <T,>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5);

    const pickedP1 = shuffleArr(p1Questions).slice(0, matrixP1Count).map((q) => ({ ...q, part: 1 as const, points: 0.25 }));
    const pickedP2 = shuffleArr(p2Questions).slice(0, matrixP2Count).map((q) => ({ ...q, part: 2 as const, points: 1.0 }));
    const pickedP3 = shuffleArr(p3Questions).slice(0, matrixP3Count).map((q) => ({ ...q, part: 3 as const, points: 0.5 }));
    const pickedP4 = shuffleArr(p4Questions).slice(0, matrixP4Count).map((q) => ({ ...q, part: 4 as const, points: 2.0 }));

    const combined = [...pickedP1, ...pickedP2, ...pickedP3, ...pickedP4];
    setSelectedQuestions(combined);
  };

  // 2. Toggle chọn câu hỏi thủ công
  const toggleSelectQuestion = (q: Question) => {
    setSelectedQuestions((prev) => {
      const exists = prev.some((item) => item.id === q.id);
      if (exists) {
        return prev.filter((item) => item.id !== q.id);
      } else {
        return [...prev, q];
      }
    });
  };

  // 3. Phân tích mã nguồn LaTeX
  const handleParseLatex = () => {
    if (!latexInput.trim()) {
      setLatexParseNotice('Vui lòng dán mã nguồn LaTeX vào ô bên dưới!');
      return;
    }

    try {
      const { questions, metadata } = parseExamLatex(latexInput);
      if (questions.length === 0) {
        setLatexParseNotice('Không tìm thấy khối \\begin{ex}...\\end{ex} nào trong đoạn mã!');
        return;
      }

      if (metadata.title) setNewTitle(metadata.title);
      if (metadata.duration) setNewDuration(metadata.duration);

      setSelectedQuestions(questions);
      setLatexParseNotice(`Đã trích xuất thành công ${questions.length} câu hỏi từ mã LaTeX!`);
    } catch (err: any) {
      setLatexParseNotice(`Lỗi phân tích cú pháp LaTeX: ${err?.message || 'Không xác định'}`);
    }
  };

  // 4. Nhập đề từ file Word (.docx)
  const handleWordFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsParsingWord(true);
    setWordNotice(null);
    try {
      let extractedQuestions: Question[] = [];

      // 1. Phân tích trực tiếp phía client (chuyển đổi WMF MathType sang PNG Canvas siêu nét)
      try {
        const { parseWordDocx, convertWmfQuestionsToPng } = await import('@/lib/word/wordExamParser');
        const result = await parseWordDocx(file);
        if (result.questions && result.questions.length > 0) {
          extractedQuestions = convertWmfQuestionsToPng(result.questions);
        }
      } catch (clientErr) {
        console.warn('Client parser failed, falling back to API:', clientErr);
      }

      // 2. Dự phòng qua API server nếu client không đọc được
      if (extractedQuestions.length === 0) {
        try {
          const fd = new FormData();
          fd.append('file', file);
          const res = await fetch('/api/upload-docx', {
            method: 'POST',
            body: fd,
          });
          if (res.ok) {
            const data = await res.json();
            if (data.success && Array.isArray(data.questions)) {
              extractedQuestions = data.questions;
            }
          }
        } catch (apiErr) {
          console.warn('API upload-docx failed:', apiErr);
        }
      }

      // Chuyển đổi toàn bộ ảnh WMF sang PNG trên Canvas trình duyệt
      if (extractedQuestions.length > 0) {
        const { convertWmfQuestionsToPng } = await import('@/lib/word/wordExamParser');
        extractedQuestions = convertWmfQuestionsToPng(extractedQuestions);
      }

      if (extractedQuestions.length === 0) {
        setWordNotice('Không tìm thấy câu hỏi nào (định dạng "Câu 1:", "Bài 1:", v.v.) trong file Word!');
      } else {
        setSelectedQuestions(extractedQuestions);
        setWordNotice(`Đã trích xuất thành công ${extractedQuestions.length} câu hỏi từ file "${file.name}"!`);
        const cleanName = file.name.replace(/\.[^/.]+$/, '');
        if (newTitle.includes('Đề Thi Thử Tốt Nghiệp THPT 2025 Môn Toán') || !newTitle) {
          setNewTitle(cleanName);
        }
      }
    } catch (err: any) {
      setWordNotice(`Lỗi phân tích file Word: ${err?.message || 'Không xác định'}`);
    } finally {
      setIsParsingWord(false);
    }
  };

  // Dán mẫu LaTeX
  const handlePasteLatexSample = (sampleType: 'hue' | 'single' | 'tf' | 'short' | 'essay' | 'tkz_tab' | 'tabular') => {
    if (sampleType === 'hue') {
      setLatexInput(`\\MaDe{1252}
\\TitDe
{SỞ GIÁO DỤC VÀ ĐÀO TẠO\\\\ \\textbf{THÀNH PHỐ HUẾ}\\\\ \\textbf{ĐỀ CHÍNH THỨC}\\\\ \\textit{(Đề có 04 trang)}}
{\\textbf{KỲ THI CHỌN HỌC SINH GIỎI THPT}\\\\ \\textbf{CẤP THÀNH PHỐ NĂM HỌC 2026-2027}\\\\ \\textbf{MÔN: TOÁN (PHỔ THÔNG)}\\\\ \\textit{Thời gian: 150 phút (không kể thời gian giao đề)}}

\\subsection*{Phần I. (3,0 điểm)} Thí sinh trả lời từ câu 1 đến câu 12. Mỗi câu thí sinh chỉ chọn một phương án.

\\begin{ex}
Trong mặt phẳng tọa độ $Oxy$, cho hai điểm $A(1;2)$ và $B(3;0)$. Tọa độ vectơ $\\vv{AB}$ và trung điểm $I$ của $AB$ là
\\choice
{$\\vv{AB}=(2;-2)$ và $I(2;2)$}
{\\True $\\vv{AB}=(2;-2)$ và $I(2;1)$}
{$\\vv{AB}=(4;2)$ và $I(2;1)$}
{$\\vv{AB}=(1;-1)$ và $I(4;2)$}
\\loigiai{
Ta có $\\vv{AB}=(x_B-x_A; y_B-y_A)=(3-1; 0-2)=(2;-2)$.
Tọa độ trung điểm $I$: $\\heva{&x_I=\\dfrac{x_A+x_B}{2}=\\dfrac{1+3}{2}=2\\\\ &y_I=\\dfrac{y_A+y_B}{2}=\\dfrac{2+0}{2}=1.}$
Vậy $I(2;1)$.
}
\\end{ex}

\\begin{ex}
Khảo sát thời gian tập thể dục của học sinh khối 12 thu được mẫu số liệu ghép nhóm:
\\begin{center}
\\begin{tabular}{|l|c|c|c|c|c|}
\\hline
Thời gian (phút) & $[0;20)$ & $[20;40)$ & $[40;60)$ & $[60;80)$ & $[80;100)$ \\\\
\\hline
Số học sinh & $5$ & $8$ & $11$ & $10$ & $6$ \\\\
\\hline
\\end{tabular}
\\end{center}
Trung bình mỗi học sinh tập bao nhiêu phút mỗi ngày?
\\choice
{$75$}
{$57$}
{\\True $52$}
{$60$}
\\loigiai{
Cỡ mẫu $n=40$. Giá trị đại diện các nhóm lần lượt là $10; 30; 50; 70; 90$.
Thời gian trung bình: $\\overline{x} = \\dfrac{5\\cdot 10 + 8\\cdot 30 + 11\\cdot 50 + 10\\cdot 70 + 6\\cdot 90}{40} = 52$ phút.
}
\\end{ex}

\\subsection*{Phần II. (4,0 điểm)} Câu trắc nghiệm đúng sai.

\\begin{ex}
Cho hàm số $y=f(x)$ liên tục trên $\\mathbb{R}$ và có bảng biến thiên:
\\begin{center}
\\begin{tikzpicture}
\\tkzTabInit[nocadre=false,lgt=1.2,espcl=2.5,deltacl=0.6]
{$x$/0.6,$y'$/0.6,$y$/2}
{$-\\infty$,$-1$,$4$,$+\\infty$}
\\tkzTabLine{,+,0,-,0,+,}
\\tkzTabVar{-/$-\\infty$,+/$10$,-/$-22$,+/$+\\infty$}
\\end{tikzpicture}
\\end{center}
\\choiceTF
{\\True Hàm số đồng biến trên khoảng $(-\\infty;-1)$.}
{Giá trị cực tiểu của hàm số bằng $4$.}
{\\True Điểm cực đại của đồ thị hàm số là $(-1;10)$.}
{Hàm số có đúng 1 điểm cực trị.}
\\loigiai{
Dựa vào bảng biến thiên, hàm số đạt cực đại tại $x=-1$, $y_{\\text{CĐ}}=10$ và đạt cực tiểu tại $x=4$, $y_{\\text{CT}}=-22$.
}
\\end{ex}

\\begin{ex}
\\immini{
Cho hàm số $f(x)=\\dfrac{ax+b}{cx+d}$ có đồ thị $y=f'(x)$ như hình bên và nhận đường thẳng $x=-1$ làm tiệm cận đứng.
\\choiceTF
{\\True Hàm số $y=f(x)$ đồng biến trên $(-1;+\\infty)$.}
{$f(0)=1$.}
{\\True Tiệm cận ngang của đồ thị $y=f(x)$ là $y=2$.}
{Số điểm có tọa độ nguyên thuộc đồ thị là $6$.}
}{
\\begin{tikzpicture}[scale=0.65, font=\\footnotesize, line join=round, line cap=round]
\\def\\xmin{-3.5} \\def\\xmax{3.2}
\\def\\ymin{-0.8} \\def\\ymax{4.5}
\\draw[->] (\\xmin,0) -- (\\xmax,0) node[below left] {$x$};
\\draw[->] (0,\\ymin) -- (0,\\ymax) node[below right] {$y$};
\\node[below left] at (0,0) {$O$};
\\draw[thick, domain=-0.4:\\xmax, smooth] plot (\\x, {2.5/((\\x)+1)^2});
\\draw[dashed] (-1,\\ymin) -- (-1,\\ymax);
\\node[below] at (-1,0) {$-1$};
\\end{tikzpicture}
}
\\loigiai{
Đồ thị hàm số $y=f'(x)$ nằm hoàn toàn phía trên trục hoành trên $(-1;+\\infty)$ nên $f'(x)>0$, do đó $f(x)$ đồng biến trên $(-1;+\\infty)$.
}
\\end{ex}`);
    } else if (sampleType === 'tkz_tab') {
      setLatexInput(`\\begin{ex}
Cho hàm số bậc ba $y = f(x)$ có bảng biến thiên:
\\begin{center}
\\begin{tikzpicture}
\\tkzTabInit[nocadre=false,lgt=1.2,espcl=2.5,deltacl=0.6]
{$x$/0.8,$f'(x)$/0.8,$f(x)$/2}
{$-\\infty$,$-2$,$2$,$+\\infty$}
\\tkzTabLine{,+,0,-,0,+,}
\\tkzTabVar{-/$-\\infty$,+/$10$,-/$-22$,+/$+\\infty$}
\\end{tikzpicture}
\\end{center}
Số nghiệm thực của phương trình $f(x) - 1 = 0$ là
\\choice
{$1$}
{$2$}
{\\True $3$}
{$0$}
\\loigiai{
Đường thẳng $y = 1$ cắt đồ thị hàm số tại 3 điểm phân biệt vì $-22 < 1 < 10$.
}
\\end{ex}`);
    } else if (sampleType === 'tabular') {
      setLatexInput(`\\begin{ex}
Bảng thống kê điểm kiểm tra môn Toán của lớp 12A:
\\begin{center}
\\begin{tabular}{|l|c|c|c|c|}
\\hline
Mức điểm & $[5;6.5)$ & $[6.5;8)$ & $[8;9)$ & $[9;10]$ \\\\
\\hline
Tần số & $8$ & $15$ & $12$ & $5$ \\\\
\\hline
\\end{tabular}
\\end{center}
Khoảng biến thiên của mẫu số liệu trên bằng bao nhiêu?
\\choice
{$3$}
{\\True $5$}
{$10$}
{$15$}
\\loigiai{
Khoảng biến thiên là $R = 10 - 5 = 5$.
}
\\end{ex}`);
    } else if (sampleType === 'single') {
      setLatexInput(`\\begin{ex}
Cho hàm số $y=f(x)$ liên tục trên $\\mathbb{R}$ và có đạo hàm $f'(x)=x(x-1)^2(x+2)$. Số điểm cực trị của hàm số là
\\choice
{$1$}
{\\True $2$}
{$3$}
{$4$}
\\loigiai{
Nghiệm đơn hoặc bội lẻ của đạo hàm là $x=0$ và $x=-2$. Nghiệm $x=1$ là nghiệm bội chẵn nên đạo hàm không đổi dấu. Vậy hàm số có 2 điểm cực trị.
}
\\end{ex}`);
    } else if (sampleType === 'tf') {
      setLatexInput(`\\begin{ex}
Cho hàm số $y = \\dfrac{2x-1}{x+1}$.
\\choiceTF
{\\True Đồ thị hàm số có tiệm cận đứng là $x = -1$.}
{\\True Đồ thị hàm số có tiệm cận ngang là $y = 2$.}
{Hàm số đồng biến trên toàn bộ $\\mathbb{R}$.}
{\\True Giao điểm hai tiệm cận là tâm đối xứng $I(-1; 2)$.}
\\loigiai{
Tập xác định $D = \\mathbb{R}\\setminus\\{-1\\}$. Hàm số chỉ đồng biến trên từng khoảng xác định.
}
\\end{ex}`);
    } else if (sampleType === 'short') {
      setLatexInput(`\\begin{ex}
Trong không gian $Oxyz$, cho mặt cầu $(S): (x-1)^2+(y+2)^2+(z-3)^2=25$. Khoảng cách từ tâm $I$ đến mặt phẳng $(P): 2x-2y+z+3=0$ bằng bao nhiêu?
\\shortans{$4$}
\\loigiai{
Tâm $I(1;-2;3)$, khoảng cách $d(I,(P))=\\dfrac{|2(1)-2(-2)+3+3|}{\\sqrt{2^2+(-2)^2+1^2}}=\\dfrac{12}{3}=4$.
}
\\end{ex}`);
    } else if (sampleType === 'essay') {
      setLatexInput(`\\begin{ex}
Một hộ gia đình dự định xây một bể nước hình hộp chữ nhật không nắp có thể tích $V = 32\\text{ m}^3$, đáy là hình vuông cạnh $x\\text{ (m)}$. Hãy tìm kích thước đáy và chiều cao để chi phí xây dựng ít nhất.
\\loigiai{
Thể tích $V = x^2 h = 32 \\implies h = \\dfrac{32}{x^2}$.
Diện tích toàn phần không nắp: $S(x) = x^2 + 4xh = x^2 + \\dfrac{128}{x}$.
Đạo hàm $S'(x) = 2x - \\dfrac{128}{x^2} = 0 \\iff 2x^3 = 128 \\iff x = 4\\text{ m}$.
Khi đó chiều cao $h = 2\\text{ m}$.
}
\\end{ex}`);
    }
  };

  // Tạo đề thi mới
  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `exam-${Date.now()}`;

    // Nếu giáo viên chưa chọn câu hỏi nào, tự động lấy 7 câu mặc định
    const examQuestions = selectedQuestions.length > 0 ? selectedQuestions : questionsPool.slice(0, 7);

    // Tính điểm tối đa và cơ cấu các phần
    const p1Count = examQuestions.filter((q) => q.part === 1 || q.type === 'single_choice' || q.type === 'multiple_choice').length;
    const p2Count = examQuestions.filter((q) => q.part === 2 || q.type === 'true_false').length;
    const p3Count = examQuestions.filter((q) => q.part === 3 || q.type === 'short_answer').length;
    const p4Count = examQuestions.filter((q) => q.part === 4 || q.type === 'essay').length;

    const created: Exam = {
      id: newId,
      code: Math.random().toString(36).substring(2, 8).toUpperCase(),
      title: newTitle.trim(),
      description: newDescription.trim() || 'Đề thi trắc nghiệm và tự luận Toán THPT Thầy Sơn.',
      teacher_id: user?.id || '22222222-2222-2222-2222-222222222222',
      grade: newGrade,
      duration_minutes: Number(newDuration),
      passing_score: 5.0,
      shuffle_questions: shuffleQuestions,
      shuffle_options: !shuffleQuestions,
      max_attempts: 3,
      status: 'published',
      format: selectedFormat,
      part_structure: {
        part1_count: p1Count,
        part2_count: p2Count,
        part3_count: p3Count,
        part4_count: p4Count,
      },
      is_view_answer_allowed: true,
      questions: examQuestions.map((q, i) => ({
        ...q,
        order_index: i + 1,
        custom_points: q.points,
      })),
    };

    const updated = [created, ...exams];
    saveExamsToStorage(updated);

    // 1. Phản hồi tức thì 0ms (Optimistic UI):
    setShowCreateModal(false);
    setSelectedQuestions([]);
    setLatexInput('');
    setLatexParseNotice(null);
    router.push(`/exams/editor?id=${newId}`);

    // 2. Nếu tick chọn lưu câu hỏi vào Ngân hàng câu hỏi
    if (saveNewExamQuestionsToBank && examQuestions.length > 0) {
      try {
        const savedQ = localStorage.getItem('lms_questions');
        let qList: Question[] = savedQ ? JSON.parse(savedQ) : [];
        const qIds = new Set(qList.map((q) => q.id));
        const newItems = examQuestions.filter((q) => !qIds.has(q.id));
        if (newItems.length > 0) {
          const combined = [...newItems, ...qList];
          localStorage.setItem('lms_questions', JSON.stringify(combined));
          setQuestionsPool(combined);
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

    // 3. Đồng bộ đề thi thời gian thực lên Cloud API
    fetch('/api/exams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(created),
    }).catch((err) => console.warn('Lỗi lưu đề thi vào Supabase:', err));
  };

  // Mở modal sửa đề
  const openEditModal = (exam: Exam) => {
    setEditingExam(exam);
    setEditTitle(exam.title);
    setEditGrade(exam.grade);
    setEditDuration(exam.duration_minutes);
    setEditDescription(exam.description || '');
    setEditShuffle(exam.shuffle_questions);
    setShowEditModal(true);
  };

  // Cập nhật đề thi
  const handleUpdateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExam || !editTitle.trim()) return;

    const targetExam = exams.find((ex) => ex.id === editingExam.id) || editingExam;
    const updatedExam: Exam = {
      ...targetExam,
      title: editTitle.trim(),
      grade: editGrade,
      duration_minutes: Number(editDuration),
      description: editDescription.trim(),
      shuffle_questions: editShuffle,
      updated_at: new Date().toISOString(),
    };

    const updated = exams.map((ex) => (ex.id === editingExam.id ? updatedExam : ex));
    saveExamsToStorage(updated);
    setShowEditModal(false);
    setEditingExam(null);
    setCopyToast('Đã lưu các sửa đổi của đề thi thành công!');
    setTimeout(() => setCopyToast(null), 2500);

    fetch('/api/exams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedExam),
    }).catch((err) => console.warn('Lỗi cập nhật đề thi trên Cloud:', err));
  };

  // Xóa vĩnh viễn đề thi (dành cho Giáo viên & Quản trị viên)
  const handleDeleteExam = async (examId: string, examTitle: string) => {
    const isConfirmed = confirm(
      `Thầy có chắc chắn muốn xóa vĩnh viễn đề thi "${examTitle}" không?\nHọc sinh và hệ thống sẽ không còn thấy đề này nữa.`
    );
    if (!isConfirmed) return;

    // 1. Phản hồi tức thì 0ms trên giao diện & localStorage
    const updated = exams.filter((e) => e.id !== examId);
    saveExamsToStorage(updated);
    setCopyToast(`Đã xóa vĩnh viễn đề thi: "${examTitle}"!`);
    setTimeout(() => setCopyToast(null), 3000);

    // 2. Gửi lệnh xóa ngầm lên Supabase Cloud API
    try {
      await fetch(`/api/exams?id=${examId}`, { method: 'DELETE' });
    } catch (err) {
      console.warn('Lỗi xóa đề thi trên Cloud API:', err);
    }
  };

  // Xóa toàn bộ đề thi trên hệ thống (dành cho Thầy Sơn / Admin)
  const handleDeleteAllExams = async () => {
    const isConfirmed = confirm(
      'Thầy có chắc chắn muốn xóa TOÀN BỘ tất cả các đề thi trên hệ thống không?\nHọc sinh và mọi lớp học sẽ không còn thấy bất kỳ đề thi nào nữa.'
    );
    if (!isConfirmed) return;

    saveExamsToStorage([]);
    setCopyToast('Đã xóa sạch toàn bộ đề thi trên hệ thống!');
    setTimeout(() => setCopyToast(null), 3000);

    try {
      await fetch('/api/exams?all=true', { method: 'DELETE' });
    } catch (err) {
      console.warn('Lỗi xóa tất cả đề thi trên Cloud API:', err);
    }
  };

  // Mở modal giao đề cho lớp
  const handleOpenAssignModal = (exam: Exam) => {
    setAssigningExam(exam);
    setAssignAccessType(exam.access_type || 'restricted');
    setAssignClassesSelection(Array.isArray(exam.assigned_classes) ? exam.assigned_classes : []);
  };

  // Lưu phân công đề thi cho các lớp học
  const handleSaveClassAssignment = () => {
    if (!assigningExam) return;
    let changedExam: Exam | null = null;
    const updated = exams.map((e) => {
      if (e.id === assigningExam.id) {
        changedExam = {
          ...e,
          access_type: assignAccessType,
          assigned_classes: assignAccessType === 'public' ? [] : assignClassesSelection,
          updated_at: new Date().toISOString(),
        };
        return changedExam;
      }
      return e;
    });
    saveExamsToStorage(updated);
    setAssigningExam(null);
    setCopyToast(`Đã cập nhật phân công giao đề "${assigningExam.title}" cho lớp thành công!`);
    setTimeout(() => setCopyToast(null), 3000);

    if (changedExam) {
      fetch('/api/exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changedExam),
      }).catch((err) => console.warn('Lỗi lưu phân công lớp lên Cloud:', err));
    }
  };

  // Lấy bài nộp của học sinh đối với đề thi cụ thể
  const getStudentSubmission = (examId: string, studentId?: string) => {
    // 1. Kiểm tra trong allSubmissions (đồng bộ từ Cloud Supabase theo thời gian thực)
    const cloudSub = allSubmissions.find((s: any) => {
      if (!s) return false;
      const matchExam = s.exam_id === examId || s.exam?.id === examId;
      const matchStudent =
        (studentId && (s.student_id === studentId || s.student?.id === studentId)) ||
        (user?.email && s.student?.email && s.student.email.toLowerCase() === user.email.toLowerCase());
      return matchExam && matchStudent;
    });
    if (cloudSub) return cloudSub;

    // 2. Fallback sang bộ nhớ cục bộ cá nhân của học sinh
    if (!studentId || typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(`my_submissions_${studentId}`);
      if (!raw) return null;
      const subs = JSON.parse(raw);
      if (Array.isArray(subs)) {
        return subs.find((s: any) => s.exam_id === examId);
      }
    } catch {}
    return null;
  };

  // Tính số lượng đề thi gán cho từng lớp học thực tế (khớp chính xác tên lớp)
  const getExamCountForClass = (clsName: string, clsGrade?: number) => {
    const target = clsName.trim().toLowerCase();
    return exams.filter((e) => {
      if (!isTeacher && !isExamPermittedForStudent(e, user?.id, classes, user?.email)) return false;
      const inAssigned = e.assigned_classes?.some(
        (c) => c.trim().toLowerCase() === target
      );
      const inClassName = e.class_name?.trim().toLowerCase() === target;
      return inAssigned || inClassName;
    }).length;
  };

  const filteredExams = exams.filter((e) => {
    // Phân quyền Học sinh: BẮT BUỘC phải vào lớp mới xem được đề
    if (!isTeacher) {
      if (!isUserEnrolledInAnyClass(user)) return false;
      const isPermitted = isExamPermittedForStudent(e, user?.id, classes, user?.email);
      if (!isPermitted) return false;
    }

    if (categoryTab !== 'all') {
      const cat = getExamCategory(e);
      if (cat !== categoryTab) return false;
    }

    if (selectedGrade !== 'all' && e.grade !== selectedGrade) return false;
    if (selectedClass !== 'all') {
      const target = selectedClass.trim().toLowerCase();
      const inAssigned = e.assigned_classes?.some((c) => c.trim().toLowerCase() === target);
      const inClassName = e.class_name?.trim().toLowerCase() === target;
      if (!inAssigned && !inClassName) return false;
    }
    if (filterType === 'timed' && e.duration_minutes < 45) return false;
    if (filterType === 'practice' && e.duration_minutes >= 90) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = e.title.toLowerCase().includes(q);
      const matchCode = (e.code || '').toLowerCase().includes(q);
      if (!matchTitle && !matchCode) return false;
    }
    return true;
  });

  const totalCount = exams.length;
  const examCount = exams.filter((e) => getExamCategory(e) === 'exam').length;
  const practiceCount = exams.filter((e) => getExamCategory(e) === 'practice').length;

  // Unique topics trong ngân hàng
  const allTopics = Array.from(new Set(questionsPool.map((q) => q.topic))).filter(Boolean);

  // Lọc câu hỏi trong tab Manual
  const filteredBankQuestions = questionsPool.filter((q) => {
    if (manualPartFilter !== 'all' && q.part !== manualPartFilter) return false;
    if (manualTopicFilter !== 'all' && q.topic !== manualTopicFilter) return false;
    if (manualSearch.trim()) {
      const s = manualSearch.toLowerCase();
      const matchContent = q.content.toLowerCase().includes(s);
      const matchTopic = q.topic.toLowerCase().includes(s);
      if (!matchContent && !matchTopic) return false;
    }
    return true;
  });

  // Thống kê câu hỏi đã chọn theo phần
  const selectedP1 = selectedQuestions.filter((q) => q.part === 1 || q.type === 'single_choice' || q.type === 'multiple_choice');
  const selectedP2 = selectedQuestions.filter((q) => q.part === 2 || q.type === 'true_false');
  const selectedP3 = selectedQuestions.filter((q) => q.part === 3 || q.type === 'short_answer');
  const selectedP4 = selectedQuestions.filter((q) => q.part === 4 || q.type === 'essay');

  // Phân quyền Học sinh: Nếu học sinh chưa vào bất kỳ lớp học nào, chặn hoàn toàn và hiện phòng chờ nhập mã
  if (user && !isTeacher && !isUserEnrolledInAnyClass(user)) {
    let isApprovedInCache = false;
    try {
      const cached = localStorage.getItem(`lms_student_classes_${user.id}`);
      isApprovedInCache = Boolean(cached && JSON.parse(cached).length > 0);
    } catch {}
    if (!isApprovedInCache) {
      return <StudentPendingApprovalView />;
    }
  }

  return (
    <div className="space-y-6 pb-16 relative">
      {/* Toast thông báo */}
      {copyToast && (
        <div className="fixed top-20 right-6 z-50 rounded-2xl bg-slate-900 text-white px-5 py-3 text-xs font-semibold shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>{copyToast}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <ClipboardList className="h-8 w-8 text-blue-600 shrink-0" />
            <span>Đề thi của tôi</span>
            <span className="text-sm font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
              {filteredExams.length} đề thi
            </span>
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            Quản lý ngân hàng đề thi, tạo đề từ file PDF, Word hoặc bộ soạn thảo trực tuyến Toán Thầy Sơn.
          </p>
        </div>

        {/* Nút tác vụ Tạo đề & Chế độ xem */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Toggle Grid / List */}
          <div className="flex items-center rounded-xl bg-slate-100 p-1 border border-slate-200 text-slate-600">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                viewMode === 'grid' ? 'bg-white text-blue-600 shadow-2xs' : 'hover:text-slate-900'
              }`}
              title="Xem dạng lưới"
            >
              <Grid className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                viewMode === 'list' ? 'bg-white text-blue-600 shadow-2xs' : 'hover:text-slate-900'
              }`}
              title="Xem dạng danh sách"
            >
              <List className="h-4 w-4" />
            </button>
          </div>

          {/* CÁC NÚT TẠO ĐỀ (CHỈ DÀNH RIÊNG CHO GIÁO VIÊN / ADMIN) */}
          {isTeacher && (
            <>
              {/* NÚT TẠO TỪ PDF RIÊNG BIỆT */}
              <button
                type="button"
                onClick={() => setShowPdfCreateModal(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md shadow-blue-500/20 hover:from-blue-500 hover:to-indigo-500 transition cursor-pointer"
              >
                <FileText className="h-4 w-4" />
                <span>Tạo từ PDF</span>
              </button>

              {/* NÚT TẠO ĐỀ MỚI */}
              <Link
                href="/exams/editor?new=1"
                prefetch={true}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-500 transition cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Tạo đề mới</span>
              </Link>

              {/* NÚT XÓA SẠCH TẤT CẢ ĐỀ THI */}
              {exams.length > 0 && (
                <button
                  type="button"
                  onClick={handleDeleteAllExams}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs sm:text-sm font-semibold text-red-600 hover:bg-red-100 transition cursor-pointer"
                  title="Xóa tất cả các đề thi hiện có trên hệ thống"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Xóa tất cả</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* 3 Tab phân loại chuyên biệt: Đề thi chính thức vs Bài tập & Tự luyện */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-100 rounded-2xl border border-slate-200 w-fit">
        <button
          type="button"
          onClick={() => setCategoryTab('all')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition cursor-pointer ${
            categoryTab === 'all'
              ? 'bg-white text-blue-600 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ClipboardList className="h-4 w-4" />
          <span>Tất cả ({totalCount})</span>
        </button>

        <button
          type="button"
          onClick={() => setCategoryTab('exam')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition cursor-pointer ${
            categoryTab === 'exam'
              ? 'bg-white text-indigo-600 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Award className="h-4 w-4 text-amber-500" />
          <span>🎯 Đề thi chính thức ({examCount})</span>
        </button>

        <button
          type="button"
          onClick={() => setCategoryTab('practice')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition cursor-pointer ${
            categoryTab === 'practice'
              ? 'bg-white text-emerald-600 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Zap className="h-4 w-4 text-amber-500 fill-amber-500" />
          <span>⚡ Bài tập & Tự luyện ({practiceCount})</span>
        </button>
      </div>

      {/* Thanh tìm kiếm & lọc nhanh */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên đề thi hoặc mã đề (ví dụ: UXHF8H)..."
            className="w-full pl-9 pr-4 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400 font-semibold flex items-center gap-1">
            <Filter className="h-3.5 w-3.5" /> Khối:
          </span>
          {[
            { id: 'all', label: 'Tất cả' },
            { id: 12, label: 'Lớp 12' },
            { id: 11, label: 'Lớp 11' },
            { id: 10, label: 'Lớp 10' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedGrade(tab.id as any)}
              className={`rounded-lg px-2.5 py-1 font-semibold transition cursor-pointer ${
                selectedGrade === tab.id
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* BỐ CỤC CHÍNH: CỘT LỌC LỚP BÊN TRÁI + LƯỚI ĐỀ THI BÊN PHẢI */}
      <div className="flex flex-col lg:flex-row gap-5 items-start">
        {/* Cột trái: Danh mục lớp học (Chỉ hiển thị cho Giáo viên/Admin để quản lý) */}
        {isTeacher && (
          <aside className="w-full lg:w-64 shrink-0 space-y-2 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between px-2 py-1 border-b border-slate-100 pb-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <GraduationCap className="h-4 w-4 text-blue-600" />
                Danh mục lớp
              </span>
              <Link
                href="/classes"
                className="text-[11px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-0.5 hover:underline"
                title="Đi tới trang Quản lý Lớp học"
              >
                <span>Quản lý</span>
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="space-y-1">
              {/* Mục: Tất cả lớp */}
              <button
                type="button"
                onClick={() => setSelectedClass('all')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  selectedClass === 'all'
                    ? 'bg-blue-50 text-blue-700 font-bold shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <FileText className={`h-3.5 w-3.5 ${selectedClass === 'all' ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span>Tất cả các lớp</span>
                </div>
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                    selectedClass === 'all' ? 'bg-blue-200/70 text-blue-800' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {isTeacher
                    ? exams.length
                    : exams.filter((e) => isExamPermittedForStudent(e, user?.id, classes)).length}
                </span>
              </button>

              {/* Danh sách lớp động tải từ classes */}
              {classes.map((cls) => {
                const isActive = selectedClass.toLowerCase() === cls.name.toLowerCase();
                const count = getExamCountForClass(cls.name, cls.grade);
                return (
                  <div
                    key={cls.id}
                    className={`group w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-semibold transition ${
                      isActive ? 'bg-blue-50 text-blue-700 font-bold shadow-2xs' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedClass(cls.name)}
                      className="flex-1 flex items-center gap-2 text-left cursor-pointer overflow-hidden py-0.5"
                      title={`Lọc đề thi lớp ${cls.name}`}
                    >
                      <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                      <span className="truncate">{cls.name}</span>
                      <span className="text-[10px] text-slate-400 font-normal shrink-0">K{cls.grade}</span>
                    </button>

                    <div className="flex items-center gap-1 shrink-0">
                      <span
                        className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold ${
                          isActive ? 'bg-blue-200/70 text-blue-800' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {count}
                      </span>
                      <Link
                        href={`/classes/${cls.id}`}
                        className="p-1 text-slate-400 hover:text-blue-600 rounded-md hover:bg-white transition"
                        title={`Xem chi tiết và học sinh lớp ${cls.name}`}
                      >
                        <ArrowUpRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 border-t border-slate-100">
              <Link
                href="/classes"
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition border border-dashed border-slate-200 hover:border-blue-300"
              >
                <Plus className="h-3.5 w-3.5 text-blue-600" />
                <span>Tạo hoặc quản lý lớp</span>
              </Link>
            </div>
          </aside>
        )}

        {/* Cột phải: Lưới đề thi */}
        <main className="flex-1 w-full">
          {isLoading && exams.length === 0 ? (
            <div className={`grid gap-4 sm:gap-5 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1'} animate-pulse`}>
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                    <div className="h-5 w-16 bg-slate-200 rounded-md"></div>
                    <div className="h-4 w-20 bg-slate-100 rounded"></div>
                  </div>
                  <div className="h-6 w-3/4 bg-slate-200 rounded-lg"></div>
                  <div className="h-4 w-full bg-slate-100 rounded"></div>
                  <div className="flex gap-2 pt-2">
                    <div className="h-6 w-16 bg-slate-100 rounded-md"></div>
                    <div className="h-6 w-20 bg-slate-100 rounded-md"></div>
                  </div>
                  <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                    <div className="h-4 w-24 bg-slate-100 rounded"></div>
                    <div className="h-8 w-24 bg-blue-100 rounded-xl"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredExams.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-xs">
              <ClipboardList className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-800">Không tìm thấy đề thi phù hợp</h3>
              <p className="text-xs text-slate-400 mt-1">
                {isTeacher
                  ? 'Thầy hãy thử chọn lớp khác hoặc tạo đề mới.'
                  : 'Hiện chưa có đề thi mới được giao cho lớp của em. Thầy Sơn sẽ đăng tải sớm!'}
              </p>
            </div>
          ) : (
            <div className={`grid gap-4 sm:gap-5 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1'}`}>
              {filteredExams.map((exam) => {
                const examCode = exam.code || exam.id.slice(0, 6).toUpperCase();
                const qCount = (exam as any).questions_count ?? (exam.questions || []).length;
                const isLocked = exam.is_locked || exam.status === 'closed';
                const studentSub = !isTeacher ? getStudentSubmission(exam.id, user?.id) : null;

                // Lấy danh sách bài nộp thực tế của đề thi này
                const examSubmissions = allSubmissions.filter((s: any) => {
                  if (!s) return false;
                  const matchId =
                    s.exam_id === exam.id ||
                    s.exam?.id === exam.id ||
                    s.exam_id === examCode ||
                    s.exam?.code === examCode;
                  const matchCode =
                    (s.exam?.code && exam.code && s.exam.code.toUpperCase() === exam.code.toUpperCase()) ||
                    (s.exam_code && exam.code && s.exam_code.toUpperCase() === exam.code.toUpperCase());
                  const matchTitle =
                    (s.exam?.title && exam.title && s.exam.title.trim().toLowerCase() === exam.title.trim().toLowerCase()) ||
                    (s.exam_title && exam.title && s.exam_title.trim().toLowerCase() === exam.title.trim().toLowerCase()) ||
                    (Boolean(exam.title?.includes('11-1')) && (s.exam?.title?.includes('11-1') || s.exam_id?.includes('11-1') || s.exam_title?.includes('11-1')));
                  return matchId || matchCode || matchTitle;
                });
                const actualSubCount = Math.max(
                  typeof (exam as any).submissions_count === 'number' ? (exam as any).submissions_count : 0,
                  examSubmissions.length
                );
                const pendingEssaySubs = examSubmissions.filter((s: any) => s.status === 'grading' || s.status === 'pending');
                const pendingCount = Math.max(
                  (exam as any).pending_grading_count || 0,
                  pendingEssaySubs.length
                );
                const pendingSubId =
                  pendingEssaySubs[0]?.id ||
                  (exam as any).first_pending_submission_id ||
                  '';

                return (
                  <div
                    key={exam.id}
                    className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs hover:shadow-md transition flex flex-col justify-between hover:border-blue-300"
                  >
                    <div>
                      {/* Top Card Header: Mã đề, Copy, Link, Date, Trash */}
                      <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-slate-800 text-xs tracking-wider bg-slate-100 px-2 py-0.5 rounded-md">
                            {examCode}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyExamCode(examCode)}
                            className="p-1 text-slate-400 hover:text-blue-600 transition cursor-pointer"
                            title="Sao chép mã đề"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopyExamLink(exam.id)}
                            className="p-1 text-slate-400 hover:text-blue-600 transition cursor-pointer"
                            title="Sao chép link làm bài của học sinh"
                          >
                            <Link2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div className="flex items-center gap-1.5 text-slate-400">
                          <span className="text-[11px] flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {exam.created_at ? new Date(exam.created_at).toLocaleDateString('vi-VN') : '26/10/2026'}
                          </span>
                          {isTeacher && (
                            <button
                              type="button"
                              onClick={() => handleDeleteExam(exam.id, exam.title)}
                              className="p-1 text-rose-400 hover:text-rose-600 transition cursor-pointer"
                              title="Xóa đề thi"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Status Badges */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-2.5 mb-2">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 ${
                            getExamCategory(exam) === 'practice'
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                          }`}
                        >
                          {getExamCategory(exam) === 'practice' ? (
                            <>
                              <Zap className="h-3 w-3 text-amber-600 fill-amber-500" />
                              <span>Bài tập & Tự luyện</span>
                            </>
                          ) : (
                            <>
                              <Award className="h-3 w-3 text-indigo-600" />
                              <span>Đề thi chính thức</span>
                            </>
                          )}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            isLocked
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {isLocked ? 'Đã khóa' : 'Đang mở'}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-50 text-slate-600 border border-slate-200">
                          {exam.start_time ? `Lịch: ${new Date(exam.start_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}` : 'Không đặt lịch'}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                          {exam.access_type === 'public' ? 'Công khai' : 'Giới hạn lớp'}
                        </span>
                        {(exam.exam_mode === 'pdf_view' || exam.pdf_url) && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            PDF
                          </span>
                        )}
                      </div>

                      {/* Tiêu đề đề thi */}
                      <h3 className="font-bold text-sm sm:text-base text-slate-900 leading-snug line-clamp-2 my-1">
                        {exam.title}
                      </h3>

                      {/* LỚP ĐƯỢC PHÉP THI - Chỉ hiển thị cho Giáo viên để quản trị */}
                      {isTeacher && (
                        <div className="text-[11px] text-slate-500 mt-2 mb-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-slate-400 uppercase text-[9px] tracking-wider block">
                              LỚP ĐƯỢC PHÉP THI
                            </span>
                            <button
                              type="button"
                              onClick={() => handleOpenAssignModal(exam)}
                              className="text-[10.5px] font-bold text-blue-600 hover:underline cursor-pointer"
                            >
                              + Đổi lớp
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {exam.access_type === 'public' ? (
                              <span className="rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-[11px] font-semibold">
                                Công khai (Mọi học sinh)
                              </span>
                            ) : Array.isArray(exam.assigned_classes) && exam.assigned_classes.length > 0 ? (
                              exam.assigned_classes.map((clsName) => {
                                const matchedClass = classes.find(
                                  (c) =>
                                    c.name.trim().toLowerCase() === clsName.trim().toLowerCase() ||
                                    c.code.trim().toLowerCase() === clsName.trim().toLowerCase()
                                );
                                return (
                                  <div
                                    key={clsName}
                                    className="inline-flex items-center gap-1 rounded-md bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 text-[11px] font-semibold hover:bg-blue-100 transition"
                                  >
                                    <button
                                      type="button"
                                      onClick={() => setSelectedClass(clsName)}
                                      title={`Lọc theo lớp ${clsName}`}
                                      className="cursor-pointer hover:underline"
                                    >
                                      {clsName}
                                    </button>
                                    {matchedClass && (
                                      <Link
                                        href={`/classes/${matchedClass.id}`}
                                        title={`Mở trang chi tiết lớp ${clsName}`}
                                        className="text-blue-500 hover:text-blue-900 ml-0.5 p-0.5 rounded hover:bg-blue-200/50"
                                      >
                                        <ArrowUpRight className="h-2.5 w-2.5" />
                                      </Link>
                                    )}
                                  </div>
                                );
                              })
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleOpenAssignModal(exam)}
                                className="rounded-md bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 text-[11px] font-medium hover:bg-amber-100 cursor-pointer"
                              >
                                Chưa gán lớp (Bấm để gán)
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Thông số câu và lượt thi */}
                      <div className="text-xs text-slate-500 my-2">
                        <span className="font-semibold text-slate-700">{qCount} câu</span>
                        <span className="mx-1.5">•</span>
                        <span className={actualSubCount > 0 ? 'font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded' : ''}>
                          {actualSubCount} HS đã thi
                        </span>
                        <span className="mx-1.5">•</span>
                        <span>{exam.duration_minutes} phút</span>
                      </div>
                    </div>

                    {/* Hàng nút tác vụ (Phân quyền: Giáo viên quản lý đề vs Học sinh làm bài) */}
                    {isTeacher ? (
                      <div className="pt-3 border-t border-slate-100 space-y-2">
                        {/* Nút Cảnh Báo Có Bài Tự Luận Cần Chấm Ngay */}
                        {pendingCount > 0 && (
                          <Link
                            href={pendingSubId ? `/gradebook/grade/${pendingSubId}` : `/gradebook?examId=${exam.id}`}
                            className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-black bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md shadow-amber-500/25 transition active:scale-95 animate-pulse"
                            title="Đề thi có bài tự luận của học sinh đang chờ Thầy chấm"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span>✍️ Chấm tự luận ({pendingCount} bài chờ)</span>
                          </Link>
                        )}

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleLockExam(exam.id)}
                            className={`inline-flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                              isLocked
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100'
                                : 'bg-rose-50/50 border-rose-200 text-rose-700 hover:bg-rose-100'
                            }`}
                          >
                            {isLocked ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                            <span>{isLocked ? 'Mở đề' : 'Khoá đề'}</span>
                          </button>

                          <Link
                            href={`/exams/${exam.id}/monitor`}
                            className="inline-flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-xl text-xs font-bold bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 transition"
                            title="Giám sát phòng thi thời gian thực"
                          >
                            <Radio className="h-3.5 w-3.5 text-emerald-600 animate-pulse" />
                            <span>Live</span>
                          </Link>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <Link
                            href={`/exams/editor?id=${exam.id}`}
                            prefetch={true}
                            className="inline-flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-xl text-xs font-bold bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 transition"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span>Sửa</span>
                          </Link>

                          <Link
                            href={`/gradebook?examId=${exam.id}`}
                            className="inline-flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-xl text-xs font-bold bg-purple-50 border border-purple-200 text-purple-700 hover:bg-purple-100 transition"
                            title="Xem bảng điểm và danh sách học sinh đã thi đề này"
                          >
                            <BarChart3 className="h-3.5 w-3.5" />
                            <span>Kết quả {actualSubCount > 0 ? `(${actualSubCount})` : ''}</span>
                          </Link>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenAssignModal(exam)}
                            className="inline-flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-xl text-xs font-bold bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition cursor-pointer"
                            title="Giao đề thi cho các lớp học"
                          >
                            <GraduationCap className="h-3.5 w-3.5" />
                            <span>Giao lớp</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDuplicateExam(exam)}
                            className="inline-flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-xl text-xs font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                          >
                            <Copy className="h-3.5 w-3.5 text-slate-400" />
                            <span>Nhân bản</span>
                          </button>
                        </div>

                        {/* Nút Luyện tập thử cho Giáo viên */}
                        <Link
                          href={`/exams/${exam.id}/practice`}
                          className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-xl text-xs font-bold bg-amber-50/70 border border-amber-300 text-amber-800 hover:bg-amber-100 transition shadow-2xs"
                          title="Thử nghiệm chế độ tự luyện từng câu với AI đổi số"
                        >
                          <Zap className="h-3.5 w-3.5 text-amber-600 fill-amber-500" />
                          <span>⚡ Thử Chế Độ Tự Luyện (AI Đổi Số)</span>
                        </Link>
                      </div>
                    ) : (
                      <div className="pt-3 border-t border-slate-100">
                        {isLocked ? (
                          <div className="w-full py-2.5 px-4 rounded-xl bg-slate-100 text-slate-400 text-xs font-bold text-center flex items-center justify-center gap-1.5 cursor-not-allowed">
                            <Lock className="h-3.5 w-3.5" />
                            <span>Phòng thi đang đóng</span>
                          </div>
                        ) : studentSub ? (
                          <div className="space-y-2">
                            <Link
                              href={`/exams/${exam.id}/result/${studentSub.id}`}
                              className="w-full flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 text-xs font-bold transition shadow-2xs"
                            >
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                              <span>
                                Đã nộp ({studentSub.score !== undefined ? `${studentSub.score.toFixed(2)}đ` : 'Xem bài làm'})
                              </span>
                            </Link>

                            <Link
                              href={`/exams/${exam.id}/practice`}
                              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-800 text-xs font-bold transition shadow-2xs"
                              title="Tự luyện tập lại từng câu, có đáp án và AI đổi số liệu"
                            >
                              <Zap className="h-3.5 w-3.5 text-amber-600 fill-amber-500" />
                              <span>⚡ Luyện tập lại đề này (Có lời giải ngay)</span>
                            </Link>
                          </div>
                        ) : getExamCategory(exam) === 'practice' ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <Link
                              href={`/exams/${exam.id}/practice`}
                              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-bold transition shadow-md shadow-amber-500/20 active:scale-[0.99]"
                              title="Tự luyện từng câu, có lời giải chi tiết KaTeX ngay và AI đổi số"
                            >
                              <Zap className="h-4 w-4 fill-white" />
                              <span>⚡ Làm tự luyện</span>
                            </Link>

                            <Link
                              href={`/exams/${exam.id}/take`}
                              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition border border-slate-200"
                              title="Làm cả đề hoàn chỉnh như bài kiểm tra"
                            >
                              <Play className="h-3.5 w-3.5 text-slate-600" />
                              <span>Làm cả đề</span>
                            </Link>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <Link
                              href={`/exams/${exam.id}/take`}
                              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-md shadow-blue-500/20 active:scale-[0.99]"
                              title="Vào phòng thi chính thức (tính giờ, có giám sát)"
                            >
                              <Play className="h-4 w-4 fill-white" />
                              <span>Thi chính thức</span>
                            </Link>

                            <Link
                              href={`/exams/${exam.id}/practice`}
                              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-800 text-xs font-bold transition shadow-2xs"
                              title="Tự luyện không áp lực thời gian, kiểm tra từng câu và có AI đổi số"
                            >
                              <Zap className="h-3.5 w-3.5 text-amber-600 fill-amber-500" />
                              <span>⚡ Ôn luyện</span>
                            </Link>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* MODAL TẠO ĐỀ TỪ PDF RIÊNG BIỆT */}
      {showPdfCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-100 text-purple-700 font-bold">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900">Tạo Đề Thi Từ File PDF</h3>
                  <p className="text-[11px] text-slate-500">Tải đề PDF và cấu hình phiếu đáp án điện tử OMR</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPdfCreateModal(false)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePdfExamSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Chọn file PDF đề thi:</label>
                <input
                  type="file"
                  accept=".pdf"
                  required
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setPdfFile(f);
                      if (!pdfExamTitle) setPdfExamTitle(f.name.replace(/\.[^/.]+$/, ''));
                    }
                  }}
                  className="w-full rounded-xl border border-dashed border-purple-300 p-4 text-center bg-purple-50/40 text-purple-700 font-medium cursor-pointer"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Tiêu đề đề thi:</label>
                <input
                  type="text"
                  required
                  value={pdfExamTitle}
                  onChange={(e) => setPdfExamTitle(e.target.value)}
                  placeholder="VD: Bài 3. Đường tiệm cận - Lớp 12 Toán 1"
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 font-medium focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Khối lớp:</label>
                  <select
                    value={pdfGrade}
                    onChange={(e) => setPdfGrade(Number(e.target.value) as any)}
                    className="w-full rounded-xl border border-slate-200 p-2 text-xs bg-white focus:outline-none"
                  >
                    <option value={12}>Lớp 12</option>
                    <option value={11}>Lớp 11</option>
                    <option value={10}>Lớp 10</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Lớp thi:</label>
                  <select
                    value={pdfAssignedClass}
                    onChange={(e) => setPdfAssignedClass(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2 text-xs bg-white focus:outline-none"
                  >
                    {classes.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name} (Khối {c.grade})
                      </option>
                    ))}
                    <option value="Tất cả các lớp">Tất cả các lớp</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Thời gian (phút):</label>
                  <input
                    type="number"
                    min={5}
                    max={180}
                    value={pdfDuration}
                    onChange={(e) => setPdfDuration(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 p-2 text-xs focus:outline-none"
                  />
                </div>
              </div>

              {/* Cấu hình số câu */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <span className="font-bold text-slate-700 text-xs block">Cấu hình số câu trên phiếu trả lời:</span>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <span className="text-[11px] text-slate-500 block mb-0.5">Phần I (Trắc nghiệm):</span>
                    <input
                      type="number"
                      min={0}
                      value={pdfP1Count}
                      onChange={(e) => setPdfP1Count(Number(e.target.value))}
                      className="w-full p-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block mb-0.5">Phần II (Đúng/Sai):</span>
                    <input
                      type="number"
                      min={0}
                      value={pdfP2Count}
                      onChange={(e) => setPdfP2Count(Number(e.target.value))}
                      className="w-full p-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block mb-0.5">Phần III (Điền số):</span>
                    <input
                      type="number"
                      min={0}
                      value={pdfP3Count}
                      onChange={(e) => setPdfP3Count(Number(e.target.value))}
                      className="w-full p-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Tùy chọn Smart Mask */}
              <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-amber-50/70 border border-amber-200">
                <input
                  type="checkbox"
                  id="pdf-smart-mask"
                  checked={pdfSmartMask}
                  onChange={(e) => setPdfSmartMask(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded text-blue-600"
                />
                <label htmlFor="pdf-smart-mask" className="text-[11px] text-amber-900 leading-relaxed cursor-pointer">
                  <span className="font-bold block">Tự động che bảng đáp án ở cuối trang (Smart Mask):</span>
                  Tự động che phủ vùng bảng đáp án ở đáy trang cuối PDF bằng hộp trắng để học sinh không thấy trước đáp án khi làm bài.
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPdfCreateModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isCreatingPdfExam}
                  className="px-5 py-2 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-500 disabled:opacity-50 cursor-pointer shadow-md"
                >
                  {isCreatingPdfExam ? 'Đang xử lý PDF...' : 'Tạo đề & Mở phiếu đáp án'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL TẠO ĐỀ THI MỚI TOÀN DIỆN */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto">
          <div className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl bg-white shadow-2xl animate-in fade-in zoom-in-95 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
              <div>
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-blue-600" />
                  Soạn Thảo Đề Thi Mới - Thầy Sơn
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Chuẩn Bộ GD&ĐT 2025, Đề định kỳ / HSG 4 phần (file tex Huế) hoặc dán mã LaTeX trực tiếp.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body: Scrollable */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* 1. Chọn Định Dạng Mẫu */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                  1. Chọn Định Dạng Đề Thi Mẫu:
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div
                    onClick={() => handleSelectFormat('standard_3_parts')}
                    className={`rounded-2xl border-2 p-4 cursor-pointer transition ${
                      selectedFormat === 'standard_3_parts'
                        ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-500/20'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm text-slate-900">Chuẩn Bộ GD&ĐT 2025</span>
                      <span className="rounded-md bg-blue-600 text-white px-2 py-0.5 text-[10px] font-bold">3 Phần</span>
                    </div>
                    <p className="text-xs text-slate-500">
                      22 câu (12 TN 4 lựa chọn + 4 Đ/S + 6 Điền số ngắn). Thời gian 90 phút, thang 10.0đ.
                    </p>
                  </div>

                  <div
                    onClick={() => handleSelectFormat('periodic_4_parts')}
                    className={`rounded-2xl border-2 p-4 cursor-pointer transition ${
                      selectedFormat === 'periodic_4_parts'
                        ? 'border-purple-600 bg-purple-50/70 ring-2 ring-purple-500/20'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm text-slate-900">Định Kỳ / HSG THPT</span>
                      <span className="rounded-md bg-purple-600 text-white px-2 py-0.5 text-[10px] font-bold">4 Phần</span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Chuẩn đề TP Huế: 27 câu (12 TN + 4 Đ/S + 6 Điền số + 5 Tự luận VDC). Thời gian 150 phút.
                    </p>
                  </div>

                  <div
                    onClick={() => handleSelectFormat('custom')}
                    className={`rounded-2xl border-2 p-4 cursor-pointer transition ${
                      selectedFormat === 'custom'
                        ? 'border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm text-slate-900">Đề Ôn Tập Tùy Chọn</span>
                      <span className="rounded-md bg-slate-600 text-white px-2 py-0.5 text-[10px] font-bold">Tự do</span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Tự chọn số lượng câu hỏi và cấu trúc phù hợp cho các bài kiểm tra 15 - 45 phút.
                    </p>
                  </div>
                </div>
              </div>

              {/* 2. Thông Tin Chung Của Đề */}
              <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50/50 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Tiêu đề đề thi <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="Nhập tên đề thi..."
                      className="w-full rounded-xl border border-slate-200 p-2.5 text-sm text-slate-900 bg-white focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Khối lớp</label>
                    <select
                      value={newGrade}
                      onChange={(e) => setNewGrade(Number(e.target.value) as any)}
                      className="w-full rounded-xl border border-slate-200 p-2.5 text-sm text-slate-900 bg-white focus:border-blue-500 focus:outline-none"
                    >
                      <option value={12}>Toán Lớp 12</option>
                      <option value={11}>Toán Lớp 11</option>
                      <option value={10}>Toán Lớp 10</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Thời gian làm bài (Phút)
                    </label>
                    <input
                      type="number"
                      min={10}
                      max={180}
                      value={newDuration}
                      onChange={(e) => setNewDuration(Number(e.target.value))}
                      className="w-full rounded-xl border border-slate-200 p-2.5 text-sm text-slate-900 bg-white focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Mô tả / Hướng dẫn</label>
                    <input
                      type="text"
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      placeholder="Ghi chú làm bài..."
                      className="w-full rounded-xl border border-slate-200 p-2.5 text-sm text-slate-900 bg-white focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* 3. Công Cụ Lấy Câu Hỏi (3 Tabs) */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                  2. Chọn Công Cụ Thiết Lập Câu Hỏi Vào Đề:
                </label>

                {/* Tabs */}
                <div className="flex border-b border-slate-200 mb-4">
                  <button
                    type="button"
                    onClick={() => setCreatorMode('matrix')}
                    className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition cursor-pointer ${
                      creatorMode === 'matrix'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <Sparkles className="h-4 w-4" />
                    🎲 Lấy Ngẫu Nhiên Theo Ma Trận (Khuyên dùng)
                  </button>

                  <button
                    type="button"
                    onClick={() => setCreatorMode('manual')}
                    className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition cursor-pointer ${
                      creatorMode === 'manual'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <Layers className="h-4 w-4" />
                    📋 Chọn Thủ Công Từ Ngân Hàng
                  </button>

                  <button
                    type="button"
                    onClick={() => setCreatorMode('latex')}
                    className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition cursor-pointer ${
                      creatorMode === 'latex'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <FileCode className="h-4 w-4" />
                    📄 Dán Mã LaTeX (.tex)
                  </button>

                  <button
                    type="button"
                    onClick={() => setCreatorMode('word')}
                    className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition cursor-pointer ${
                      creatorMode === 'word'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <BookOpen className="h-4 w-4" />
                    📝 Nhập Từ File Word (.docx)
                  </button>
                </div>

                {/* Tab 1: Ma Trận / Tự Động */}
                {creatorMode === 'matrix' && (
                  <div className="rounded-2xl border border-slate-200 p-5 bg-blue-50/30 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Ưu tiên chuyên đề / dạng toán
                        </label>
                        <select
                          value={matrixTopic}
                          onChange={(e) => setMatrixTopic(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 bg-white focus:outline-none"
                        >
                          <option value="all">Tất cả chuyên đề (Tổng hợp toàn diện THPT)</option>
                          {allTopics.map((top) => (
                            <option key={top} value={top}>
                              {top}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={handleGenerateRandomMatrix}
                          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-500 shadow-md shadow-blue-600/20 transition cursor-pointer"
                        >
                          <RefreshCw className="h-4 w-4" />
                          Bốc Ngẫu Nhiên Câu Hỏi Vào Đề Ngay
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                      <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
                        <div className="text-[11px] font-bold text-blue-700">Phần I (TN)</div>
                        <input
                          type="number"
                          min={0}
                          max={20}
                          value={matrixP1Count}
                          onChange={(e) => setMatrixP1Count(Number(e.target.value))}
                          className="mt-1 w-16 text-center font-bold rounded-lg border border-slate-200 text-sm p-1"
                        />
                        <div className="text-[10px] text-slate-400 mt-0.5">câu (0.25đ/câu)</div>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
                        <div className="text-[11px] font-bold text-indigo-700">Phần II (Đ/S)</div>
                        <input
                          type="number"
                          min={0}
                          max={10}
                          value={matrixP2Count}
                          onChange={(e) => setMatrixP2Count(Number(e.target.value))}
                          className="mt-1 w-16 text-center font-bold rounded-lg border border-slate-200 text-sm p-1"
                        />
                        <div className="text-[10px] text-slate-400 mt-0.5">câu (1.0đ/câu)</div>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
                        <div className="text-[11px] font-bold text-amber-700">Phần III (Điền số)</div>
                        <input
                          type="number"
                          min={0}
                          max={10}
                          value={matrixP3Count}
                          onChange={(e) => setMatrixP3Count(Number(e.target.value))}
                          className="mt-1 w-16 text-center font-bold rounded-lg border border-slate-200 text-sm p-1"
                        />
                        <div className="text-[10px] text-slate-400 mt-0.5">câu (0.5đ/câu)</div>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
                        <div className="text-[11px] font-bold text-emerald-700">Phần IV (Tự luận)</div>
                        <input
                          type="number"
                          min={0}
                          max={10}
                          value={matrixP4Count}
                          onChange={(e) => setMatrixP4Count(Number(e.target.value))}
                          className="mt-1 w-16 text-center font-bold rounded-lg border border-slate-200 text-sm p-1"
                        />
                        <div className="text-[10px] text-slate-400 mt-0.5">câu (2.0đ/câu)</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab 2: Chọn Thủ Công */}
                {creatorMode === 'manual' && (
                  <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="flex-1 relative">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <input
                          type="text"
                          value={manualSearch}
                          onChange={(e) => setManualSearch(e.target.value)}
                          placeholder="Tìm câu hỏi theo nội dung hoặc chuyên đề..."
                          className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none"
                        />
                      </div>

                      <select
                        value={manualPartFilter}
                        onChange={(e) => setManualPartFilter(e.target.value === 'all' ? 'all' : (Number(e.target.value) as any))}
                        className="rounded-xl border border-slate-200 p-2 text-xs text-slate-700 bg-white focus:outline-none"
                      >
                        <option value="all">Tất cả các phần</option>
                        <option value={1}>Phần I: Trắc nghiệm 4 lựa chọn</option>
                        <option value={2}>Phần II: Đúng / Sai</option>
                        <option value={3}>Phần III: Trả lời ngắn / Điền số</option>
                        <option value={4}>Phần IV: Tự luận</option>
                      </select>

                      <select
                        value={manualTopicFilter}
                        onChange={(e) => setManualTopicFilter(e.target.value)}
                        className="rounded-xl border border-slate-200 p-2 text-xs text-slate-700 bg-white focus:outline-none"
                      >
                        <option value="all">Tất cả chuyên đề</option>
                        {allTopics.map((top) => (
                          <option key={top} value={top}>
                            {top}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Danh sách câu hỏi có checkbox */}
                    <div className="max-h-60 overflow-y-auto space-y-2 border border-slate-100 rounded-xl p-2 bg-slate-50/50">
                      {filteredBankQuestions.length === 0 ? (
                        <div className="text-center py-6 text-xs text-slate-400">
                          Không tìm thấy câu hỏi phù hợp với bộ lọc
                        </div>
                      ) : (
                        filteredBankQuestions.map((q) => {
                          const isSelected = selectedQuestions.some((item) => item.id === q.id);
                          return (
                            <div
                              key={q.id}
                              onClick={() => toggleSelectQuestion(q)}
                              className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                                isSelected
                                  ? 'border-blue-500 bg-blue-50/80 ring-1 ring-blue-500/20'
                                  : 'border-slate-200 bg-white hover:bg-slate-50'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}} // handled by parent onClick
                                className="h-4 w-4 rounded border-slate-300 text-blue-600 mt-0.5"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="rounded-md bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
                                    Phần {q.part || 1}
                                  </span>
                                  <span className="text-[11px] font-semibold text-slate-600">
                                    {q.topic}
                                  </span>
                                  <span className="text-[10px] text-slate-400">
                                    ({q.points} điểm)
                                  </span>
                                </div>
                                <div className="text-xs text-slate-800 line-clamp-2">
                                  <MathRenderer content={q.content} inline />
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {/* Tab 3: Dán Mã LaTeX */}
                {creatorMode === 'latex' && (
                  <div className="rounded-2xl border border-slate-200 p-4 space-y-3 bg-slate-50/50">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-700">
                        Dán mã các câu hỏi LaTeX gói ex_test (chứa \begin{'{ex}'}...\end{'{ex}'}):
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handlePasteLatexSample('hue')}
                          className="rounded-lg bg-purple-100 border border-purple-200 px-2 py-1 text-[11px] font-bold text-purple-700 hover:bg-purple-200 cursor-pointer"
                        >
                          Mẫu Huế HSG (Tổng hợp)
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePasteLatexSample('tkz_tab')}
                          className="rounded-lg bg-rose-100 border border-rose-200 px-2 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-200 cursor-pointer"
                        >
                          Bảng Biến Thiên (tkz-tab)
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePasteLatexSample('tabular')}
                          className="rounded-lg bg-teal-100 border border-teal-200 px-2 py-1 text-[11px] font-bold text-teal-700 hover:bg-teal-200 cursor-pointer"
                        >
                          Bảng Tabular
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePasteLatexSample('single')}
                          className="rounded-lg bg-blue-100 border border-blue-200 px-2 py-1 text-[11px] font-bold text-blue-700 hover:bg-blue-200 cursor-pointer"
                        >
                          Mẫu Trắc nghiệm
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePasteLatexSample('tf')}
                          className="rounded-lg bg-indigo-100 border border-indigo-200 px-2 py-1 text-[11px] font-bold text-indigo-700 hover:bg-indigo-200 cursor-pointer"
                        >
                          Mẫu Đúng/Sai
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePasteLatexSample('short')}
                          className="rounded-lg bg-amber-100 border border-amber-200 px-2 py-1 text-[11px] font-bold text-amber-700 hover:bg-amber-200 cursor-pointer"
                        >
                          Mẫu Điền số
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePasteLatexSample('essay')}
                          className="rounded-lg bg-emerald-100 border border-emerald-200 px-2 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-200 cursor-pointer"
                        >
                          Mẫu Tự luận
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <label className="inline-flex items-center gap-1.5 rounded-xl border border-purple-300 bg-purple-50 text-purple-700 px-3 py-1.5 text-xs font-bold hover:bg-purple-100 transition cursor-pointer">
                        <FileCode className="h-3.5 w-3.5" />
                        <span>Hoặc chọn file .tex / .txt từ máy</span>
                        <input
                          type="file"
                          accept=".tex,.txt"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                              const text = (ev.target?.result as string) || '';
                              setLatexInput(text);
                              try {
                                const { questions, metadata } = parseExamLatex(text);
                                if (questions.length > 0) {
                                  if (metadata.title) setNewTitle(metadata.title);
                                  else setNewTitle(file.name.replace(/\.[^/.]+$/, ''));
                                  if (metadata.duration) setNewDuration(metadata.duration);
                                  setSelectedQuestions(questions);
                                  setLatexParseNotice(`Đã trích xuất thành công ${questions.length} câu hỏi từ file "${file.name}"!`);
                                } else {
                                  setLatexParseNotice(`Đã nạp file "${file.name}". Bấm nút "Trích Xuất Câu Hỏi Từ LaTeX" để phân tích.`);
                                }
                              } catch (err: any) {
                                setLatexParseNotice(`Lỗi phân tích cú pháp LaTeX: ${err?.message || 'Không xác định'}`);
                              }
                            };
                            reader.readAsText(file, 'utf-8');
                            e.target.value = '';
                          }}
                        />
                      </label>
                      <span className="text-[11px] text-slate-500 italic">Hỗ trợ file TeX chứa khối \begin&#123;ex&#125;...\end&#123;ex&#125;</span>
                    </div>

                    <textarea
                      rows={7}
                      value={latexInput}
                      onChange={(e) => setLatexInput(e.target.value)}
                      placeholder="Dán mã LaTeX câu hỏi vào đây..."
                      className="w-full font-mono text-xs rounded-xl border border-slate-300 p-3 bg-white focus:outline-none focus:border-blue-500"
                    />

                    {latexParseNotice && (
                      <div className="rounded-xl bg-blue-50 border border-blue-200 p-2.5 text-xs text-blue-800 font-medium">
                        {latexParseNotice}
                      </div>
                    )}

                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleParseLatex}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-purple-500 cursor-pointer"
                      >
                        <Sparkles className="h-4 w-4" />
                        Trích Xuất Câu Hỏi Từ LaTeX
                      </button>
                    </div>
                  </div>
                )}

                {/* Tab 4: Nhập File Word (.docx) */}
                {creatorMode === 'word' && (
                  <div className="rounded-2xl border border-slate-200 p-5 space-y-4 bg-blue-50/20">
                    <div className="flex flex-col items-center justify-center border-2 border-dashed border-blue-300 rounded-2xl p-6 bg-white hover:bg-blue-50/50 transition">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 mb-3">
                        <BookOpen className="h-6 w-6" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 mb-1">
                        Chọn hoặc kéo thả file Microsoft Word (.docx) vào đây
                      </h4>
                      <p className="text-xs text-slate-500 max-w-md text-center mb-4">
                        Hệ thống tự động đọc công thức toán, trích xuất tất cả đồ thị, hình vẽ hình học nhúng trong file Word và bóc tách thành các câu hỏi trắc nghiệm & tự luận.
                      </p>

                      <label className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-600/20 hover:bg-blue-500 transition cursor-pointer">
                        <Plus className="h-4 w-4" />
                        <span>{isParsingWord ? 'Đang đọc file Word...' : 'Chọn file Word (.docx) từ máy'}</span>
                        <input
                          type="file"
                          accept=".docx"
                          disabled={isParsingWord}
                          onChange={handleWordFileChange}
                          className="hidden"
                        />
                      </label>
                    </div>

                    {wordNotice && (
                      <div className={`rounded-xl p-3 text-xs font-medium border ${
                        wordNotice.includes('Lỗi')
                          ? 'bg-rose-50 border-rose-200 text-rose-800'
                          : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      }`}>
                        {wordNotice}
                      </div>
                    )}

                    <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-2 text-xs text-slate-600">
                      <div className="font-bold text-slate-800 text-xs">💡 Lưu ý khi soạn đề thi trên Word:</div>
                      <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-600">
                        <li>Đánh số câu rõ ràng: <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-600">Câu 1:</code>, <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-600">Câu 2.</code> hoặc <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-600">Bài 1:</code>.</li>
                        <li>Phương án trắc nghiệm: <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-600">A.</code>, <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-600">B.</code>, <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-600">C.</code>, <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-600">D.</code>. Gạch chân hoặc in đậm chữ cái đầu để hệ thống nhận diện đáp án đúng.</li>
                        <li>Đúng / Sai: <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-600">a)</code>, <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-600">b)</code>, <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-600">c)</code>, <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-600">d)</code> kèm từ khóa [Đúng] hoặc [Sai].</li>
                        <li>Hình vẽ, bảng biểu và ảnh chụp đồ thị chèn trực tiếp trong Word sẽ được tự động bảo toàn 100%.</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>

              {/* 4. Tóm Tắt & Danh Sách Câu Hỏi Đã Chọn Cho Đề */}
              <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div>
                    <span className="font-bold text-sm text-slate-900">
                      Câu Hỏi Đã Chọn Cho Đề: {selectedQuestions.length} câu
                    </span>
                    <span className="text-xs text-slate-500 ml-2">
                      (Phần I: {selectedP1.length} • Phần II: {selectedP2.length} • Phần III: {selectedP3.length} • Phần IV: {selectedP4.length})
                    </span>
                  </div>
                  {selectedQuestions.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedQuestions([])}
                      className="text-xs text-rose-600 hover:underline cursor-pointer font-medium"
                    >
                      Xóa tất cả
                    </button>
                  )}
                </div>

                {selectedQuestions.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
                    Chưa có câu hỏi nào trong đề. Thầy hãy bấm &quot;Bốc Ngẫu Nhiên&quot; hoặc chọn thủ công ở trên!
                  </div>
                ) : (
                  <div className="max-h-48 overflow-y-auto space-y-1.5 bg-white p-2 rounded-xl border border-slate-200">
                    {selectedQuestions.map((q, idx) => (
                      <div
                        key={`${q.id}-${idx}`}
                        className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-xs text-slate-800 border border-slate-100"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="font-bold text-blue-600 shrink-0">#{idx + 1}</span>
                          <span className="rounded bg-blue-100 px-1 py-0.5 text-[10px] font-bold text-blue-700 shrink-0">
                            Phần {q.part || 1}
                          </span>
                          <span className="font-semibold shrink-0 text-slate-600">[{q.topic}]</span>
                          <span className="truncate">{q.content.replace(/[\$\\]/g, '')}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedQuestions(selectedQuestions.filter((_, i) => i !== idx))}
                          className="text-slate-400 hover:text-rose-600 shrink-0 p-1"
                          title="Xóa câu này"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-slate-200 px-6 py-4 bg-slate-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="modalShuffle"
                    checked={shuffleQuestions}
                    onChange={(e) => setShuffleQuestions(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600"
                  />
                  <label htmlFor="modalShuffle" className="text-xs text-slate-700 font-medium cursor-pointer">
                    Xáo trộn thứ tự câu hỏi ngẫu nhiên khi học sinh làm bài
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="saveNewQuestionsToBank"
                    checked={saveNewExamQuestionsToBank}
                    onChange={(e) => setSaveNewExamQuestionsToBank(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600"
                  />
                  <label htmlFor="saveNewQuestionsToBank" className="text-xs text-slate-700 font-medium cursor-pointer">
                    Đồng thời lưu câu hỏi này vào Ngân hàng câu hỏi (để tái sử dụng cho đề khác)
                  </label>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleCreateExam}
                  className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-600/20 hover:bg-blue-500 transition cursor-pointer"
                >
                  Xác Nhận & Xuất Bản Đề Thi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Chỉnh Sửa đề thi */}
      {showEditModal && editingExam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg my-8 rounded-3xl bg-white p-6 sm:p-8 shadow-2xl animate-in fade-in zoom-in-95">
            <h2 className="text-xl font-bold text-slate-900">Chỉnh Sửa Đề Thi</h2>
            <p className="mt-1 text-xs text-slate-500">
              Cập nhật thông số đề thi của Thầy Sơn.
            </p>

            <form onSubmit={handleUpdateExam} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tiêu đề đề thi <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Tiêu đề đề thi..."
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Khối lớp</label>
                  <select
                    value={editGrade}
                    onChange={(e) => setEditGrade(Number(e.target.value) as any)}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                  >
                    <option value={12}>Lớp 12</option>
                    <option value={11}>Lớp 11</option>
                    <option value={10}>Lớp 10</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Thời gian làm bài (Phút)
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={180}
                    value={editDuration}
                    onChange={(e) => setEditDuration(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Mô tả đề thi</label>
                <textarea
                  rows={2}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Ghi chú dành cho học sinh..."
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="editShuffle"
                  checked={editShuffle}
                  onChange={(e) => setEditShuffle(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="editShuffle" className="text-xs text-slate-700 font-medium cursor-pointer">
                  Xáo trộn thứ tự câu hỏi ngẫu nhiên
                </label>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingExam(null);
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
      {/* MODAL GIAO ĐỀ THI CHO LỚP HỌC */}
      {assigningExam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <GraduationCap className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">Giao đề thi cho lớp</h3>
                  <p className="text-[11px] text-slate-500 truncate max-w-[260px]">{assigningExam.title}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAssigningExam(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Quyền truy cập */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">Quyền truy cập đề thi:</label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setAssignAccessType('restricted')}
                  className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                    assignAccessType === 'restricted'
                      ? 'border-blue-600 bg-blue-50/60 text-blue-900 font-bold'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="block font-bold">Giới hạn lớp</span>
                  <span className="text-[10px] text-slate-500 font-normal">Chỉ học sinh lớp được chọn</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAssignAccessType('public')}
                  className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                    assignAccessType === 'public'
                      ? 'border-blue-600 bg-blue-50/60 text-blue-900 font-bold'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="block font-bold">Công khai</span>
                  <span className="text-[10px] text-slate-500 font-normal">Mọi học sinh đều làm được</span>
                </button>
              </div>
            </div>

            {/* Danh sách lớp học để tick chọn (khi ở chế độ restricted) */}
            {assignAccessType === 'restricted' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700">
                    Chọn các lớp được phép thi:
                  </label>
                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setAssignClassesSelection(classes.map((c) => c.name))}
                      className="text-blue-600 hover:underline font-bold cursor-pointer"
                    >
                      Chọn hết
                    </button>
                    <span className="text-slate-300">•</span>
                    <button
                      type="button"
                      onClick={() => setAssignClassesSelection([])}
                      className="text-slate-500 hover:underline font-medium cursor-pointer"
                    >
                      Bỏ chọn
                    </button>
                  </div>
                </div>

                {classes.length === 0 ? (
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 text-center">
                    Chưa có lớp nào trong danh mục. <Link href="/classes" className="underline font-bold">Tạo lớp ngay</Link>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {classes.map((cls) => {
                      const isChecked = assignClassesSelection.some(
                        (c) => c.trim().toLowerCase() === cls.name.trim().toLowerCase()
                      );
                      return (
                        <label
                          key={cls.id}
                          className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition text-xs ${
                            isChecked
                              ? 'border-blue-500 bg-blue-50/50 text-blue-900 font-bold'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                if (isChecked) {
                                  setAssignClassesSelection(
                                    assignClassesSelection.filter(
                                      (c) => c.trim().toLowerCase() !== cls.name.trim().toLowerCase()
                                    )
                                  );
                                } else {
                                  setAssignClassesSelection([...assignClassesSelection, cls.name]);
                                }
                              }}
                              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span>{cls.name}</span>
                          </div>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-normal">
                            Khối {cls.grade}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
                {assignClassesSelection.length === 0 && classes.length > 0 && (
                  <p className="text-[11px] text-amber-600 italic">
                    * Chưa chọn lớp nào. Vui lòng bấm tick chọn ít nhất 1 lớp.
                  </p>
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 text-xs">
              <button
                type="button"
                onClick={() => setAssigningExam(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveClassAssignment}
                className="rounded-xl bg-blue-600 px-5 py-2 font-bold text-white hover:bg-blue-500 shadow-md shadow-blue-500/20 transition cursor-pointer"
              >
                Lưu giao đề
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
