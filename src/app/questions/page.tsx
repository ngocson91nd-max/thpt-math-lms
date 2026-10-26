'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { MOCK_QUESTIONS } from '@/lib/supabase/mockStore';
import { Question, QuestionType, QuestionDifficulty } from '@/types/database';
import MathRenderer from '@/components/math/MathRenderer';
import MathEditor from '@/components/math/MathEditor';
import { createClient } from '@/lib/supabase/client';
import { parseWordDocx } from '@/lib/word/wordExamParser';
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
} from 'lucide-react';

export default function QuestionsPage() {
  const { isTeacher } = useAuth();
  const [questions, setQuestions] = useState<Question[]>(MOCK_QUESTIONS);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all');
  const [gradeFilter, setGradeFilter] = useState<string>('all');
  const [partFilter, setPartFilter] = useState<'all' | 1 | 2 | 3 | 4>('all');

  // Modal States
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
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

  // Tải danh sách câu hỏi từ localStorage hoặc Supabase
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('lms_questions');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const existingIds = new Set(parsed.map((q: any) => q.id));
            const missing = MOCK_QUESTIONS.filter((q) => !existingIds.has(q.id));
            setQuestions([...parsed, ...missing]);
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
        .from('questions')
        .select('*')
        .then(({ data, error }) => {
          if (!error && data && data.length > 0) {
            setQuestions(data as any);
            if (typeof window !== 'undefined') {
              localStorage.setItem('lms_questions', JSON.stringify(data));
            }
          }
        });
    }
  }, []);

  const saveQuestions = (updated: Question[]) => {
    setQuestions(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('lms_questions', JSON.stringify(updated));
    }
  };

  const [isUploadingWord, setIsUploadingWord] = useState(false);
  const handleWordImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingWord(true);
    try {
      const { questions: extracted } = await parseWordDocx(file);
      if (extracted.length === 0) {
        alert('Không tìm thấy câu hỏi nào (định dạng "Câu 1:", "Bài 1:", v.v.) trong file Word!');
      } else {
        const updated = [...extracted, ...questions];
        saveQuestions(updated);
        alert(`Đã nhập thành công ${extracted.length} câu hỏi từ file "${file.name}" vào Ngân hàng câu hỏi!`);
      }
    } catch (err: any) {
      alert(`Lỗi đọc file Word: ${err?.message || 'Không xác định'}`);
    } finally {
      setIsUploadingWord(false);
      e.target.value = '';
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
        : `q-${Date.now()}`;

    const newQ: Question = {
      id: newId,
      teacher_id: '22222222-2222-2222-2222-222222222222',
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

    try {
      const supabase = createClient();
      if (supabase) {
        await supabase.from('questions').insert([
          {
            id: newId,
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
          },
        ]);
      }
    } catch (err) {
      console.warn('Lỗi thêm câu hỏi trên Supabase:', err);
    }

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

    const updated = questions.map((q) => {
      if (q.id === editingQuestion.id) {
        return {
          ...q,
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
      }
      return q;
    });

    saveQuestions(updated);

    try {
      const supabase = createClient();
      if (supabase) {
        await supabase
          .from('questions')
          .update({
            grade: editGrade,
            topic: editTopic,
            difficulty: editDifficulty,
            type: editType,
            content: editContent,
            options,
            correct_answer,
            explanation: editExplanation,
            points: Number(editPoints),
          })
          .eq('id', editingQuestion.id);
      }
    } catch (err) {
      console.warn('Lỗi cập nhật câu hỏi trên Supabase:', err);
    }

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

    try {
      const supabase = createClient();
      if (supabase) {
        await supabase.from('questions').delete().eq('id', questionId);
      }
    } catch (err) {
      console.warn('Lỗi xóa câu hỏi trên Supabase:', err);
    }
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
            Kho câu hỏi phong phú chuẩn hóa theo 5 định dạng của Bộ GD&ĐT 2025, hiển thị chuẩn KaTeX và tích hợp AI.
          </p>
        </div>

        {isTeacher && (
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
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
            <option value="all">Tất cả các lớp (10, 11, 12)</option>
            <option value="12">Toán Lớp 12</option>
            <option value="11">Toán Lớp 11</option>
            <option value="10">Toán Lớp 10</option>
          </select>
        </div>

        <div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-blue-500"
          >
            <option value="all">Tất cả dạng câu hỏi</option>
            <option value="single_choice">Trắc nghiệm 1 đáp án (Phần I)</option>
            <option value="true_false">Đúng / Sai 4 ý (Phần II)</option>
            <option value="short_answer">Điền đáp số ngắn (Phần III)</option>
            <option value="multiple_choice">Nhiều lựa chọn đúng</option>
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
          <div className="rounded-2xl border border-dashed border-slate-200 p-12 text-center text-slate-400 text-xs">
            Không tìm thấy câu hỏi nào phù hợp với bộ lọc.
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
                </div>
              </div>

              {/* Question Content */}
              <div className="text-sm text-slate-800 leading-relaxed font-medium">
                <MathRenderer content={q.content} />
              </div>

              {/* Options Preview */}
              {q.options && q.options.length > 0 && (
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {q.options.map((opt: any) => (
                    <div
                      key={opt.id}
                      className="flex items-start gap-2 rounded-xl bg-slate-50 p-2.5 border border-slate-100"
                    >
                      <span className="font-bold text-slate-600 uppercase">{opt.id}.</span>
                      <div className="text-slate-800">
                        <MathRenderer content={opt.text} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Correct Answer & Explanation Preview */}
              {q.explanation && (
                <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/40 p-3 text-xs">
                  <div className="font-bold text-blue-900 mb-1">
                    Đáp án đúng:{' '}
                    <span className="font-mono text-emerald-700">
                      {typeof q.correct_answer === 'object'
                        ? JSON.stringify(q.correct_answer)
                        : String(q.correct_answer)}
                    </span>
                  </div>
                  <MathRenderer content={q.explanation} className="text-slate-700 leading-relaxed" />
                </div>
              )}

              {/* Teacher Actions (Edit / Delete) */}
              {isTeacher && (
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => openEditQuestion(q)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 transition"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    <span>Sửa câu hỏi</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteQuestion(q.id)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Xóa câu hỏi</span>
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Modal Thêm Câu Hỏi Mới */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-3xl my-8 rounded-3xl bg-white p-6 sm:p-8 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Thêm Câu Hỏi Toán Mới</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Soạn câu hỏi với công thức KaTeX và hỗ trợ tạo tự động bằng AI.
                </p>
              </div>

              <button
                type="button"
                disabled={isGeneratingAi}
                onClick={handleAiGenerate}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-3.5 py-2 text-xs font-bold text-white shadow-md shadow-indigo-500/20 hover:from-indigo-500 hover:to-purple-500 transition disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                {isGeneratingAi ? 'AI Đang Soạn Đề...' : 'AI Tạo Đề Tự Động'}
              </button>
            </div>

            <form onSubmit={handleCreateQuestion} className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Khối lớp</label>
                  <select
                    value={formGrade}
                    onChange={(e) => setFormGrade(Number(e.target.value) as any)}
                    className="w-full rounded-xl border border-slate-200 p-2 text-xs text-slate-900 focus:outline-none"
                  >
                    <option value={12}>Lớp 12</option>
                    <option value={11}>Lớp 11</option>
                    <option value={10}>Lớp 10</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Chủ đề</label>
                  <input
                    type="text"
                    value={formTopic}
                    onChange={(e) => setFormTopic(e.target.value)}
                    placeholder="Khảo sát hàm số, Oxyz..."
                    className="w-full rounded-xl border border-slate-200 p-2 text-xs text-slate-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Mức độ</label>
                  <select
                    value={formDifficulty}
                    onChange={(e) => setFormDifficulty(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-200 p-2 text-xs text-slate-900 focus:outline-none"
                  >
                    <option value="nhan_biet">Nhận biết</option>
                    <option value="thong_hieu">Thông hiểu</option>
                    <option value="van_dung">Vận dụng</option>
                    <option value="van_dung_cao">Vận dụng cao</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Dạng câu</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-200 p-2 text-xs text-slate-900 focus:outline-none"
                  >
                    <option value="single_choice">Trắc nghiệm 1 đáp án</option>
                    <option value="true_false">Đúng / Sai 4 ý</option>
                    <option value="short_answer">Điền đáp số ngắn</option>
                    <option value="essay">Tự luận</option>
                  </select>
                </div>
              </div>

              {/* Math Editor for Content */}
              <div>
                <MathEditor
                  value={formContent}
                  onChange={setFormContent}
                  label="Nội dung đề bài (Hỗ trợ LaTeX):"
                  placeholder="Ví dụ: Cho hàm số $y = x^3 - 3x^2$... Tính $\int_0^1 ...$"
                  rows={4}
                />
              </div>

              {/* Options if single choice */}
              {formType === 'single_choice' && (
                <div className="space-y-2 rounded-2xl bg-slate-50 p-4 border border-slate-100">
                  <div className="text-xs font-semibold text-slate-700 mb-1">4 Phương án lựa chọn:</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Đáp số đúng:
                  </label>
                  <input
                    type="text"
                    value={shortAns}
                    onChange={(e) => setShortAns(e.target.value)}
                    placeholder="Ví dụ: 6 hoặc 2.5 hoặc 5/2"
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none"
                  />
                </div>
              )}

              {/* Explanation Editor */}
              <div>
                <MathEditor
                  value={formExplanation}
                  onChange={setFormExplanation}
                  label="Lời giải chi tiết chuẩn sư phạm (KaTeX):"
                  placeholder="Trình bày các bước suy luận và công thức toán..."
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
                  Lưu Vào Ngân Hàng Đề
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Chỉnh Sửa Câu Hỏi */}
      {showEditModal && editingQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-3xl my-8 rounded-3xl bg-white p-6 sm:p-8 shadow-2xl animate-in fade-in zoom-in-95">
            <h2 className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-3 mb-5">
              Chỉnh Sửa Câu Hỏi
            </h2>

            <form onSubmit={handleUpdateQuestion} className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Khối lớp</label>
                  <select
                    value={editGrade}
                    onChange={(e) => setEditGrade(Number(e.target.value) as any)}
                    className="w-full rounded-xl border border-slate-200 p-2 text-xs text-slate-900 focus:outline-none"
                  >
                    <option value={12}>Lớp 12</option>
                    <option value={11}>Lớp 11</option>
                    <option value={10}>Lớp 10</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Chủ đề</label>
                  <input
                    type="text"
                    value={editTopic}
                    onChange={(e) => setEditTopic(e.target.value)}
                    placeholder="Khảo sát hàm số..."
                    className="w-full rounded-xl border border-slate-200 p-2 text-xs text-slate-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Mức độ</label>
                  <select
                    value={editDifficulty}
                    onChange={(e) => setEditDifficulty(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-200 p-2 text-xs text-slate-900 focus:outline-none"
                  >
                    <option value="nhan_biet">Nhận biết</option>
                    <option value="thong_hieu">Thông hiểu</option>
                    <option value="van_dung">Vận dụng</option>
                    <option value="van_dung_cao">Vận dụng cao</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Điểm số</label>
                  <input
                    type="number"
                    step="0.05"
                    value={editPoints}
                    onChange={(e) => setEditPoints(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 p-2 text-xs text-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              {/* Content Editor */}
              <div>
                <MathEditor
                  value={editContent}
                  onChange={setEditContent}
                  label="Nội dung câu hỏi (KaTeX):"
                  rows={4}
                />
              </div>

              {/* Options for single choice */}
              {editType === 'single_choice' && (
                <div className="space-y-2 rounded-2xl bg-slate-50 p-4 border border-slate-100">
                  <div className="text-xs font-semibold text-slate-700 mb-1">4 Phương án:</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
