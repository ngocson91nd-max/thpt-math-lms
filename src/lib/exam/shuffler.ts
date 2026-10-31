import crypto from 'crypto';
import { QuestionPublic } from './schema';

/**
 * Thuật toán Fisher-Yates xáo trộn mảng dùng nguồn ngẫu nhiên an toàn mã hóa (crypto.randomBytes)
 */
export function secureShuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const randomBuffer = crypto.randomBytes(4);
    const randomUint32 = randomBuffer.readUInt32LE(0);
    const j = randomUint32 % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export interface ExamShuffleResult {
  shuffledQuestions: QuestionPublic[];
  questionOrder: string[]; // Danh sách ID câu hỏi theo thứ tự mới
  optionPermutations: Record<string, string[]>; // {"q1": ["C", "A", "D", "B"]}
}

/**
 * Xáo trộn đề thi:
 * 1. Câu hỏi có cùng `group_id` bắt buộc luôn được giữ liền nhau thành một khối.
 * 2. Câu hỏi có `lock_options_order = true` thì giữ nguyên thứ tự phương án ban đầu.
 * 3. Tạo bảng hoán vị optionPermutations để phục vụ ánh xạ 2 chiều:
 *    - Khi nộp: Dịch chữ cái hiển thị của học sinh -> chữ cái gốc trong khóa.
 *    - Khi xem lại: Dịch chữ cái gốc trong khóa -> chữ cái hiển thị học sinh đã thấy.
 */
export function shuffleExamQuestions(questions: QuestionPublic[]): ExamShuffleResult {
  // 1. Gom các câu hỏi theo group_id (hoặc nhóm đơn nếu group_id null/undefined)
  interface QuestionCluster {
    groupId: string | null;
    items: QuestionPublic[];
  }

  const clusters: QuestionCluster[] = [];
  const groupMap = new Map<string, QuestionCluster>();

  for (const q of questions) {
    if (q.group_id) {
      if (!groupMap.has(q.group_id)) {
        const newCluster: QuestionCluster = { groupId: q.group_id, items: [] };
        groupMap.set(q.group_id, newCluster);
        clusters.push(newCluster);
      }
      groupMap.get(q.group_id)!.items.push(q);
    } else {
      clusters.push({ groupId: null, items: [q] });
    }
  }

  // Xáo trộn thứ tự các cụm (các câu cùng group_id vẫn nằm trọn trong cụm của mình)
  const shuffledClusters = secureShuffle(clusters);
  const orderedQuestions: QuestionPublic[] = [];

  for (const cluster of shuffledClusters) {
    // Có thể xáo trộn nội bộ trong cụm nếu cần, hoặc giữ nguyên thứ tự tiểu câu trong chùm
    for (const q of cluster.items) {
      orderedQuestions.push(q);
    }
  }

  const questionOrder: string[] = orderedQuestions.map((q) => q.id);
  const optionPermutations: Record<string, string[]> = {};
  const finalPublicQuestions: QuestionPublic[] = [];

  // 2. Xử lý xáo trộn phương án cho từng câu
  for (const q of orderedQuestions) {
    if (q.type === 'single_choice') {
      const origLetters = ['A', 'B', 'C', 'D'] as const;
      if (q.lock_options_order) {
        // Khóa thứ tự phương án: Giữ nguyên A, B, C, D
        optionPermutations[q.id] = [...origLetters];
        finalPublicQuestions.push(q);
      } else {
        // Xáo trộn ngẫu nhiên 4 phương án
        const shuffledOpts = secureShuffle(q.options);
        const perm = shuffledOpts.map((opt) => opt.id); // Lưu lại thứ tự ID gốc, ví dụ: ['C', 'A', 'D', 'B']
        optionPermutations[q.id] = perm;

        // Gán lại nhãn hiển thị tuần tự A, B, C, D cho học sinh
        const remappedOptions = shuffledOpts.map((opt, idx) => ({
          id: origLetters[idx],
          text: opt.text,
        }));

        finalPublicQuestions.push({
          ...q,
          options: remappedOptions,
        });
      }
    } else if (q.type === 'true_false') {
      const origLetters = ['a', 'b', 'c', 'd'] as const;
      if (q.lock_options_order) {
        optionPermutations[q.id] = [...origLetters];
        finalPublicQuestions.push(q);
      } else {
        const shuffledOpts = secureShuffle(q.options);
        const perm = shuffledOpts.map((opt) => opt.id);
        optionPermutations[q.id] = perm;

        const remappedOptions = shuffledOpts.map((opt, idx) => ({
          id: origLetters[idx],
          text: opt.text,
        }));

        finalPublicQuestions.push({
          ...q,
          options: remappedOptions,
        });
      }
    } else {
      // short_answer hoặc essay không có options
      finalPublicQuestions.push(q);
    }
  }

  return {
    shuffledQuestions: finalPublicQuestions,
    questionOrder,
    optionPermutations,
  };
}

/**
 * Dịch lựa chọn hiển thị của học sinh sang lựa chọn gốc trong ngân hàng:
 * Ví dụ: optionPermutations[qId] = ['C', 'A', 'D', 'B']
 * Học sinh thấy phương án đầu tiên là 'A' -> ID gốc thực tế là 'C'
 */
export function mapDisplayedToCanonical(
  displayedChoice: string,
  permutation: string[] | undefined
): string {
  if (!permutation || permutation.length === 0) return displayedChoice;

  const isUpperCase = displayedChoice === displayedChoice.toUpperCase();
  const letters = isUpperCase ? ['A', 'B', 'C', 'D'] : ['a', 'b', 'c', 'd'];
  const idx = letters.indexOf(displayedChoice);
  if (idx >= 0 && idx < permutation.length) {
    return permutation[idx];
  }
  return displayedChoice;
}

/**
 * Dịch đáp án gốc trong ngân hàng sang chữ cái mà học sinh đã thấy trên màn hình:
 * Ví dụ: optionPermutations[qId] = ['C', 'A', 'D', 'B']
 * Đáp án đúng gốc là 'C' -> Xuất hiện ở vị trí đầu tiên -> Học sinh đã thấy là 'A'
 */
export function mapCanonicalToDisplayed(
  canonicalChoice: string,
  permutation: string[] | undefined
): string {
  if (!permutation || permutation.length === 0) return canonicalChoice;

  const idx = permutation.indexOf(canonicalChoice);
  if (idx >= 0) {
    const isUpperCase = canonicalChoice === canonicalChoice.toUpperCase();
    const letters = isUpperCase ? ['A', 'B', 'C', 'D'] : ['a', 'b', 'c', 'd'];
    return letters[idx] || canonicalChoice;
  }
  return canonicalChoice;
}
