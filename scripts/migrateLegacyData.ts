import { computeContentHash } from '../src/lib/exam/examLinter';

/**
 * Xóa hoàn toàn các thẻ đáp án (\True, \choiceTF, \shortans) và toàn bộ khối \loigiai{...}
 * khỏi nội dung công khai để học sinh không thể đọc được.
 */
export function sanitizePublicContent(text: string): string {
  if (!text) return '';

  let sanitized = text;

  // 1. Xóa các khối \loigiai{...}
  const loigiaiIdx = sanitized.indexOf('\\loigiai');
  if (loigiaiIdx !== -1) {
    let depth = 0;
    let startIdx = -1;
    let endIdx = -1;

    for (let i = loigiaiIdx; i < sanitized.length; i++) {
      if (sanitized[i] === '{') {
        if (depth === 0) startIdx = i;
        depth++;
      } else if (sanitized[i] === '}') {
        depth--;
        if (depth === 0) {
          endIdx = i;
          break;
        }
      }
    }

    if (startIdx !== -1 && endIdx !== -1) {
      sanitized = sanitized.slice(0, loigiaiIdx) + sanitized.slice(endIdx + 1);
    } else {
      // Fallback regex nếu ngoặc không cân bằng
      sanitized = sanitized.replace(/\\loigiai\{[\s\S]*?\}/g, '');
    }
  }

  // 2. Xóa các từ khóa đáp án và gói lệnh nhạy cảm
  sanitized = sanitized
    .replace(/\\True\s*/g, '')
    .replace(/\\choiceTF\b/g, '')
    .replace(/\\shortans\b/g, '')
    .trim();

  return sanitized;
}

/**
 * Xóa \True khỏi các phương án lựa chọn A, B, C, D hoặc a, b, c, d
 */
export function sanitizePublicOptions(options: any): any {
  if (!Array.isArray(options)) return options;

  return options.map((opt: any) => ({
    ...opt,
    text: sanitizePublicContent(opt.text || ''),
  }));
}

/**
 * Chuẩn hóa đáp án trả lời ngắn từ mảng chuỗi cũ (VD: ["0.5", "1/2"])
 * sang đối tượng chuẩn Zod gồm value (dấu chấm) và alternatives.
 */
export function normalizeLegacyShortAnswer(rawAns: any): {
  value: string;
  alternatives: string[];
} {
  let valStr = '';
  const alts: string[] = [];

  if (Array.isArray(rawAns)) {
    valStr = String(rawAns[0] || '').trim();
    for (let i = 1; i < rawAns.length; i++) {
      const alt = String(rawAns[i] || '').trim();
      if (alt) alts.push(alt);
    }
  } else if (typeof rawAns === 'object' && rawAns !== null) {
    valStr = String(rawAns.value || rawAns.correct || '').trim();
    if (Array.isArray(rawAns.alternatives)) {
      alts.push(...rawAns.alternatives.map((a: any) => String(a).trim()));
    }
  } else {
    valStr = String(rawAns || '').trim();
  }

  // Chuẩn hóa dấu phẩy sang dấu chấm
  valStr = valStr.replace(/\s+/g, '').replace(/,/g, '.');

  // Nếu giá trị chính là phân số (ví dụ: "1/2"), chuyển sang dạng số thập phân nếu có thể
  if (/^-?\d+\/\d+$/.test(valStr)) {
    const [num, den] = valStr.split('/').map(Number);
    if (den !== 0) {
      const decimalVal = (num / den).toString();
      alts.push(valStr); // Giữ phân số gốc trong alternatives
      valStr = decimalVal;
    }
  }

  // Nếu không parse được dạng số, giữ mặc định "0"
  if (!/^-?\d+(\.\d+)?$/.test(valStr)) {
    valStr = '0';
  }

  return {
    value: valStr,
    alternatives: alts,
  };
}

/**
 * Chuyển đổi một bản ghi câu hỏi cũ sang bộ đôi:
 * 1. question_version (public, an toàn, đã bóc đáp án)
 * 2. question_key (private, chứa đáp án chuẩn và lời giải)
 */
export function transformLegacyQuestion(legacyQ: any, isUsedInExam: boolean = false) {
  const cleanContent = sanitizePublicContent(legacyQ.content || '');
  const cleanOptions = sanitizePublicOptions(legacyQ.options);
  const contentHash = computeContentHash(cleanContent);

  const questionVersion = {
    id: legacyQ.id, // Giữ ID tương thích
    question_id: legacyQ.id,
    version: 1,
    type: legacyQ.type || 'single_choice',
    grade: legacyQ.grade || 12,
    topic: legacyQ.topic || 'Khảo sát hàm số',
    difficulty: legacyQ.difficulty || 'thong_hieu',
    content: cleanContent,
    options: cleanOptions,
    image_url: legacyQ.image_url || null,
    lock_options_order: legacyQ.lock_options_order ?? false,
    group_id: legacyQ.group_id || null,
    content_hash: contentHash,
    status: isUsedInExam ? 'published' : 'draft',
    warnings: [],
  };

  // Chuẩn bị khóa đáp án cho private.question_keys
  let keyPayload: any = {};
  if (legacyQ.type === 'single_choice') {
    let correct = legacyQ.correct_answer;
    if (typeof correct === 'object' && correct !== null) {
      correct = correct.id || correct.correct || 'A';
    }
    keyPayload = { correct: String(correct || 'A').toUpperCase() };
  } else if (legacyQ.type === 'true_false') {
    const rawMap = legacyQ.correct_answer || {};
    keyPayload = {
      correct: {
        a: Boolean(rawMap.a),
        b: Boolean(rawMap.b),
        c: Boolean(rawMap.c),
        d: Boolean(rawMap.d),
      },
    };
  } else if (legacyQ.type === 'short_answer') {
    const normalized = normalizeLegacyShortAnswer(legacyQ.correct_answer);
    keyPayload = {
      value: normalized.value,
      alternatives: normalized.alternatives,
    };
  } else {
    keyPayload = {};
  }

  const questionKey = {
    question_version_id: legacyQ.id,
    type: legacyQ.type || 'single_choice',
    key: keyPayload,
    explanation: legacyQ.explanation || null,
    raw_tex: legacyQ.raw_tex || legacyQ.content || null,
  };

  return { questionVersion, questionKey };
}
