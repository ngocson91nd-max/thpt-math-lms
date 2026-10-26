'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { MOCK_EXAMS, MOCK_SUBMISSIONS } from '@/lib/supabase/mockStore';
import { Exam, Question } from '@/types/database';
import MathRenderer from '@/components/math/MathRenderer';
import { gradeExamSubmission } from '@/lib/grading/grader';
import { createClient } from '@/lib/supabase/client';
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
} from 'lucide-react';

export default function TakeExamPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { user } = useAuth();

  const [exam, setExam] = useState<Exam | undefined>(() => {
    return MOCK_EXAMS.find((e) => e.id === resolvedParams.id) || MOCK_EXAMS[0];
  });

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [timeLeft, setTimeLeft] = useState((exam?.duration_minutes || 90) * 60);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Tải thông tin đề thi từ localStorage hoặc Supabase nếu có
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedExams = localStorage.getItem('lms_exams');
      if (savedExams) {
        try {
          const parsed: Exam[] = JSON.parse(savedExams);
          const found = parsed.find((e) => e.id === resolvedParams.id);
          if (found) {
            setExam(found);
            setTimeLeft(found.duration_minutes * 60);
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
        .eq('id', resolvedParams.id)
        .single()
        .then(({ data, error }) => {
          if (!error && data) {
            setExam(data as any);
            setTimeLeft(data.duration_minutes * 60);
          }
        });
    }
  }, [resolvedParams.id]);

  const questions: Question[] = exam?.questions || [];

  // Bộ đếm thời gian thực
  useEffect(() => {
    if (timeLeft <= 0) {
      handleFinalSubmit();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

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

  const handleSingleChoiceSelect = (qId: string, optionId: string) => {
    setAnswers((prev) => ({ ...prev, [qId]: optionId }));
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
  };

  const handleTrueFalseSelect = (qId: string, stmtId: string, isTrue: boolean) => {
    const existing = answers[qId] || {};
    setAnswers((prev) => ({
      ...prev,
      [qId]: { ...existing, [stmtId]: isTrue },
    }));
  };

  const handleShortAnswerChange = (qId: string, val: string) => {
    setAnswers((prev) => ({ ...prev, [qId]: val }));
  };

  const handleEssayChange = (qId: string, val: string) => {
    setAnswers((prev) => ({ ...prev, [qId]: val }));
  };

  const handleInsertMathToEssay = (snippet: string) => {
    if (!currentQ) return;
    const existing = answers[currentQ.id] || '';
    setAnswers((prev) => ({ ...prev, [currentQ.id]: existing + ' ' + snippet }));
  };

  const toggleFlag = (qId: string) => {
    setFlagged((prev) => ({ ...prev, [qId]: !prev[qId] }));
  };

  // Tính số lượng câu đã làm
  const answeredCount = questions.filter((q) => {
    const ans = answers[q.id];
    if (ans === undefined || ans === null || ans === '') return false;
    if (Array.isArray(ans) && ans.length === 0) return false;
    if (q.type === 'true_false' && Object.keys(ans).length === 0) return false;
    return true;
  }).length;

  const handleFinalSubmit = async () => {
    if (!exam) return;
    setIsSubmitting(true);

    // Chấm điểm phía máy chủ
    const gradingResult = gradeExamSubmission(questions, answers);

    const maxScore = exam.format === 'periodic_4_parts' ? 20.0 : 10.0;

    // Sử dụng UUID hợp lệ tương thích hoàn toàn với PostgreSQL UUID
    const newSubId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : '99999999-9999-9999-9999-999999999999';

    const startTimeIso = new Date(Date.now() - (exam.duration_minutes * 60 - timeLeft) * 1000).toISOString();
    const submittedAtIso = new Date().toISOString();
    const studentId = user?.id || '33333333-3333-3333-3333-333333333333';

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
      teacher_feedback: gradingResult.hasPendingEssay
        ? 'Bài thi có câu tự luận, đang chờ Thầy Sơn chấm điểm và ghi nhận xét.'
        : 'Đã hoàn thành toàn bộ bài thi trắc nghiệm.',
      answers: gradingResult.answers.map((r) => ({
        question_id: r.questionId,
        student_answer: answers[r.questionId],
        is_correct: r.isCorrect ?? undefined,
        earned_points: r.earnedPoints,
        max_points: r.maxPoints,
      })),
    };

    // Đồng bộ lưu trực tiếp vào cơ sở dữ liệu Supabase nếu có
    try {
      const supabase = createClient();
      if (supabase && user) {
        await supabase.from('submissions').insert([
          {
            id: newSubId,
            exam_id: exam.id,
            student_id: user.id,
            start_time: startTimeIso,
            submitted_at: submittedAtIso,
            score: gradingResult.score,
            max_score: maxScore,
            status: gradingResult.hasPendingEssay ? 'grading' : 'graded',
            teacher_feedback: gradingResult.hasPendingEssay
              ? 'Bài thi có câu tự luận, đang chờ Thầy chấm.'
              : 'Hoàn thành bài thi trắc nghiệm.',
          },
        ]);

        const answersData = gradingResult.answers.map((r) => ({
          submission_id: newSubId,
          question_id: r.questionId,
          student_answer: answers[r.questionId] ?? null,
          is_correct: r.isCorrect ?? null,
          earned_points: r.earnedPoints,
          max_points: r.maxPoints,
        }));
        await supabase.from('submission_answers').insert(answersData);
      }
    } catch (err) {
      console.warn('Supabase submission save info:', err);
    }

    MOCK_SUBMISSIONS.unshift(newSubmission as any);

    // Lưu vào localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem(`submission_${newSubId}`, JSON.stringify(newSubmission));
      const mySubmissionsKey = `my_submissions_${studentId}`;
      const existingMySubs = JSON.parse(localStorage.getItem(mySubmissionsKey) || '[]');
      existingMySubs.unshift(newSubmission);
      localStorage.setItem(mySubmissionsKey, JSON.stringify(existingMySubs));
    }

    router.push(`/exams/${exam.id}/result/${newSubId}`);
  };

  if (!exam || questions.length === 0 || !currentQ) {
    return <div className="p-8 text-center text-slate-500">Đang tải đề thi...</div>;
  }

  const isLowTime = timeLeft < 300; // Dưới 5 phút

  // Lấy thông tin Phần của câu hỏi hiện tại
  const getPartDetails = (q: Question) => {
    const p = q.part || (q.type === 'essay' ? 4 : q.type === 'short_answer' ? 3 : q.type === 'true_false' ? 2 : 1);
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
        sub: 'Trong mỗi ý a), b), c), d) ở mỗi câu, thí sinh chọn Đúng hoặc Sai. Chuẩn Bộ: 1 ý=0.1đ • 2 ý=0.25đ • 3 ý=0.5đ • 4 ý=1.0đ.',
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
      sub: 'Thí sinh trình bày chi tiết các bước giải toán, lập luận và đáp số cuối cùng.',
      theme: 'emerald',
    };
  };

  const partInfo = getPartDetails(currentQ);

  // Phân nhóm câu hỏi theo Phần cho Bảng điều khiển (Sidebar)
  const part1Questions = questions.map((q, idx) => ({ q, idx })).filter((item) => (item.q.part || (item.q.type === 'essay' ? 4 : item.q.type === 'short_answer' ? 3 : item.q.type === 'true_false' ? 2 : 1)) === 1);
  const part2Questions = questions.map((q, idx) => ({ q, idx })).filter((item) => (item.q.part || (item.q.type === 'essay' ? 4 : item.q.type === 'short_answer' ? 3 : item.q.type === 'true_false' ? 2 : 1)) === 2);
  const part3Questions = questions.map((q, idx) => ({ q, idx })).filter((item) => (item.q.part || (item.q.type === 'essay' ? 4 : item.q.type === 'short_answer' ? 3 : item.q.type === 'true_false' ? 2 : 1)) === 3);
  const part4Questions = questions.map((q, idx) => ({ q, idx })).filter((item) => (item.q.part || (item.q.type === 'essay' ? 4 : item.q.type === 'short_answer' ? 3 : item.q.type === 'true_false' ? 2 : 1)) === 4);

  return (
    <div className="space-y-6">
      {!user && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800 animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <span>
              Bạn đang làm bài với tư cách <strong>Khách</strong>. Điểm số vẫn được chấm đầy đủ, nhưng hãy{' '}
              <a href="/login" target="_blank" className="font-bold underline text-blue-700">Đăng nhập</a> hoặc{' '}
              <a href="/register" target="_blank" className="font-bold underline text-blue-700">Đăng ký</a> để lưu vào học bạ cá nhân của Thầy Sơn!
            </span>
          </div>
        </div>
      )}

      {/* Top Bar: Title & Countdown Timer */}
      <div className="sticky top-16 z-40 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white/95 px-6 py-4 shadow-sm backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700">
              Lớp {exam.grade}
            </span>
            {exam.format === 'periodic_4_parts' ? (
              <span className="rounded-md bg-purple-100 px-2 py-0.5 text-[11px] font-bold text-purple-700">
                Đề Định kỳ / HSG (4 Phần)
              </span>
            ) : exam.format === 'standard_3_parts' ? (
              <span className="rounded-md bg-cyan-100 px-2 py-0.5 text-[11px] font-bold text-cyan-800">
                Chuẩn Bộ GD&ĐT 2025
              </span>
            ) : null}
          </div>
          <h1 className="text-lg font-bold text-slate-900 mt-1">{exam.title}</h1>
        </div>

        <div className="flex items-center gap-4">
          <div
            className={`flex items-center gap-2 rounded-xl px-4 py-2 font-mono font-bold text-sm border transition ${
              isLowTime
                ? 'border-rose-300 bg-rose-50 text-rose-600 animate-pulse'
                : 'border-slate-200 bg-slate-50 text-slate-800'
            }`}
          >
            <Clock className={`h-4 w-4 ${isLowTime ? 'text-rose-600' : 'text-blue-600'}`} />
            <span>Thời gian còn: {formatTime(timeLeft)}</span>
          </div>

          <button
            onClick={() => setShowSubmitModal(true)}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-500 transition active:scale-95 cursor-pointer"
          >
            <Send className="h-4 w-4" />
            Nộp bài
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Question Area (3 Cols) */}
        <div className="lg:col-span-3 space-y-6">
          {/* Section Indicator Banner */}
          <div
            className={`rounded-2xl border p-4 ${
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
                className={`rounded-lg px-2 py-0.5 text-xs font-black uppercase text-white ${
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

          <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
            {/* Question Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white shadow-xs">
                  {currentIndex + 1}
                </span>
                <div>
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    {currentQ.type === 'single_choice' && 'Trắc nghiệm 1 đáp án'}
                    {currentQ.type === 'multiple_choice' && 'Trắc nghiệm nhiều đáp án'}
                    {currentQ.type === 'true_false' && 'Đúng/Sai 4 ý chuẩn THPT'}
                    {currentQ.type === 'short_answer' && 'Điền đáp số ngắn'}
                    {currentQ.type === 'essay' && 'Tự luận trình bày'}
                  </div>
                  <div className="text-xs text-slate-500">
                    Chủ đề: {currentQ.topic} • {currentQ.points} điểm
                  </div>
                </div>
              </div>

              <button
                onClick={() => toggleFlag(currentQ.id)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border transition cursor-pointer ${
                  flagged[currentQ.id]
                    ? 'border-amber-300 bg-amber-50 text-amber-700'
                    : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
              >
                <Flag className="h-3.5 w-3.5" />
                {flagged[currentQ.id] ? 'Đã đánh dấu' : 'Đánh dấu xem lại'}
              </button>
            </div>

            {/* Question Content (Rendered KaTeX) */}
            <div className="text-base text-slate-900 leading-relaxed font-medium">
              <MathRenderer content={currentQ.content} />
            </div>

            {/* Answer Controls Based on Question Type */}
            <div className="mt-8 space-y-4">
              {/* 1. Single Choice */}
              {currentQ.type === 'single_choice' && (
                <div className="space-y-3">
                  {currentQ.options?.map((opt: any) => {
                    const isSelected = answers[currentQ.id] === opt.id;
                    return (
                      <label
                        key={opt.id}
                        onClick={() => handleSingleChoiceSelect(currentQ.id, opt.id)}
                        className={`flex items-start gap-3.5 rounded-2xl border p-4 cursor-pointer transition ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                        }`}
                      >
                        <div
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition mt-0.5 ${
                            isSelected
                              ? 'border-blue-600 bg-blue-600 text-white'
                              : 'border-slate-300 text-slate-600'
                          }`}
                        >
                          {opt.id}
                        </div>
                        <div className="flex-1 text-slate-800 text-sm">
                          <MathRenderer content={opt.text} />
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}

              {/* 2. Multiple Choice */}
              {currentQ.type === 'multiple_choice' && (
                <div className="space-y-3">
                  <div className="text-xs font-medium text-blue-600">
                    * Chọn tất cả các phương án đúng:
                  </div>
                  {currentQ.options?.map((opt: any) => {
                    const isSelected = (answers[currentQ.id] || []).includes(opt.id);
                    return (
                      <label
                        key={opt.id}
                        onClick={() => handleMultipleChoiceToggle(currentQ.id, opt.id)}
                        className={`flex items-start gap-3.5 rounded-2xl border p-4 cursor-pointer transition ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                        }`}
                      >
                        <div
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-xs font-bold transition mt-0.5 ${
                            isSelected
                              ? 'border-indigo-600 bg-indigo-600 text-white'
                              : 'border-slate-300 text-slate-600'
                          }`}
                        >
                          {opt.id}
                        </div>
                        <div className="flex-1 text-slate-800 text-sm">
                          <MathRenderer content={opt.text} />
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}

              {/* 3. True / False (4 statements) */}
              {currentQ.type === 'true_false' && (
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                      <tr>
                        <th className="py-3 px-4 w-12 text-center">Ý</th>
                        <th className="py-3 px-4">Khẳng định</th>
                        <th className="py-3 px-4 w-24 text-center">Đúng</th>
                        <th className="py-3 px-4 w-24 text-center">Sai</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {currentQ.options?.map((stmt: any) => {
                        const val = (answers[currentQ.id] || {})[stmt.id];
                        return (
                          <tr key={stmt.id} className="hover:bg-slate-50/50">
                            <td className="py-3.5 px-4 font-bold text-center text-slate-700 uppercase">
                              {stmt.id})
                            </td>
                            <td className="py-3.5 px-4 text-slate-800">
                              <MathRenderer content={stmt.text} />
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <button
                                type="button"
                                onClick={() => handleTrueFalseSelect(currentQ.id, stmt.id, true)}
                                className={`h-8 w-16 rounded-lg text-xs font-bold transition cursor-pointer ${
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
                                onClick={() => handleTrueFalseSelect(currentQ.id, stmt.id, false)}
                                className={`h-8 w-16 rounded-lg text-xs font-bold transition cursor-pointer ${
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

              {/* 4. Short Answer */}
              {currentQ.type === 'short_answer' && (
                <div className="space-y-3">
                  <label className="block text-xs font-semibold text-slate-600">
                    Điền kết quả / đáp số vào ô bên dưới (số nguyên, phân số như 5/2 hoặc số thập phân như 2.25):
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      value={answers[currentQ.id] || ''}
                      onChange={(e) => handleShortAnswerChange(currentQ.id, e.target.value)}
                      placeholder="Nhập đáp số..."
                      className="w-full max-w-sm rounded-xl border border-slate-300 p-3 text-base font-semibold text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                    />
                  </div>
                  {answers[currentQ.id] && (
                    <div className="rounded-lg bg-slate-50 p-2.5 text-xs text-slate-600 flex items-center gap-2">
                      <span>Xem trước:</span>
                      <MathRenderer content={`$${answers[currentQ.id]}$`} inline />
                    </div>
                  )}
                </div>
              )}

              {/* 5. Essay with LaTeX Preview */}
              {currentQ.type === 'essay' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="block text-xs font-semibold text-slate-700">
                      Trình bày bài giải chi tiết các bước (hỗ trợ gõ công thức LaTeX):
                    </label>
                    <div className="flex flex-wrap items-center gap-1 text-xs">
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
                          onClick={() => handleInsertMathToEssay(item.val)}
                          className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-700 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition cursor-pointer"
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <textarea
                    rows={8}
                    value={answers[currentQ.id] || ''}
                    onChange={(e) => handleEssayChange(currentQ.id, e.target.value)}
                    placeholder="Trình bày lời giải toán, lập luận và các bước tính toán tại đây..."
                    className="w-full rounded-2xl border border-slate-300 p-4 text-sm text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none font-mono"
                  />

                  {/* Realtime KaTeX Render Preview */}
                  {answers[currentQ.id] && (
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4 space-y-1">
                      <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                        Bản Xem Trước Bài Trình Bày (KaTeX):
                      </div>
                      <div className="text-sm text-slate-800 pt-1">
                        <MathRenderer content={answers[currentQ.id]} />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Upload className="h-4 w-4 text-slate-400 shrink-0" />
                    <span>Bài làm tự luận sẽ được lưu trữ và gửi trực tiếp cho Thầy Sơn chấm điểm chi tiết.</span>
                  </div>
                </div>
              )}
            </div>

            {/* Navigation buttons */}
            <div className="mt-10 pt-6 border-t border-slate-100 flex items-center justify-between gap-4">
              <button
                type="button"
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
                Câu trước
              </button>

              <div className="text-xs font-medium text-slate-400">
                Câu {currentIndex + 1} / {questions.length}
              </div>

              <button
                type="button"
                disabled={currentIndex === questions.length - 1}
                onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
              >
                Câu sau
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar Question Palette (1 Col) */}
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900">Bảng Số Câu Hỏi</h3>
              <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                Đã làm: {answeredCount}/{questions.length}
              </span>
            </div>

            {/* Helper function to render group */}
            {[
              { title: 'Phần I: Trắc Nghiệm', list: part1Questions, color: 'blue' },
              { title: 'Phần II: Đúng / Sai', list: part2Questions, color: 'indigo' },
              { title: 'Phần III: Điền Số Ngắn', list: part3Questions, color: 'amber' },
              { title: 'Phần IV: Tự Luận VDC', list: part4Questions, color: 'emerald' },
            ].map((sec) => {
              if (sec.list.length === 0) return null;
              return (
                <div key={sec.title} className="space-y-2">
                  <div className="text-xs font-bold text-slate-600 flex items-center justify-between border-b border-slate-100 pb-1">
                    <span>{sec.title}</span>
                    <span className="text-[11px] font-normal text-slate-400">({sec.list.length} câu)</span>
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                    {sec.list.map(({ q, idx }) => {
                      const isCurrent = idx === currentIndex;
                      const isFlag = flagged[q.id];
                      const hasAns = answers[q.id] !== undefined && answers[q.id] !== '';

                      let btnClass = 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200';
                      if (isCurrent) {
                        btnClass = 'ring-2 ring-blue-600 bg-blue-600 text-white font-bold shadow-xs';
                      } else if (isFlag) {
                        btnClass = 'bg-amber-100 text-amber-800 border-amber-300 font-semibold';
                      } else if (hasAns) {
                        btnClass = 'bg-blue-50 text-blue-700 border-blue-200 font-semibold';
                      }

                      return (
                        <button
                          key={q.id}
                          onClick={() => setCurrentIndex(idx)}
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
                </div>
              );
            })}

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
                <span>Đã đánh dấu</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-blue-600" />
                <span>Đang chọn</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Submit Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Xác Nhận Nộp Bài Thi</h3>
            <div className="rounded-xl bg-slate-50 p-4 space-y-2 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Tổng số câu hỏi:</span>
                <span className="font-bold text-slate-900">{questions.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Số câu đã hoàn thành:</span>
                <span className="font-bold text-emerald-600">{answeredCount} câu</span>
              </div>
              <div className="flex justify-between">
                <span>Số câu chưa làm:</span>
                <span className="font-bold text-rose-500">{questions.length - answeredCount} câu</span>
              </div>
              <div className="flex justify-between">
                <span>Thời gian còn lại:</span>
                <span className="font-bold text-blue-600">{formatTime(timeLeft)}</span>
              </div>
            </div>

            <p className="text-xs text-slate-500">
              Sau khi nộp bài, hệ thống sẽ tự động chấm điểm các phần trắc nghiệm và chuyển phần tự luận cho Thầy Sơn.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setShowSubmitModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Tiếp tục làm bài
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleFinalSubmit}
                className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-500 transition cursor-pointer"
              >
                {isSubmitting ? 'Đang chấm điểm...' : 'Xác Nhận Nộp Bài'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
