import { describe, it, expect } from 'vitest';
import { generateSmartMathVariant } from '@/lib/ai/questionVariantGenerator';

describe('AI Question Variant Generator - Precision Test', () => {
  it('Q1: Cho cos x = 4/5 sinh ra bài tương tự về giá trị lượng giác', () => {
    const q1 = {
      content: 'Cho $\\cos x = \\dfrac{4}{5}$, $x \\in \\left(-\\dfrac{\\pi}{2}; 0\\right)$. Giá trị của $\\sin 2x$ là',
      correct_answer: 'A',
    };
    const res = generateSmartMathVariant(q1);
    expect(res.content).toContain('\\cos x');
    expect(res.content).toContain('\\sin 2x');
    expect(res.content).not.toContain('Tập xác định');
  });

  it('Q2: Công thức lượng giác sinh ra bài tương tự về công thức lượng giác', () => {
    const q2 = {
      content: 'Trong các công thức sau, công thức nào đúng?',
      correct_answer: 'C',
    };
    const res = generateSmartMathVariant(q2);
    expect(res.content).toContain('công thức');
    expect(res.options[0].text).toContain('\\cos 2a');
  });

  it('Q3: Tập xác định sinh ra bài tương tự về TẬP XÁC ĐỊNH (không bị nhầm sang Q1)', () => {
    const q3 = {
      content: 'Tập xác định của hàm số $y = \\dfrac{1 + \\cos x}{\\sin x - 1}$ là',
      correct_answer: 'A',
    };
    const res = generateSmartMathVariant(q3);
    // Phải là câu hỏi về tập xác định, KHÔNG ĐƯỢC là câu hỏi tính sin 2x!
    expect(res.content).toContain('Tập xác định');
    expect(res.content).not.toContain('\\sin 2x');
    expect(res.options[0].text).toContain('\\mathbb{R}');
  });

  it('Q4: Số nghiệm phương trình sinh ra bài tương tự về SỐ NGHIỆM', () => {
    const q4 = {
      content: 'Số nghiệm của phương trình $2\\sin x - \\sqrt{3} = 0$ trên đoạn $[0; 2\\pi]$ là',
      correct_answer: 'C',
    };
    const res = generateSmartMathVariant(q4);
    expect(res.content).toContain('Số nghiệm');
    expect(res.content).not.toContain('Tập xác định');
  });

  it('Q5: Nghiệm phương trình sinh ra bài tương tự về giải phương trình', () => {
    const q5 = {
      content: 'Phương trình $2\\cos x - 1 = 0$ có tất cả các nghiệm là',
      correct_answer: 'A',
    };
    const res = generateSmartMathVariant(q5);
    expect(res.content).toContain('Phương trình');
    expect(res.content).toContain('nghiệm là');
  });

  it('Q6: Dãy số u_n sinh ra bài tương tự về DÃY SỐ', () => {
    const q6 = {
      content: 'Cho dãy số $(u_n)$ có công thức số hạng tổng quát $u_n = 8 - 3n$. Tính $u_4$.',
      correct_answer: 'A',
    };
    const res = generateSmartMathVariant(q6);
    expect(res.content).toContain('(u_n)');
    expect(res.content).toContain('Tính $u_');
  });
});
