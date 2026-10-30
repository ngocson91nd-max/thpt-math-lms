import { Question, SubmissionAnswer } from '@/types/database';

export interface GradeQuestionResult {
  questionId: string;
  isCorrect: boolean | null; // null nếu là tự luận cần GV chấm
  earnedPoints: number;
  maxPoints: number;
  explanation?: string;
  correctAnswer?: any;
}

export interface GradeExamResult {
  score: number; // Tổng điểm quy đổi trên thang 10
  rawEarnedPoints: number;
  rawMaxPoints: number;
  answers: GradeQuestionResult[];
  hasPendingEssay: boolean;
}

/**
 * Chuẩn hóa câu trả lời ngắn của học sinh:
 * - Loại bỏ khoảng trắng thừa
 * - Chuyển dấu phẩy thập phân kiểu Việt Nam (,) thành dấu chấm (.)
 * - Hỗ trợ phân số đơn giản (ví dụ "5/2" -> 2.5)
 */
export function normalizeShortAnswer(val: any): string {
  if (val === null || val === undefined) return '';
  let str = String(val).trim().toLowerCase();
  // Bỏ dấu $ nếu học sinh gõ LaTeX: $14$ -> 14
  str = str.replace(/\$/g, '');
  // Bỏ các tiền tố như "x=", "s=", "d="
  str = str.replace(/^[a-z]\s*=\s*/, '');
  // Thay thế dấu phẩy thập phân kiểu Việt Nam
  str = str.replace(',', '.');
  return str.trim();
}

/**
 * Kiểm tra xem 2 giá trị số có tương đương nhau không
 */
function areNumericValuesEqual(val1: string, val2: string): boolean {
  // Thử parse phân số "a/b"
  const parseVal = (s: string): number | null => {
    if (s.includes('/')) {
      const parts = s.split('/');
      if (parts.length === 2) {
        const num = parseFloat(parts[0]);
        const den = parseFloat(parts[1]);
        if (!isNaN(num) && !isNaN(den) && den !== 0) {
          return num / den;
        }
      }
    }
    const num = parseFloat(s);
    return isNaN(num) ? null : num;
  };

  const n1 = parseVal(val1);
  const n2 = parseVal(val2);

  if (n1 !== null && n2 !== null) {
    return Math.abs(n1 - n2) < 1e-4;
  }

  return val1 === val2;
}

/**
 * Chấm điểm cho 1 câu hỏi toán độc lập phía máy chủ
 */
export function gradeSingleQuestion(
  question: Question,
  studentAnswer: any,
  customMaxPoints?: number
): GradeQuestionResult {
  const maxPoints = customMaxPoints !== undefined ? customMaxPoints : (question.points || 1.0);

  // 1. Dạng Tự luận (essay) - cần GV chấm sau
  if (question.type === 'essay') {
    return {
      questionId: question.id,
      isCorrect: null,
      earnedPoints: 0,
      maxPoints,
      explanation: question.explanation,
      correctAnswer: question.correct_answer,
    };
  }

  // 2. Dạng Trắc nghiệm 1 đáp án (single_choice)
  if (question.type === 'single_choice') {
    const isCorrect =
      studentAnswer !== undefined &&
      studentAnswer !== null &&
      String(studentAnswer).trim().toUpperCase() ===
        String(question.correct_answer).trim().toUpperCase();

    return {
      questionId: question.id,
      isCorrect,
      earnedPoints: isCorrect ? maxPoints : 0,
      maxPoints,
      explanation: question.explanation,
      correctAnswer: question.correct_answer,
    };
  }

  // 3. Dạng Trắc nghiệm nhiều lựa chọn (multiple_choice)
  if (question.type === 'multiple_choice') {
    const studentChoices: string[] = Array.isArray(studentAnswer)
      ? studentAnswer.map((s) => String(s).trim().toUpperCase()).sort()
      : [];

    const correctChoices: string[] = Array.isArray(question.correct_answer)
      ? question.correct_answer.map((s) => String(s).trim().toUpperCase()).sort()
      : [];

    // So sánh mảng
    const isExactMatch =
      studentChoices.length === correctChoices.length &&
      studentChoices.every((val, idx) => val === correctChoices[idx]);

    // Nếu chọn đúng một phần không có lựa chọn sai: cho điểm theo tỷ lệ
    let earned = 0;
    if (isExactMatch) {
      earned = maxPoints;
    } else if (studentChoices.length > 0 && correctChoices.length > 0) {
      const correctSelected = studentChoices.filter((c) => correctChoices.includes(c)).length;
      const wrongSelected = studentChoices.filter((c) => !correctChoices.includes(c)).length;
      if (wrongSelected === 0 && correctSelected > 0) {
        earned = Number(((correctSelected / correctChoices.length) * maxPoints).toFixed(2));
      }
    }

    return {
      questionId: question.id,
      isCorrect: isExactMatch,
      earnedPoints: earned,
      maxPoints,
      explanation: question.explanation,
      correctAnswer: question.correct_answer,
    };
  }

  // 4. Dạng Đúng/Sai 4 ý chuẩn THPT 2025 (true_false)
  // Quy đổi điểm chính thức theo Bộ GD&ĐT:
  // - Đúng 1 ý: 0.10 điểm (10% tổng điểm câu)
  // - Đúng 2 ý: 0.25 điểm (25% tổng điểm câu)
  // - Đúng 3 ý: 0.50 điểm (50% tổng điểm câu)
  // - Đúng 4 ý: 1.00 điểm (100% tổng điểm câu)
  if (question.type === 'true_false') {
    const correctMap = (question.correct_answer || {}) as Record<string, boolean>;
    const studentMap = (studentAnswer || {}) as Record<string, boolean>;

    // Chuẩn hóa keys về chữ thường (hỗ trợ cả a, b, c, d lẫn A, B, C, D)
    const normCorrect: Record<string, boolean> = {};
    if (correctMap && typeof correctMap === 'object') {
      Object.keys(correctMap).forEach((k) => {
        normCorrect[k.toLowerCase().trim()] = Boolean(correctMap[k]);
      });
    }
    const normStudent: Record<string, boolean> = {};
    if (studentMap && typeof studentMap === 'object') {
      Object.keys(studentMap).forEach((k) => {
        normStudent[k.toLowerCase().trim()] = Boolean(studentMap[k]);
      });
    }

    const statementKeys = ['a', 'b', 'c', 'd'];
    let correctCount = 0;

    for (const key of statementKeys) {
      if (
        normStudent[key] !== undefined &&
        normStudent[key] === normCorrect[key]
      ) {
        correctCount++;
      }
    }

    let ratio = 0;
    if (correctCount === 1) ratio = 0.1;
    else if (correctCount === 2) ratio = 0.25;
    else if (correctCount === 3) ratio = 0.5;
    else if (correctCount === 4) ratio = 1.0;

    const earnedPoints = Number((ratio * maxPoints).toFixed(2));
    const isCorrect = correctCount === 4;

    return {
      questionId: question.id,
      isCorrect,
      earnedPoints,
      maxPoints,
      explanation: question.explanation,
      correctAnswer: question.correct_answer,
    };
  }

  // 5. Dạng Trả lời ngắn / Điền đáp số (short_answer)
  if (question.type === 'short_answer') {
    const normStudent = normalizeShortAnswer(studentAnswer);
    const acceptedAnswers: string[] = Array.isArray(question.correct_answer)
      ? question.correct_answer.map(normalizeShortAnswer)
      : [normalizeShortAnswer(question.correct_answer)];

    let isMatch = false;
    for (const acc of acceptedAnswers) {
      if (areNumericValuesEqual(normStudent, acc)) {
        isMatch = true;
        break;
      }
    }

    return {
      questionId: question.id,
      isCorrect: isMatch,
      earnedPoints: isMatch ? maxPoints : 0,
      maxPoints,
      explanation: question.explanation,
      correctAnswer: question.correct_answer,
    };
  }

  return {
    questionId: question.id,
    isCorrect: false,
    earnedPoints: 0,
    maxPoints,
  };
}

/**
 * Chấm điểm toàn bộ đề thi phía máy chủ, quy đổi sang thang điểm chuẩn
 */
export function gradeExamSubmission(
  questions: (Question & { custom_points?: number })[],
  studentAnswersMap: Record<string, any>,
  targetMaxScore: number = 10
): GradeExamResult {
  let rawEarnedPoints = 0;
  let rawMaxPoints = 0;
  let hasPendingEssay = false;

  const results: GradeQuestionResult[] = [];

  for (const q of questions) {
    const sAns = studentAnswersMap[q.id];
    const maxP = q.custom_points !== undefined ? q.custom_points : (q.points || 1.0);
    rawMaxPoints += maxP;

    const r = gradeSingleQuestion(q, sAns, maxP);
    results.push(r);

    if (q.type === 'essay') {
      hasPendingEssay = true;
    } else {
      rawEarnedPoints += r.earnedPoints;
    }
  }

  // Nếu đề thi đã được thiết kế sẵn điểm số theo thang 10 (tổng điểm các câu từ 9.0 đến 11.5 điểm):
  // Điểm đạt được là tổng điểm trực tiếp của các câu đã làm đúng, không bị ép chia giảm tỷ lệ
  let normalizedScore = 0;
  if (rawMaxPoints >= 9.0 && rawMaxPoints <= 11.5) {
    normalizedScore = Math.min(targetMaxScore, Number(rawEarnedPoints.toFixed(2)));
  } else if (rawMaxPoints > 0) {
    normalizedScore = Number(((rawEarnedPoints / rawMaxPoints) * targetMaxScore).toFixed(2));
  }

  return {
    score: normalizedScore,
    rawEarnedPoints: Number(rawEarnedPoints.toFixed(2)),
    rawMaxPoints: Number(rawMaxPoints.toFixed(2)),
    answers: results,
    hasPendingEssay,
  };
}
