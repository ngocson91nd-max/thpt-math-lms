import { describe, it, expect } from 'vitest';
import {
  safeText,
  partOf,
  QuestionPublicSchema,
  QuestionKeySchema,
  gradeTrueFalseQuestion,
  gradeShortAnswerQuestion,
} from '../src/lib/exam/schema';

describe('1. Zod Schemas & SafeText Validation', () => {
  it('safeText rejects any text containing \\True, \\loigiai, \\choiceTF, \\shortans', () => {
    expect(() => safeText.parse('Cho hàm số $y=f(x)$')).not.toThrow();
    expect(() => safeText.parse('\\choice {$1$} {\\True $2$} {$3$}')).toThrow();
    expect(() => safeText.parse('\\loigiai{Ta có f(x) > 0}')).toThrow();
    expect(() => safeText.parse('\\choiceTF{a}{b}{c}{d}')).toThrow();
    expect(() => safeText.parse('\\shortans{0.5}')).toThrow();
  });

  it('partOf infers part number directly from question type', () => {
    expect(partOf('single_choice')).toBe(1);
    expect(partOf('true_false')).toBe(2);
    expect(partOf('short_answer')).toBe(3);
    expect(partOf('essay')).toBe(4);
  });

  it('QuestionPublicSchema validates single_choice without leakage', () => {
    const validQ = {
      id: 'q-1',
      type: 'single_choice' as const,
      content: 'Cho hàm số $y = x^3 - 3x$. Mệnh đề nào đúng?',
      options: [
        { id: 'A' as const, text: 'Hàm số đồng biến trên toàn R' },
        { id: 'B' as const, text: 'Hàm số có 2 điểm cực trị' },
        { id: 'C' as const, text: 'Hàm số nghịch biến trên R' },
        { id: 'D' as const, text: 'Hàm số không có cực trị' },
      ],
      lock_options_order: false,
    };
    expect(() => QuestionPublicSchema.parse(validQ)).not.toThrow();

    // Thử chèn \True vào options
    const leakyOptions = {
      ...validQ,
      options: [
        { id: 'A' as const, text: 'Phương án A' },
        { id: 'B' as const, text: '\\True Phương án B' },
        { id: 'C' as const, text: 'Phương án C' },
        { id: 'D' as const, text: 'Phương án D' },
      ],
    };
    expect(() => QuestionPublicSchema.parse(leakyOptions)).toThrow();
  });
});

describe('2. True/False MoET Standard Grading', () => {
  const correctMap = { a: true, b: false, c: true, d: false };

  it('calculates points accurately for 0, 1, 2, 3, 4 correct branches', () => {
    // 0 đúng
    expect(gradeTrueFalseQuestion({ a: false, b: true, c: false, d: true }, correctMap).points).toBe(0);

    // 1 đúng -> 0.1 điểm
    expect(gradeTrueFalseQuestion({ a: true, b: true, c: false, d: true }, correctMap).points).toBe(0.1);

    // 2 đúng -> 0.25 điểm
    expect(gradeTrueFalseQuestion({ a: true, b: false, c: false, d: true }, correctMap).points).toBe(0.25);

    // 3 đúng -> 0.5 điểm
    expect(gradeTrueFalseQuestion({ a: true, b: false, c: true, d: true }, correctMap).points).toBe(0.5);

    // 4 đúng -> 1.0 điểm
    expect(gradeTrueFalseQuestion({ a: true, b: false, c: true, d: false }, correctMap).points).toBe(1.0);
  });
});

describe('3. Short Answer Grading with decimal.js', () => {
  const key = {
    question_id: 'q-short-1',
    type: 'short_answer' as const,
    value: '0.5',
    alternatives: ['1/2'],
    decimals: 2,
  };

  it('normalizes student input (spaces, commas) and compares decimals cleanly', () => {
    // Nhập "0,5"
    const res1 = gradeShortAnswerQuestion('0,5', key, 0.5, 'exam');
    expect(res1.isCorrect).toBe(true);
    expect(res1.points).toBe(0.5);

    // Nhập " 0.50 "
    const res2 = gradeShortAnswerQuestion(' 0.50 ', key, 0.5, 'exam');
    expect(res2.isCorrect).toBe(true);
    expect(res2.points).toBe(0.5);

    // Số âm "-0.5" so với khóa âm
    const negativeKey = { ...key, value: '-0.5' };
    const res3 = gradeShortAnswerQuestion('-0.50', negativeKey, 0.5, 'exam');
    expect(res3.isCorrect).toBe(true);
  });

  it('rejects fraction in exam mode, but accepts in practice mode', () => {
    // Chế độ thi chính thức (exam): từ chối "1/2"
    const examRes = gradeShortAnswerQuestion('1/2', key, 0.5, 'exam');
    expect(examRes.isCorrect).toBe(false);
    expect(examRes.points).toBe(0);

    // Chế độ luyện tập (practice): chấp nhận "1/2" vì nằm trong alternatives
    const practiceRes = gradeShortAnswerQuestion('1/2', key, 0.5, 'practice');
    expect(practiceRes.isCorrect).toBe(true);
    expect(practiceRes.points).toBe(0.5);
  });
});
