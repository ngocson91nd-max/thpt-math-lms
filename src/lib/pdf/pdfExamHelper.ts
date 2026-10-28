import { Question } from '@/types/database';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export interface ParsedPdfAnswers {
  part1: Record<number, string>; // { 1: 'A', 2: 'B', ... }
  part2: Record<number, Record<string, boolean>>; // { 13: { a: true, b: false, ... } }
  part3: Record<number, string>; // { 17: '1440', 18: '-2.5', ... }
}

/**
 * Phân tích chuỗi đáp án nhanh 1 chạm của giáo viên
 * Hỗ trợ đa dạng định dạng:
 * Phần I:  1A 2B 3C 4D... hoặc 1.A, 2-B, 1: A
 * Phần II: 13: aD bS cD dS | 14: aĐ bĐ cS dS | 15: D S D S | 16: T F T F
 * Phần III: 17: 1440 | 18: -2.5 | 19: 12 | 20: 3/4 | 17. 1440
 */
export function parseQuickAnswerKey(input: string): ParsedPdfAnswers {
  const result: ParsedPdfAnswers = {
    part1: {},
    part2: {},
    part3: {},
  };

  if (!input || !input.trim()) return result;

  const lines = input.split(/\r?\n|;/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // 1. Kiểm tra dòng bắt đầu bằng số câu (VD: "13: ...", "13. ...", "13 ...")
    // Lưu ý: không gom dấu trừ '-' vào delimiter để không nuốt mất dấu âm của đáp số (VD: 18: -2.5)
    const lineMatch = line.match(/^(\d+)\s*[:.]\s*(.*)$/) || line.match(/^(\d+)\s+(.*)$/);
    if (lineMatch) {
      const qNum = parseInt(lineMatch[1], 10);
      const rest = lineMatch[2].trim();

      // Kiểm tra 1.1: 4 chữ cái Đúng/Sai liên tiếp (VD: "D S D S" hoặc "Đ S Đ S" hoặc "T F T F")
      const tokens = rest.split(/[\s,]+/).filter(Boolean);
      if (
        tokens.length === 4 &&
        tokens.every((t) => /^[dsđtfe]$/i.test(t) || /^(đúng|sai|true|false)$/i.test(t))
      ) {
        const letters = ['a', 'b', 'c', 'd'];
        const stmtMap: Record<string, boolean> = {};
        tokens.forEach((tok, idx) => {
          const t = tok.toLowerCase();
          stmtMap[letters[idx]] = t.startsWith('d') || t.startsWith('đ') || t.startsWith('t');
        });
        result.part2[qNum] = stmtMap;
        continue;
      }

      // Kiểm tra 1.2: Định dạng có tên ý a, b, c, d rõ ràng (VD: "aD bS cD dS" hoặc "a:Đ, b:S" hoặc "a) Đúng")
      if (/\ba[\s.:)\-_]*[dsđttruefals]/i.test(rest)) {
        const tfSubMatch = rest.match(/\b([a-d])[\s.:)\-_]*([dsđttruefals]+)/gi);
        if (tfSubMatch && tfSubMatch.length >= 2) {
          const stmtMap: Record<string, boolean> = {};
          for (const item of tfSubMatch) {
            const m = item.match(/([a-d])[\s.:)\-_]*([dsđttruefals]+)/i);
            if (m) {
              const letter = m[1].toLowerCase();
              const valStr = m[2].toLowerCase();
              const isTrue = valStr.startsWith('d') || valStr.startsWith('đ') || valStr.startsWith('t');
              stmtMap[letter] = isTrue;
            }
          }
          if (Object.keys(stmtMap).length >= 2) {
            result.part2[qNum] = stmtMap;
            continue;
          }
        }
      }

      // Kiểm tra 1.3: Số hoặc biểu thức điền ngắn (Phần III)
      // VD: "1440" hoặc "-2.5" hoặc "-2,5" hoặc "3/4"
      if (/^-?\d+(?:[.,]\d+)?(?:\/\d+)?$/.test(rest)) {
        result.part3[qNum] = rest.replace(',', '.');
        continue;
      }

      // Kiểm tra 1.4: Đáp án trắc nghiệm đơn A, B, C, D (VD: "1: A" hoặc "1. B")
      if (/^[A-Da-d]$/.test(rest)) {
        result.part1[qNum] = rest.toUpperCase();
        continue;
      }
    }

    // 2. Tìm tất cả các cặp trắc nghiệm đơn trong dòng (Phần I)
    // VD: "1A 2B 3C 4D 5A..." hoặc "1.A 2.B" hoặc "1-A 2-B"
    const p1Regex = /(?:^|\s|[.,;])(\d+)[\s.:-]*([A-Da-d])(?=\s|[.,;]|$)/g;
    let match;
    let hasP1 = false;
    while ((match = p1Regex.exec(line)) !== null) {
      const qNum = parseInt(match[1], 10);
      const ans = match[2].toUpperCase();
      result.part1[qNum] = ans;
      hasP1 = true;
    }

    if (hasP1) continue;

    // 3. Fallback câu điền số nếu không có dấu hai chấm: "17 1440" hoặc "18 -2.5"
    const p3Simple = line.match(/^(\d+)\s+(-?\d+(?:[.,]\d+)?(?:\/\d+)?)$/);
    if (p3Simple) {
      const qNum = parseInt(p3Simple[1], 10);
      result.part3[qNum] = p3Simple[2].replace(',', '.');
    }
  }

  return result;
}

/**
 * Tạo danh sách câu hỏi chuẩn cho Đề PDF từ số lượng câu hoặc bảng đáp án
 */
export function buildPdfExamQuestions(
  part1Count: number = 12,
  part2Count: number = 4,
  part3Count: number = 6,
  parsedAnswers?: ParsedPdfAnswers
): Question[] {
  const questions: Question[] = [];

  // PHẦN I: Trắc nghiệm 4 lựa chọn (0.25đ/câu)
  for (let i = 1; i <= part1Count; i++) {
    const correctAns = parsedAnswers?.part1[i] || 'A';
    questions.push({
      id: `pdf-q-p1-${i}`,
      grade: 12,
      topic: 'Đề thi PDF',
      part: 1,
      difficulty: 'thong_hieu',
      type: 'single_choice',
      content: `Câu ${i} (Đọc câu hỏi trong file PDF đề bài)`,
      options: [
        { id: 'A', text: 'Phương án A' },
        { id: 'B', text: 'Phương án B' },
        { id: 'C', text: 'Phương án C' },
        { id: 'D', text: 'Phương án D' },
      ],
      correct_answer: correctAns,
      points: 0.25,
      is_public: true,
      explanation: `Xem lời giải chi tiết trong file đề PDF câu ${i}.`,
    });
  }

  // PHẦN II: Trắc nghiệm Đúng/Sai (1.0đ/câu theo thang điểm BGD)
  const p2Start = part1Count + 1;
  for (let i = 0; i < part2Count; i++) {
    const qNum = p2Start + i;
    const correctMap = parsedAnswers?.part2[qNum] || { a: true, b: false, c: true, d: false };
    questions.push({
      id: `pdf-q-p2-${qNum}`,
      grade: 12,
      topic: 'Đề thi PDF',
      part: 2,
      difficulty: 'van_dung',
      type: 'true_false',
      content: `Câu ${qNum} (Đọc các mệnh đề a, b, c, d trong file PDF đề bài)`,
      options: [
        { id: 'a', text: 'Mệnh đề a)' },
        { id: 'b', text: 'Mệnh đề b)' },
        { id: 'c', text: 'Mệnh đề c)' },
        { id: 'd', text: 'Mệnh đề d)' },
      ],
      correct_answer: correctMap,
      points: 1.0,
      is_public: true,
      explanation: `Xem lời giải chi tiết trong file đề PDF câu ${qNum}.`,
    });
  }

  // PHẦN III: Trắc nghiệm Trả lời ngắn / Điền số (0.5đ/câu)
  const p3Start = p2Start + part2Count;
  for (let i = 0; i < part3Count; i++) {
    const qNum = p3Start + i;
    const numAns = parsedAnswers?.part3[qNum] || '';
    questions.push({
      id: `pdf-q-p3-${qNum}`,
      grade: 12,
      topic: 'Đề thi PDF',
      part: 3,
      difficulty: 'van_dung_cao',
      type: 'short_answer',
      content: `Câu ${qNum} (Đọc câu hỏi và giải toán trong file PDF đề bài)`,
      correct_answer: numAns ? [numAns, numAns.replace(',', '.')] : ['0', '0'],
      points: 0.5,
      is_public: true,
      explanation: `Xem lời giải chi tiết trong file đề PDF câu ${qNum}.`,
    });
  }

  return questions;
}

/**
 * Chuyển Base64 / Data URL sang Uint8Array
 */
export function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  if (typeof window !== 'undefined' && typeof window.atob === 'function') {
    const binary = window.atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  return Uint8Array.from(Buffer.from(base64, 'base64'));
}

/**
 * Đếm số trang của tài liệu PDF
 */
export async function getPdfPageCount(dataUrl: string): Promise<number> {
  try {
    const bytes = dataUrlToUint8Array(dataUrl);
    const pdfDoc = await PDFDocument.load(bytes);
    return pdfDoc.getPageCount();
  } catch (err) {
    console.error('Lỗi khi đếm số trang PDF:', err);
    return 1;
  }
}

/**
 * Cắt bỏ trang cuối (hoặc các trang chỉ định) khỏi file PDF
 * Ví dụ: Đề thi có 4 trang, trang 4 là bảng đáp án -> cắt bỏ trang 4, chỉ giữ lại trang 1 đến 3.
 */
export async function trimPdfPages(
  dataUrl: string,
  options: {
    removeLastPage?: boolean;
    pagesToKeep?: number[];
    startPage?: number;
    endPage?: number;
  }
): Promise<{ trimmedDataUrl: string; totalOriginal: number; totalNew: number }> {
  try {
    const bytes = dataUrlToUint8Array(dataUrl);
    const pdfDoc = await PDFDocument.load(bytes);
    const totalOriginal = pdfDoc.getPageCount();

    if (totalOriginal <= 1) {
      return { trimmedDataUrl: dataUrl, totalOriginal, totalNew: totalOriginal };
    }

    let indicesToKeep: number[] = [];

    if (options.pagesToKeep && options.pagesToKeep.length > 0) {
      indicesToKeep = options.pagesToKeep.map((p) => p - 1).filter((p) => p >= 0 && p < totalOriginal);
    } else if (options.startPage && options.endPage) {
      for (let i = options.startPage - 1; i <= options.endPage - 1 && i < totalOriginal; i++) {
        if (i >= 0) indicesToKeep.push(i);
      }
    } else if (options.removeLastPage) {
      for (let i = 0; i < totalOriginal - 1; i++) {
        indicesToKeep.push(i);
      }
    } else {
      return { trimmedDataUrl: dataUrl, totalOriginal, totalNew: totalOriginal };
    }

    if (indicesToKeep.length === 0) {
      return { trimmedDataUrl: dataUrl, totalOriginal, totalNew: totalOriginal };
    }

    const newPdf = await PDFDocument.create();
    const copiedPages = await newPdf.copyPages(pdfDoc, indicesToKeep);
    copiedPages.forEach((page) => newPdf.addPage(page));

    const newBase64 = await newPdf.saveAsBase64({ dataUri: true });
    return {
      trimmedDataUrl: newBase64,
      totalOriginal,
      totalNew: copiedPages.length,
    };
  } catch (err) {
    console.error('Lỗi khi cắt trang PDF:', err);
    return { trimmedDataUrl: dataUrl, totalOriginal: 1, totalNew: 1 };
  }
}

/**
 * TỰ ĐỘNG CẮT / CHE BẢNG ĐÁP ÁN Ở CUỐI TRANG PDF:
 * - KHÔNG xóa cả trang để giữ nguyên 100% các câu hỏi cuối đề thi
 * - Phủ khối màu trắng opaque che khuất bảng đáp án ở đáy trang cuối
 * - In dòng chữ trang trọng "---------- HẾT ----------"
 */
export async function maskPdfAnswerKey(
  dataUrl: string,
  options?: {
    bottomRatio?: number; // Tỷ lệ chiều cao cần che ở đáy trang cuối (mặc định 0.32 = 32% đáy trang)
    customHeightPoints?: number;
    noticeText?: string;
  }
): Promise<{ maskedDataUrl: string; totalPages: number }> {
  try {
    const bytes = dataUrlToUint8Array(dataUrl);
    const pdfDoc = await PDFDocument.load(bytes);
    const totalPages = pdfDoc.getPageCount();

    if (totalPages === 0) return { maskedDataUrl: dataUrl, totalPages: 0 };

    const lastPage = pdfDoc.getPage(totalPages - 1);
    const { width, height } = lastPage.getSize();

    // Tỷ lệ che đáy trang (bảng đáp án \dapan thường chiếm từ 60% đến 85% chiều cao trang cuối)
    const ratio = options?.bottomRatio ?? 0.80;
    const maskHeight = options?.customHeightPoints ?? (height * ratio);

    // 1. Phủ khối chữ nhật màu trắng xóa hoàn toàn bảng đáp án ở đáy trang (từ y=0 đến y=maskHeight)
    lastPage.drawRectangle({
      x: 0,
      y: 0,
      width: width,
      height: maskHeight,
      color: rgb(1, 1, 1), // Màu trắng tinh tuyệt đối
    });

    // 2. Vẽ đường phân cách tinh tế trên đỉnh vùng che
    lastPage.drawLine({
      start: { x: 40, y: maskHeight },
      end: { x: width - 40, y: maskHeight },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8),
    });

    // 3. In thông báo chuẩn thi THPT ở vùng đã che
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const titleText = options?.noticeText || '---------- HET ----------';
    const subText = 'Thi sinh chon dap an tren phieu tra loi dien tu ben canh';

    const titleWidth = boldFont.widthOfTextAtSize(titleText, 12);
    const subWidth = regularFont.widthOfTextAtSize(subText, 10);

    lastPage.drawText(titleText, {
      x: Math.max(10, (width - titleWidth) / 2),
      y: maskHeight - 24,
      size: 12,
      font: boldFont,
      color: rgb(0.2, 0.2, 0.2),
    });

    lastPage.drawText(subText, {
      x: Math.max(10, (width - subWidth) / 2),
      y: maskHeight - 44,
      size: 10,
      font: regularFont,
      color: rgb(0.4, 0.4, 0.4),
    });

    const maskedBase64 = await pdfDoc.saveAsBase64({ dataUri: true });
    return { maskedDataUrl: maskedBase64, totalPages };
  } catch (err) {
    console.error('Lỗi khi tự động che đáp án PDF:', err);
    return { maskedDataUrl: dataUrl, totalPages: 1 };
  }
}
