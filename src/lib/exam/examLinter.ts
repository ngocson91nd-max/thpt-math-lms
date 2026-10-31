import crypto from 'crypto';

export interface LintResult {
  lock_options_order: boolean;
  suggested_group: boolean;
  warnings: string[];
}

export const LOCKED_OPTION_PATTERNS = [
  /cả\s+[A-D]\s+và\s+[A-D]/i,
  /[A-D]\s+và\s+[A-D]\s+đều\s+(đúng|sai)/i,
  /tất\s+cả\s+(các\s+phương\s+án\s+trên\s+)?(đều\s+)?(đúng|sai)/i,
  /không\s+có\s+đáp\s+án\s+nào\s+đúng/i,
  /cả\s+ba\s+đáp\s+án\s+trên/i,
];

export const GROUP_SUGGESTION_PATTERNS = [
  /hình\s+(vẽ\s+)?(bên|trên|dưới)/i,
  /câu\s+\d+/i,
  /dữ\s+kiện\s+(trên|dưới)/i,
  /sử\s+dụng\s+thông\s+tin\s+(sau|trên)/i,
  /thông\s+tin\s+chung\s+cho/i,
];

export const HARDCODED_ANSWER_LETTER_PATTERN = /(chọn|đáp\s*án)\s*([A-D])\b/i;

/**
 * Băm nội dung câu hỏi SHA-256 để phát hiện câu trùng lặp trong ngân hàng
 */
export function computeContentHash(content: string): string {
  const normalized = content.trim().replace(/\s+/g, ' ');
  return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
}

/**
 * Kiểm tra phân tích chất lượng câu hỏi (Linting) khi nạp đề:
 * 1. Phương án khớp mẫu "cả A và B", "tất cả đều đúng" -> Tự động lock_options_order và cảnh báo.
 * 2. Lời giải nêu chữ cái cứng A, B, C, D -> Cảnh báo sẽ bị sai sau khi đảo phương án.
 * 3. Đề bài tham chiếu "hình trên", "dữ kiện trên", "câu \d+" -> Gợi ý gán group_id.
 * 4. Trùng content_hash với câu đã có trong ngân hàng -> Cảnh báo trùng câu.
 */
export function lintQuestion(input: {
  content: string;
  options?: { id: string; text: string }[];
  explanation?: string;
  existingHashes?: Set<string>;
  previouslyPublishedIds?: Set<string>;
  questionId?: string;
}): LintResult {
  const warnings: string[] = [];
  let lock_options_order = false;
  let suggested_group = false;

  // 1. Kiểm tra phương án có phụ thuộc vị trí tương đối
  if (Array.isArray(input.options)) {
    for (const opt of input.options) {
      const isLockedMatch = LOCKED_OPTION_PATTERNS.some((pattern) => pattern.test(opt.text));
      if (isLockedMatch) {
        lock_options_order = true;
        warnings.push(
          `Phương án "${opt.id}: ${opt.text}" phụ thuộc vị trí thứ tự ("cả A và B", "tất cả đều đúng") -> Tự động KHÓA đảo phương án.`
        );
        break;
      }
    }
  }

  // 2. Kiểm tra lời giải có chứa chữ cái cứng (A, B, C, D)
  if (input.explanation) {
    const match = input.explanation.match(HARDCODED_ANSWER_LETTER_PATTERN);
    if (match) {
      warnings.push(
        `Lời giải chứa chữ cái cố định "${match[0]}". Cần viết theo nội dung phương án để tránh sai lệch khi xáo trộn đề.`
      );
    }
  }

  // 3. Kiểm tra đề bài có tham chiếu hình/dữ kiện chung
  const hasGroupReference = GROUP_SUGGESTION_PATTERNS.some((pattern) =>
    pattern.test(input.content)
  );
  if (hasGroupReference) {
    suggested_group = true;
    warnings.push(
      'Nội dung câu hỏi tham chiếu "hình trên / dữ kiện trên / câu trước" -> Gợi ý gán chung group_id để không bị tách rời khi trộn đề.'
    );
  }

  // 4. Kiểm tra trùng lặp content_hash
  if (input.existingHashes && input.content) {
    const hash = computeContentHash(input.content);
    if (input.existingHashes.has(hash)) {
      warnings.push('Phát hiện nội dung câu hỏi trùng lặp với câu đã có trong ngân hàng đề.');
    }
  }

  // 5. Kiểm tra câu hỏi đã từng bị công bố lời giải ở đề trước
  if (input.previouslyPublishedIds && input.questionId) {
    if (input.previouslyPublishedIds.has(input.questionId)) {
      warnings.push('Câu hỏi này đã từng được công bố lời giải cho học sinh ở một bài thi trước đó.');
    }
  }

  return {
    lock_options_order,
    suggested_group,
    warnings,
  };
}
