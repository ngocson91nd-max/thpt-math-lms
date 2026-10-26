import { describe, it, expect } from 'vitest';
import {
  gradeSingleQuestion,
  gradeExamSubmission,
  normalizeShortAnswer,
} from '../src/lib/grading/grader';
import { Question } from '../src/types/database';

describe('Bộ máy chấm điểm Toán THPT (Server-side Math Grader)', () => {
  describe('1. Trắc nghiệm 1 đáp án (Single Choice)', () => {
    const q: Question = {
      id: 'q1',
      grade: 12,
      topic: 'Đạo hàm',
      difficulty: 'nhan_biet',
      type: 'single_choice',
      content: 'Tính đạo hàm của $y = x^2$',
      points: 0.25,
      is_public: true,
      correct_answer: 'A',
    };

    it('Chấm đúng khi học sinh chọn đáp án khớp', () => {
      const res = gradeSingleQuestion(q, 'A');
      expect(res.isCorrect).toBe(true);
      expect(res.earnedPoints).toBe(0.25);
    });

    it('Không phân biệt hoa thường và khoảng trắng thừa', () => {
      const res = gradeSingleQuestion(q, ' a ');
      expect(res.isCorrect).toBe(true);
      expect(res.earnedPoints).toBe(0.25);
    });

    it('Chấm 0 điểm khi học sinh chọn sai đáp án', () => {
      const res = gradeSingleQuestion(q, 'B');
      expect(res.isCorrect).toBe(false);
      expect(res.earnedPoints).toBe(0);
    });
  });

  describe('2. Trắc nghiệm nhiều đáp án (Multiple Choice)', () => {
    const q: Question = {
      id: 'q2',
      grade: 12,
      topic: 'Tiệm cận',
      difficulty: 'thong_hieu',
      type: 'multiple_choice',
      content: 'Chọn các khẳng định đúng',
      points: 1.0,
      is_public: true,
      correct_answer: ['A', 'B', 'D'],
    };

    it('Chấm điểm tối đa khi chọn đúng và đủ tất cả các ý', () => {
      const res = gradeSingleQuestion(q, ['D', 'A', 'B']); // Thứ tự khác nhau
      expect(res.isCorrect).toBe(true);
      expect(res.earnedPoints).toBe(1.0);
    });

    it('Chấm điểm một phần khi chọn đúng một số ý và không có ý sai', () => {
      const res = gradeSingleQuestion(q, ['A', 'B']);
      expect(res.isCorrect).toBe(false);
      expect(res.earnedPoints).toBe(0.67); // 2/3 * 1.0
    });

    it('Chấm 0 điểm khi có ý chọn sai', () => {
      const res = gradeSingleQuestion(q, ['A', 'C']); // C là sai
      expect(res.isCorrect).toBe(false);
      expect(res.earnedPoints).toBe(0);
    });
  });

  describe('3. Trắc nghiệm Đúng/Sai 4 ý chuẩn Bộ GD&ĐT 2025 (True/False)', () => {
    const q: Question = {
      id: 'q3',
      grade: 12,
      topic: 'Khảo sát hàm số',
      difficulty: 'van_dung',
      type: 'true_false',
      content: 'Xét tính đúng/sai của 4 mệnh đề',
      points: 1.0,
      is_public: true,
      correct_answer: { a: true, b: true, c: false, d: true },
    };

    it('Đúng 4 ý -> Đạt 100% điểm (1.0đ)', () => {
      const studentAns = { a: true, b: true, c: false, d: true };
      const res = gradeSingleQuestion(q, studentAns);
      expect(res.isCorrect).toBe(true);
      expect(res.earnedPoints).toBe(1.0);
    });

    it('Đúng 3 ý -> Đạt 50% điểm (0.50đ)', () => {
      const studentAns = { a: true, b: true, c: true, d: true }; // sai ý c
      const res = gradeSingleQuestion(q, studentAns);
      expect(res.isCorrect).toBe(false);
      expect(res.earnedPoints).toBe(0.5);
    });

    it('Đúng 2 ý -> Đạt 25% điểm (0.25đ)', () => {
      const studentAns = { a: true, b: false, c: true, d: true }; // sai b, c
      const res = gradeSingleQuestion(q, studentAns);
      expect(res.isCorrect).toBe(false);
      expect(res.earnedPoints).toBe(0.25);
    });

    it('Đúng 1 ý -> Đạt 10% điểm (0.10đ)', () => {
      const studentAns = { a: false, b: false, c: true, d: true }; // chỉ đúng d
      const res = gradeSingleQuestion(q, studentAns);
      expect(res.isCorrect).toBe(false);
      expect(res.earnedPoints).toBe(0.1);
    });

    it('Đúng 0 ý -> Đạt 0đ', () => {
      const studentAns = { a: false, b: false, c: true, d: false }; // sai hết cả 4
      const res = gradeSingleQuestion(q, studentAns);
      expect(res.isCorrect).toBe(false);
      expect(res.earnedPoints).toBe(0);
    });
  });

  describe('4. Trả lời ngắn / Điền đáp số (Short Answer)', () => {
    const q: Question = {
      id: 'q4',
      grade: 12,
      topic: 'Min-Max',
      difficulty: 'thong_hieu',
      type: 'short_answer',
      content: 'Tìm giá trị nhỏ nhất của hàm số...',
      points: 0.5,
      is_public: true,
      correct_answer: ['6', '6.0', '6,0'],
    };

    it('Chấp nhận số nguyên và khoảng trắng', () => {
      const res = gradeSingleQuestion(q, '  6  ');
      expect(res.isCorrect).toBe(true);
      expect(res.earnedPoints).toBe(0.5);
    });

    it('Chấp nhận dấu phẩy thập phân kiểu Việt Nam "6,0"', () => {
      const res = gradeSingleQuestion(q, '6,0');
      expect(res.isCorrect).toBe(true);
      expect(res.earnedPoints).toBe(0.5);
    });

    it('Chấp nhận phân số tương đương (ví dụ 5/2 = 2.5)', () => {
      const qFraction: Question = {
        id: 'q_frac',
        grade: 12,
        topic: 'Tích phân',
        difficulty: 'van_dung',
        type: 'short_answer',
        content: 'Tính diện tích hình phẳng...',
        points: 0.5,
        is_public: true,
        correct_answer: ['2.5', '5/2', '2,5'],
      };

      const res = gradeSingleQuestion(qFraction, '5/2');
      expect(res.isCorrect).toBe(true);
      expect(res.earnedPoints).toBe(0.5);

      const resDecimal = gradeSingleQuestion(qFraction, '2,5');
      expect(resDecimal.isCorrect).toBe(true);
      expect(resDecimal.earnedPoints).toBe(0.5);
    });
  });

  describe('5. Tự luận (Essay)', () => {
    const q: Question = {
      id: 'q5',
      grade: 12,
      topic: 'Toán thực tế',
      difficulty: 'van_dung_cao',
      type: 'essay',
      content: 'Tìm kích thước bể nước...',
      points: 1.0,
      is_public: true,
      correct_answer: 'Hướng dẫn chấm...',
    };

    it('Đánh dấu bài làm là chờ giáo viên chấm (isCorrect = null)', () => {
      const res = gradeSingleQuestion(q, 'Học sinh trình bày bài làm...');
      expect(res.isCorrect).toBe(null);
      expect(res.earnedPoints).toBe(0);
      expect(res.maxPoints).toBe(1.0);
    });
  });

  describe('6. Tổng hợp điểm toàn bộ Đề thi (Grade Exam Submission)', () => {
    it('Tính điểm và quy đổi sang thang điểm 10 chính xác', () => {
      const questions: Question[] = [
        {
          id: 'q1',
          grade: 12,
          topic: 'Toán',
          difficulty: 'nhan_biet',
          type: 'single_choice',
          content: 'C1',
          points: 1.0,
          is_public: true,
          correct_answer: 'A',
        },
        {
          id: 'q2',
          grade: 12,
          topic: 'Toán',
          difficulty: 'nhan_biet',
          type: 'single_choice',
          content: 'C2',
          points: 1.0,
          is_public: true,
          correct_answer: 'B',
        },
      ];

      const examResult = gradeExamSubmission(questions, {
        q1: 'A',
        q2: 'B',
      });

      expect(examResult.score).toBe(10.0);
      expect(examResult.rawEarnedPoints).toBe(2.0);
      expect(examResult.rawMaxPoints).toBe(2.0);
      expect(examResult.hasPendingEssay).toBe(false);
    });
  });
});
