import { describe, it, expect } from 'vitest';
import { parseQuickAnswerKey, buildPdfExamQuestions } from '../src/lib/pdf/pdfExamHelper';

describe('Kiểm thử bộ phân tích đáp án đề thi PDF (pdfExamHelper)', () => {
  it('Phân tích đúng chuỗi đáp án Phần I dạng 1A 2B 3C...', () => {
    const raw = '1A 2B 3C 4D 5A 6B 7C 8D 9A 10B 11C 12D';
    const parsed = parseQuickAnswerKey(raw);
    expect(parsed.part1[1]).toBe('A');
    expect(parsed.part1[2]).toBe('B');
    expect(parsed.part1[12]).toBe('D');
  });

  it('Phân tích đúng câu trắc nghiệm Đúng/Sai Phần II', () => {
    const raw = `
13: aD bS cD dS
14: aĐ bĐ cS dS
15: D S D S
16: T F T F
    `;
    const parsed = parseQuickAnswerKey(raw);
    expect(parsed.part2[13]).toEqual({ a: true, b: false, c: true, d: false });
    expect(parsed.part2[14]).toEqual({ a: true, b: true, c: false, d: false });
    expect(parsed.part2[15]).toEqual({ a: true, b: false, c: true, d: false });
    expect(parsed.part2[16]).toEqual({ a: true, b: false, c: true, d: false });
  });

  it('Phân tích đúng câu trả lời ngắn Phần III dạng điền số', () => {
    const raw = `
17: 1440
18: -2.5
19: 12
20: 3/4
    `;
    const parsed = parseQuickAnswerKey(raw);
    expect(parsed.part3[17]).toBe('1440');
    expect(parsed.part3[18]).toBe('-2.5');
    expect(parsed.part3[19]).toBe('12');
    expect(parsed.part3[20]).toBe('3/4');
  });

  it('Tạo cấu trúc 22 câu hỏi chuẩn Bộ GD&ĐT từ bảng đáp án PDF', () => {
    const raw = `
1A 2B 3C 4D 5A 6B 7C 8D 9A 10B 11C 12D
13: aD bS cD dS
14: aS bD cD dS
15: aD bD cS dS
16: aD bD cS dD
17: 1440
18: -2.5
19: 12
20: 3/4
21: 5
22: 10
    `;
    const parsed = parseQuickAnswerKey(raw);
    const questions = buildPdfExamQuestions(12, 4, 6, parsed);

    expect(questions.length).toBe(22);
    expect(questions[0].correct_answer).toBe('A');
    expect(questions[11].correct_answer).toBe('D');

    // Câu 13 (Phần II)
    expect(questions[12].type).toBe('true_false');
    expect(questions[12].correct_answer).toEqual({ a: true, b: false, c: true, d: false });

    // Câu 17 (Phần III)
    expect(questions[16].type).toBe('short_answer');
    expect(questions[16].correct_answer).toEqual(['1440', '1440']);
  });
});
