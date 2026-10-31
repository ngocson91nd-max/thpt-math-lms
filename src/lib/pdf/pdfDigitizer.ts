import { Question } from '@/types/database';
import { parseExamLatex } from '@/lib/latex/examParser';
import { precompileQuestionsTikz } from '@/lib/latex/tikzPrecompiler';

export interface DigitizedPdfResult {
  questions: Question[];
  rawLatex: string;
  metadata: {
    title?: string;
    duration?: number;
    grade?: number;
    totalQuestions: number;
    part1Count: number;
    part2Count: number;
    part3Count: number;
    part4Count: number;
    warnings: string[];
  };
}

/**
 * Số hóa đề thi PDF thành danh sách Question[] hoàn chỉnh bằng AI Vision
 */
export async function digitizePdfExam(
  fileOrBase64: File | string,
  onStatusChange?: (status: string) => void
): Promise<DigitizedPdfResult> {
  if (onStatusChange) onStatusChange('Đang tải và chuẩn bị tài liệu PDF...');

  let res: Response;

  if (typeof fileOrBase64 === 'string') {
    if (onStatusChange) onStatusChange('Đang gửi tài liệu sang AI Vision bóc tách câu hỏi...');
    res = await fetch('/api/digitize-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pdfBase64: fileOrBase64 }),
    });
  } else {
    if (onStatusChange) onStatusChange('Đang phân tích trang PDF bằng AI Vision (Gemini)...');
    const fd = new FormData();
    fd.append('file', fileOrBase64);
    res = await fetch('/api/digitize-pdf', {
      method: 'POST',
      body: fd,
    });
  }

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Lỗi số hóa PDF: HTTP ${res.status}`);
  }

  const data = await res.json();
  if (!data.success || !data.latex) {
    throw new Error(data.error || 'AI không thể nhận diện nội dung câu hỏi trong file PDF.');
  }

  const rawLatex: string = data.latex;

  if (onStatusChange) onStatusChange('Đang phân tích cấu trúc mã LaTeX ex_test...');
  const { questions, metadata } = parseExamLatex(rawLatex);

  if (questions.length === 0) {
    throw new Error('AI đã trích xuất văn bản nhưng không tìm thấy cấu trúc câu hỏi \\begin{ex}...\\end{ex}.');
  }

  if (onStatusChange) onStatusChange(`Đã phát hiện ${questions.length} câu hỏi. Đang tiền biên dịch hình vẽ TikZ...`);
  const precompiledQuestions = await precompileQuestionsTikz(questions, (done, total) => {
    if (onStatusChange) onStatusChange(`Đang dựng hình vẽ TikZ: ${done}/${total} câu...`);
  });

  const part1Count = precompiledQuestions.filter((q) => q.part === 1).length;
  const part2Count = precompiledQuestions.filter((q) => q.part === 2).length;
  const part3Count = precompiledQuestions.filter((q) => q.part === 3).length;
  const part4Count = precompiledQuestions.filter((q) => q.part === 4).length;

  const warnings: string[] = [];
  precompiledQuestions.forEach((q, idx) => {
    if (!q.correct_answer && q.type !== 'essay') {
      warnings.push(`Câu ${idx + 1} (${q.type}): Chưa xác định được đáp án chính xác.`);
    }
  });

  return {
    questions: precompiledQuestions,
    rawLatex,
    metadata: {
      title: metadata.title,
      duration: metadata.duration,
      grade: (metadata as any).grade || 12,
      totalQuestions: precompiledQuestions.length,
      part1Count,
      part2Count,
      part3Count,
      part4Count,
      warnings,
    },
  };
}
