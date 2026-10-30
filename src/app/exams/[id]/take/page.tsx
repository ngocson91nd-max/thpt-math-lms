'use client';

import React, { useState, useEffect, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { MOCK_EXAMS, MOCK_SUBMISSIONS, MOCK_CLASSES } from '@/lib/supabase/mockStore';
import { Exam, Question, ClassItem } from '@/types/database';
import dynamic from 'next/dynamic';
import MathRenderer from '@/components/math/MathRenderer';
import { gradeExamSubmission } from '@/lib/grading/grader';
import { createClient } from '@/lib/supabase/client';
import { ExamCalculator } from '@/components/exam/ExamCalculator';
import { ExamFormulaSheetModal } from '@/components/exam/ExamFormulaSheetModal';
import { getPdfFromIndexedDb } from '@/lib/pdf/pdfStorage';
import { isExamPermittedForStudent } from '@/lib/auth/enrollment';

const PdfExamViewer = dynamic(() => import('@/components/exam/PdfExamViewer'), {
  ssr: false,
  loading: () => (
    <div className="flex h-96 items-center justify-center rounded-2xl border border-slate-200 bg-white p-6 text-slate-400">
      <div className="flex flex-col items-center gap-2">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        <span className="text-xs font-semibold">Đang nạp trình đọc PDF...</span>
      </div>
    </div>
  ),
});
import { broadcastDataChange } from '@/lib/realtime/syncService';
import {
  Clock,
  Flag,
  ChevronLeft,
  ChevronRight,
  Send,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Upload,
  BookOpen,
  Award,
  Sparkles,
  Calculator as CalcIcon,
  Maximize,
  Minimize,
  Type,
  FileText,
  ListOrdered,
  Eye,
  Trash2,
  Image as ImageIcon,
  Check,
  ShieldAlert,
  Save,
  CheckCircle,
  X,
  Lock,
} from 'lucide-react';

export default function TakeExamPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { user, isTeacher, isStudent } = useAuth();

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

  const [notFound, setNotFound] = useState(false);

  const [exam, setExam] = useState<Exam | undefined>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('lms_exams');
        if (saved) {
          const list = JSON.parse(saved);
          const cleanTarget = (resolvedParams.id || '').trim().toLowerCase();
          const found =
            list.find((e: any) => {
              if (e.id && e.id.toLowerCase() === cleanTarget) return true;
              if (e.code && e.code.toLowerCase() === cleanTarget) return true;
              if (e.title && e.title.trim().toLowerCase() === cleanTarget) return true;
              return false;
            }) || (list.length === 1 ? list[0] : undefined);
          return found;
        }
      } catch {}
    }
    return undefined;
  });

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [essayImages, setEssayImages] = useState<Record<string, string[]>>({});
  const [timeLeft, setTimeLeft] = useState((exam?.duration_minutes || 90) * 60);

  // Chế độ làm bài: 'focus' (từng câu), 'scroll' (cuộn như đề thi giấy Azota), hoặc 'pdf' (chia đôi màn hình: file PDF & phiếu tô)
  const [viewMode, setViewMode] = useState<'focus' | 'scroll' | 'pdf'>('scroll');
  const [loadedPdfUrl, setLoadedPdfUrl] = useState<string | null>(null);
  const [pdfMobileTab, setPdfMobileTab] = useState<'pdf' | 'answers'>('pdf');

  // Bộ lọc câu hỏi: 'all' | 'unanswered' | 'flagged'
  const [filterMode, setFilterMode] = useState<'all' | 'unanswered' | 'flagged'>('all');

  // Bật/tắt phiếu tô đáp án nhanh (OMR Sheet)
  const [showOmrQuick, setShowOmrQuick] = useState(false);

  // Kích thước cỡ chữ: sm (14px), base (16px), lg (18px), xl (20px)
  const [fontSize, setFontSize] = useState<'sm' | 'base' | 'lg' | 'xl'>('base');

  // Modals & Công cụ
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [isFormulaSheetOpen, setIsFormulaSheetOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Giám sát thi & chống gian lận chuẩn Azota
  const MAX_ALLOWED_VIOLATIONS = 3;
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [violationLogs, setViolationLogs] = useState<string[]>([]);
  const [showTabWarning, setShowTabWarning] = useState(false);
  const [isAutoSubmittingDueToViolation, setIsAutoSubmittingDueToViolation] = useState(false);
  const [proctoringToast, setProctoringToast] = useState<string | null>(null);
  const [showFullscreenOverlay, setShowFullscreenOverlay] = useState(false);

  // Trạng thái tự động lưu (Auto-save)
  const [lastSavedTime, setLastSavedTime] = useState<string>('');
  const [isAutoSaved, setIsAutoSaved] = useState(true);

  // Preview ảnh phóng to
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const storageKey = `exam_take_v2_${resolvedParams.id}_${user?.id || 'guest'}`;

  // 1. Tải đề thi từ Supabase hoặc localStorage
  useEffect(() => {
    const checkAndLoadPdf = (targetExam: Exam) => {
      const isPdfMode =
        targetExam.exam_mode === 'pdf_view' ||
        Boolean(targetExam.pdf_url) ||
        (targetExam.questions && targetExam.questions.some((q) => q.content?.includes('file PDF')));

      if (isPdfMode) {
        setViewMode('pdf');
      }

      const applyAutoMask = async (rawPdf: string) => {
        // Tự động che bảng đáp án ở đáy trang cuối để học sinh không nhìn thấy (giữ trọn vẹn câu hỏi)
        try {
          const { maskPdfAnswerKey } = await import('@/lib/pdf/pdfExamHelper');
          const res = await maskPdfAnswerKey(rawPdf);
          setLoadedPdfUrl(res.maskedDataUrl);
        } catch (e) {
          console.warn('Lỗi auto-mask đáp án:', e);
          setLoadedPdfUrl(rawPdf);
        }
      };

      if (targetExam.pdf_url) {
        if (targetExam.pdf_url.startsWith('idb:')) {
          const idbKey = targetExam.pdf_url.replace('idb:', '');
          getPdfFromIndexedDb(idbKey).then((data) => {
            if (data) applyAutoMask(data);
          });
        } else {
          applyAutoMask(targetExam.pdf_url);
        }
      } else {
        // Fallback: Thử tìm trong IndexedDB theo id đề thi
        getPdfFromIndexedDb(`pdf_${targetExam.id}`).then((data) => {
          if (data) applyAutoMask(data);
        });
      }
    };

    const mockExam = MOCK_EXAMS.find((e) => e.id === resolvedParams.id);

    if (typeof window !== 'undefined') {
      const savedExams = localStorage.getItem('lms_exams');
      if (savedExams) {
        try {
          const parsed: Exam[] = JSON.parse(savedExams);
          const cleanTarget = (resolvedParams.id || '').trim().toLowerCase();
          const found =
            parsed.find((e) => {
              if (e.id && e.id.toLowerCase() === cleanTarget) return true;
              if (e.code && e.code.toLowerCase() === cleanTarget) return true;
              if (e.title && e.title.trim().toLowerCase() === cleanTarget) return true;
              return false;
            }) || (parsed.length === 1 ? parsed[0] : null);

          // Nếu trong cache đã có sẵn câu hỏi đầy đủ thì nạp tức thì 0ms
          if (found && Array.isArray(found.questions) && found.questions.length > 0) {
            setExam(found);
            setTimeLeft(found.no_time_limit ? 0 : found.duration_minutes * 60);
            checkAndLoadPdf(found);
            return;
          }
        } catch (e) {
          console.error(e);
        }
      }
    }

    if (mockExam && Array.isArray(mockExam.questions) && mockExam.questions.length > 0) {
      setExam(mockExam);
      setTimeLeft(mockExam.no_time_limit ? 0 : mockExam.duration_minutes * 60);
      checkAndLoadPdf(mockExam);
      return;
    }

    // Nạp danh sách lớp học thực tế từ Cloud
    fetch('/api/classes')
      .then((r) => r.json())
      .then((d) => {
        if (d.success && Array.isArray(d.classes)) {
          setClasses(d.classes);
          if (typeof window !== 'undefined') {
            localStorage.setItem('lms_classes', JSON.stringify(d.classes));
          }
        }
      })
      .catch(() => {});

    // Đồng bộ trạng thái lớp học của học sinh từ Cloud
    if (user && isStudent) {
      fetch(`/api/cloud-sync?userId=${encodeURIComponent(user.id)}&email=${encodeURIComponent(user.email || '')}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.success && Array.isArray(d.approvedClasses) && typeof window !== 'undefined') {
            localStorage.setItem(`lms_student_classes_${user.id}`, JSON.stringify(d.approvedClasses));
            if (user.email) {
              localStorage.setItem(`lms_student_classes_${user.email.toLowerCase()}`, JSON.stringify(d.approvedClasses));
            }
            window.dispatchEvent(new Event('lms_enrollment_changed'));
          }
        })
        .catch(() => {});
    }

    // Tải thông tin đề thi đầy đủ câu hỏi trực tiếp theo ID từ Cloud API
    const loadExamWithFallback = async () => {
      try {
        const r = await fetch(`/api/exams?id=${encodeURIComponent(resolvedParams.id)}`);
        const d = await r.json();
        if (d.success && d.exam && Array.isArray(d.exam.questions) && d.exam.questions.length > 0) {
          setExam(d.exam);
          setTimeLeft(d.exam.no_time_limit ? 0 : d.exam.duration_minutes * 60);
          checkAndLoadPdf(d.exam);

          // Cập nhật câu hỏi vào cache để lần sau nạp ngay 0ms
          if (typeof window !== 'undefined') {
            try {
              const saved = localStorage.getItem('lms_exams');
              if (saved) {
                const list: Exam[] = JSON.parse(saved);
                const idx = list.findIndex((e) => e.id === d.exam.id);
                if (idx >= 0) list[idx] = d.exam;
                else list.unshift(d.exam);
                localStorage.setItem('lms_exams', JSON.stringify(list));
              }
            } catch {}
          }
          return;
        }
      } catch (err) {
        console.warn('Lỗi tải đề thi theo id, thử fallback:', err);
      }

      // Fallback: Tải từ danh sách đầy đủ ?full=true
      try {
        const r2 = await fetch('/api/exams?full=true');
        const d2 = await r2.json();
        if (d2.success && Array.isArray(d2.exams)) {
          const cleanTarget = (resolvedParams.id || '').trim().toLowerCase();
          const found =
            d2.exams.find((e: any) => {
              if (e.id && e.id.toLowerCase() === cleanTarget) return true;
              if (e.code && e.code.toLowerCase() === cleanTarget) return true;
              if (e.title && e.title.trim().toLowerCase() === cleanTarget) return true;
              return false;
            }) || (d2.exams.length === 1 ? d2.exams[0] : null);

          if (found && Array.isArray(found.questions) && found.questions.length > 0) {
            setExam(found);
            setTimeLeft(found.no_time_limit ? 0 : found.duration_minutes * 60);
            checkAndLoadPdf(found);
            if (typeof window !== 'undefined') {
              localStorage.setItem('lms_exams', JSON.stringify(d2.exams));
            }
            return;
          }
        }
      } catch (err2) {
        console.error('Lỗi fallback đề thi:', err2);
      }

      // Nếu quét mọi cách vẫn không tìm thấy đề
      setNotFound(true);
    };

    loadExamWithFallback();
  }, [resolvedParams.id, user, isStudent]);

  // 2. KHÔI PHỤC TIẾN ĐỘ BÀI LÀM TỰ ĐỘNG (Crash Recovery / F5 Protection)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const savedProgress = localStorage.getItem(storageKey);
      if (savedProgress) {
        const data = JSON.parse(savedProgress);
        if (data.answers) setAnswers(data.answers);
        if (data.flagged) setFlagged(data.flagged);
        if (data.essayImages) setEssayImages(data.essayImages);
        if (data.viewMode && !isPdfExam) setViewMode(data.viewMode);
        if (isPdfExam) setViewMode('pdf');
        if (data.fontSize) setFontSize(data.fontSize);
        if (data.tabSwitchCount) setTabSwitchCount(data.tabSwitchCount);

        // Tính toán lại thời gian còn lại chính xác dựa trên mốc bắt đầu thực
        if (data.startedAt) {
          const elapsedSecs = Math.floor((Date.now() - data.startedAt) / 1000);
          if (exam?.no_time_limit) {
            setTimeLeft(elapsedSecs);
          } else if (exam?.duration_minutes) {
            const totalSecs = exam.duration_minutes * 60;
            const remaining = Math.max(0, totalSecs - elapsedSecs);
            setTimeLeft(remaining);
          }
        }
      } else {
        // Lưu mốc bắt đầu mới
        localStorage.setItem(
          storageKey,
          JSON.stringify({
            startedAt: Date.now(),
            answers: {},
            flagged: {},
            essayImages: {},
            tabSwitchCount: 0,
          })
        );
      }
    } catch (e) {
      console.warn('Lỗi khôi phục tiến độ bài thi:', e);
    }
  }, [exam?.id, storageKey]);

  // 3. TỰ ĐỘNG LƯU BÀI LÀM REALTIME VÀO LOCALSTORAGE
  useEffect(() => {
    if (typeof window === 'undefined' || !exam) return;
    try {
      const existing = JSON.parse(localStorage.getItem(storageKey) || '{}');
      const updated = {
        ...existing,
        answers,
        flagged,
        essayImages,
        viewMode,
        fontSize,
        tabSwitchCount,
        lastSaved: Date.now(),
      };
      localStorage.setItem(storageKey, JSON.stringify(updated));
      const now = new Date();
      setLastSavedTime(`${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`);
      setIsAutoSaved(true);

      // Cập nhật tín hiệu Live Presence tới Phòng giám sát thi của Giáo viên
      const stuId = user?.id || 'demo-student';
      const ansCount = Object.keys(answers).length;
      const presencePayload = {
        studentId: stuId,
        fullName: user?.full_name || 'Học sinh',
        email: user?.email || '',
        schoolName: user?.school_name || 'THPT Chuyên',
        status: tabSwitchCount > 0 ? 'violation' : 'taking',
        answeredCount: ansCount,
        totalCount: questions.length,
        tabSwitchCount,
        lastPing: Date.now(),
      };
      localStorage.setItem(`lms_presence_${exam.id}_${stuId}`, JSON.stringify(presencePayload));
      broadcastDataChange('ALL_UPDATED', { type: 'PRESENCE', data: presencePayload });
    } catch (e) {
      console.warn('Lỗi tự động lưu:', e);
    }
  }, [answers, flagged, essayImages, viewMode, fontSize, tabSwitchCount, exam, storageKey]);

  // Trigger thông báo răn đe chống gian lận (Anti-cheat Toast)
  const triggerProctorToast = (msg: string) => {
    setProctoringToast(msg);
    setTimeout(() => setProctoringToast(null), 3000);
  };

  // 4. GIÁM SÁT THI & CHỐNG GIAN LẬN TOÀN DIỆN CHUẨN AZOTA
  useEffect(() => {
    // A. Chặn phím tắt gian lận: F12, Ctrl+Shift+I, Ctrl+C, Ctrl+V, Ctrl+U, Ctrl+S
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Chặn phím tắt mở Developer Tools (F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C)
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && ['I', 'J', 'C', 'i', 'j', 'c'].includes(e.key)) ||
        (e.metaKey && e.altKey && ['I', 'J', 'C', 'i', 'j', 'c'].includes(e.key))
      ) {
        e.preventDefault();
        triggerProctorToast('⚠️ Thao tác bị khóa! Nghiêm cấm mở công cụ nhà phát triển trong lúc thi.');
        return false;
      }

      // 2. Chặn Ctrl + U (Xem mã nguồn HTML)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'u' || e.key === 'U')) {
        e.preventDefault();
        triggerProctorToast('⚠️ Thao tác bị khóa! Không thể xem mã nguồn.');
        return false;
      }

      // 3. Chặn Ctrl + S (Lưu trang)
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        return false;
      }

      // 4. Chặn Sao chép (Ctrl + C / Cmd + C) trừ khi đang gõ trong input/textarea của tự luận
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
        const targetTag = (e.target as HTMLElement)?.tagName?.toUpperCase();
        if (targetTag !== 'INPUT' && targetTag !== 'TEXTAREA') {
          e.preventDefault();
          triggerProctorToast('🔒 Nghiêm cấm sao chép câu hỏi đề thi ra bên ngoài!');
          return false;
        }
      }
    };

    // B. Chặn chuột phải (Context Menu)
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      triggerProctorToast('🔒 Chuột phải đã bị vô hiệu hóa để bảo mật đề thi.');
      return false;
    };

    // C. Chặn bôi đen đề thi để chống copy
    const handleSelectStart = (e: Event) => {
      const targetTag = (e.target as HTMLElement)?.tagName?.toUpperCase();
      if (targetTag !== 'INPUT' && targetTag !== 'TEXTAREA') {
        e.preventDefault();
        return false;
      }
    };

    // Gắn các trình nghe chống gian lận
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('contextmenu', handleContextMenu, true);
    document.addEventListener('selectstart', handleSelectStart);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('contextmenu', handleContextMenu, true);
      document.removeEventListener('selectstart', handleSelectStart);
    };
  }, []);

  // B. Giám sát rời tab và thu bài tự động nếu vi phạm quá mức theo cấu hình đề
  const recordViolation = (reason: string) => {
    const timeStr = new Date().toLocaleTimeString('vi-VN');
    const logItem = `${timeStr}: ${reason}`;

    setViolationLogs((prev) => [...prev, logItem]);
    setTabSwitchCount((prev) => {
      const next = prev + 1;
      const isLockAction = exam?.violation_action === 'lock_exam';
      const allowedLimit = exam?.max_violations || 3;

      if (isLockAction && next > allowedLimit) {
        // Tự động thu bài và khóa thi ngay lập tức
        setIsAutoSubmittingDueToViolation(true);
        setTimeout(() => {
          handleFinalSubmitWithViolation(next, [...violationLogs, logItem]);
        }, 1500);
      } else {
        setShowTabWarning(true);
      }
      return next;
    });
  };

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        recordViolation('Rời khỏi tab đề thi (chuyển sang ứng dụng hoặc tab khác)');
      }
    };

    const handleWindowBlur = () => {
      setTimeout(() => {
        const activeTag = document.activeElement?.tagName?.toUpperCase();
        if (activeTag === 'IFRAME' || activeTag === 'EMBED' || activeTag === 'OBJECT') {
          return;
        }
        if (!document.hidden) {
          return;
        }
        recordViolation('Chuyển cửa sổ làm việc (mất tiêu điểm trình duyệt)');
      }, 200);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [violationLogs]);

  // C. Giám sát chế độ toàn màn hình (Fullscreen)
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        setIsFullscreen(true);
        setShowFullscreenOverlay(false);
      }).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const onFsChange = () => {
      const isFs = !!document.fullscreenElement;
      setIsFullscreen(isFs);
      // Nếu đề thi đang diễn ra mà thoát fullscreen -> Cảnh báo
      if (!isFs && timeLeft > 0 && !isSubmitting) {
        setShowFullscreenOverlay(true);
        recordViolation('Thoát khỏi chế độ toàn màn hình');
      } else {
        setShowFullscreenOverlay(false);
      }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, [timeLeft, isSubmitting, violationLogs]);

  // Nạp danh sách câu hỏi với cơ chế xáo trộn (shuffle) thông minh, bảo lưu thứ tự trong phiên qua sessionStorage
  const questions: Question[] = React.useMemo(() => {
    if (!exam?.questions || exam.questions.length === 0) return [];
    let list = [...exam.questions];

    const shuffleKey = `lms_shuffle_${exam.id}_${user?.id || 'guest'}`;
    if (typeof window !== 'undefined') {
      try {
        const cached = sessionStorage.getItem(shuffleKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length === list.length) {
            return parsed;
          }
        }
      } catch {}
    }

    if (exam.shuffle_questions) {
      // Xáo trộn thứ tự các câu hỏi trong từng phần, giữ nguyên cấu trúc phần 1, 2, 3, 4
      const p1 = list.filter((q) => (q.part || 1) === 1).sort(() => Math.random() - 0.5);
      const p2 = list.filter((q) => q.part === 2).sort(() => Math.random() - 0.5);
      const p3 = list.filter((q) => q.part === 3).sort(() => Math.random() - 0.5);
      const p4 = list.filter((q) => q.part === 4).sort(() => Math.random() - 0.5);
      list = [...p1, ...p2, ...p3, ...p4];
    }

    if (exam.shuffle_options) {
      list = list.map((q) => {
        if ((q.type === 'single_choice' || q.type === 'multiple_choice') && Array.isArray(q.options) && q.options.length > 0) {
          const shuffledOpts = [...q.options].sort(() => Math.random() - 0.5);
          return { ...q, options: shuffledOpts };
        }
        return q;
      });
    }

    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(shuffleKey, JSON.stringify(list));
      } catch {}
    }

    return list;
  }, [exam?.id, exam?.questions, exam?.shuffle_questions, exam?.shuffle_options, user?.id]);

  const part1Questions = questions.filter((q) => q.part === 1 || q.type === 'single_choice' || q.type === 'multiple_choice');
  const part2Questions = questions.filter((q) => q.part === 2 || q.type === 'true_false');
  const part3Questions = questions.filter((q) => q.part === 3 || q.type === 'short_answer');
  const part4Questions = questions.filter((q) => q.part === 4 || q.type === 'essay');

  const isPdfExam =
    exam?.exam_mode === 'pdf_view' ||
    Boolean(exam?.pdf_url) ||
    Boolean(loadedPdfUrl) ||
    (questions.length > 0 && questions.some((q) => q.content?.includes('file PDF')));

  // 6. BỘ ĐẾM THỜI GIAN THẬT (TỰ ĐỘNG CHUYỂN COUNT-UP NẾU KHÔNG GIỚI HẠN THỜI GIAN)
  useEffect(() => {
    if (exam?.no_time_limit) {
      // Chế độ không giới hạn thời gian: đếm xuôi (thời gian đã làm), KHÔNG tự động nộp
      const timer = setInterval(() => {
        setTimeLeft((prev) => prev + 1);
      }, 1000);
      return () => clearInterval(timer);
    }

    if (timeLeft <= 0) {
      handleFinalSubmit();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, exam?.no_time_limit]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const currentQ = questions[currentIndex];

  // Xử lý chọn đáp án các dạng câu hỏi
  const handleSingleChoiceSelect = (qId: string, optionId: string) => {
    setAnswers((prev) => ({ ...prev, [qId]: optionId }));
    setIsAutoSaved(false);
  };

  const handleMultipleChoiceToggle = (qId: string, optionId: string) => {
    const existing: string[] = Array.isArray(answers[qId]) ? answers[qId] : [];
    if (existing.includes(optionId)) {
      setAnswers((prev) => ({
        ...prev,
        [qId]: existing.filter((id) => id !== optionId),
      }));
    } else {
      setAnswers((prev) => ({
        ...prev,
        [qId]: [...existing, optionId],
      }));
    }
    setIsAutoSaved(false);
  };

  const handleTrueFalseSelect = (qId: string, stmtId: string, isTrue: boolean) => {
    const existing = answers[qId] || {};
    setAnswers((prev) => ({
      ...prev,
      [qId]: { ...existing, [stmtId]: isTrue },
    }));
    setIsAutoSaved(false);
  };

  const handleShortAnswerChange = (qId: string, val: string) => {
    setAnswers((prev) => ({ ...prev, [qId]: val }));
    setIsAutoSaved(false);
  };

  const handleEssayChange = (qId: string, val: string) => {
    setAnswers((prev) => ({ ...prev, [qId]: val }));
    setIsAutoSaved(false);
  };

  const handleInsertMathToEssay = (snippet: string, targetQId?: string) => {
    const qId = targetQId || currentQ?.id;
    if (!qId) return;
    const existing = answers[qId] || '';
    setAnswers((prev) => ({ ...prev, [qId]: existing + ' ' + snippet }));
    setIsAutoSaved(false);
  };

  // Nén ảnh thông minh phía client để tải siêu tốc, không tràn bộ nhớ và chống nghẽn server
  const compressImageFile = (file: File, maxWidth = 1200, quality = 0.75): Promise<string> => {
    return new Promise((resolve) => {
      // Nếu file không phải ảnh hoặc quá nhỏ (< 200KB), đọc trực tiếp
      if (!file.type.startsWith('image/') || file.size < 200 * 1024) {
        const reader = new FileReader();
        reader.onload = (e) => resolve((e.target?.result as string) || '');
        reader.onerror = () => resolve('');
        reader.readAsDataURL(file);
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressed = canvas.toDataURL('image/jpeg', quality);
            resolve(compressed);
          } else {
            resolve((event.target?.result as string) || '');
          }
        };
        img.onerror = () => resolve((event.target?.result as string) || '');
        img.src = (event.target?.result as string) || '';
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  };

  // Tải ảnh bài làm tự luận viết tay (được tự động nén tối ưu dung lượng)
  const handleUploadEssayImage = async (qId: string, files: FileList | null) => {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);
    for (const file of fileArray) {
      try {
        const compressedBase64 = await compressImageFile(file);
        if (compressedBase64) {
          setEssayImages((prev) => ({
            ...prev,
            [qId]: [...(prev[qId] || []), compressedBase64],
          }));
          setIsAutoSaved(false);
        }
      } catch (err) {
        console.warn('Lỗi xử lý ảnh tự luận:', err);
      }
    }
  };

  const handleRemoveEssayImage = (qId: string, imgIdx: number) => {
    setEssayImages((prev) => ({
      ...prev,
      [qId]: (prev[qId] || []).filter((_, idx) => idx !== imgIdx),
    }));
    setIsAutoSaved(false);
  };

  const toggleFlag = (qId: string) => {
    setFlagged((prev) => ({ ...prev, [qId]: !prev[qId] }));
  };

  // Kiểm tra câu hỏi đã hoàn thành hay chưa
  const isQuestionAnswered = (q: Question) => {
    const ans = answers[q.id];
    if (ans === undefined || ans === null || ans === '') {
      // Kiểm tra câu tự luận nếu có tải ảnh lên thì xem là đã làm
      if (q.type === 'essay' && (essayImages[q.id] || []).length > 0) return true;
      return false;
    }
    if (Array.isArray(ans) && ans.length === 0) return false;
    if (q.type === 'true_false') {
      const keys = Object.keys(ans);
      // Đủ 4 ý a, b, c, d
      return keys.length >= 1;
    }
    return true;
  };

  const answeredCount = questions.filter(isQuestionAnswered).length;
  const unansweredQuestions = questions.filter((q) => !isQuestionAnswered(q));

  // Nhảy tới câu hỏi (hỗ trợ cả 2 chế độ cuộn và từng câu)
  const jumpToQuestion = (idx: number, qId: string) => {
    setCurrentIndex(idx);
    if (viewMode === 'scroll') {
      const el = document.getElementById(`q-card-${qId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  // Xử lý nộp bài cưỡng chế khi vi phạm quá số lần cho phép
  const handleFinalSubmitWithViolation = async (violationCount: number, logs: string[]) => {
    if (!exam || isSubmitting) return;
    setIsSubmitting(true);

    const maxScore = exam.format === 'periodic_4_parts' ? 20.0 : 10.0;
    const gradingResult = gradeExamSubmission(questions, answers, maxScore, {
      trueFalseScoring: exam.true_false_scoring || 'standard_thpt',
      partPoints: exam.part_points,
    });
    const newSubId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : '99999999-9999-9999-9999-999999999999';

    const startTimeIso = exam.no_time_limit
      ? new Date(Date.now() - timeLeft * 1000).toISOString()
      : new Date(Date.now() - (exam.duration_minutes * 60 - timeLeft) * 1000).toISOString();
    const submittedAtIso = new Date().toISOString();
    const studentId = user?.id || '33333333-3333-3333-3333-333333333333';

    const submissionAnswers = gradingResult.answers.map((r) => ({
      question_id: r.questionId,
      student_answer: answers[r.questionId],
      essay_images: essayImages[r.questionId] || [],
      is_correct: r.isCorrect ?? undefined,
      earned_points: r.earnedPoints,
      max_points: r.maxPoints,
    }));

    const allowedLimit = exam.max_violations || 3;
    const violationDetail = logs.length > 0 ? `\nNhật ký vi phạm:\n${logs.join('\n')}` : '';

    const newSubmission = {
      id: newSubId,
      exam_id: exam.id,
      exam,
      student_id: studentId,
      student: user || undefined,
      attempt_number: 1,
      start_time: startTimeIso,
      submitted_at: submittedAtIso,
      score: gradingResult.score,
      max_score: maxScore,
      status: gradingResult.hasPendingEssay ? ('grading' as const) : ('graded' as const),
      tab_switch_count: violationCount,
      teacher_feedback: `[VI PHẠM QUY CHẾ THI] Bài thi bị thu tự động do rời màn hình quá ${allowedLimit} lần.${violationDetail}`,
      answers: submissionAnswers,
    };

    try {
      await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSubmission),
      });
    } catch {}

    MOCK_SUBMISSIONS.unshift(newSubmission as any);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`submission_${newSubId}`, JSON.stringify(newSubmission));
      const mySubmissionsKey = `my_submissions_${studentId}`;
      const existingMySubs = JSON.parse(localStorage.getItem(mySubmissionsKey) || '[]');
      existingMySubs.unshift(newSubmission);
      localStorage.setItem(mySubmissionsKey, JSON.stringify(existingMySubs));

      const allSubsKey = 'lms_all_submissions';
      const existingAllSubs = JSON.parse(localStorage.getItem(allSubsKey) || '[]');
      const filteredAll = existingAllSubs.filter((s: any) => s.id !== newSubId);
      filteredAll.unshift(newSubmission);
      localStorage.setItem(allSubsKey, JSON.stringify(filteredAll));

      broadcastDataChange('SUBMISSIONS_UPDATED', newSubmission);
      broadcastDataChange('EXAMS_UPDATED');
      localStorage.removeItem(storageKey);
    }

    router.push(`/exams/${exam.id}/result/${newSubId}`);
  };

  // Kiểm tra thời gian tối thiểu trước khi mở modal nộp bài
  const handleOpenSubmitModal = () => {
    if (user && isStudent && exam?.submission_restriction === 'min_time') {
      const minMins = exam.submission_min_minutes || 0;
      const elapsedSecs = exam.no_time_limit ? timeLeft : (exam.duration_minutes * 60 - timeLeft);
      const elapsedMins = Math.floor(elapsedSecs / 60);
      if (elapsedMins < minMins) {
        alert(`⚠️ Quy định phòng thi: Chưa đến thời gian được nộp bài!\n\nĐề thi yêu cầu tối thiểu làm bài trong ${minMins} phút.\nThời gian em đã làm: ${elapsedMins} phút ${elapsedSecs % 60} giây.\nVui lòng kiểm tra lại bài và chờ đến khi đủ thời gian quy định.`);
        return;
      }
    }
    setShowSubmitModal(true);
  };

  // Xử lý nộp bài chủ động
  const handleFinalSubmit = async () => {
    if (!exam) return;

    if (user && isStudent && exam.submission_restriction === 'min_time') {
      const minMins = exam.submission_min_minutes || 0;
      const elapsedSecs = exam.no_time_limit ? timeLeft : (exam.duration_minutes * 60 - timeLeft);
      const elapsedMins = Math.floor(elapsedSecs / 60);
      if (elapsedMins < minMins) {
        alert(`⚠️ Quy định phòng thi: Chưa đủ thời gian làm bài tối thiểu (${minMins} phút) để nộp bài!`);
        return;
      }
    }

    setIsSubmitting(true);

    const maxScore = exam.format === 'periodic_4_parts' ? 20.0 : 10.0;
    const gradingResult = gradeExamSubmission(questions, answers, maxScore, {
      trueFalseScoring: exam.true_false_scoring || 'standard_thpt',
      partPoints: exam.part_points,
    });

    const newSubId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : '99999999-9999-9999-9999-999999999999';

    const startTimeIso = exam.no_time_limit
      ? new Date(Date.now() - timeLeft * 1000).toISOString()
      : new Date(Date.now() - (exam.duration_minutes * 60 - timeLeft) * 1000).toISOString();
    const submittedAtIso = new Date().toISOString();
    const studentId = user?.id || '33333333-3333-3333-3333-333333333333';

    // Đính kèm ảnh tự luận vào bài làm
    const submissionAnswers = gradingResult.answers.map((r) => ({
      question_id: r.questionId,
      student_answer: answers[r.questionId],
      essay_images: essayImages[r.questionId] || [],
      is_correct: r.isCorrect ?? undefined,
      earned_points: r.earnedPoints,
      max_points: r.maxPoints,
    }));

    const newSubmission = {
      id: newSubId,
      exam_id: exam.id,
      exam,
      student_id: studentId,
      student: user || undefined,
      attempt_number: 1,
      start_time: startTimeIso,
      submitted_at: submittedAtIso,
      score: gradingResult.score,
      max_score: maxScore,
      status: gradingResult.hasPendingEssay ? ('grading' as const) : ('graded' as const),
      tab_switch_count: tabSwitchCount,
      teacher_feedback: gradingResult.hasPendingEssay
        ? 'Bài thi có câu tự luận (kèm ảnh bài giải viết tay), đang chờ Thầy Sơn chấm điểm chi tiết.'
        : `Hoàn thành toàn bộ bài thi trắc nghiệm. (Số lần chuyển tab giám sát: ${tabSwitchCount})`,
      answers: submissionAnswers,
    };

    // 1. Đồng bộ lên Supabase Cloud API qua /api/submissions (đảm bảo 100% giáo viên nhận được)
    try {
      await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSubmission),
      });
    } catch (err) {
      console.warn('API submission save error:', err);
    }

    MOCK_SUBMISSIONS.unshift(newSubmission as any);

    // 2. Lưu vào localStorage đa người dùng (để cả học sinh và giáo viên cùng xem được tức thì)
    if (typeof window !== 'undefined') {
      localStorage.setItem(`submission_${newSubId}`, JSON.stringify(newSubmission));

      // A. Lưu vào danh sách cá nhân của học sinh
      const mySubmissionsKey = `my_submissions_${studentId}`;
      const existingMySubs = JSON.parse(localStorage.getItem(mySubmissionsKey) || '[]');
      existingMySubs.unshift(newSubmission);
      localStorage.setItem(mySubmissionsKey, JSON.stringify(existingMySubs));

      // B. Lưu vào SỔ ĐIỂM TOÀN TRƯỜNG (lms_all_submissions) để Giáo viên / Admin thấy ngay tức thì!
      const allSubsKey = 'lms_all_submissions';
      const existingAllSubs = JSON.parse(localStorage.getItem(allSubsKey) || '[]');
      const filteredAll = existingAllSubs.filter((s: any) => s.id !== newSubId);
      filteredAll.unshift(newSubmission);
      localStorage.setItem(allSubsKey, JSON.stringify(filteredAll));

      // C. Tự động tăng số lượt làm bài (submissions_count) của đề thi trên card Đề thi
      try {
        const savedExamsRaw = localStorage.getItem('lms_exams');
        if (savedExamsRaw) {
          const listExams = JSON.parse(savedExamsRaw);
          const eIdx = listExams.findIndex((e: any) => e.id === exam.id);
          if (eIdx >= 0) {
            listExams[eIdx].submissions_count = (listExams[eIdx].submissions_count || 0) + 1;
            localStorage.setItem('lms_exams', JSON.stringify(listExams));
          }
        }
      } catch {}

      // D. Phát tín hiệu thời gian thực 0ms tới tất cả các tab của Giáo viên
      broadcastDataChange('SUBMISSIONS_UPDATED', newSubmission);
      broadcastDataChange('EXAMS_UPDATED');

      // Xóa bộ nhớ tạm tiến độ bài thi sau khi nộp thành công
      localStorage.removeItem(storageKey);
    }

    router.push(`/exams/${exam.id}/result/${newSubId}`);
  };

  // 1. Kiểm tra phòng thi chưa mở hoặc đã đóng đối với học sinh
  if (user && isStudent && exam) {
    const now = Date.now();
    const startTimeMs = exam.start_time ? new Date(exam.start_time).getTime() : null;
    const endTimeMs = exam.end_time ? new Date(exam.end_time).getTime() : null;

    if (startTimeMs && now < startTimeMs) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
          <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200 shadow-xl text-center space-y-4">
            <div className="h-14 w-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
              <Clock className="h-7 w-7" />
            </div>
            <h2 className="text-lg font-extrabold text-slate-900">Phòng thi chưa mở</h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              Đề thi <span className="font-bold text-slate-700">"{exam.title}"</span> có lịch mở phòng thi lúc:
              <br />
              <span className="font-bold text-amber-700 text-sm mt-1 inline-block">{new Date(exam.start_time!).toLocaleString('vi-VN')}</span>.
              <br />
              Em vui lòng quay lại khi đến giờ làm bài nhé!
            </p>
            <div className="pt-2">
              <Link
                href="/exams"
                className="inline-block w-full py-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-500 transition shadow-md shadow-blue-500/20"
              >
                Quay lại danh sách đề thi
              </Link>
            </div>
          </div>
        </div>
      );
    }

    if (exam.is_locked || exam.status === 'closed' || (endTimeMs && now > endTimeMs)) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
          <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200 shadow-xl text-center space-y-4">
            <div className="h-14 w-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Lock className="h-7 w-7" />
            </div>
            <h2 className="text-lg font-extrabold text-slate-900">Phòng thi đã đóng</h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              Đề thi <span className="font-bold text-slate-700">"{exam.title}"</span> hiện đang tạm khóa hoặc đã kết thúc thời gian mở thi{endTimeMs ? ` (đóng lúc ${new Date(exam.end_time!).toLocaleString('vi-VN')})` : ''}.
            </p>
            <div className="pt-2">
              <Link
                href="/exams"
                className="inline-block w-full py-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-500 transition shadow-md shadow-blue-500/20"
              >
                Quay lại danh sách đề thi
              </Link>
            </div>
          </div>
        </div>
      );
    }
  }

  // 2. Kiểm tra quyền vào lớp đối với đề thi giới hạn lớp
  if (user && isStudent && exam && !isExamPermittedForStudent(exam, user.id, classes, user.email)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200 shadow-xl text-center space-y-4">
          <div className="h-14 w-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
            <Lock className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-extrabold text-slate-900">Đề thi giới hạn lớp học</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Đề thi <span className="font-bold text-slate-700">"{exam.title}"</span> chỉ dành riêng cho học sinh thuộc các lớp được phân công ({exam.assigned_classes?.join(', ') || 'lớp chuyên'}).
            <br />
            Tài khoản của em hiện chưa được duyệt vào lớp để tham gia đề thi này.
          </p>
          <div className="pt-2 flex flex-col gap-2">
            <Link
              href="/"
              className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-500 transition shadow-md shadow-blue-500/20"
            >
              Nhập mã lớp để kích hoạt tài khoản
            </Link>
            <Link
              href="/exams"
              className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition"
            >
              Quay lại danh sách đề thi
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (notFound && (!exam || questions.length === 0)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center space-y-4">
        <div className="h-14 w-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <h2 className="text-lg font-bold text-slate-800">Không tìm thấy đề thi này</h2>
        <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
          Đề thi này không còn khả dụng hoặc Thầy Sơn vừa cập nhật đề mới. Em vui lòng bấm nút bên dưới để quay lại danh sách đề thi nhé!
        </p>
        <Link
          href="/exams"
          className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition shadow-md shadow-blue-500/20"
        >
          Về danh sách đề thi
        </Link>
      </div>
    );
  }

  if (!exam || questions.length === 0 || !currentQ) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center space-y-4">
        <div className="h-10 w-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <div>
          <h2 className="text-base font-bold text-slate-800">Đang chuẩn bị đề thi...</h2>
          <p className="text-xs text-slate-500 mt-1">Đang nạp toàn bộ câu hỏi và công thức Toán từ máy chủ...</p>
        </div>
        <div className="pt-2 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition cursor-pointer shadow-sm"
          >
            Tải lại
          </button>
          <Link
            href="/exams"
            className="px-4 py-2 border border-slate-200 bg-white text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 transition"
          >
            Về danh sách đề
          </Link>
        </div>
      </div>
    );
  }

  const isLowTime = !exam?.no_time_limit && timeLeft < 300; // Dưới 5 phút (chỉ kích hoạt khi có giới hạn thời gian)

  // Thông tin từng Phần (Tự động nhận diện chuẩn Bộ GD&ĐT 2025 kể cả khi đề nhập thô)
  const getPartDetails = (q: Question, idx?: number) => {
    let p = q.part;
    if (!p) {
      if (q.type === 'true_false') {
        p = 2;
      } else if (q.type === 'short_answer') {
        p = 3;
      } else if (q.type === 'essay') {
        p = 4;
      } else if (typeof idx === 'number') {
        // Tự động phân phần chuẩn THPT 2025: Câu 1-12 là Phần I, 13-16 là Phần II, 17-22 là Phần III
        if (idx < 12) p = 1;
        else if (idx < 16) p = 2;
        else if (idx < 22) p = 3;
        else p = 4;
      } else {
        p = 1;
      }
    }
    if (p === 1) {
      return {
        part: 1,
        badge: 'PHẦN I',
        title: 'CÂU TRẮC NGHIỆM NHIỀU PHƯƠNG ÁN LỰA CHỌN',
        sub: 'Thí sinh trả lời từ câu 1 đến câu tương ứng. Mỗi câu hỏi chỉ chọn một phương án. (0.25đ/câu)',
        theme: 'blue',
      };
    }
    if (p === 2) {
      return {
        part: 2,
        badge: 'PHẦN II',
        title: 'CÂU TRẮC NGHIỆM ĐÚNG SAI',
        sub: 'Trong mỗi ý a), b), c), d) ở mỗi câu, thí sinh chọn Đúng hoặc Sai. Chuẩn Bộ GD&ĐT: 1 ý=0.1đ • 2 ý=0.25đ • 3 ý=0.5đ • 4 ý=1.0đ.',
        theme: 'indigo',
      };
    }
    if (p === 3) {
      return {
        part: 3,
        badge: 'PHẦN III',
        title: 'CÂU TRẮC NGHIỆM TRẢ LỜI NGẮN',
        sub: 'Thí sinh điền đáp số vào ô trống (chấp nhận số thập phân 2.25 hoặc 2,25, phân số 9/4). (0.5đ/câu)',
        theme: 'amber',
      };
    }
    return {
      part: 4,
      badge: 'PHẦN IV',
      title: 'BÀI TẬP TỰ LUẬN VẬN DỤNG CAO',
      sub: 'Thí sinh trình bày chi tiết lời giải hoặc chụp ảnh bài giải viết tay trên giấy nộp cho Thầy Sơn.',
      theme: 'emerald',
    };
  };

  // Lọc danh sách câu hỏi cho Sidebar
  const filteredQuestionList = questions
    .map((q, idx) => ({ q, idx }))
    .filter(({ q }) => {
      if (filterMode === 'unanswered') return !isQuestionAnswered(q);
      if (filterMode === 'flagged') return !!flagged[q.id];
      return true;
    });

  const fontSizeClass =
    fontSize === 'sm'
      ? 'text-base sm:text-[17px]'
      : fontSize === 'base'
      ? 'text-[17.5px] sm:text-[18.5px]'
      : fontSize === 'lg'
      ? 'text-[19.5px] sm:text-[21px]'
      : 'text-[22px] sm:text-[24px]';

  // Render các ô điều khiển đáp án cho từng câu
  const renderAnswerControls = (q: Question) => {
    return (
      <div className="mt-6 space-y-4">
        {/* 1. Trắc nghiệm 1 đáp án (Phần I) */}
        {q.type === 'single_choice' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {q.options?.map((opt: any) => {
              const isSelected = answers[q.id] === opt.id;
              return (
                <label
                  key={opt.id}
                  onClick={() => handleSingleChoiceSelect(q.id, opt.id)}
                  className={`flex items-start gap-3.5 rounded-2xl border p-4 cursor-pointer transition select-none ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-500/20 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/60 bg-white'
                  }`}
                >
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs sm:text-sm font-bold transition mt-0.5 ${
                      isSelected
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-slate-300 text-slate-600 bg-slate-50'
                    }`}
                  >
                    {opt.id}
                  </div>
                  <div className="flex-1 text-slate-800 text-[15.5px] sm:text-[16.5px] leading-relaxed">
                    <MathRenderer content={opt.text} />
                  </div>
                </label>
              );
            })}
          </div>
        )}

        {/* 2. Trắc nghiệm nhiều lựa chọn */}
        {q.type === 'multiple_choice' && (
          <div className="space-y-3">
            <div className="text-xs font-semibold text-blue-600">* Chọn tất cả các phương án đúng:</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {q.options?.map((opt: any) => {
                const isSelected = (answers[q.id] || []).includes(opt.id);
                return (
                  <label
                    key={opt.id}
                    onClick={() => handleMultipleChoiceToggle(q.id, opt.id)}
                    className={`flex items-start gap-3.5 rounded-2xl border p-4 cursor-pointer transition select-none ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-500/20 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/60 bg-white'
                    }`}
                  >
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-xs sm:text-sm font-bold transition mt-0.5 ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-600 text-white'
                          : 'border-slate-300 text-slate-600 bg-slate-50'
                      }`}
                    >
                      {opt.id}
                    </div>
                    <div className="flex-1 text-slate-800 text-[15.5px] sm:text-[16.5px] leading-relaxed">
                      <MathRenderer content={opt.text} />
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* 3. Trắc nghiệm Đúng / Sai (Phần II) */}
        {q.type === 'true_false' && (
          <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-2xs">
            <table className="w-full text-left text-sm sm:text-base border-collapse bg-white">
              <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">Ý</th>
                  <th className="py-3 px-4">Nội dung mệnh đề</th>
                  <th className="py-3 px-4 w-28 text-center">Đúng</th>
                  <th className="py-3 px-4 w-28 text-center">Sai</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {q.options?.map((stmt: any) => {
                  const val = (answers[q.id] || {})[stmt.id];
                  return (
                    <tr key={stmt.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-center text-slate-700 uppercase text-sm sm:text-base">
                        {stmt.id})
                      </td>
                      <td className="py-3.5 px-4 text-slate-800 text-[15.5px] sm:text-[16.5px] leading-relaxed">
                        <MathRenderer content={stmt.text} />
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleTrueFalseSelect(q.id, stmt.id, true)}
                          className={`h-9 w-20 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
                            val === true
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          Đúng
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleTrueFalseSelect(q.id, stmt.id, false)}
                          className={`h-9 w-20 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
                            val === false
                              ? 'bg-rose-600 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          Sai
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 4. Trắc nghiệm Trả lời ngắn / Điền số (Phần III) */}
        {q.type === 'short_answer' && (
          <div className="space-y-3 bg-slate-50 p-5 rounded-2xl border border-slate-200">
            <label className="block text-xs font-semibold text-slate-700">
              Nhập đáp số (hỗ trợ số nguyên, số thập phân như <code className="text-blue-700 font-mono">2.25</code> hoặc <code className="text-blue-700 font-mono">2,25</code>, phân số <code className="text-blue-700 font-mono">9/4</code>):
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="text"
                value={answers[q.id] || ''}
                onChange={(e) => handleShortAnswerChange(q.id, e.target.value)}
                placeholder="Nhập kết quả..."
                className="w-full max-w-sm rounded-xl border border-slate-300 bg-white p-3.5 text-lg font-bold text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none"
              />
              {answers[q.id] && (
                <div className="rounded-xl bg-white px-3.5 py-2.5 border border-slate-200 text-sm text-slate-700 flex items-center gap-2">
                  <span className="font-semibold text-xs text-slate-500">Xem trước:</span>
                  <MathRenderer content={`$${answers[q.id]}$`} inline />
                </div>
              )}
            </div>
          </div>
        )}

        {/* 5. Tự luận & Chụp ảnh bài giải viết tay (Phần IV) */}
        {q.type === 'essay' && (
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="block text-xs font-bold text-slate-800">
                Trình bày bài giải (Gõ công thức LaTeX hoặc Tải ảnh bài viết tay):
              </label>
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-slate-400 text-[11px] mr-1">Chèn nhanh:</span>
                {[
                  { label: 'Phân số', val: '$\\frac{a}{b}$' },
                  { label: 'Căn', val: '$\\sqrt{x}$' },
                  { label: 'Tích phân', val: '$\\int_{0}^{1} f(x)\\,\\mathrm{d}x$' },
                  { label: 'Giới hạn', val: '$\\lim_{x\\to 3}$' },
                  { label: 'Hệ PT', val: '$\\heva{x+y=1 \\\\ x-y=2}$' },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => handleInsertMathToEssay(item.val, q.id)}
                    className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition cursor-pointer"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              rows={6}
              value={answers[q.id] || ''}
              onChange={(e) => handleEssayChange(q.id, e.target.value)}
              placeholder="Gõ lời giải, lập luận và các bước tính toán tại đây..."
              className="w-full rounded-2xl border border-slate-300 bg-white p-4 text-sm text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none font-mono"
            />

            {/* Xem trước KaTeX */}
            {answers[q.id] && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-1">
                <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                  Xem Trước Lời Giải (KaTeX):
                </div>
                <div className="text-sm text-slate-800 pt-1">
                  <MathRenderer content={answers[q.id]} />
                </div>
              </div>
            )}

            {/* Khu vực chụp ảnh / tải ảnh bài giải viết tay (Chuẩn Azota) */}
            <div className="border-t border-slate-200 pt-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-blue-600" />
                  <span className="text-xs font-bold text-slate-800">
                    Ảnh chụp bài làm viết tay ({((essayImages[q.id] || []).length)} ảnh)
                  </span>
                </div>
                <label className="flex items-center gap-2 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 transition cursor-pointer shadow-xs active:scale-95">
                  <Upload className="h-3.5 w-3.5" />
                  <span>Chụp ảnh / Tải ảnh lên</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => handleUploadEssayImage(q.id, e.target.files)}
                  />
                </label>
              </div>

              {/* Thumbnails danh sách ảnh đã tải */}
              {(essayImages[q.id] || []).length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  {(essayImages[q.id] || []).map((imgUrl, imgIdx) => (
                    <div
                      key={imgIdx}
                      className="group relative rounded-xl border border-slate-200 bg-white p-1 overflow-hidden shadow-2xs"
                    >
                      <img
                        src={imgUrl}
                        alt={`Trang ${imgIdx + 1}`}
                        className="h-28 w-full object-cover rounded-lg cursor-pointer"
                        onClick={() => setPreviewImage(imgUrl)}
                      />
                      <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 rounded-xl">
                        <button
                          type="button"
                          onClick={() => setPreviewImage(imgUrl)}
                          className="p-1.5 bg-white text-slate-800 rounded-lg hover:bg-blue-50 transition"
                          title="Xem ảnh lớn"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveEssayImage(q.id, imgIdx)}
                          className="p-1.5 bg-rose-600 text-white rounded-lg hover:bg-rose-500 transition"
                          title="Xóa ảnh"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="text-[10px] text-center font-semibold text-slate-500 py-0.5">
                        Trang {imgIdx + 1}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className="space-y-6 select-none"
      onContextMenu={(e) => e.preventDefault()}
      onCopy={(e) => e.preventDefault()}
    >
      {/* 1. THANH ĐIỀU KHIỂN & ĐỒNG HỒ TRÊN CÙNG (Sticky TopBar) */}
      <div className="sticky top-3 z-40 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-white/95 px-6 py-3.5 shadow-sm backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700">
              Lớp {exam.grade}
            </span>
            <span className="rounded-lg bg-purple-100 px-2 py-0.5 text-[11px] font-bold text-purple-700">
              {exam.format === 'periodic_4_parts' ? 'Đề 4 Phần Chuẩn THPT' : 'Đề Thi Chuẩn Bộ'}
            </span>
          </div>

          <div className="h-4 w-px bg-slate-200 hidden sm:block" />

          {/* Chế độ làm bài: Đề PDF tự động hoặc Bộ chọn cho đề tương tác */}
          {isPdfExam ? (
            <div className="flex items-center gap-1.5 rounded-xl bg-rose-50 border border-rose-200 px-3 py-1 text-xs font-bold text-rose-700 shadow-2xs">
              <FileText className="h-3.5 w-3.5 text-rose-600" />
              <span>Chế Độ Thi Đề PDF</span>
            </div>
          ) : (
            <div className="flex items-center rounded-xl bg-slate-100 p-1 text-xs font-bold text-slate-600">
              <button
                type="button"
                onClick={() => setViewMode('scroll')}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 transition cursor-pointer ${
                  viewMode === 'scroll'
                    ? 'bg-white text-blue-600 shadow-2xs font-extrabold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="h-3.5 w-3.5" />
                <span>Toàn bộ đề</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('focus')}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 transition cursor-pointer ${
                  viewMode === 'focus'
                    ? 'bg-white text-blue-600 shadow-2xs font-extrabold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ListOrdered className="h-3.5 w-3.5" />
                <span>Từng câu</span>
              </button>
            </div>
          )}

          {/* Bộ chỉnh cỡ chữ A- / A+ */}
          <div className="flex items-center rounded-xl bg-slate-100 p-1 text-xs font-bold text-slate-600">
            <button
              type="button"
              onClick={() => setFontSize('sm')}
              className={`px-2 py-0.5 rounded-md ${fontSize === 'sm' ? 'bg-white text-blue-600 font-black' : ''}`}
              title="Cỡ chữ nhỏ"
            >
              A-
            </button>
            <button
              type="button"
              onClick={() => setFontSize('base')}
              className={`px-2 py-0.5 rounded-md ${fontSize === 'base' ? 'bg-white text-blue-600 font-black' : ''}`}
              title="Cỡ chữ chuẩn"
            >
              A
            </button>
            <button
              type="button"
              onClick={() => setFontSize('lg')}
              className={`px-2 py-0.5 rounded-md ${fontSize === 'lg' ? 'bg-white text-blue-600 font-black' : ''}`}
              title="Cỡ chữ lớn"
            >
              A+
            </button>
          </div>
        </div>

        {/* Công cụ bổ trợ: Máy tính, Sổ tay công thức, Toàn màn hình, Đếm ngược & Nộp bài */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Nút mở máy tính THPT */}
          <button
            type="button"
            onClick={() => setIsCalculatorOpen(true)}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-blue-300 hover:bg-blue-50/50 hover:text-blue-700 transition cursor-pointer"
            title="Mở máy tính khoa học mini"
          >
            <CalcIcon className="h-4 w-4 text-cyan-600" />
            <span className="hidden sm:inline">Máy tính</span>
          </button>

          {/* Nút mở sổ tay công thức */}
          <button
            type="button"
            onClick={() => setIsFormulaSheetOpen(true)}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-blue-300 hover:bg-blue-50/50 hover:text-blue-700 transition cursor-pointer"
            title="Tra cứu công thức Toán THPT"
          >
            <BookOpen className="h-4 w-4 text-indigo-600" />
            <span className="hidden sm:inline">Công thức</span>
          </button>

          {/* Toàn màn hình */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 transition cursor-pointer"
            title={isFullscreen ? 'Thoát toàn màn hình' : 'Bật toàn màn hình thi'}
          >
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </button>

          {/* Đồng hồ thời gian */}
          <div
            className={`flex items-center gap-2 rounded-xl px-3.5 py-1.5 font-mono font-bold text-xs sm:text-sm border transition ${
              exam?.no_time_limit
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : isLowTime
                ? 'border-rose-300 bg-rose-50 text-rose-600 animate-pulse'
                : 'border-slate-200 bg-slate-50 text-slate-800'
            }`}
            title={exam?.no_time_limit ? 'Thời gian làm bài (Không giới hạn)' : 'Thời gian còn lại'}
          >
            <Clock className={`h-4 w-4 ${exam?.no_time_limit ? 'text-emerald-600' : isLowTime ? 'text-rose-600' : 'text-blue-600'}`} />
            <span>{formatTime(timeLeft)}</span>
            {exam?.no_time_limit && (
              <span className="text-[10px] font-sans font-medium text-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 rounded">Tự do</span>
            )}
          </div>

          {/* Nút nộp bài */}
          <button
            type="button"
            onClick={handleOpenSubmitModal}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs sm:text-sm font-bold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-500 transition active:scale-95 cursor-pointer"
          >
            <Send className="h-4 w-4" />
            <span>Nộp bài</span>
          </button>
        </div>
      </div>

      {/* Dòng trạng thái tự động lưu & Thông tin thí sinh */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-2 text-[11px] text-slate-500">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 font-medium text-slate-700">
            <span>Thí sinh: <strong className="text-slate-900">{user?.full_name || 'Học sinh'}</strong></span>
            {user?.candidate_number && (
              <span className="font-mono font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md text-[10px]">
                SBD: {user.candidate_number}
              </span>
            )}
          </div>
          <span className="text-slate-300 hidden sm:inline">•</span>
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span>
              Tự động lưu bài {lastSavedTime ? `(vừa lưu ${lastSavedTime})` : 'liên tục'} • Không lo mất bài khi F5
            </span>
          </div>
        </div>
        {tabSwitchCount > 0 && (
          <div className="flex items-center gap-1.5 text-amber-600 font-semibold">
            <ShieldAlert className="h-3.5 w-3.5" />
            <span>Giám sát: Đã phát hiện rời tab {tabSwitchCount} lần</span>
          </div>
        )}
      </div>

      {isPdfExam || viewMode === 'pdf' ? (
        /* CHẾ ĐỘ ĐỀ PDF: PHẦN TO ĐÙNG Ở GIỮA/TRÁI LÀ ĐỀ (67%), PHẦN CHỌN ĐÁP ÁN CHO SANG BÊN PHẢI (33%) */
        <div className="space-y-4">
          {/* Mobile Switcher Tab (Chỉ hiện trên điện thoại / tablet nhỏ) */}
          <div className="lg:hidden flex items-center justify-between rounded-2xl bg-slate-100 p-1.5 text-xs font-bold">
            <button
              type="button"
              onClick={() => setPdfMobileTab('pdf')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl transition cursor-pointer ${
                pdfMobileTab === 'pdf'
                  ? 'bg-rose-600 text-white shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="h-4 w-4" />
              <span>Xem Đề PDF</span>
            </button>
            <button
              type="button"
              onClick={() => setPdfMobileTab('answers')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl transition cursor-pointer ${
                pdfMobileTab === 'answers'
                  ? 'bg-blue-600 text-white shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CheckCircle className="h-4 w-4" />
              <span>Phiếu Tô Đáp Án ({answeredCount}/{questions.length})</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* CỘT TRÁI TO ĐÙNG (8 Cột = 66.7%): KHUNG ĐỌC ĐỀ PDF */}
            <div className={`lg:col-span-8 xl:col-span-8 ${pdfMobileTab === 'pdf' ? 'block' : 'hidden lg:block'}`}>
              <div className="sticky top-20 rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden p-2">
                {loadedPdfUrl || exam.pdf_url ? (
                  <PdfExamViewer
                    pdfUrl={loadedPdfUrl || exam.pdf_url || ''}
                    title={exam.title}
                    className="h-[calc(100vh-140px)] min-h-[640px]"
                  />
                ) : (
                  <div className="h-[640px] flex flex-col items-center justify-center text-slate-400 gap-3">
                    <FileText className="h-12 w-12 text-slate-300 animate-pulse" />
                    <p className="text-sm font-semibold">Đang nạp file đề PDF...</p>
                  </div>
                )}
              </div>
            </div>

            {/* CỘT PHẢI (4 Cột = 33.3%): PHIẾU TÔ / CHỌN ĐÁP ÁN BÊN PHẢI */}
            <div className={`lg:col-span-4 xl:col-span-4 ${pdfMobileTab === 'answers' ? 'block' : 'hidden lg:block'}`}>
              <div className="sticky top-20 max-h-[calc(100vh-120px)] flex flex-col rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                {/* Header Phiếu */}
                <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-blue-50/50 p-4 shrink-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-extrabold text-sm sm:text-base text-slate-900 flex items-center gap-2">
                        <FileText className="h-4 w-4 text-blue-600" />
                        PHIẾU TRẢ LỜI BÀI THI
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Đọc câu hỏi trên file PDF và chọn / điền đáp án tương ứng
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="inline-block rounded-xl bg-blue-600 px-3 py-1 text-xs font-black text-white shadow-2xs">
                        {answeredCount}/{questions.length} câu
                      </span>
                    </div>
                  </div>

                  {/* Thanh Tiến Độ */}
                  <div className="mt-3 w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${(answeredCount / Math.max(1, questions.length)) * 100}%` }}
                    />
                  </div>

                  {/* Quick question pill bar */}
                  <div className="mt-3 flex flex-wrap gap-1 max-h-20 overflow-y-auto pr-1">
                    {questions.map((q, qIdx) => {
                      const isDone = isQuestionAnswered(q);
                      const isFlag = flagged[q.id];
                      return (
                        <button
                          key={q.id}
                          type="button"
                          onClick={() => {
                            const el = document.getElementById(`omr-q-${q.id}`);
                            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }}
                          className={`h-6 min-w-[24px] px-1 text-[11px] font-bold rounded-md transition cursor-pointer ${
                            isFlag
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : isDone
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                          }`}
                          title={`Câu ${qIdx + 1}: ${isDone ? 'Đã làm' : 'Chưa làm'}`}
                        >
                          {qIdx + 1}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Danh Sách Các Phần Trong Phiếu */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-6">
                  {/* PHẦN I */}
                  {part1Questions.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b border-blue-100 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="rounded-lg bg-blue-600 text-white px-2 py-0.5 text-xs font-black">
                            PHẦN I
                          </span>
                          <span className="font-bold text-xs text-slate-800">
                            TRẮC NGHIỆM ({part1Questions.length} câu • 0.25đ/câu)
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {part1Questions.map((q) => {
                          const globalIdx = questions.findIndex((item) => item.id === q.id) + 1;
                          const selectedVal = answers[q.id];
                          const isFlag = flagged[q.id];

                          return (
                            <div
                              key={q.id}
                              id={`omr-q-${q.id}`}
                              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-2.5 hover:border-blue-300 hover:bg-blue-50/20 transition"
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs text-slate-800 w-14">
                                  Câu {globalIdx}:
                                </span>
                                <button
                                  type="button"
                                  onClick={() => toggleFlag(q.id)}
                                  className={`p-1 rounded-md transition ${isFlag ? 'text-amber-500' : 'text-slate-300 hover:text-slate-500'}`}
                                  title="Cắm cờ"
                                >
                                  <Flag className="h-3.5 w-3.5 fill-current" />
                                </button>
                              </div>

                              <div className="flex items-center gap-1.5 sm:gap-2">
                                {['A', 'B', 'C', 'D'].map((opt) => {
                                  const isChecked = selectedVal === opt;
                                  return (
                                    <button
                                      key={opt}
                                      type="button"
                                      onClick={() => handleSingleChoiceSelect(q.id, opt)}
                                      className={`h-8 w-8 sm:h-9 sm:w-9 rounded-full text-xs font-bold transition flex items-center justify-center cursor-pointer ${
                                        isChecked
                                          ? 'bg-blue-600 text-white ring-2 ring-blue-300 font-black shadow-xs scale-105'
                                          : 'border border-slate-300 text-slate-700 bg-slate-50 hover:border-blue-400 hover:bg-white'
                                      }`}
                                    >
                                      {opt}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* PHẦN II */}
                  {part2Questions.length > 0 && (
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="rounded-lg bg-indigo-600 text-white px-2 py-0.5 text-xs font-black">
                            PHẦN II
                          </span>
                          <span className="font-bold text-xs text-slate-800">
                            TRẮC NGHIỆM ĐÚNG SAI ({part2Questions.length} câu)
                          </span>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {part2Questions.map((q) => {
                          const globalIdx = questions.findIndex((item) => item.id === q.id) + 1;
                          const currentTfAnswers = answers[q.id] || {};
                          const isFlag = flagged[q.id];

                          return (
                            <div
                              key={q.id}
                              id={`omr-q-${q.id}`}
                              className="rounded-2xl border border-slate-200 bg-white p-3 space-y-2"
                            >
                              <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                                <span className="font-bold text-xs text-slate-900">
                                  Câu {globalIdx} (Đúng / Sai 4 ý):
                                </span>
                                <button
                                  type="button"
                                  onClick={() => toggleFlag(q.id)}
                                  className={`p-1 rounded-md transition ${isFlag ? 'text-amber-500' : 'text-slate-300 hover:text-slate-500'}`}
                                  title="Cắm cờ"
                                >
                                  <Flag className="h-3.5 w-3.5 fill-current" />
                                </button>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {['a', 'b', 'c', 'd'].map((sub) => {
                                  const val = currentTfAnswers[sub];
                                  return (
                                    <div
                                      key={sub}
                                      className="flex items-center justify-between bg-slate-50 rounded-xl px-2.5 py-1.5 border border-slate-200"
                                    >
                                      <span className="text-xs font-bold text-slate-700 uppercase">
                                        Ý {sub})
                                      </span>
                                      <div className="flex items-center gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => handleTrueFalseSelect(q.id, sub, true)}
                                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                                            val === true
                                              ? 'bg-emerald-600 text-white ring-1 ring-emerald-300 shadow-2xs font-extrabold'
                                              : 'bg-white border border-slate-200 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
                                          }`}
                                        >
                                          Đúng
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleTrueFalseSelect(q.id, sub, false)}
                                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                                            val === false
                                              ? 'bg-rose-600 text-white ring-1 ring-rose-300 shadow-2xs font-extrabold'
                                              : 'bg-white border border-slate-200 text-slate-600 hover:bg-rose-50 hover:text-rose-700'
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
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* PHẦN III */}
                  {part3Questions.length > 0 && (
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between border-b border-amber-100 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="rounded-lg bg-amber-600 text-white px-2 py-0.5 text-xs font-black">
                            PHẦN III
                          </span>
                          <span className="font-bold text-xs text-slate-800">
                            TRẢ LỜI NGẮN ({part3Questions.length} câu • 0.5đ/câu)
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2.5">
                        {part3Questions.map((q) => {
                          const globalIdx = questions.findIndex((item) => item.id === q.id) + 1;
                          const currentVal = answers[q.id] || '';
                          const isFlag = flagged[q.id];

                          return (
                            <div
                              key={q.id}
                              id={`omr-q-${q.id}`}
                              className="rounded-2xl border border-slate-200 bg-white p-3 space-y-2"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-xs text-slate-900">
                                  Câu {globalIdx} (Điền kết quả số):
                                </span>
                                <button
                                  type="button"
                                  onClick={() => toggleFlag(q.id)}
                                  className={`p-1 rounded-md transition ${isFlag ? 'text-amber-500' : 'text-slate-300 hover:text-slate-500'}`}
                                  title="Cắm cờ"
                                >
                                  <Flag className="h-3.5 w-3.5 fill-current" />
                                </button>
                              </div>

                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={currentVal}
                                  onChange={(e) => handleShortAnswerChange(q.id, e.target.value)}
                                  placeholder="Điền đáp số (VD: 1440 hoặc -2.5 hoặc 3/4)..."
                                  className="flex-1 font-mono font-bold text-sm text-slate-900 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (currentVal.startsWith('-')) {
                                      handleShortAnswerChange(q.id, currentVal.slice(1));
                                    } else {
                                      handleShortAnswerChange(q.id, '-' + currentVal);
                                    }
                                  }}
                                  className="rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs font-mono font-bold text-slate-700 hover:bg-slate-100"
                                  title="Thêm/Bỏ dấu trừ (-)"
                                >
                                  ±
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* PHẦN IV (Tự luận nếu có) */}
                  {part4Questions.length > 0 && (
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between border-b border-emerald-100 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="rounded-lg bg-emerald-600 text-white px-2 py-0.5 text-xs font-black">
                            PHẦN IV
                          </span>
                          <span className="font-bold text-xs text-slate-800">
                            TỰ LUẬN ({part4Questions.length} câu)
                          </span>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {part4Questions.map((q) => {
                          const globalIdx = questions.findIndex((item) => item.id === q.id) + 1;
                          return (
                            <div key={q.id} id={`omr-q-${q.id}`} className="rounded-2xl border border-slate-200 bg-white p-3 space-y-2">
                              <span className="font-bold text-xs text-slate-900">Câu {globalIdx} (Tự luận):</span>
                              {renderAnswerControls(q)}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Phiếu: Nút nộp bài trực tiếp */}
                <div className="border-t border-slate-200 bg-slate-50 p-4 shrink-0 flex items-center justify-between gap-3">
                  <div className="text-xs text-slate-500">
                    <span className="font-bold text-slate-900">{answeredCount}/{questions.length}</span> câu đã hoàn thành
                  </div>
                  <button
                    type="button"
                    onClick={handleOpenSubmitModal}
                    className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-500 transition cursor-pointer active:scale-95"
                  >
                    <Send className="h-4 w-4" />
                    <span>Nộp Bài Thi Ngay</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* KHU VỰC NỘI DUNG ĐỀ THI (3 Cột) */}
        <div className="lg:col-span-3 space-y-6">
          {/* CHẾ ĐỘ 1: CUỘN TOÀN BỘ ĐỀ (Scroll View - Giống đề thi giấy Azota) */}
          {viewMode === 'scroll' ? (
            <div className="space-y-6">
              {questions.map((q, idx) => {
                const partInfo = getPartDetails(q, idx);
                // Hiển thị banner đầu Phần nếu là câu đầu tiên của Phần đó
                const isFirstOfPart =
                  idx === 0 ||
                  (getPartDetails(questions[idx - 1], idx - 1).part !== partInfo.part);

                return (
                  <div key={q.id} id={`q-card-${q.id}`} className="space-y-4">
                    {isFirstOfPart && (
                      <div
                        className={`rounded-2xl border p-4 shadow-2xs ${
                          partInfo.theme === 'blue'
                            ? 'border-blue-200 bg-gradient-to-r from-blue-50 to-cyan-50'
                            : partInfo.theme === 'indigo'
                            ? 'border-indigo-200 bg-gradient-to-r from-indigo-50 to-purple-50'
                            : partInfo.theme === 'amber'
                            ? 'border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50'
                            : 'border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-lg px-2.5 py-0.5 text-xs font-black uppercase text-white ${
                              partInfo.theme === 'blue'
                                ? 'bg-blue-600'
                                : partInfo.theme === 'indigo'
                                ? 'bg-indigo-600'
                                : partInfo.theme === 'amber'
                                ? 'bg-amber-600'
                                : 'bg-emerald-600'
                            }`}
                          >
                            {partInfo.badge}
                          </span>
                          <h2 className="font-bold text-sm text-slate-900">{partInfo.title}</h2>
                        </div>
                        <p className="text-xs text-slate-600 mt-1">{partInfo.sub}</p>
                      </div>
                    )}

                    <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
                      {/* Tiêu đề câu hỏi */}
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-5">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold text-white shadow-2xs">
                            {idx + 1}
                          </span>
                          <div>
                            <span className="text-xs font-bold text-slate-900">Câu {idx + 1}</span>
                            <span className="text-xs text-slate-400 ml-2">
                              ({q.points} điểm • {q.topic || 'Toán THPT'})
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => toggleFlag(q.id)}
                          className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium border transition cursor-pointer ${
                            flagged[q.id]
                              ? 'border-amber-300 bg-amber-50 text-amber-700'
                              : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                          }`}
                        >
                          <Flag className="h-3.5 w-3.5" />
                          <span>{flagged[q.id] ? 'Đã cắm cờ' : 'Cắm cờ'}</span>
                        </button>
                      </div>

                      {/* Nội dung câu hỏi KaTeX */}
                      <div className={`${fontSizeClass} text-slate-900 leading-relaxed font-medium`}>
                        <MathRenderer content={q.content} />
                      </div>

                      {/* Các lựa chọn đáp án */}
                      {renderAnswerControls(q)}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* CHẾ ĐỘ 2: TẬP TRUNG TỪNG CÂU (Focus Mode) */
            <div className="space-y-6">
              {/* Section Indicator Banner */}
              {(() => {
                const partInfo = getPartDetails(currentQ, currentIndex);
                return (
                  <div
                    className={`rounded-2xl border p-4 shadow-2xs ${
                      partInfo.theme === 'blue'
                        ? 'border-blue-200 bg-gradient-to-r from-blue-50 to-cyan-50'
                        : partInfo.theme === 'indigo'
                        ? 'border-indigo-200 bg-gradient-to-r from-indigo-50 to-purple-50'
                        : partInfo.theme === 'amber'
                        ? 'border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50'
                        : 'border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-lg px-2.5 py-0.5 text-xs font-black uppercase text-white ${
                          partInfo.theme === 'blue'
                            ? 'bg-blue-600'
                            : partInfo.theme === 'indigo'
                            ? 'bg-indigo-600'
                            : partInfo.theme === 'amber'
                            ? 'bg-amber-600'
                            : 'bg-emerald-600'
                        }`}
                      >
                        {partInfo.badge}
                      </span>
                      <h2 className="font-bold text-sm text-slate-900">{partInfo.title}</h2>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">{partInfo.sub}</p>
                  </div>
                );
              })()}

              <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
                {/* Header Câu hiện tại */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-sm font-bold text-white shadow-xs">
                      {currentIndex + 1}
                    </span>
                    <div>
                      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        {currentQ.type === 'single_choice' && 'Trắc nghiệm 1 đáp án'}
                        {currentQ.type === 'multiple_choice' && 'Trắc nghiệm nhiều đáp án'}
                        {currentQ.type === 'true_false' && 'Đúng/Sai 4 ý chuẩn THPT'}
                        {currentQ.type === 'short_answer' && 'Điền kết quả ngắn'}
                        {currentQ.type === 'essay' && 'Tự luận trình bày & chụp ảnh'}
                      </div>
                      <div className="text-xs text-slate-500">
                        Chủ đề: {currentQ.topic || 'Toán THPT'} • {currentQ.points} điểm
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleFlag(currentQ.id)}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border transition cursor-pointer ${
                      flagged[currentQ.id]
                        ? 'border-amber-300 bg-amber-50 text-amber-700'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <Flag className="h-3.5 w-3.5" />
                    <span>{flagged[currentQ.id] ? 'Đã cắm cờ' : 'Cắm cờ xem lại'}</span>
                  </button>
                </div>

                {/* Nội dung câu hỏi KaTeX */}
                <div className={`${fontSizeClass} text-slate-900 leading-relaxed font-medium`}>
                  <MathRenderer content={currentQ.content} />
                </div>

                {/* Answer Controls */}
                {renderAnswerControls(currentQ)}

                {/* Thanh chuyển câu trước / câu sau */}
                <div className="mt-10 pt-6 border-t border-slate-100 flex items-center justify-between gap-4">
                  <button
                    type="button"
                    disabled={currentIndex === 0}
                    onClick={() => jumpToQuestion(Math.max(0, currentIndex - 1), questions[Math.max(0, currentIndex - 1)].id)}
                    className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span>Câu trước</span>
                  </button>

                  <div className="text-xs font-medium text-slate-500">
                    Câu {currentIndex + 1} / {questions.length}
                  </div>

                  <button
                    type="button"
                    disabled={currentIndex === questions.length - 1}
                    onClick={() => jumpToQuestion(Math.min(questions.length - 1, currentIndex + 1), questions[Math.min(questions.length - 1, currentIndex + 1)].id)}
                    className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer shadow-xs"
                  >
                    <span>Câu sau</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 2. BẢNG SỐ CÂU HỎI & PHIẾU TÔ ĐÁP ÁN NỔI (1 Cột Sticky) */}
        <div className="sticky top-32 space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900">Bảng Số Câu Hỏi</h3>
              <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100">
                {answeredCount}/{questions.length} câu
              </span>
            </div>

            {/* Bộ lọc câu hỏi */}
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 text-[11px] font-bold text-slate-600">
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className={`py-1 rounded-lg transition ${
                  filterMode === 'all' ? 'bg-white text-blue-600 shadow-2xs font-extrabold' : ''
                }`}
              >
                Tất cả ({questions.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('unanswered')}
                className={`py-1 rounded-lg transition ${
                  filterMode === 'unanswered' ? 'bg-white text-rose-600 shadow-2xs font-extrabold' : ''
                }`}
              >
                Chưa làm ({questions.length - answeredCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('flagged')}
                className={`py-1 rounded-lg transition ${
                  filterMode === 'flagged' ? 'bg-white text-amber-600 shadow-2xs font-extrabold' : ''
                }`}
              >
                Cắm cờ ({Object.values(flagged).filter(Boolean).length})
              </button>
            </div>

            {/* Toggle phiếu tô đáp án nhanh OMR */}
            <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
              <label className="flex items-center gap-2 cursor-pointer text-slate-700 font-semibold select-none">
                <input
                  type="checkbox"
                  checked={showOmrQuick}
                  onChange={(e) => setShowOmrQuick(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span>Tô đáp án nhanh (OMR)</span>
              </label>
            </div>

            {/* Danh sách các nút số câu hỏi chia theo từng phần */}
            <div className="max-h-[55vh] overflow-y-auto pr-1 space-y-4">
              {([1, 2, 3, 4] as const).map((partNum) => {
                const partItems = filteredQuestionList.filter(({ q, idx }) => getPartDetails(q, idx).part === partNum);
                if (partItems.length === 0) return null;

                const partHeader =
                  partNum === 1
                    ? { badgeColor: 'bg-blue-600', badgeText: 'PHẦN I', sub: 'Trắc nghiệm 4 lựa chọn' }
                    : partNum === 2
                    ? { badgeColor: 'bg-indigo-600', badgeText: 'PHẦN II', sub: 'Đúng / Sai' }
                    : partNum === 3
                    ? { badgeColor: 'bg-amber-600', badgeText: 'PHẦN III', sub: 'Trả lời ngắn' }
                    : { badgeColor: 'bg-emerald-600', badgeText: 'PHẦN IV', sub: 'Tự luận' };

                return (
                  <div key={partNum} className="space-y-2 border-t border-slate-100 pt-3 first:border-t-0 first:pt-0">
                    <div className="flex items-center justify-between px-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className={`rounded-md ${partHeader.badgeColor} px-1.5 py-0.5 text-[10px] font-black text-white`}>
                          {partHeader.badgeText}
                        </span>
                        <span className="font-bold text-[11px] text-slate-800">
                          {partHeader.sub}
                        </span>
                      </div>
                      <span className="text-[10px] font-semibold text-slate-400">
                        {partItems.length} câu
                      </span>
                    </div>

                    {showOmrQuick ? (
                      /* Chế độ Phiếu Tô Đáp Án Nhanh OMR theo phần */
                      <div className="space-y-2">
                        {partItems.map(({ q, idx }) => {
                          const isAnswered = isQuestionAnswered(q);
                          const isFlag = flagged[q.id];
                          const selectedVal = answers[q.id];

                          return (
                            <div
                              key={q.id}
                              className={`p-2.5 rounded-2xl border text-xs transition ${
                                idx === currentIndex
                                  ? 'border-blue-500 bg-blue-50/40 ring-1 ring-blue-400'
                                  : 'border-slate-200 bg-slate-50/50'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1.5">
                                <button
                                  type="button"
                                  onClick={() => jumpToQuestion(idx, q.id)}
                                  className="font-bold text-slate-800 hover:text-blue-600 cursor-pointer"
                                >
                                  Câu {idx + 1}
                                  {isFlag && <span className="text-amber-500 ml-1">🚩</span>}
                                </button>
                                <span className="text-[10px] text-slate-400">
                                  {isAnswered ? '✓ Đã làm' : 'Chưa làm'}
                                </span>
                              </div>

                              {/* Nút tô A, B, C, D trực tiếp cho Phần I */}
                              {q.type === 'single_choice' && (
                                <div className="flex items-center justify-between gap-1">
                                  {['A', 'B', 'C', 'D'].map((opt) => (
                                    <button
                                      key={opt}
                                      type="button"
                                      onClick={() => handleSingleChoiceSelect(q.id, opt)}
                                      className={`h-7 w-7 rounded-full text-[11px] font-bold border transition cursor-pointer ${
                                        selectedVal === opt
                                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                          : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'
                                      }`}
                                    >
                                      {opt}
                                    </button>
                                  ))}
                                </div>
                              )}

                              {/* Đúng / Sai cho Phần II */}
                              {q.type === 'true_false' && (
                                <div
                                  onClick={() => jumpToQuestion(idx, q.id)}
                                  className="text-center py-1 text-[11px] text-indigo-600 font-semibold cursor-pointer hover:underline"
                                >
                                  {isAnswered ? '✓ Đã chọn 4 ý' : 'Bấm để chọn 4 ý Đúng/Sai'}
                                </div>
                              )}

                              {/* Trả lời ngắn / Tự luận */}
                              {q.type !== 'single_choice' && q.type !== 'true_false' && (
                                <div
                                  onClick={() => jumpToQuestion(idx, q.id)}
                                  className="text-center py-1 text-[11px] text-amber-600 font-semibold cursor-pointer hover:underline"
                                >
                                  {isAnswered ? '✓ ' + (answers[q.id] || 'Đã điền') : 'Bấm để điền đáp số'}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      /* Chế độ Lưới Ô Vuông theo từng phần */
                      <div className="grid grid-cols-5 gap-2">
                        {partItems.map(({ q, idx }) => {
                          const isCurrent = idx === currentIndex;
                          const isFlag = flagged[q.id];
                          const isDone = isQuestionAnswered(q);

                          let btnClass = 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200';
                          if (isCurrent) {
                            btnClass = 'ring-2 ring-blue-600 bg-blue-600 text-white font-bold shadow-xs';
                          } else if (isFlag) {
                            btnClass = 'bg-amber-100 text-amber-800 border-amber-300 font-semibold';
                          } else if (isDone) {
                            btnClass = 'bg-blue-50 text-blue-700 border-blue-200 font-semibold';
                          }

                          return (
                            <button
                              key={q.id}
                              type="button"
                              onClick={() => jumpToQuestion(idx, q.id)}
                              className={`relative flex h-9 w-full items-center justify-center rounded-xl border text-xs transition cursor-pointer ${btnClass}`}
                            >
                              {idx + 1}
                              {isFlag && (
                                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Chú thích màu sắc */}
            <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-[11px] text-slate-500">
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-blue-50 border border-blue-300" />
                <span>Đã làm</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-slate-100 border border-slate-300" />
                <span>Chưa làm</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-amber-100 border border-amber-300" />
                <span>Đã cắm cờ</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-blue-600" />
                <span>Đang chọn</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* 3. MODAL XÁC NHẬN NỘP BÀI THÔNG MINH */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Xác Nhận Nộp Bài Thi</h3>

            <div className="rounded-2xl bg-slate-50 p-4 space-y-2 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Tổng số câu hỏi:</span>
                <span className="font-bold text-slate-900">{questions.length} câu</span>
              </div>
              <div className="flex justify-between">
                <span>Số câu đã hoàn thành:</span>
                <span className="font-bold text-emerald-600">{answeredCount} câu</span>
              </div>
              <div className="flex justify-between">
                <span>Số câu chưa trả lời:</span>
                <span className="font-bold text-rose-500">{unansweredQuestions.length} câu</span>
              </div>
              <div className="flex justify-between">
                <span>{exam?.no_time_limit ? 'Thời gian đã làm:' : 'Thời gian còn lại:'}</span>
                <span className="font-bold text-blue-600">{formatTime(timeLeft)}</span>
              </div>
              {tabSwitchCount > 0 && (
                <div className="flex justify-between text-amber-700 pt-1 border-t border-slate-200">
                  <span>Số lần rời màn hình thi:</span>
                  <span className="font-bold">{tabSwitchCount} lần</span>
                </div>
              )}
            </div>

            {/* Nếu còn câu chưa làm, liệt kê các nút nhảy nhanh */}
            {unansweredQuestions.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-rose-600">
                  ⚠️ Các câu chưa làm (bấm vào số câu để xem lại ngay):
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1">
                  {unansweredQuestions.map((q) => {
                    const qIdx = questions.findIndex((item) => item.id === q.id);
                    return (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => {
                          setShowSubmitModal(false);
                          jumpToQuestion(qIdx, q.id);
                        }}
                        className="rounded-lg bg-rose-50 border border-rose-200 px-2 py-1 text-xs font-bold text-rose-700 hover:bg-rose-100 transition cursor-pointer"
                      >
                        Câu {qIdx + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <p className="text-xs text-slate-500">
              Sau khi xác nhận nộp, hệ thống sẽ chấm điểm trắc nghiệm tự động và lưu trữ bài tự luận để Thầy Sơn xem xét.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setShowSubmitModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                Tiếp tục làm bài
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleFinalSubmit}
                className="rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-500 transition cursor-pointer"
              >
                {isSubmitting ? 'Đang chấm điểm...' : 'Xác Nhận Nộp Bài'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. TOAST THÔNG BÁO CHỐNG GIAN LẬN THỜI GIAN THỰC (AZOTA SHIELD) */}
      {proctoringToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 rounded-2xl bg-slate-900/95 text-white px-5 py-3 text-xs sm:text-sm font-bold shadow-2xl backdrop-blur-md border border-rose-500/60 animate-in fade-in slide-in-from-top-4">
          <ShieldAlert className="h-5 w-5 text-rose-400 shrink-0 animate-bounce" />
          <span>{proctoringToast}</span>
        </div>
      )}

      {/* 5. OVERLAY BẮT BUỘC TOÀN MÀN HÌNH (ENFORCED FULLSCREEN GUARD) */}
      {showFullscreenOverlay && !isAutoSubmittingDueToViolation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 sm:p-7 shadow-2xl text-center space-y-4 border-2 border-amber-400">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-100 text-amber-600 mx-auto">
              <Maximize className="h-9 w-9 animate-pulse" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">YÊU CẦU TOÀN MÀN HÌNH</h3>
              <p className="text-xs text-slate-500 mt-1">
                Quy chế thi trực tuyến yêu cầu bạn phải giữ toàn màn hình cho tới khi hoàn thành nộp bài.
              </p>
            </div>
            <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3.5 text-xs text-amber-900 font-semibold text-left">
              ⚠️ Hành vi thu nhỏ cửa sổ hoặc chuyển màn hình đã được ghi nhận vào nhật ký giám sát gửi về máy Thầy Sơn.
            </div>
            <button
              type="button"
              onClick={toggleFullscreen}
              className="w-full rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-extrabold py-3 text-sm shadow-lg shadow-orange-500/25 transition active:scale-95 cursor-pointer flex items-center justify-center gap-2"
            >
              <Maximize className="h-4 w-4" />
              <span>Quay Lại Toàn Màn Hình Để Tiếp Tục</span>
            </button>
          </div>
        </div>
      )}

      {/* 6. MODAL ĐÌNH CHỈ THI & TỰ ĐỘNG THU BÀI (AUTO-SUBMIT ON 3 VIOLATIONS) */}
      {isAutoSubmittingDueToViolation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-rose-950/90 backdrop-blur-md p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl text-center space-y-4 border-4 border-rose-600 animate-in zoom-in-95">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-rose-100 text-rose-600 mx-auto">
              <AlertTriangle className="h-9 w-9 animate-bounce" />
            </div>
            <div>
              <h3 className="text-xl font-black text-rose-600">BÀI THI BỊ THU CƯỠNG CHẾ</h3>
              <p className="text-xs text-slate-600 mt-1 font-medium">
                Bạn đã rời màn hình làm bài quá <strong>{MAX_ALLOWED_VIOLATIONS} lần</strong> quy định!
              </p>
            </div>
            <div className="rounded-2xl bg-rose-50 border border-rose-200 p-4 text-xs text-rose-900 text-left space-y-2">
              <div className="font-bold">Biên bản vi phạm đã được lập:</div>
              <ul className="list-disc pl-4 space-y-1 text-[11px] text-rose-800">
                {violationLogs.map((log, idx) => (
                  <li key={idx}>{log}</li>
                ))}
              </ul>
            </div>
            <div className="flex items-center justify-center gap-2 text-xs font-bold text-slate-500">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-rose-600 border-t-transparent" />
              <span>Đang tự động nộp bài và khóa quyền truy cập...</span>
            </div>
          </div>
        </div>
      )}

      {/* 7. MODAL CẢNH BÁO RỜI MÀN HÌNH THI PHÂN CẤP (AZOTA SHIELD) */}
      {showTabWarning && !isAutoSubmittingDueToViolation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 backdrop-blur-xs p-4">
          <div className={`w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 space-y-4 border-2 ${
            tabSwitchCount === 1 ? 'border-amber-400' : 'border-rose-500 animate-pulse'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl shrink-0 ${
                tabSwitchCount === 1 ? 'bg-amber-100 text-amber-600' : 'bg-rose-100 text-rose-600'
              }`}>
                <ShieldAlert className="h-7 w-7" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {tabSwitchCount === 1 ? 'CẢNH BÁO VI PHẠM (Lần 1/3)' : '🚨 CẢNH BÁO NGUY CẤP (Lần 2/3)'}
                </h3>
                <p className="text-xs text-slate-500">Hệ thống giám sát phát hiện bạn vừa rời khỏi đề thi</p>
              </div>
            </div>

            <div className={`rounded-2xl border p-4 space-y-1.5 text-xs ${
              tabSwitchCount === 1
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-rose-50 border-rose-200 text-rose-900 font-semibold'
            }`}>
              <div className="font-bold text-sm">
                Bạn đã rời khỏi màn hình làm bài {tabSwitchCount}/{MAX_ALLOWED_VIOLATIONS} lần!
              </div>
              <p>
                {tabSwitchCount === 1
                  ? 'Hành vi chuyển tab (tìm kiếm Google, mở ChatGPT, chuyển app) được ghi nhận chi tiết vào biên bản thi gửi về cho Thầy Sơn.'
                  : '⚠️ CẢNH BÁO CUỐI CÙNG: Nếu rời màn hình thêm 1 lần nữa, bài thi sẽ BỊ THU CƯỠNG CHẾ VÀ ĐÌNH CHỈ THI NGAY LẬP TỨC!'}
              </p>
            </div>

            <p className="text-xs text-slate-600 font-medium">
              Vui lòng tập trung 100% làm bài và giữ nguyên màn hình thi cho tới khi hoàn tất nộp bài!
            </p>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setShowTabWarning(false)}
                className={`rounded-xl px-5 py-2.5 text-xs font-bold text-white transition cursor-pointer ${
                  tabSwitchCount === 1
                    ? 'bg-blue-600 hover:bg-blue-500'
                    : 'bg-rose-600 hover:bg-rose-500 shadow-md shadow-rose-600/30'
                }`}
              >
                Tôi Cam Kết Trung Thực & Tiếp Tục Làm Bài
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. MODAL XEM ẢNH BÀI TỰ LUẬN PHÓNG TO */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-h-[90vh] max-w-3xl overflow-hidden rounded-2xl bg-white p-2 shadow-2xl">
            <img src={previewImage} alt="Bài giải phóng to" className="max-h-[85vh] w-auto object-contain rounded-xl" />
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 rounded-full bg-slate-900/70 p-2 text-white hover:bg-slate-900 transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {/* 6. MÁY TÍNH KHOA HỌC MINI & SỔ TAY CÔNG THỨC */}
      <ExamCalculator isOpen={isCalculatorOpen} onClose={() => setIsCalculatorOpen(false)} />
      <ExamFormulaSheetModal isOpen={isFormulaSheetOpen} onClose={() => setIsFormulaSheetOpen(false)} />
    </div>
  );
}
