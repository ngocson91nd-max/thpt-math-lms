'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MOCK_SUBMISSIONS, MOCK_EXAMS } from '@/lib/supabase/mockStore';
import { Submission, Exam, Question } from '@/types/database';
import MathRenderer from '@/components/math/MathRenderer';
import { broadcastDataChange } from '@/lib/realtime/syncService';
import {
  ArrowLeft,
  Sparkles,
  CheckCircle,
  HelpCircle,
  Save,
  Award,
  Image as ImageIcon,
  Check,
  Clock,
  User,
} from 'lucide-react';

export default function GradeEssayPage({
  params,
}: {
  params: Promise<{ submissionId: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();

  const [submission, setSubmission] = useState<Submission | null>(null);
  const [exam, setExam] = useState<Exam | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [essayScores, setEssayScores] = useState<Record<string, number>>({});
  const [teacherComments, setTeacherComments] = useState<Record<string, string>>({});
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // 1. Tải bài làm từ cache hoặc Cloud API
  useEffect(() => {
    let sub: Submission | null = null;

    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(`submission_${resolvedParams.submissionId}`);
        if (saved) sub = JSON.parse(saved);

        if (!sub) {
          const all = localStorage.getItem('lms_all_submissions');
          if (all) {
            const list = JSON.parse(all);
            sub = list.find((s: any) => s.id === resolvedParams.submissionId) || null;
          }
        }
      } catch {}
    }

    if (sub) {
      setSubmission(sub);
      initExamAndScores(sub);
      setIsLoading(false);
    } else {
      // Tải từ Cloud API
      fetch(`/api/submissions?id=${resolvedParams.submissionId}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.success && data.submission) {
            setSubmission(data.submission);
            initExamAndScores(data.submission);
          }
        })
        .finally(() => setIsLoading(false));
    }
  }, [resolvedParams.submissionId]);

  const initExamAndScores = (sub: Submission) => {
    let targetExam: Exam | null = sub.exam || null;
    if (!targetExam && sub.exam_id && typeof window !== 'undefined') {
      try {
        const savedExams = localStorage.getItem('lms_exams');
        if (savedExams) {
          const list = JSON.parse(savedExams);
          targetExam = list.find((e: any) => e.id === sub.exam_id) || null;
        }
      } catch {}
    }
    setExam(targetExam);

    // Khởi tạo điểm và lời phê ban đầu
    const scores: Record<string, number> = {};
    const comments: Record<string, string> = {};

    if (Array.isArray(sub.answers)) {
      sub.answers.forEach((ans: any) => {
        if (ans.earned_points !== undefined) {
          scores[ans.question_id] = ans.earned_points;
        }
        if (ans.teacher_comment) {
          comments[ans.question_id] = ans.teacher_comment;
        }
      });
    }
    setEssayScores(scores);
    setTeacherComments(comments);
  };

  const essayQuestions: any[] =
    (exam?.questions?.filter((q: any) => q.type === 'essay') as any[]) || [];

  // 2. Gợi ý chấm điểm bằng AI
  const handleAiGradeSuggestion = async (qId: string) => {
    setIsAiLoading(true);
    const q = essayQuestions.find((item: any) => item.id === qId);
    const ans = submission?.answers?.find((a: any) => a.question_id === qId);

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'grade_essay',
          questionContent: q?.content,
          solutionRubric: q?.correct_answer || q?.explanation,
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

  // 3. Lưu điểm & Hoàn tất bài thi
  const handleSaveGrade = async () => {
    if (!submission) return;
    setIsSaving(true);

    const totalEssayScore = Object.values(essayScores).reduce((sum, score) => sum + (Number(score) || 0), 0);

    // Điểm trắc nghiệm ban đầu (loại trừ các câu tự luận)
    const mcqAnswers = (submission.answers || []).filter((a: any) => {
      const q = exam?.questions?.find((item: any) => item.id === a.question_id);
      return !q || q.type !== 'essay';
    });

    const originalMcqScore = mcqAnswers.length > 0
      ? mcqAnswers.reduce((sum: number, a: any) => sum + (Number(a.earned_points) || 0), 0)
      : (submission.score || 0);

    const finalScore = Math.min(
      Number(submission.max_score || 10),
      Math.round((originalMcqScore + totalEssayScore) * 100) / 100
    );

    const updatedAnswers = (submission.answers || []).map((ans: any) => {
      if (essayScores[ans.question_id] !== undefined) {
        return {
          ...ans,
          earned_points: essayScores[ans.question_id],
          teacher_comment: teacherComments[ans.question_id] || '',
        };
      }
      return ans;
    });

    const updatedSubmission: Submission = {
      ...submission,
      score: finalScore,
      status: 'graded',
      teacher_feedback:
        'Thầy Sơn đã chấm xong phần tự luận. ' +
        Object.values(teacherComments).filter(Boolean).join(' • '),
      answers: updatedAnswers,
      updated_at: new Date().toISOString(),
    };

    // A. Lưu vào Supabase Cloud API
    try {
      await fetch('/api/submissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: updatedSubmission.id,
          score: updatedSubmission.score,
          status: updatedSubmission.status,
          teacher_feedback: updatedSubmission.teacher_feedback,
          answers: updatedSubmission.answers,
        }),
      });
    } catch (err) {
      console.warn('Lưu Cloud submission error:', err);
    }

    // B. Lưu vào LocalStorage đồng bộ cả học sinh và giáo viên
    if (typeof window !== 'undefined') {
      localStorage.setItem(`submission_${updatedSubmission.id}`, JSON.stringify(updatedSubmission));

      // Sổ điểm toàn trường
      const all = localStorage.getItem('lms_all_submissions');
      if (all) {
        try {
          const list: Submission[] = JSON.parse(all);
          const idx = list.findIndex((s) => s.id === updatedSubmission.id);
          if (idx >= 0) list[idx] = updatedSubmission;
          else list.unshift(updatedSubmission);
          localStorage.setItem('lms_all_submissions', JSON.stringify(list));
        } catch {}
      }

      // Sổ điểm học sinh
      const stuKey = `my_submissions_${updatedSubmission.student_id}`;
      const mySaved = localStorage.getItem(stuKey);
      if (mySaved) {
        try {
          const myList: Submission[] = JSON.parse(mySaved);
          const idx = myList.findIndex((s) => s.id === updatedSubmission.id);
          if (idx >= 0) myList[idx] = updatedSubmission;
          else myList.unshift(updatedSubmission);
          localStorage.setItem(stuKey, JSON.stringify(myList));
        } catch {}
      }

      // Phát tín hiệu Realtime để màn hình học sinh và sổ điểm giáo viên cập nhật ngay
      broadcastDataChange('SUBMISSIONS_UPDATED', updatedSubmission);
    }

    setIsSaving(false);
    router.push('/gradebook');
  };

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center p-8 text-center">
        <div className="h-8 w-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-xs text-slate-500 font-medium">Đang tải bài thi của học sinh...</p>
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center space-y-3">
        <h2 className="text-base font-bold text-slate-800">Không tìm thấy bài làm cần chấm</h2>
        <p className="text-xs text-slate-500">Bài thi hoặc bài làm của học sinh không tồn tại.</p>
        <button
          onClick={() => router.push('/gradebook')}
          className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold cursor-pointer hover:bg-blue-700 transition"
        >
          Quay lại Sổ điểm
        </button>
      </div>
    );
  }

  const studentName = submission.student?.full_name || 'Học sinh';
  const studentEmail = submission.student?.email || '';
  const currentMcqScore = submission.score ?? 0;

  return (
    <div className="space-y-6 pb-16 max-w-5xl mx-auto">
      {/* Nút quay lại */}
      <Link
        href="/gradebook"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition"
      >
        <ArrowLeft className="h-4 w-4" />
        Quay lại Sổ điểm & Chấm thi
      </Link>

      {/* Header Banner */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-xs font-extrabold text-amber-800 mb-2">
              <Clock className="h-3.5 w-3.5 animate-pulse text-amber-600" />
              Chấm Điểm Bài Thi Tự Luận
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              {exam?.title || 'Đề Kiểm Tra Toán'}
            </h1>
            <p className="mt-1 text-xs text-slate-500 flex items-center gap-2 flex-wrap">
              <span>Học sinh: <strong className="text-slate-800">{studentName}</strong> ({studentEmail})</span>
              <span>•</span>
              <span>Thời gian nộp: <strong>{submission.submitted_at ? new Date(submission.submitted_at).toLocaleString('vi-VN') : 'Mới nộp'}</strong></span>
              <span>•</span>
              <span className="text-blue-700 font-semibold bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                Điểm trắc nghiệm máy chấm: {currentMcqScore.toFixed(2)}/10
              </span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveGrade}
              disabled={isSaving}
              className="flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-xs font-extrabold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-500 transition active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              <span>{isSaving ? 'Đang lưu...' : 'Lưu Điểm & Hoàn Tất'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal phóng to ảnh */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs cursor-zoom-out"
        >
          <img
            src={previewImage}
            alt="Ảnh phóng to bài làm"
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-2xl shadow-2xl"
          />
        </div>
      )}

      {/* Danh sách câu hỏi tự luận */}
      {essayQuestions.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center space-y-3">
          <p className="text-sm font-semibold text-slate-700">Đề thi này không có câu hỏi tự luận cần chấm riêng.</p>
          <p className="text-xs text-slate-500">Thầy có thể bấm Lưu Điểm để hoàn tất trạng thái bài làm.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {essayQuestions.map((q: any, idx: number) => {
            const ans = submission.answers?.find((a: any) => a.question_id === q.id);
            const essayImages: string[] = (ans as any)?.essay_images || [];

            return (
              <div
                key={q.id}
                className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs space-y-6 hover:border-blue-300 transition"
              >
                {/* Header Câu Hỏi */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-blue-600 text-xs font-black text-white">
                      {idx + 1}
                    </span>
                    <span className="font-extrabold text-sm text-slate-900">
                      Câu hỏi tự luận #{idx + 1} {q.topic ? `(${q.topic})` : ''}
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={isAiLoading}
                    onClick={() => handleAiGradeSuggestion(q.id)}
                    className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:from-blue-700 hover:to-indigo-700 transition cursor-pointer disabled:opacity-50"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>{isAiLoading ? 'AI Đang Đọc Bài...' : 'AI Gợi Ý Chấm Điểm'}</span>
                  </button>
                </div>

                {/* Đề bài KaTeX */}
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Đề bài:
                  </div>
                  <div className="text-sm font-medium text-slate-900 leading-relaxed bg-slate-50/60 p-4 rounded-2xl border border-slate-100">
                    <MathRenderer content={q.content} />
                  </div>
                </div>

                {/* Đáp án mẫu / Rubric hướng dẫn chấm */}
                {(q.correct_answer || q.explanation) && (
                  <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-4">
                    <div className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-800 mb-2 flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      Đáp án mẫu & Thang điểm gợi ý:
                    </div>
                    <div className="text-xs text-slate-800 leading-relaxed">
                      <MathRenderer content={String(q.correct_answer || q.explanation)} />
                    </div>
                  </div>
                )}

                {/* Bài làm của học sinh */}
                <div className="rounded-2xl border border-blue-200 bg-blue-50/30 p-5 space-y-4">
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-blue-600" />
                    Bài làm của học sinh {studentName}:
                  </div>

                  {/* Lời giải dạng văn bản / KaTeX */}
                  {ans?.student_answer ? (
                    <div className="text-sm text-slate-900 leading-relaxed bg-white p-4 rounded-xl border border-blue-100 shadow-2xs">
                      <MathRenderer content={String(ans.student_answer)} />
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500 italic bg-white/70 p-3 rounded-xl border border-dashed border-slate-200">
                      Học sinh không nhập văn bản giải thích.
                    </div>
                  )}

                  {/* Ảnh chụp bài làm viết tay của học sinh */}
                  {essayImages.length > 0 && (
                    <div>
                      <div className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                        <ImageIcon className="h-3.5 w-3.5 text-indigo-600" />
                        <span>Ảnh chụp bài giải viết tay đính kèm ({essayImages.length} ảnh):</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {essayImages.map((imgBase64, imgIdx) => (
                          <div
                            key={imgIdx}
                            onClick={() => setPreviewImage(imgBase64)}
                            className="relative group cursor-zoom-in rounded-xl overflow-hidden border border-slate-200 bg-white aspect-4/3 flex items-center justify-center hover:border-blue-500 transition shadow-2xs"
                          >
                            <img
                              src={imgBase64}
                              alt={`Bài giải trang ${imgIdx + 1}`}
                              className="w-full h-full object-cover group-hover:scale-105 transition"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-bold">
                              🔍 Bấm xem to
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Form Nhập Điểm & Nhận Xét Của Giáo Viên */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-100 bg-slate-50/70 p-4 rounded-2xl border">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      Điểm tự luận (Tối đa {q.points || 1.0}đ):
                    </label>
                    <input
                      type="number"
                      step="0.05"
                      min="0"
                      max={q.points || 5.0}
                      value={essayScores[q.id] ?? 0}
                      onChange={(e) =>
                        setEssayScores((prev) => ({
                          ...prev,
                          [q.id]: Math.min(q.points || 5.0, Math.max(0, parseFloat(e.target.value) || 0)),
                        }))
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-extrabold text-blue-700 focus:outline-none focus:border-blue-500 shadow-2xs"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      Lời phê & Nhận xét của Thầy Sơn:
                    </label>
                    <input
                      type="text"
                      value={teacherComments[q.id] ?? ''}
                      onChange={(e) =>
                        setTeacherComments((prev) => ({ ...prev, [q.id]: e.target.value }))
                      }
                      placeholder="Ví dụ: Bước giải tốt, lưu ý thêm điều kiện xác định..."
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 shadow-2xs"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Nút lưu ở chân trang */}
      <div className="flex justify-end pt-4">
        <button
          onClick={handleSaveGrade}
          disabled={isSaving}
          className="flex items-center gap-2 rounded-2xl bg-emerald-600 px-6 py-3.5 text-xs font-extrabold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-500 transition active:scale-95 cursor-pointer disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          <span>{isSaving ? 'Đang lưu điểm...' : 'Lưu Điểm & Hoàn Tất Chấm Bài'}</span>
        </button>
      </div>
    </div>
  );
}
