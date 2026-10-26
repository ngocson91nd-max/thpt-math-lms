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
} from 'lucide-react';

export default function TakeExamPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { user } = useAuth();

  const exam: Exam | undefined =
    MOCK_EXAMS.find((e) => e.id === resolvedParams.id) || MOCK_EXAMS[0];

  const questions: Question[] = exam?.questions || [];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [timeLeft, setTimeLeft] = useState((exam?.duration_minutes || 45) * 60);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
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
    setIsSubmitting(true);

    // Chấm điểm phía máy chủ
    const gradingResult = gradeExamSubmission(questions, answers);

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
      max_score: 10.0,
      status: gradingResult.hasPendingEssay ? ('grading' as const) : ('graded' as const),
      teacher_feedback: gradingResult.hasPendingEssay
        ? 'Bài thi có câu tự luận, đang chờ giáo viên chấm và ghi nhận xét.'
        : 'Hoàn thành bài thi trắc nghiệm.',
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
            max_score: 10.0,
            status: gradingResult.hasPendingEssay ? 'grading' : 'graded',
            teacher_feedback: gradingResult.hasPendingEssay
              ? 'Bài thi có câu tự luận, đang chờ giáo viên chấm.'
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
      // Lưu vào danh sách các bài làm của học sinh
      const mySubmissionsKey = `my_submissions_${studentId}`;
      const existingMySubs = JSON.parse(localStorage.getItem(mySubmissionsKey) || '[]');
      existingMySubs.unshift(newSubmission);
      localStorage.setItem(mySubmissionsKey, JSON.stringify(existingMySubs));
    }

    router.push(`/exams/${exam.id}/result/${newSubId}`);
  };

  if (!currentQ) {
    return <div className="p-8 text-center text-slate-500">Đang tải đề thi...</div>;
  }

  const isLowTime = timeLeft < 300; // Dưới 5 phút

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
          <span className="rounded-md bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700">
            Lớp {exam.grade}
          </span>
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
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-500 transition active:scale-95"
          >
            <Send className="h-4 w-4" />
            Nộp bài
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Question Area (3 Cols) */}
        <div className="lg:col-span-3 space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
            {/* Question Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
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
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border transition ${
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
                                className={`h-8 w-16 rounded-lg text-xs font-bold transition ${
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
                                className={`h-8 w-16 rounded-lg text-xs font-bold transition ${
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
                    Điền kết quả / đáp số vào ô bên dưới (số nguyên, phân số như 5/2 hoặc số thập phân như 2.5):
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

              {/* 5. Essay */}
              {currentQ.type === 'essay' && (
                <div className="space-y-4">
                  <label className="block text-xs font-semibold text-slate-600">
                    Trình bày bài giải tự luận hoặc dán link ảnh/bài làm:
                  </label>
                  <textarea
                    rows={6}
                    value={answers[currentQ.id] || ''}
                    onChange={(e) => handleEssayChange(currentQ.id, e.target.value)}
                    placeholder="Nhập các bước chứng minh, lập luận và đáp số cuối cùng..."
                    className="w-full rounded-2xl border border-slate-200 p-4 text-sm text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none font-sans"
                  />
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Upload className="h-4 w-4 text-slate-400" />
                    <span>Học sinh có thể gõ trực tiếp công thức LaTeX hoặc chèn link ảnh bài giải viết tay.</span>
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
                className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
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
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Câu sau
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar Question Palette (1 Col) */}
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs">
            <h3 className="font-bold text-sm text-slate-900 mb-3">Danh Sách Câu Hỏi</h3>

            <div className="grid grid-cols-5 gap-2.5">
              {questions.map((q, idx) => {
                const isCurrent = idx === currentIndex;
                const isFlag = flagged[q.id];
                const hasAns = answers[q.id] !== undefined && answers[q.id] !== '';

                let btnClass = 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200';
                if (isCurrent) {
                  btnClass = 'ring-2 ring-blue-600 bg-blue-600 text-white font-bold';
                } else if (isFlag) {
                  btnClass = 'bg-amber-100 text-amber-800 border-amber-300 font-semibold';
                } else if (hasAns) {
                  btnClass = 'bg-blue-50 text-blue-700 border-blue-200 font-semibold';
                }

                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentIndex(idx)}
                    className={`relative flex h-10 w-full items-center justify-center rounded-xl border text-xs transition ${btnClass}`}
                  >
                    {idx + 1}
                    {isFlag && (
                      <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-amber-500" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="mt-6 pt-4 border-t border-slate-100 space-y-2 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-md bg-blue-50 border border-blue-200" />
                <span>Đã trả lời ({answeredCount})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-md bg-amber-100 border border-amber-300" />
                <span>Đã đánh dấu xem lại ({Object.values(flagged).filter(Boolean).length})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-md bg-slate-100 border border-slate-200" />
                <span>Chưa trả lời ({questions.length - answeredCount})</span>
              </div>
            </div>

            <div className="mt-6">
              <button
                type="button"
                onClick={() => setShowSubmitModal(true)}
                className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-500 transition active:scale-98"
              >
                Nộp Bài Thi
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Submit Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-amber-600 mb-3">
              <AlertTriangle className="h-6 w-6" />
              <h3 className="text-lg font-bold text-slate-900">Xác Nhận Nộp Bài</h3>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed">
              Bạn đã hoàn thành <strong className="text-blue-600">{answeredCount}/{questions.length}</strong> câu hỏi.
              {answeredCount < questions.length && (
                <span className="block mt-2 text-rose-600 text-xs font-semibold">
                  Cảnh báo: Còn {questions.length - answeredCount} câu chưa điền đáp án!
                </span>
              )}
            </p>

            <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
              >
                Tiếp tục làm bài
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleFinalSubmit}
                className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-500 transition disabled:opacity-50"
              >
                {isSubmitting ? 'Đang chấm điểm...' : 'Đồng ý nộp bài'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
