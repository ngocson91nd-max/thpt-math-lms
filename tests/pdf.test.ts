import { describe, it, expect } from 'vitest';
import {
  parseQuickAnswerKey,
  buildPdfExamQuestions,
  trimPdfPages,
  getPdfPageCount,
  maskPdfAnswerKey,
} from '../src/lib/pdf/pdfExamHelper';
import { PDFDocument } from 'pdf-lib';

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

  it('Cắt bỏ trang cuối chứa bảng đáp án bằng pdf-lib (trimPdfPages)', async () => {
    // Tạo PDF mẫu có 4 trang (3 trang đề + 1 trang đáp án)
    const doc = await PDFDocument.create();
    doc.addPage([600, 800]); // Trang 1
    doc.addPage([600, 800]); // Trang 2
    doc.addPage([600, 800]); // Trang 3
    doc.addPage([600, 800]); // Trang 4 (Bảng đáp án)
    const base64 = await doc.saveAsBase64({ dataUri: true });

    // Kiểm tra số trang ban đầu
    const originalCount = await getPdfPageCount(base64);
    expect(originalCount).toBe(4);

    // Cắt bỏ trang cuối chứa bảng đáp án
    const result = await trimPdfPages(base64, { removeLastPage: true });
    expect(result.totalOriginal).toBe(4);
    expect(result.totalNew).toBe(3);

    // Kiểm tra lại file PDF sau khi cắt
    const newCount = await getPdfPageCount(result.trimmedDataUrl);
    expect(newCount).toBe(3);
  });

  it('Tự động che bảng đáp án ở cuối trang mà không làm mất trang (maskPdfAnswerKey)', async () => {
    // Tạo PDF mẫu có 3 trang
    const doc = await PDFDocument.create();
    doc.addPage([600, 800]); // Trang 1
    doc.addPage([600, 800]); // Trang 2
    doc.addPage([600, 800]); // Trang 3 (chứa câu hỏi + bảng đáp án ở đáy)
    const base64 = await doc.saveAsBase64({ dataUri: true });

    // Che bảng đáp án (giữ nguyên 3 trang)
    const result = await maskPdfAnswerKey(base64, { bottomRatio: 0.35 });
    expect(result.totalPages).toBe(3);

    // Kiểm tra số trang sau khi che vẫn giữ đủ 3 trang, không mất câu hỏi cuối
    const count = await getPdfPageCount(result.maskedDataUrl);
    expect(count).toBe(3);
  });
});
