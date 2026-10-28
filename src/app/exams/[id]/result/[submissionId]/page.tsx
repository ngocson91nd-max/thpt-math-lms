'use client';

import React, { useEffect, use } from 'react';
import Link from 'next/link';
import confetti from 'canvas-confetti';
import { MOCK_SUBMISSIONS, MOCK_EXAMS } from '@/lib/supabase/mockStore';
import MathRenderer from '@/components/math/MathRenderer';
import {
  Award,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  RotateCcw,
  Sparkles,
  HelpCircle,
  BookOpen,
} from 'lucide-react';

export default function ExamResultPage({
  params,
}: {
  params: Promise<{ id: string; submissionId: string }>;
}) {
  const resolvedParams = use(params);

  // Tìm submission trong mock store hoặc localStorage
  let submission = MOCK_SUBMISSIONS.find((s) => s.id === resolvedParams.submissionId);
  if (!submission && typeof window !== 'undefined') {
    const saved = localStorage.getItem(`submission_${resolvedParams.submissionId}`);
    if (saved) {
      try {
        submission = JSON.parse(saved);
      } catch {}
    }
  }

  let exam = submission?.exam || MOCK_EXAMS.find((e) => e.id === resolvedParams.id);
  if (!exam && typeof window !== 'undefined') {
    const savedExams = localStorage.getItem('lms_exams');
    if (savedExams) {
      try {
        const parsed = JSON.parse(savedExams);
        const found = parsed.find((e: any) => e.id === resolvedParams.id);
        if (found) exam = found;
      } catch {}
    }
  }

  const maxScore = submission?.max_score || (exam?.format === 'periodic_4_parts' ? 20.0 : 10.0);
  const score = submission?.score ?? 0;
  const isHighScorer = score >= (maxScore * 0.8);

  useEffect(() => {
    if (isHighScorer) {
      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
  }, [isHighScorer]);

  if (!submission || !exam) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center">
        <h2 className="text-base font-bold text-slate-800">Không tìm thấy kết quả bài làm</h2>
        <p className="text-xs text-slate-500 mt-1 mb-4">Bài thi hoặc lượt làm này không tồn tại hoặc đã được xóa.</p>
        <Link href="/exams" className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold">
          Quay lại trang Đề thi
        </Link>
      </div>
    );
  }

  const questions = exam.questions || [];

  return (
    <div className="space-y-8 pb-12">
      {/* Score Overview Card */}
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 mb-2">
              Kết Quả Bài Thi Trực Tuyến
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900">{exam.title}</h1>
            <p className="mt-1 text-xs text-slate-500">
              Học sinh: {submission.student?.full_name || 'Học sinh'} • Lớp {exam.grade} • Thời gian nộp: {submission.submitted_at ? new Date(submission.submitted_at).toLocaleString('vi-VN') : '26/10/2026 08:35'}
            </p>
            {(submission as any).tab_switch_count > 0 && (
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1 text-xs font-bold text-amber-800">
                <span>⚠️ Giám sát: Rời màn hình thi {(submission as any).tab_switch_count} lần</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 self-center md:self-auto">
            <div className="flex flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 px-8 py-5 text-white shadow-lg shadow-blue-500/20">
              <span className="text-xs uppercase font-semibold tracking-wider text-blue-100">
                Điểm Đạt Được
              </span>
              <div className="text-4xl font-black mt-1">
                {score.toFixed(2)}
                <span className="text-lg font-normal text-blue-200">/{maxScore}</span>
              </div>
              <span className="text-[11px] text-blue-200 mt-1 font-medium">
                {score >= 8.5
                  ? '🌟 Xuất Sắc'
                  : score >= 7.0
                  ? '👍 Khá - Giỏi'
                  : score >= 5.0
                  ? '✅ Đạt Yêu Cầu'
                  : '⚠️ Cần Cố Gắng'}
              </span>
            </div>
          </div>
        </div>

        {/* Teacher / AI Feedback Box */}
        {(submission.teacher_feedback || submission.ai_feedback) && (
          <div className="mt-8 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-5">
            <div className="flex items-center gap-2 text-indigo-900 font-bold text-sm mb-2">
              <Sparkles className="h-4 w-4 text-indigo-600" />
              Nhận Xét & Đánh Giá Của Giáo Viên / Trợ Lý AI:
            </div>
            {submission.teacher_feedback && (
              <p className="text-xs text-slate-700 leading-relaxed">
                <strong>Giáo viên:</strong> {submission.teacher_feedback}
              </p>
            )}
            {submission.ai_feedback && (
              <p className="mt-2 text-xs text-indigo-800 leading-relaxed">
                <strong>AI Phân tích:</strong> {submission.ai_feedback}
              </p>
            )}
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3 pt-6 border-t border-slate-100">
          <Link
            href={`/exams/${exam.id}/take`}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Làm lại bài thi
          </Link>

          <Link
            href="/gradebook"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-500 transition"
          >
            <Award className="h-3.5 w-3.5" />
            Xem sổ điểm cá nhân
          </Link>
        </div>
      </div>

      {/* Detailed Question Review */}
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-slate-900">Chi Tiết Lời Giải Từng Câu Hỏi</h2>

        {questions.map((q, idx) => {
          const ans = submission?.answers?.find((a) => a.question_id === q.id);
          const isCorrect = ans?.is_correct;
          const isEssay = q.type === 'essay';

          return (
            <div
              key={q.id}
              className={`rounded-3xl border bg-white p-6 sm:p-8 shadow-xs transition ${
                isEssay
                  ? 'border-indigo-200'
                  : isCorrect
                  ? 'border-emerald-200'
                  : 'border-rose-200'
              }`}
            >
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold text-white ${
                      isEssay
                        ? 'bg-indigo-600'
                        : isCorrect
                        ? 'bg-emerald-600'
                        : 'bg-rose-600'
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <span className="font-bold text-sm text-slate-800">
                    Câu {idx + 1} ({q.topic})
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700">
                    Điểm: {ans?.earned_points ?? 0} / {ans?.max_points ?? q.points}
                  </span>
                  {isEssay ? (
                    <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                      Tự luận
                    </span>
                  ) : isCorrect ? (
                    <span className="flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Đúng
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">
                      <XCircle className="h-3.5 w-3.5" /> Sai
                    </span>
                  )}
                </div>
              </div>

              {/* Question Content */}
              <div className="text-base sm:text-[17.5px] text-slate-900 font-medium leading-relaxed">
                <MathRenderer content={q.content} />
              </div>

              {/* Answers Breakdown */}
              <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4 rounded-2xl bg-slate-50 p-4 text-sm">
                <div>
                  <span className="font-semibold text-slate-500 uppercase tracking-wider block mb-1 text-xs">
                    Câu trả lời của bạn:
                  </span>
                  <div className="font-medium text-slate-900 text-sm sm:text-base">
                    {ans?.student_answer ? (
                      typeof ans.student_answer === 'object' ? (
                        <pre className="text-xs font-mono bg-white p-2.5 rounded border border-slate-200">
                          {JSON.stringify(ans.student_answer, null, 2)}
                        </pre>
                      ) : (
                        <MathRenderer content={String(ans.student_answer)} inline />
                      )
                    ) : (
                      <span className="italic text-slate-400">Không trả lời</span>
                    )}
                  </div>
                </div>

                <div>
                  <span className="font-semibold text-slate-500 uppercase tracking-wider block mb-1 text-xs">
                    Đáp án chính xác:
                  </span>
                  <div className="font-semibold text-emerald-700 text-sm sm:text-base">
                    {typeof q.correct_answer === 'object' ? (
                      <pre className="text-xs font-mono bg-white p-2.5 rounded border border-slate-200 text-slate-800">
                        {JSON.stringify(q.correct_answer, null, 2)}
                      </pre>
                    ) : (
                      <MathRenderer content={String(q.correct_answer)} inline />
                    )}
                  </div>
                </div>
              </div>

              {/* Ảnh bài giải tự luận học sinh nộp */}
              {(ans as any)?.essay_images && (ans as any).essay_images.length > 0 && (
                <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4">
                  <div className="text-xs font-bold text-indigo-900 mb-2">
                    📸 Ảnh Chụp Bài Giải Viết Tay Của Học Sinh ({(ans as any).essay_images.length} trang):
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {(ans as any).essay_images.map((img: string, i: number) => (
                      <a
                        key={i}
                        href={img}
                        target="_blank"
                        rel="noreferrer"
                        className="group relative block rounded-xl border border-indigo-200 overflow-hidden bg-white shadow-2xs hover:shadow-md transition"
                      >
                        <img src={img} alt={`Bài giải trang ${i + 1}`} className="h-32 w-full object-cover" />
                        <span className="block text-[10px] text-center font-bold text-indigo-700 py-1 bg-indigo-50">
                          Trang {i + 1} (Xem lớn ↗)
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Detailed Explanation (KaTeX) */}
              {q.explanation && (
                <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
                  <div className="text-xs font-bold uppercase tracking-wider text-blue-800 mb-2">
                    💡 Hướng Dẫn Giải Chi Tiết Chuẩn Sư Phạm:
                  </div>
                  <MathRenderer content={q.explanation} className="text-sm sm:text-[15.5px] text-slate-800 leading-relaxed" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
