import { z } from 'zod';
import Decimal from 'decimal.js';

// Regex phát hiện rò rỉ đáp án hoặc lời giải trong văn bản công khai
export const NO_LEAK = /\\(True|loigiai|choiceTF|shortans)/;

export const safeText = z.string().refine(
  (s) => !NO_LEAK.test(s),
  'Nội dung công khai không được chứa \\True, \\loigiai, \\choiceTF hoặc \\shortans'
);

const commonPublic = {
  id: z.string(),
  content: safeText,
  image_url: z.string().nullish(),
  lock_options_order: z.boolean().default(false),
  group_id: z.string().nullish(),
};

export const QuestionPublicSchema = z.discriminatedUnion('type', [
  z.object({
    ...commonPublic,
    type: z.literal('single_choice'),
    options: z.array(z.object({ id: z.enum(['A', 'B', 'C', 'D']), text: safeText })).length(4),
  }),
  z.object({
    ...commonPublic,
    type: z.literal('true_false'),
    options: z.array(z.object({ id: z.enum(['a', 'b', 'c', 'd']), text: safeText })).length(4),
  }),
  z.object({
    ...commonPublic,
    type: z.literal('short_answer'),
  }),
  z.object({
    ...commonPublic,
    type: z.literal('essay'),
  }),
]);

export type QuestionPublic = z.infer<typeof QuestionPublicSchema>;

// `part` KHÔNG lưu trong DB, suy ra trực tiếp từ type
export const partOf = (t: QuestionPublic['type']): 1 | 2 | 3 | 4 =>
  ({ single_choice: 1, true_false: 2, short_answer: 3, essay: 4 } as const)[t];

const keyBase = {
  explanation: z.string().optional(),
  raw_tex: z.string().optional(),
};

export const QuestionKeySchema = z.discriminatedUnion('type', [
  z.object({
    ...keyBase,
    type: z.literal('single_choice'),
    correct: z.enum(['A', 'B', 'C', 'D']),
  }),
  z.object({
    ...keyBase,
    type: z.literal('true_false'),
    correct: z.object({
      a: z.boolean(),
      b: z.boolean(),
      c: z.boolean(),
      d: z.boolean(),
    }),
  }),
  z.object({
    ...keyBase,
    type: z.literal('short_answer'),
    // Giá trị đã chuẩn hóa: dùng dấu chấm, không khoảng trắng. Ví dụ "-0.5"
    value: z.string().regex(/^-?\d+(\.\d+)?$/),
    // Cách viết tương đương được chấp nhận, đã chuẩn hóa. Ví dụ ["-1/2"] chỉ dùng cho chế độ luyện tập
    alternatives: z.array(z.string()).default([]),
    // Nếu đề yêu cầu làm tròn: số chữ số thập phân
    decimals: z.number().int().min(0).max(6).optional(),
  }),
  z.object({
    ...keyBase,
    type: z.literal('essay'),
    rubric: z.array(z.object({ step: z.string(), points: z.number() })).optional(),
  }),
]);

export type QuestionKey = z.infer<typeof QuestionKeySchema>;

/**
 * Chấm điểm câu Đúng/Sai (Phần II) theo quy định chuẩn của Bộ GD&ĐT:
 * - Đúng 1 ý: 0.10 điểm
 * - Đúng 2 ý: 0.25 điểm
 * - Đúng 3 ý: 0.50 điểm
 * - Đúng cả 4 ý: 1.00 điểm (hoặc tính theo tỷ lệ maxPoints)
 */
export function gradeTrueFalseQuestion(
  studentAnswers: Record<string, boolean> | undefined | null,
  correctMap: Record<'a' | 'b' | 'c' | 'd', boolean>,
  maxPoints: number = 1.0
): { correctCount: number; points: number } {
  if (!studentAnswers || typeof studentAnswers !== 'object') {
    return { correctCount: 0, points: 0 };
  }

  let count = 0;
  const branches: Array<'a' | 'b' | 'c' | 'd'> = ['a', 'b', 'c', 'd'];
  for (const b of branches) {
    if (typeof studentAnswers[b] === 'boolean' && studentAnswers[b] === correctMap[b]) {
      count++;
    }
  }

  const ratio = count === 4 ? 1.0 : count === 3 ? 0.5 : count === 2 ? 0.25 : count === 1 ? 0.1 : 0;
  const points = Math.round(maxPoints * ratio * 100) / 100;
  return { correctCount: count, points };
}

/**
 * Chấm điểm câu Trả lời ngắn (Phần III) bằng decimal.js.
 * - Chế độ thi chính thức ('exam'): chỉ nhận số thập phân/nguyên, từ chối phân số, không dùng số thực IEEE-754.
 * - Chế độ luyện tập ('practice'): chấp nhận phân số và các đáp án tương đương (alternatives).
 */
export function gradeShortAnswerQuestion(
  rawInput: string | undefined | null,
  key: Extract<QuestionKey, { type: 'short_answer' }>,
  maxPoints: number = 0.5,
  mode: 'exam' | 'practice' = 'exam'
): { isCorrect: boolean; points: number; normalizedInput: string } {
  if (!rawInput || typeof rawInput !== 'string') {
    return { isCorrect: false, points: 0, normalizedInput: '' };
  }

  // 1. Chuẩn hóa chuỗi học sinh nhập: bỏ khoảng trắng, đổi dấu phẩy thành dấu chấm
  const cleaned = rawInput.trim().replace(/\s+/g, '').replace(/,/g, '.');

  // Chế độ luyện tập: kiểm tra xem có khớp chuỗi alternatives (ví dụ: "1/2") không
  if (mode === 'practice' && key.alternatives && key.alternatives.length > 0) {
    const isAltMatch = key.alternatives.some(
      (alt) => alt.trim().replace(/\s+/g, '').replace(/,/g, '.') === cleaned
    );
    if (isAltMatch) {
      return { isCorrect: true, points: maxPoints, normalizedInput: cleaned };
    }
  }

  // Kiểm tra định dạng số: bắt buộc là số thập phân hoặc số nguyên
  const isDecimalFormat = /^-?\d+(\.\d+)?$/.test(cleaned);
  if (!isDecimalFormat) {
    // Trong chế độ thi chính thức, phân số như "1/2" hoặc ký tự lạ bị coi là không hợp lệ
    return { isCorrect: false, points: 0, normalizedInput: cleaned };
  }

  try {
    let studentVal = new Decimal(cleaned);
    let targetVal = new Decimal(key.value);

    // Nếu đề thi yêu cầu làm tròn số chữ số thập phân
    if (typeof key.decimals === 'number') {
      studentVal = studentVal.toDecimalPlaces(key.decimals);
      targetVal = targetVal.toDecimalPlaces(key.decimals);
    }

    const isMatch = studentVal.equals(targetVal);
    return {
      isCorrect: isMatch,
      points: isMatch ? maxPoints : 0,
      normalizedInput: cleaned,
    };
  } catch {
    return { isCorrect: false, points: 0, normalizedInput: cleaned };
  }
}
