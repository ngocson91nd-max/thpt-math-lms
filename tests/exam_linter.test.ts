import { describe, it, expect } from 'vitest';
import { lintQuestion, computeContentHash } from '../src/lib/exam/examLinter';

describe('Exam Ingestion Linter Tests', () => {
  it('automatically sets lock_options_order = true and warns for positional options', () => {
    const q1 = {
      content: 'Trong các mệnh đề sau, mệnh đề nào đúng?',
      options: [
        { id: 'A', text: 'Mệnh đề 1' },
        { id: 'B', text: 'Mệnh đề 2' },
        { id: 'C', text: 'Cả A và B đều đúng' },
        { id: 'D', text: 'Tất cả đều sai' },
      ],
    };
    const res = lintQuestion(q1);
    expect(res.lock_options_order).toBe(true);
    expect(res.warnings.length).toBeGreaterThan(0);
    expect(res.warnings[0]).toContain('KHÓA đảo phương án');
  });

  it('warns when explanation contains hardcoded answer letters like "chọn B"', () => {
    const q2 = {
      content: 'Tìm giá trị nhỏ nhất của hàm số...',
      options: [
        { id: 'A', text: '1' },
        { id: 'B', text: '2' },
        { id: 'C', text: '3' },
        { id: 'D', text: '4' },
      ],
      explanation: 'Ta có f\'(x) = 0 <=> x = 1. Thay vào được y = 2. Do đó chọn B.',
    };
    const res = lintQuestion(q2);
    expect(res.lock_options_order).toBe(false);
    expect(res.warnings.some((w) => w.includes('chọn B'))).toBe(true);
  });

  it('suggests group_id when question stem references previous context or diagrams', () => {
    const q3 = {
      content: 'Dựa vào hình vẽ bên của câu 1, tính diện tích thiết diện...',
    };
    const res = lintQuestion(q3);
    expect(res.suggested_group).toBe(true);
    expect(res.warnings.some((w) => w.includes('group_id'))).toBe(true);
  });

  it('detects duplicate content_hash against bank hashes', () => {
    const stem = 'Cho hình chóp S.ABCD có đáy là hình vuông cạnh a, SA vuông góc đáy.';
    const hash = computeContentHash(stem);
    const existingHashes = new Set<string>([hash]);

    const res = lintQuestion({
      content: '   Cho hình chóp S.ABCD có đáy là hình vuông cạnh a, SA vuông góc đáy.   ',
      existingHashes,
    });
    expect(res.warnings.some((w) => w.includes('trùng lặp'))).toBe(true);
  });

  it('warns when assembling an exam containing a question previously published with solution', () => {
    const previouslyPublishedIds = new Set<string>(['q-old-123']);
    const res = lintQuestion({
      content: 'Câu hỏi mới',
      questionId: 'q-old-123',
      previouslyPublishedIds,
    });
    expect(res.warnings.some((w) => w.includes('công bố lời giải'))).toBe(true);
  });
});
