'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { MOCK_EXAMS, MOCK_QUESTIONS } from '@/lib/supabase/mockStore';
import { Exam, Question } from '@/types/database';
import { parseExamLatex } from '@/lib/latex/examParser';
import { parseWordDocx } from '@/lib/word/wordExamParser';
import MathRenderer from '@/components/math/MathRenderer';
import { createClient } from '@/lib/supabase/client';
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
} from 'lucide-react';

export default function ExamsPage() {
  const { user, isTeacher, isStudent } = useAuth();
  const [exams, setExams] = useState<Exam[]>(MOCK_EXAMS);
  const [questionsPool, setQuestionsPool] = useState<Question[]>(MOCK_QUESTIONS);
  const [selectedGrade, setSelectedGrade] = useState<number | 'all'>('all');
  const [filterType, setFilterType] = useState<'all' | 'timed' | 'practice'>('all');

  // Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);

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

  // Tải danh sách đề thi & ngân hàng câu hỏi
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // 1. Tải Ngân hàng câu hỏi
      const savedQuestions = localStorage.getItem('lms_questions');
      if (savedQuestions) {
        try {
          const parsed = JSON.parse(savedQuestions);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const existingIds = new Set(parsed.map((q: any) => q.id));
            const missing = MOCK_QUESTIONS.filter((q) => !existingIds.has(q.id));
            setQuestionsPool([...parsed, ...missing]);
          }
        } catch (e) {
          console.error(e);
        }
      }

      // 2. Tải Danh sách đề thi
      const savedExams = localStorage.getItem('lms_exams');
      if (savedExams) {
        try {
          const parsed = JSON.parse(savedExams);
          if (Array.isArray(parsed) && parsed.length > 0) {
            // Đảm bảo không mất các đề thi mẫu quan trọng như Huế HSG và MOET 2025
            const existingIds = new Set(parsed.map((e: any) => e.id));
            const missingMocks = MOCK_EXAMS.filter((m) => !existingIds.has(m.id));
            const merged = [...parsed, ...missingMocks];
            setExams(merged);
            return;
          }
        } catch (e) {
          console.error(e);
        }
      }
    }

    const supabase = createClient();
    if (supabase) {
      supabase
        .from('exams')
        .select('*')
        .then(({ data, error }) => {
          if (!error && data && data.length > 0) {
            setExams(data as any);
            if (typeof window !== 'undefined') {
              localStorage.setItem('lms_exams', JSON.stringify(data));
            }
          }
        });
    }
  }, []);

  const saveExamsToStorage = (updated: Exam[]) => {
    setExams(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('lms_exams', JSON.stringify(updated));
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

      // 1. Thử gửi qua API server
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
        console.warn('API upload-docx failed, falling back to client:', apiErr);
      }

      // 2. Dự phòng phân tích trực tiếp phía client nếu server không phản hồi
      if (extractedQuestions.length === 0) {
        const result = await parseWordDocx(file);
        extractedQuestions = result.questions;
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

    try {
      const supabase = createClient();
      if (supabase && user) {
        await supabase.from('exams').insert([
          {
            id: newId,
            title: created.title,
            description: created.description,
            grade: created.grade,
            duration_minutes: created.duration_minutes,
            teacher_id: user.id,
            passing_score: 5.0,
            status: 'published',
            shuffle_questions: shuffleQuestions,
          },
        ]);
      }
    } catch (err) {
      console.warn('Lỗi lưu đề thi vào Supabase:', err);
    }

    setShowCreateModal(false);
    setSelectedQuestions([]);
    setLatexInput('');
    setLatexParseNotice(null);
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

    const updated = exams.map((ex) => {
      if (ex.id === editingExam.id) {
        return {
          ...ex,
          title: editTitle.trim(),
          grade: editGrade,
          duration_minutes: Number(editDuration),
          description: editDescription.trim(),
          shuffle_questions: editShuffle,
        };
      }
      return ex;
    });

    saveExamsToStorage(updated);

    try {
      const supabase = createClient();
      if (supabase) {
        await supabase
          .from('exams')
          .update({
            title: editTitle.trim(),
            grade: editGrade,
            duration_minutes: Number(editDuration),
            description: editDescription.trim(),
            shuffle_questions: editShuffle,
          })
          .eq('id', editingExam.id);
      }
    } catch (err) {
      console.warn('Lỗi cập nhật đề thi trên Supabase:', err);
    }

    setShowEditModal(false);
    setEditingExam(null);
  };

  // Xóa đề thi
  const handleDeleteExam = async (examId: string, examTitle: string) => {
    const isConfirmed = confirm(
      `Thầy có chắc chắn muốn xóa đề thi "${examTitle}" không?\nHọc sinh sẽ không còn thấy đề này trong danh sách.`
    );
    if (!isConfirmed) return;

    const updated = exams.filter((e) => e.id !== examId);
    saveExamsToStorage(updated);

    try {
      const supabase = createClient();
      if (supabase) {
        await supabase.from('exams').delete().eq('id', examId);
      }
    } catch (err) {
      console.warn('Lỗi xóa đề thi trên Supabase:', err);
    }
  };

  const filteredExams = exams.filter((e) => {
    if (selectedGrade !== 'all' && e.grade !== selectedGrade) return false;
    if (filterType === 'timed' && e.duration_minutes < 45) return false;
    if (filterType === 'practice' && e.duration_minutes >= 90) return false;
    return true;
  });

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

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <ClipboardList className="h-8 w-8 text-blue-600 shrink-0" />
            Đề Thi & Bài Kiểm Tra Toán THPT
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Hệ thống bài kiểm tra định kỳ và đề thi thử Tốt nghiệp THPT chuẩn Bộ GD&ĐT 2025 có bấm giờ, hỗ trợ tự luận và tự động chấm điểm.
          </p>
        </div>

        {isTeacher && (
          <button
            onClick={() => {
              handleSelectFormat('standard_3_parts');
              setShowCreateModal(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-500/20 hover:bg-blue-500 transition self-start sm:self-auto cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Tạo Đề Thi Mới
          </button>
        )}
      </div>

      {/* Student Welcome Banner */}
      {user ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50/90 to-indigo-50/70 p-5 shadow-xs">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white font-bold text-lg shadow-sm">
              {user.full_name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-base">{user.full_name}</span>
                <span className="rounded-md bg-blue-600 text-white px-2 py-0.5 text-[10px] font-bold">
                  {user.role === 'teacher' ? 'Thầy Cô' : `Học sinh Lớp ${user.grade || 12}`}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                {user.school_name || 'THPT Chuyên Lê Hồng Phong'} • Hãy chọn đề thi bên dưới để bắt đầu làm bài!
              </p>
            </div>
          </div>

          <Link
            href="/gradebook"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white border border-blue-200 px-4 py-2 text-xs font-semibold text-blue-700 shadow-2xs hover:bg-blue-50 transition"
          >
            <Award className="h-4 w-4 text-blue-600" />
            <span>{isTeacher ? 'Xem Sổ Điểm Lớp' : 'Xem Điểm Thi Của Tôi'}</span>
          </Link>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50/70 p-5 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 font-bold">
              !
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-900">
                Bạn chưa đăng nhập vào Toán Thầy Sơn
              </h3>
              <p className="text-xs text-amber-700 mt-0.5">
                Đăng ký tài khoản hoặc đăng nhập để lưu kết quả bài thi vào bảng vàng và xem lời giải chi tiết.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <span className="text-xs font-semibold text-slate-400 mr-2 flex items-center gap-1">
            <Filter className="h-3.5 w-3.5" /> Khối:
          </span>
          {[
            { id: 'all', label: 'Tất cả lớp' },
            { id: 12, label: 'Lớp 12' },
            { id: 11, label: 'Lớp 11' },
            { id: 10, label: 'Lớp 10' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedGrade(tab.id as any)}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                selectedGrade === tab.id
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs font-medium text-slate-500 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setFilterType('all')}
            className={`rounded-lg px-3 py-1.5 transition cursor-pointer ${
              filterType === 'all' ? 'bg-white text-slate-900 font-semibold shadow-2xs' : 'hover:text-slate-900'
            }`}
          >
            Tất cả đề thi
          </button>
          <button
            onClick={() => setFilterType('timed')}
            className={`rounded-lg px-3 py-1.5 transition cursor-pointer ${
              filterType === 'timed' ? 'bg-white text-slate-900 font-semibold shadow-2xs' : 'hover:text-slate-900'
            }`}
          >
            ⏱️ Đề bấm giờ (90 - 150 phút)
          </button>
          <button
            onClick={() => setFilterType('practice')}
            className={`rounded-lg px-3 py-1.5 transition cursor-pointer ${
              filterType === 'practice' ? 'bg-white text-slate-900 font-semibold shadow-2xs' : 'hover:text-slate-900'
            }`}
          >
            📚 Đề ôn tập chuyên đề (45 phút)
          </button>
        </div>
      </div>

      {/* Exams Grid */}
      {filteredExams.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-xs">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 mb-3">
            <ClipboardList className="h-7 w-7" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Chưa có đề thi nào phù hợp</h3>
          <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
            Thầy có thể bấm &quot;Tạo Đề Thi Mới&quot; để thiết lập thêm bài kiểm tra cho học sinh.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
          {filteredExams.map((exam) => {
            const qList = exam.questions || [];
            const p1 = qList.filter((q) => q.part === 1 || q.type === 'single_choice' || q.type === 'multiple_choice').length;
            const p2 = qList.filter((q) => q.part === 2 || q.type === 'true_false').length;
            const p3 = qList.filter((q) => q.part === 3 || q.type === 'short_answer').length;
            const p4 = qList.filter((q) => q.part === 4 || q.type === 'essay').length;

            return (
              <div
                key={exam.id}
                className="flex flex-col justify-between rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-7 shadow-xs hover:shadow-md transition hover:border-blue-300 relative overflow-hidden"
              >
                {/* Format Indicator Bar */}
                {exam.format === 'periodic_4_parts' ? (
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-purple-500 to-indigo-600" />
                ) : exam.format === 'standard_3_parts' ? (
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-500 to-cyan-500" />
                ) : null}

                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="rounded-lg bg-blue-100/80 px-2.5 py-1 text-xs font-bold text-blue-700">
                        Toán Lớp {exam.grade}
                      </span>
                      {exam.format === 'periodic_4_parts' ? (
                        <span className="rounded-lg bg-purple-100 px-2 py-0.5 text-[11px] font-bold text-purple-700 border border-purple-200">
                          Định kỳ / HSG (4 Phần)
                        </span>
                      ) : exam.format === 'standard_3_parts' ? (
                        <span className="rounded-lg bg-cyan-100 px-2 py-0.5 text-[11px] font-bold text-cyan-800 border border-cyan-200">
                          Chuẩn Bộ GD&ĐT 2025 (3 Phần)
                        </span>
                      ) : (
                        <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                          Đề Tùy Chọn
                        </span>
                      )}
                    </div>
                    <span className="flex items-center gap-1 text-xs font-semibold text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                      <Clock className="h-3.5 w-3.5 text-blue-600" />
                      {exam.duration_minutes} phút
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 leading-snug">
                    {exam.title}
                  </h3>

                  <p className="mt-2 text-xs text-slate-500 line-clamp-2 leading-relaxed">
                    {exam.description || 'Đề thi trắc nghiệm và tự luận Toán THPT.'}
                  </p>

                  {/* Structure Breakdown */}
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-semibold text-slate-700">Cấu trúc:</span>
                      {p1 > 0 && (
                        <span className="rounded-md bg-blue-50 px-2 py-0.5 font-medium text-blue-700 border border-blue-100">
                          {p1} câu TN (I)
                        </span>
                      )}
                      {p2 > 0 && (
                        <span className="rounded-md bg-indigo-50 px-2 py-0.5 font-medium text-indigo-700 border border-indigo-100">
                          {p2} câu Đ/S (II)
                        </span>
                      )}
                      {p3 > 0 && (
                        <span className="rounded-md bg-amber-50 px-2 py-0.5 font-medium text-amber-700 border border-amber-100">
                          {p3} câu Điền số (III)
                        </span>
                      )}
                      {p4 > 0 && (
                        <span className="rounded-md bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700 border border-emerald-100">
                          {p4} câu Tự luận (IV)
                        </span>
                      )}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <HelpCircle className="h-3.5 w-3.5 text-slate-400" />
                        <span>Tổng: {qList.length} câu</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Award className="h-3.5 w-3.5 text-slate-400" />
                        <span>Thang điểm: {exam.format === 'periodic_4_parts' ? '20.0' : '10.0'}</span>
                      </div>
                      {exam.shuffle_questions && (
                        <div className="flex items-center gap-1.5 text-indigo-600 font-medium">
                          <Shuffle className="h-3.5 w-3.5" />
                          <span>Xáo câu ngẫu nhiên</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                    <CheckCircle className="h-3.5 w-3.5" />
                    Đang mở làm bài
                  </span>

                  <div className="flex items-center gap-2">
                    {isTeacher && (
                      <>
                        <button
                          type="button"
                          onClick={() => openEditModal(exam)}
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                          title="Chỉnh sửa đề thi"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          <span>Sửa</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteExam(exam.id, exam.title)}
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                          title="Xóa đề thi"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Xóa</span>
                        </button>
                      </>
                    )}

                    <Link
                      href={`/exams/${exam.id}/take`}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-500 transition active:scale-95 cursor-pointer"
                    >
                      <Play className="h-3.5 w-3.5 fill-current" />
                      <span>Làm Bài Thi</span>
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
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
            <div className="border-t border-slate-200 px-6 py-4 bg-slate-50 flex items-center justify-between">
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
    </div>
  );
}
