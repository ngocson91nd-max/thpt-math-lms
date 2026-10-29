'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Question, QuestionType, QuestionDifficulty } from '@/types/database';
import MathRenderer from '@/components/math/MathRenderer';
import MathEditor from '@/components/math/MathEditor';
import { parseWordDocx, convertWmfQuestionsToPng } from '@/lib/word/wordExamParser';
import { parseExamLatex } from '@/lib/latex/examParser';
import {
  FileQuestion,
  Plus,
  Sparkles,
  Search,
  Filter,
  CheckCircle2,
  Layers,
  CheckSquare,
  HelpCircle,
  Pencil,
  Trash2,
  Upload,
  FileCode,
  AlertTriangle,
} from 'lucide-react';

export default function QuestionsPage() {
  const { isTeacher } = useAuth();
  const [questions, setQuestions] = useState<Question[]>(() => {
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

  const [isLoading, setIsLoading] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      const saved = localStorage.getItem('lms_questions');
      if (saved && JSON.parse(saved).length > 0) return false;
    } catch {}
    return true;
  });
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all');
  const [gradeFilter, setGradeFilter] = useState<string>('all');
  const [partFilter, setPartFilter] = useState<'all' | 1 | 2 | 3 | 4>('all');

  // Modal States
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showLatexModal, setShowLatexModal] = useState(false);
  const [latexInput, setLatexInput] = useState('');
  const [latexParseNotice, setLatexParseNotice] = useState<string | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  // Form State (Thêm mới)
  const [formType, setFormType] = useState<QuestionType>('single_choice');
  const [formGrade, setFormGrade] = useState<10 | 11 | 12>(12);
  const [formTopic, setFormTopic] = useState('Khảo sát hàm số');
  const [formDifficulty, setFormDifficulty] = useState<QuestionDifficulty>('thong_hieu');
  const [formContent, setFormContent] = useState('');
  const [formExplanation, setFormExplanation] = useState('');
  const [formPoints, setFormPoints] = useState(0.25);
  const [optA, setOptA] = useState('');
  const [optB, setOptB] = useState('');
  const [optC, setOptC] = useState('');
  const [optD, setOptD] = useState('');
  const [correctSingle, setCorrectSingle] = useState('A');
  const [shortAns, setShortAns] = useState('');

  // Form State (Chỉnh sửa)
  const [editType, setEditType] = useState<QuestionType>('single_choice');
  const [editGrade, setEditGrade] = useState<10 | 11 | 12>(12);
  const [editTopic, setEditTopic] = useState('Khảo sát hàm số');
  const [editDifficulty, setEditDifficulty] = useState<QuestionDifficulty>('thong_hieu');
  const [editContent, setEditContent] = useState('');
  const [editExplanation, setEditExplanation] = useState('');
  const [editPoints, setEditPoints] = useState(0.25);
  const [editOptA, setEditOptA] = useState('');
  const [editOptB, setEditOptB] = useState('');
  const [editOptC, setEditOptC] = useState('');
  const [editOptD, setEditOptD] = useState('');
  const [editCorrectSingle, setEditCorrectSingle] = useState('A');
  const [editShortAns, setEditShortAns] = useState('');

  // Tải danh sách câu hỏi thực tế từ Supabase Cloud API
  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    try {
      const res = await fetch('/api/questions');
      const data = await res.json();
      if (data.success && Array.isArray(data.questions)) {
        setQuestions(data.questions);
        if (typeof window !== 'undefined') {
          localStorage.setItem('lms_questions', JSON.stringify(data.questions));
        }
        return;
      }
    } catch (e) {
      console.warn('Lỗi tải ngân hàng câu hỏi:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const saveQuestions = (updated: Question[]) => {
    setQuestions(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('lms_questions', JSON.stringify(updated));
    }
  };

  // Nạp câu hỏi từ file Word (.docx)
  const [isUploadingWord, setIsUploadingWord] = useState(false);
  const handleWordImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingWord(true);
    try {
      let extracted: Question[] = [];

      try {
        const result = await parseWordDocx(file);
        if (result.questions && result.questions.length > 0) {
          extracted = result.questions;
        }
      } catch (clientErr) {
        console.warn('Client parser failed, falling back to API:', clientErr);
      }

      if (extracted.length === 0) {
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
              extracted = data.questions;
            }
          }
        } catch (apiErr) {
          console.warn('API upload-docx failed:', apiErr);
        }
      }

      if (extracted.length > 0) {
        extracted = convertWmfQuestionsToPng(extracted);
      }

      if (extracted.length === 0) {
        alert('Không tìm thấy câu hỏi nào (định dạng "Câu 1:", "Bài 1:", v.v.) trong file Word!');
      } else {
        const updated = [...extracted, ...questions];
        saveQuestions(updated);

        // Lưu đồng bộ lên Supabase Cloud
        fetch('/api/questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ questions: extracted }),
        }).catch((err) => console.warn('Lỗi lưu câu hỏi lên Cloud:', err));

        alert(`Đã nạp thành công ${extracted.length} câu hỏi từ file "${file.name}" vào Ngân hàng câu hỏi!`);
      }
    } catch (err: any) {
      alert(`Lỗi đọc file Word: ${err?.message || 'Không xác định'}`);
    } finally {
      setIsUploadingWord(false);
      e.target.value = '';
    }
  };

  // Nạp câu hỏi từ mã LaTeX
  const handleLatexImport = () => {
    if (!latexInput.trim()) {
      setLatexParseNotice('Vui lòng dán mã nguồn LaTeX chứa câu hỏi vào khung bên dưới!');
      return;
    }

    try {
      const result = parseExamLatex(latexInput);
      const parsed = result.questions || [];
      if (parsed.length === 0) {
        setLatexParseNotice('Không tìm thấy câu hỏi \\begin{ex}...\\end{ex} hợp lệ trong mã LaTeX.');
        return;
      }

      const updated = [...parsed, ...questions];
      saveQuestions(updated);

      // Lưu đồng bộ lên Cloud API
      fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions: parsed }),
      }).catch((err) => console.warn('Lỗi lưu câu hỏi LaTeX lên Cloud:', err));

      setShowLatexModal(false);
      setLatexInput('');
      setLatexParseNotice(null);
      alert(`Đã nạp thành công ${parsed.length} câu hỏi LaTeX vào Ngân hàng đề thi!`);
    } catch (err: any) {
      setLatexParseNotice(`Lỗi phân tích LaTeX: ${err?.message || 'Không rõ nguyên nhân'}`);
    }
  };

  // Xóa toàn bộ Ngân hàng câu hỏi
  const handleDeleteAllQuestions = async () => {
    const isConfirmed = confirm(
      'Thầy có chắc chắn muốn XÓA TOÀN BỘ câu hỏi trong Ngân hàng câu hỏi không?\nDữ liệu trên Cloud và trình duyệt sẽ được xóa trống hoàn toàn.'
    );
    if (!isConfirmed) return;

    saveQuestions([]);
    try {
      await fetch('/api/questions?all=true', { method: 'DELETE' });
      alert('Đã xóa sạch toàn bộ câu hỏi trong Ngân hàng đề!');
    } catch (err) {
      console.warn('Lỗi xóa tất cả câu hỏi:', err);
    }
  };

  // AI Generator Trigger
  const handleAiGenerate = async () => {
    setIsGeneratingAi(true);
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_question',
          grade: formGrade,
          topic: formTopic,
          difficulty: formDifficulty,
          type: formType,
        }),
      });

      const data = await res.json();
      if (data.success && data.result) {
        try {
          const parsed = JSON.parse(data.result);
          if (parsed.content) setFormContent(parsed.content);
          if (parsed.explanation) setFormExplanation(parsed.explanation);
          if (parsed.points) setFormPoints(parsed.points);

          if (parsed.options && Array.isArray(parsed.options)) {
            parsed.options.forEach((opt: any) => {
              if (opt.id === 'A') setOptA(opt.text);
              if (opt.id === 'B') setOptB(opt.text);
              if (opt.id === 'C') setOptC(opt.text);
              if (opt.id === 'D') setOptD(opt.text);
            });
          }
          if (parsed.correct_answer) setCorrectSingle(parsed.correct_answer);
        } catch {
          setFormContent(data.result);
        }
      }
    } catch (err) {
      console.error('Lỗi sinh câu hỏi AI:', err);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // Thêm câu hỏi thủ công
  const handleCreateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formContent.trim()) return;

    let options: any = [];
    let correct_answer: any = '';

    if (formType === 'single_choice') {
      options = [
        { id: 'A', text: optA || 'Phương án A' },
        { id: 'B', text: optB || 'Phương án B' },
        { id: 'C', text: optC || 'Phương án C' },
        { id: 'D', text: optD || 'Phương án D' },
      ];
      correct_answer = correctSingle;
    } else if (formType === 'short_answer') {
      options = [];
      correct_answer = [shortAns];
    } else if (formType === 'essay') {
      options = [];
      correct_answer = 'Hướng dẫn chấm';
    }

    const newId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : '00000000-0000-0000-0000-' + Math.random().toString(36).substring(2, 14);

    const newQ: Question = {
      id: newId,
      teacher_id: '11111111-1111-1111-1111-111111111111',
      grade: formGrade,
      topic: formTopic,
      difficulty: formDifficulty,
      type: formType,
      content: formContent,
      options,
      correct_answer,
      explanation: formExplanation,
      points: Number(formPoints),
      is_public: true,
    };

    const updated = [newQ, ...questions];
    saveQuestions(updated);

    // Lưu lên Supabase Cloud API
    fetch('/api/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newQ),
    }).catch((err) => console.warn('Lỗi lưu câu hỏi lên Cloud:', err));

    setShowModal(false);
    setFormContent('');
    setFormExplanation('');
    setOptA('');
    setOptB('');
    setOptC('');
    setOptD('');
    setShortAns('');
  };

  // Mở modal sửa câu hỏi
  const openEditQuestion = (q: Question) => {
    setEditingQuestion(q);
    setEditType(q.type);
    setEditGrade(q.grade);
    setEditTopic(q.topic);
    setEditDifficulty(q.difficulty);
    setEditContent(q.content);
    setEditExplanation(q.explanation || '');
    setEditPoints(q.points);

    if (q.options && Array.isArray(q.options)) {
      setEditOptA(q.options.find((o: any) => o.id === 'A')?.text || '');
      setEditOptB(q.options.find((o: any) => o.id === 'B')?.text || '');
      setEditOptC(q.options.find((o: any) => o.id === 'C')?.text || '');
      setEditOptD(q.options.find((o: any) => o.id === 'D')?.text || '');
    }
    setEditCorrectSingle(String(q.correct_answer || 'A'));
    if (Array.isArray(q.correct_answer)) {
      setEditShortAns(q.correct_answer[0] || '');
    } else {
      setEditShortAns(String(q.correct_answer || ''));
    }

    setShowEditModal(true);
  };

  // Cập nhật câu hỏi
  const handleUpdateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuestion || !editContent.trim()) return;

    let options: any = [];
    let correct_answer: any = '';

    if (editType === 'single_choice') {
      options = [
        { id: 'A', text: editOptA || 'Phương án A' },
        { id: 'B', text: editOptB || 'Phương án B' },
        { id: 'C', text: editOptC || 'Phương án C' },
        { id: 'D', text: editOptD || 'Phương án D' },
      ];
      correct_answer = editCorrectSingle;
    } else if (editType === 'short_answer') {
      options = [];
      correct_answer = [editShortAns];
    } else if (editType === 'essay') {
      options = [];
      correct_answer = 'Hướng dẫn chấm';
    }

    const updatedQ: Question = {
      ...editingQuestion,
      grade: editGrade,
      topic: editTopic,
      difficulty: editDifficulty,
      type: editType,
      content: editContent,
      options,
      correct_answer,
      explanation: editExplanation,
      points: Number(editPoints),
    };

    const updated = questions.map((q) => (q.id === editingQuestion.id ? updatedQ : q));
    saveQuestions(updated);

    // Lưu lên Supabase Cloud API
    fetch('/api/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedQ),
    }).catch((err) => console.warn('Lỗi cập nhật câu hỏi trên Cloud:', err));

    setShowEditModal(false);
    setEditingQuestion(null);
  };

  // Xóa câu hỏi
  const handleDeleteQuestion = async (questionId: string) => {
    const isConfirmed = confirm(
      'Thầy có chắc chắn muốn xóa câu hỏi này khỏi ngân hàng đề không?'
    );
    if (!isConfirmed) return;

    const updated = questions.filter((q) => q.id !== questionId);
    saveQuestions(updated);

    fetch(`/api/questions?id=${questionId}`, { method: 'DELETE' }).catch((err) =>
      console.warn('Lỗi xóa câu hỏi trên Cloud:', err)
    );
  };

  const filteredQuestions = questions.filter((q) => {
    if (gradeFilter !== 'all' && q.grade !== Number(gradeFilter)) return false;
    if (typeFilter !== 'all' && q.type !== typeFilter) return false;
    if (difficultyFilter !== 'all' && q.difficulty !== difficultyFilter) return false;
    if (partFilter !== 'all') {
      const p = q.part || (q.type === 'essay' ? 4 : q.type === 'short_answer' ? 3 : q.type === 'true_false' ? 2 : 1);
      if (p !== partFilter) return false;
    }
    if (search.trim()) {
      const s = search.toLowerCase();
      return (
        q.content.toLowerCase().includes(s) ||
        q.topic.toLowerCase().includes(s) ||
        (q.explanation && q.explanation.toLowerCase().includes(s))
      );
    }
    return true;
  });

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <FileQuestion className="h-8 w-8 text-blue-600 shrink-0" />
            Ngân Hàng Câu Hỏi Toán THPT
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Kho lưu trữ câu hỏi chuyên đề chuẩn hóa theo 5 định dạng của Bộ GD&ĐT 2025 ({questions.length} câu hỏi).
          </p>
        </div>

        {isTeacher && (
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            {questions.length > 0 && (
              <button
                onClick={handleDeleteAllQuestions}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition cursor-pointer"
                title="Xóa toàn bộ câu hỏi trong ngân hàng"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Xóa Hết ({questions.length})</span>
              </button>
            )}

            <button
              onClick={() => setShowLatexModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-purple-200 bg-purple-50 px-3.5 py-2.5 text-xs font-semibold text-purple-700 hover:bg-purple-100 transition cursor-pointer shadow-2xs"
            >
              <FileCode className="h-4 w-4" />
              <span>Dán Mã LaTeX</span>
            </button>

            <label className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition cursor-pointer shadow-2xs">
              <Upload className="h-4 w-4" />
              <span>{isUploadingWord ? 'Đang đọc Word...' : 'Nhập Từ Word (.docx)'}</span>
              <input
                type="file"
                accept=".docx"
                disabled={isUploadingWord}
                onChange={handleWordImport}
                className="hidden"
              />
            </label>

            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-md shadow-blue-500/20 hover:bg-blue-500 transition cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Thêm Câu Hỏi Mới
            </button>
          </div>
        )}
      </div>

      {/* Part Filter Bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        <span className="text-xs font-semibold text-slate-500 mr-1 flex items-center gap-1">
          <Filter className="h-3.5 w-3.5" /> Phần trong đề:
        </span>
        {[
          { id: 'all', label: 'Tất cả các phần' },
          { id: 1, label: 'Phần I: TN 4 Lựa Chọn' },
          { id: 2, label: 'Phần II: Đúng / Sai' },
          { id: 3, label: 'Phần III: Điền Số Ngắn' },
          { id: 4, label: 'Phần IV: Tự Luận VDC' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setPartFilter(tab.id as any)}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
              partFilter === tab.id
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo nội dung, chuyên đề..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <select
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-blue-500"
          >
            <option value="all">Tất cả các khối lớp</option>
            <option value="12">Lớp 12 (Trọng tâm THPT 2025)</option>
            <option value="11">Lớp 11</option>
            <option value="10">Lớp 10</option>
          </select>
        </div>

        <div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-blue-500"
          >
            <option value="all">Tất cả các dạng</option>
            <option value="single_choice">Trắc nghiệm 1 đáp án</option>
            <option value="multiple_choice">Nhiều lựa chọn đúng</option>
            <option value="true_false">Đúng / Sai 4 ý</option>
            <option value="short_answer">Điền đáp số ngắn</option>
            <option value="essay">Tự luận giải chi tiết</option>
          </select>
        </div>

        <div>
          <select
            value={difficultyFilter}
            onChange={(e) => setDifficultyFilter(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-blue-500"
          >
            <option value="all">Tất cả mức độ</option>
            <option value="nhan_biet">Nhận biết</option>
            <option value="thong_hieu">Thông hiểu</option>
            <option value="van_dung">Vận dụng</option>
            <option value="van_dung_cao">Vận dụng cao</option>
          </select>
        </div>
      </div>

      {/* Questions List */}
      <div className="space-y-4">
        {filteredQuestions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 mb-4 shadow-xs">
              <FileQuestion className="h-7 w-7" />
            </div>
            <h3 className="text-base font-bold text-slate-800">
              {questions.length === 0 ? 'Ngân hàng câu hỏi hiện đang trống' : 'Không tìm thấy câu hỏi phù hợp với bộ lọc'}
            </h3>
            <p className="mt-2 text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              {questions.length === 0
                ? 'Dữ liệu đã được dọn sạch hoàn toàn theo yêu cầu của Thầy. Thầy có thể nạp câu hỏi mới vào ngân hàng bằng các tính năng bên dưới:'
                : 'Hãy thử thay đổi từ khóa tìm kiếm hoặc chọn lại các bộ lọc chuyên đề/khối lớp.'}
            </p>

            {isTeacher && questions.length === 0 && (
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={() => setShowModal(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-500 transition"
                >
                  <Plus className="h-4 w-4" />
                  Thêm Câu Hỏi Mới
                </button>
                <button
                  onClick={() => setShowLatexModal(true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-purple-200 bg-white px-4 py-2.5 text-xs font-semibold text-purple-700 hover:bg-purple-50 transition shadow-2xs"
                >
                  <FileCode className="h-4 w-4" />
                  Dán Mã LaTeX
                </button>
                <label className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer shadow-2xs">
                  <Upload className="h-4 w-4 text-slate-500" />
                  Nhập File Word (.docx)
                  <input
                    type="file"
                    accept=".docx"
                    disabled={isUploadingWord}
                    onChange={handleWordImport}
                    className="hidden"
                  />
                </label>
              </div>
            )}
          </div>
        ) : (
          filteredQuestions.map((q, index) => (
            <div
              key={q.id}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs hover:border-blue-200 transition"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-100 text-xs font-bold text-blue-700">
                    #{index + 1}
                  </span>
                  <span className="font-bold text-xs text-slate-900">
                    Toán Lớp {q.grade} • {q.topic}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-[11px]">
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                    {q.type === 'single_choice' && 'Trắc nghiệm 1 đáp án'}
                    {q.type === 'multiple_choice' && 'Nhiều lựa chọn'}
                    {q.type === 'true_false' && 'Đúng/Sai 4 ý THPT'}
                    {q.type === 'short_answer' && 'Điền đáp số'}
                    {q.type === 'essay' && 'Tự luận'}
                  </span>

                  <span
                    className={`rounded-md px-2 py-0.5 font-semibold ${
                      q.difficulty === 'nhan_biet'
                        ? 'bg-blue-50 text-blue-700'
                        : q.difficulty === 'thong_hieu'
                        ? 'bg-emerald-50 text-emerald-700'
                        : q.difficulty === 'van_dung'
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-rose-50 text-rose-700'
                    }`}
                  >
                    {q.difficulty === 'nhan_biet' && 'Nhận biết'}
                    {q.difficulty === 'thong_hieu' && 'Thông hiểu'}
                    {q.difficulty === 'van_dung' && 'Vận dụng'}
                    {q.difficulty === 'van_dung_cao' && 'Vận dụng cao'}
                  </span>

                  <span className="font-bold text-slate-700">{q.points} điểm</span>

                  {isTeacher && (
                    <div className="flex items-center gap-1 ml-2 border-l border-slate-200 pl-2">
                      <button
                        onClick={() => openEditQuestion(q)}
                        className="p-1 rounded-lg hover:bg-slate-100 text-slate-600 transition"
                        title="Chỉnh sửa câu hỏi"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteQuestion(q.id)}
                        className="p-1 rounded-lg hover:bg-rose-50 text-rose-600 transition"
                        title="Xóa câu hỏi khỏi ngân hàng"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Question Content */}
              <div className="text-base sm:text-[17px] text-slate-900 leading-relaxed font-medium">
                <MathRenderer content={q.content} />
              </div>

              {/* Options Preview */}
              {q.options && q.options.length > 0 && (
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-sm sm:text-[15.5px]">
                  {q.options.map((opt: any) => (
                    <div
                      key={opt.id}
                      className="flex items-start gap-2.5 rounded-xl bg-slate-50 p-3 border border-slate-100"
                    >
                      <span className="font-bold text-slate-700 uppercase">{opt.id}.</span>
                      <div className="text-slate-800 flex-1">
                        <MathRenderer content={opt.text} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Correct Answer & Explanation Preview */}
              {q.explanation && (
                <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/40 p-4 text-sm">
                  <div className="flex items-center gap-1.5 font-bold text-blue-900 text-xs mb-1.5">
                    <CheckCircle2 className="h-4 w-4 text-blue-600" />
                    <span>Lời giải chi tiết:</span>
                  </div>
                  <div className="text-slate-800">
                    <MathRenderer content={q.explanation} />
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Modal Dán mã LaTeX */}
      {showLatexModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FileCode className="h-5 w-5 text-purple-600" />
                Nạp Câu Hỏi Từ Mã LaTeX Vào Ngân Hàng
              </h3>
              <button
                onClick={() => setShowLatexModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-3 leading-relaxed">
              Dán đoạn mã LaTeX chứa một hoặc nhiều câu hỏi (môi trường <code>\begin&#123;ex&#125; ... \end&#123;ex&#125;</code> với <code>\choice</code>, <code>\choiceTF</code>, <code>\shortans</code> và <code>\loigiai</code>).
            </p>

            {latexParseNotice && (
              <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                <span>{latexParseNotice}</span>
              </div>
            )}

            <div className="mb-4">
              <textarea
                value={latexInput}
                onChange={(e) => setLatexInput(e.target.value)}
                placeholder={`\\begin{ex}
Cho hàm số $y = f(x)$ có bảng biến thiên...
\\choice
{$1$}
{\\True $2$}
{$3$}
{$4$}
\\loigiai{
Đạo hàm đổi dấu tại 2 điểm nên hàm số có 2 điểm cực trị.
}
\\end{ex}`}
                rows={10}
                className="w-full rounded-2xl border border-slate-200 p-3.5 font-mono text-xs text-slate-900 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowLatexModal(false)}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleLatexImport}
                className="rounded-xl bg-purple-600 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-purple-500 transition"
              >
                Nạp Vào Ngân Hàng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Thêm Câu Hỏi Mới */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Plus className="h-5 w-5 text-blue-600" />
                Thêm Câu Hỏi Mới Vào Ngân Hàng
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateQuestion} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Dạng câu hỏi:</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none"
                  >
                    <option value="single_choice">Trắc nghiệm 1 đáp án</option>
                    <option value="short_answer">Điền số ngắn</option>
                    <option value="essay">Tự luận</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Khối lớp:</label>
                  <select
                    value={formGrade}
                    onChange={(e) => setFormGrade(Number(e.target.value) as any)}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none"
                  >
                    <option value={12}>Lớp 12</option>
                    <option value={11}>Lớp 11</option>
                    <option value={10}>Lớp 10</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Chuyên đề:</label>
                  <input
                    type="text"
                    value={formTopic}
                    onChange={(e) => setFormTopic(e.target.value)}
                    placeholder="VD: Khảo sát hàm số"
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Mức độ:</label>
                  <select
                    value={formDifficulty}
                    onChange={(e) => setFormDifficulty(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none"
                  >
                    <option value="nhan_biet">Nhận biết</option>
                    <option value="thong_hieu">Thông hiểu</option>
                    <option value="van_dung">Vận dụng</option>
                    <option value="van_dung_cao">Vận dụng cao</option>
                  </select>
                </div>
              </div>

              {/* Question Content Editor */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">Đề bài (hỗ trợ LaTeX, Ctrl+V dán ảnh):</label>
                  <button
                    type="button"
                    onClick={handleAiGenerate}
                    disabled={isGeneratingAi}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-600 hover:text-purple-700 cursor-pointer"
                  >
                    <Sparkles className="h-3 w-3" />
                    {isGeneratingAi ? 'Đang tạo bằng AI...' : 'Tạo nhanh bằng AI'}
                  </button>
                </div>
                <MathEditor
                  value={formContent}
                  onChange={setFormContent}
                  placeholder="Nhập đề bài câu hỏi tại đây... Nhấn Win+Shift+S rồi Ctrl+V để dán ảnh trực tiếp!"
                  rows={4}
                />
              </div>

              {/* Single Choice Options */}
              {formType === 'single_choice' && (
                <div className="space-y-2 rounded-2xl bg-slate-50 p-4 border border-slate-200">
                  <span className="text-xs font-bold text-slate-800 block">4 Lựa chọn trả lời:</span>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Phương án A"
                      value={optA}
                      onChange={(e) => setOptA(e.target.value)}
                      className="rounded-xl border border-slate-200 p-2 text-xs bg-white text-slate-900 focus:outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Phương án B"
                      value={optB}
                      onChange={(e) => setOptB(e.target.value)}
                      className="rounded-xl border border-slate-200 p-2 text-xs bg-white text-slate-900 focus:outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Phương án C"
                      value={optC}
                      onChange={(e) => setOptC(e.target.value)}
                      className="rounded-xl border border-slate-200 p-2 text-xs bg-white text-slate-900 focus:outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Phương án D"
                      value={optD}
                      onChange={(e) => setOptD(e.target.value)}
                      className="rounded-xl border border-slate-200 p-2 text-xs bg-white text-slate-900 focus:outline-none"
                    />
                  </div>

                  <div className="mt-3 flex items-center gap-3">
                    <span className="text-xs font-semibold text-slate-700">Đáp án đúng:</span>
                    {['A', 'B', 'C', 'D'].map((choice) => (
                      <label key={choice} className="flex items-center gap-1.5 text-xs text-slate-800 cursor-pointer font-bold">
                        <input
                          type="radio"
                          name="correctSingle"
                          value={choice}
                          checked={correctSingle === choice}
                          onChange={(e) => setCorrectSingle(e.target.value)}
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        <span>{choice}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Short Answer */}
              {formType === 'short_answer' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Đáp số đúng:</label>
                  <input
                    type="text"
                    placeholder="VD: 4 hoặc 0.5"
                    value={shortAns}
                    onChange={(e) => setShortAns(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none"
                  />
                </div>
              )}

              {/* Explanation */}
              <div>
                <MathEditor
                  value={formExplanation}
                  onChange={setFormExplanation}
                  label="Lời giải chi tiết chuẩn sư phạm:"
                  placeholder="Nhập lời giải chi tiết (tùy chọn)..."
                  rows={3}
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-blue-500 transition"
                >
                  Thêm Vào Ngân Hàng
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Chỉnh Sửa Câu Hỏi */}
      {showEditModal && editingQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Pencil className="h-5 w-5 text-blue-600" />
                Chỉnh Sửa Câu Hỏi Trong Ngân Hàng
              </h3>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingQuestion(null);
                }}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateQuestion} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Dạng câu hỏi:</label>
                  <select
                    value={editType}
                    onChange={(e) => setEditType(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none"
                  >
                    <option value="single_choice">Trắc nghiệm 1 đáp án</option>
                    <option value="short_answer">Điền số ngắn</option>
                    <option value="essay">Tự luận</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Khối lớp:</label>
                  <select
                    value={editGrade}
                    onChange={(e) => setEditGrade(Number(e.target.value) as any)}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none"
                  >
                    <option value={12}>Lớp 12</option>
                    <option value={11}>Lớp 11</option>
                    <option value={10}>Lớp 10</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Chuyên đề:</label>
                  <input
                    type="text"
                    value={editTopic}
                    onChange={(e) => setEditTopic(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Mức độ:</label>
                  <select
                    value={editDifficulty}
                    onChange={(e) => setEditDifficulty(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none"
                  >
                    <option value="nhan_biet">Nhận biết</option>
                    <option value="thong_hieu">Thông hiểu</option>
                    <option value="van_dung">Vận dụng</option>
                    <option value="van_dung_cao">Vận dụng cao</option>
                  </select>
                </div>
              </div>

              {/* Content Editor */}
              <div>
                <MathEditor
                  value={editContent}
                  onChange={setEditContent}
                  label="Đề bài (hỗ trợ LaTeX, Ctrl+V dán ảnh):"
                  rows={4}
                />
              </div>

              {/* Single Choice Options */}
              {editType === 'single_choice' && (
                <div className="space-y-2 rounded-2xl bg-slate-50 p-4 border border-slate-200">
                  <span className="text-xs font-bold text-slate-800 block">4 Lựa chọn trả lời:</span>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Phương án A"
                      value={editOptA}
                      onChange={(e) => setEditOptA(e.target.value)}
                      className="rounded-xl border border-slate-200 p-2 text-xs bg-white text-slate-900 focus:outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Phương án B"
                      value={editOptB}
                      onChange={(e) => setEditOptB(e.target.value)}
                      className="rounded-xl border border-slate-200 p-2 text-xs bg-white text-slate-900 focus:outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Phương án C"
                      value={editOptC}
                      onChange={(e) => setEditOptC(e.target.value)}
                      className="rounded-xl border border-slate-200 p-2 text-xs bg-white text-slate-900 focus:outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Phương án D"
                      value={editOptD}
                      onChange={(e) => setEditOptD(e.target.value)}
                      className="rounded-xl border border-slate-200 p-2 text-xs bg-white text-slate-900 focus:outline-none"
                    />
                  </div>

                  <div className="mt-3 flex items-center gap-3">
                    <span className="text-xs font-semibold text-slate-700">Đáp án đúng:</span>
                    {['A', 'B', 'C', 'D'].map((choice) => (
                      <label key={choice} className="flex items-center gap-1.5 text-xs text-slate-800 cursor-pointer font-bold">
                        <input
                          type="radio"
                          name="editCorrectSingle"
                          value={choice}
                          checked={editCorrectSingle === choice}
                          onChange={(e) => setEditCorrectSingle(e.target.value)}
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        <span>{choice}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Short Answer */}
              {editType === 'short_answer' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Đáp số đúng:</label>
                  <input
                    type="text"
                    value={editShortAns}
                    onChange={(e) => setEditShortAns(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none"
                  />
                </div>
              )}

              {/* Explanation */}
              <div>
                <MathEditor
                  value={editExplanation}
                  onChange={setEditExplanation}
                  label="Lời giải chi tiết chuẩn sư phạm:"
                  rows={3}
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingQuestion(null);
                  }}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-blue-500 transition"
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
