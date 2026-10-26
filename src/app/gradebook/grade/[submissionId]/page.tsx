'use client';

import React, { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MOCK_SUBMISSIONS, MOCK_EXAMS } from '@/lib/supabase/mockStore';
import MathRenderer from '@/components/math/MathRenderer';
import {
  ArrowLeft,
  Sparkles,
  CheckCircle,
  HelpCircle,
  Save,
  Award,
} from 'lucide-react';

export default function GradeEssayPage({
  params,
}: {
  params: Promise<{ submissionId: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();

  const submission =
    MOCK_SUBMISSIONS.find((s) => s.id === resolvedParams.submissionId) ||
    MOCK_SUBMISSIONS[1];

  const exam =
    MOCK_EXAMS.find((e) => e.id === submission.exam_id) || MOCK_EXAMS[0];

  const essayQuestions =
    exam.questions?.filter((q) => q.type === 'essay') || [];

  const [essayScores, setEssayScores] = useState<Record<string, number>>({
    'q7777777-7777-7777-7777-777777777777': 0.85,
  });

  const [teacherComments, setTeacherComments] = useState<Record<string, string>>({
    'q7777777-7777-7777-7777-777777777777':
      'Các bước đạo hàm và tìm điểm cực trị tốt, lưu ý kết luận thêm đơn vị mét (m).',
  });

  const [isAiLoading, setIsAiLoading] = useState(false);

  const handleAiGradeSuggestion = async (qId: string) => {
    setIsAiLoading(true);
    const q = essayQuestions.find((item) => item.id === qId);
    const ans = submission.answers?.find((a) => a.question_id === qId);

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'grade_essay',
          questionContent: q?.content,
          solutionRubric: q?.correct_answer,
          studentAnswer: ans?.student_answer,
          maxPoints: q?.points || 1.0,
        }),
      });

      const data = await res.json();
      if (data.success) {
        if (data.suggestedScore !== undefined) {
          setEssayScores((prev) => ({ ...prev, [qId]: data.suggestedScore }));
        }
        if (data.feedback) {
          setTeacherComments((prev) => ({ ...prev, [qId]: data.feedback }));
        }
      }
    } catch (err) {
      console.error('Lỗi gợi ý AI chấm bài:', err);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleSaveGrade = () => {
    // Cập nhật điểm cho submission
    submission.status = 'graded';
    submission.score = 7.5; // Điểm sau khi cộng phần tự luận
    submission.teacher_feedback =
      'Đã hoàn thành chấm phần tự luận. ' + Object.values(teacherComments).join(' ');

    router.push('/gradebook');
  };

  return (
    <div className="space-y-8 pb-12">
      <Link
        href="/gradebook"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition"
      >
        <ArrowLeft className="h-4 w-4" />
        Quay lại sổ điểm
      </Link>

      {/* Header Banner */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-700 mb-2">
              Chấm Bài Tự Luận
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900">{exam.title}</h1>
            <p className="mt-1 text-xs text-slate-500">
              Học sinh: <strong className="text-slate-800">{submission.student?.full_name}</strong> • Lớp {exam.grade} • Thời gian nộp: {submission.submitted_at ? new Date(submission.submitted_at).toLocaleString('vi-VN') : '25/10/2026'}
            </p>
          </div>

          <button
            onClick={handleSaveGrade}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-500 transition active:scale-95"
          >
            <Save className="h-4 w-4" />
            Lưu Điểm & Hoàn Tất
          </button>
        </div>
      </div>

      {/* Essay Questions List */}
      <div className="space-y-6">
        {essayQuestions.map((q, idx) => {
          const ans = submission.answers?.find((a) => a.question_id === q.id);

          return (
            <div
              key={q.id}
              className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs space-y-6"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-xs font-bold text-white">
                    {idx + 1}
                  </span>
                  <span className="font-bold text-sm text-slate-800">
                    Câu hỏi tự luận #{idx + 1} ({q.topic})
                  </span>
                </div>

                <button
                  type="button"
                  disabled={isAiLoading}
                  onClick={() => handleAiGradeSuggestion(q.id)}
                  className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:from-indigo-600 hover:to-purple-700 transition disabled:opacity-50"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {isAiLoading ? 'AI Đang Đọc Bài...' : 'AI Gợi Ý Chấm Điểm'}
                </button>
              </div>

              {/* Question Content */}
              <div>
                <div className="text-xs font-bold uppercase text-slate-400 mb-1">Đề bài:</div>
                <div className="text-sm font-medium text-slate-900 leading-relaxed">
                  <MathRenderer content={q.content} />
                </div>
              </div>

              {/* Rubric */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase text-slate-500 mb-2">
                  Hướng dẫn chấm / Đáp án gợi ý:
                </div>
                <MathRenderer
                  content={String(q.correct_answer)}
                  className="text-xs text-slate-700 leading-relaxed"
                />
              </div>

              {/* Student Response */}
              <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-4">
                <div className="text-xs font-bold uppercase text-blue-900 mb-2">
                  Bài làm của học sinh:
                </div>
                <div className="text-sm text-slate-900 leading-relaxed">
                  {ans?.student_answer ? (
                    <MathRenderer content={String(ans.student_answer)} />
                  ) : (
                    <span className="text-slate-400 italic text-xs">Học sinh không nộp bài làm.</span>
                  )}
                </div>
              </div>

              {/* Score & Feedback Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Điểm số (Tối đa {q.points}đ):
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    max={q.points}
                    value={essayScores[q.id] ?? 0}
                    onChange={(e) =>
                      setEssayScores((prev) => ({ ...prev, [q.id]: parseFloat(e.target.value) || 0 }))
                    }
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nhận xét của giáo viên:
                  </label>
                  <input
                    type="text"
                    value={teacherComments[q.id] ?? ''}
                    onChange={(e) =>
                      setTeacherComments((prev) => ({ ...prev, [q.id]: e.target.value }))
                    }
                    placeholder="Ghi chú sư phạm cho học sinh..."
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
