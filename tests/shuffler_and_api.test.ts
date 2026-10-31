import { describe, it, expect } from 'vitest';
import {
  shuffleExamQuestions,
  mapDisplayedToCanonical,
  mapCanonicalToDisplayed,
} from '../src/lib/exam/shuffler';
import { QuestionPublic } from '../src/lib/exam/schema';

describe('Shuffler & Permutation Mapping Tests', () => {
  const sampleQuestions: QuestionPublic[] = [
    {
      id: 'q-standalone-1',
      type: 'single_choice',
      content: 'Câu đơn 1',
      options: [
        { id: 'A', text: 'Opt A' },
        { id: 'B', text: 'Opt B' },
        { id: 'C', text: 'Opt C' },
        { id: 'D', text: 'Opt D' },
      ],
      lock_options_order: false,
    },
    {
      id: 'q-locked-2',
      type: 'single_choice',
      content: 'Câu khóa thứ tự phương án (chứa "Tất cả đều đúng")',
      options: [
        { id: 'A', text: 'Khẳng định 1' },
        { id: 'B', text: 'Khẳng định 2' },
        { id: 'C', text: 'Cả A và B đều đúng' },
        { id: 'D', text: 'Tất cả đều sai' },
      ],
      lock_options_order: true, // Bị khóa
    },
    {
      id: 'q-group-1',
      type: 'true_false',
      content: 'Dữ kiện chùm: Cho hình chóp S.ABCD...',
      options: [
        { id: 'a', text: 'SA vuông góc đáy' },
        { id: 'b', text: 'ABCD là hình vuông' },
        { id: 'c', text: 'Góc giữa SC và đáy bằng 45 độ' },
        { id: 'd', text: 'Thể tích khối chóp bằng 1/3' },
      ],
      group_id: 'group-geo-1', // Câu 1 của chùm
      lock_options_order: false,
    },
    {
      id: 'q-group-2',
      type: 'short_answer',
      content: 'Tính khoảng cách từ A đến mặt phẳng (SBC) trong hình chóp trên',
      group_id: 'group-geo-1', // Câu 2 của chùm
      lock_options_order: false,
    },
    {
      id: 'q-standalone-3',
      type: 'short_answer',
      content: 'Câu đơn 3',
      lock_options_order: false,
    },
  ];

  it('1000-run test: lock_options_order questions NEVER have their options permuted', () => {
    for (let i = 0; i < 1000; i++) {
      const res = shuffleExamQuestions(sampleQuestions);
      const lockedPerm = res.optionPermutations['q-locked-2'];
      expect(lockedPerm).toEqual(['A', 'B', 'C', 'D']);

      const lockedQ = res.shuffledQuestions.find((q) => q.id === 'q-locked-2');
      if (lockedQ && lockedQ.type === 'single_choice') {
        expect(lockedQ.options[0].text).toBe('Khẳng định 1');
        expect(lockedQ.options[1].text).toBe('Khẳng định 2');
        expect(lockedQ.options[2].text).toBe('Cả A và B đều đúng');
        expect(lockedQ.options[3].text).toBe('Tất cả đều sai');
      }
    }
  });

  it('1000-run test: questions with the same group_id are ALWAYS contiguous / adjacent', () => {
    for (let i = 0; i < 1000; i++) {
      const res = shuffleExamQuestions(sampleQuestions);
      const idx1 = res.questionOrder.indexOf('q-group-1');
      const idx2 = res.questionOrder.indexOf('q-group-2');

      // Hai câu thuộc cùng group_id phải nằm sát cạnh nhau (hiệu số chỉ số = 1)
      expect(Math.abs(idx1 - idx2)).toBe(1);
    }
  });

  it('bidirectional mapping fidelity: student choice <-> canonical key', () => {
    const perm = ['C', 'A', 'D', 'B'];

    // 1. Học sinh bấm chọn 'A' trên màn hình -> Đó là phương án 'C' gốc trong ngân hàng
    expect(mapDisplayedToCanonical('A', perm)).toBe('C');
    // Phương án 'B' trên màn hình -> Là 'A' gốc
    expect(mapDisplayedToCanonical('B', perm)).toBe('A');
    // Phương án 'C' trên màn hình -> Là 'D' gốc
    expect(mapDisplayedToCanonical('C', perm)).toBe('D');
    // Phương án 'D' trên màn hình -> Là 'B' gốc
    expect(mapDisplayedToCanonical('D', perm)).toBe('B');

    // 2. Chiều ngược lại (Xem lại kết quả): Khóa gốc là 'C' -> Hiển thị cho học sinh là 'A'
    expect(mapCanonicalToDisplayed('C', perm)).toBe('A');
    expect(mapCanonicalToDisplayed('A', perm)).toBe('B');
    expect(mapCanonicalToDisplayed('D', perm)).toBe('C');
    expect(mapCanonicalToDisplayed('B', perm)).toBe('D');

    // 3. Tính đối ngẫu hoàn hảo (Invertible Bijection)
    for (const letter of ['A', 'B', 'C', 'D']) {
      const canonical = mapDisplayedToCanonical(letter, perm);
      const backToDisplayed = mapCanonicalToDisplayed(canonical, perm);
      expect(backToDisplayed).toBe(letter);
    }
  });
});
