import { describe, it, expect } from 'vitest';
import fs from 'fs';
import { parseWordDocx } from '../src/lib/word/wordExamParser';

describe('Word Exam Parser', () => {
  it('loads tables.docx without throwing', async () => {
    const buffer = fs.readFileSync('node_modules/mammoth/test/test-data/tables.docx');
    const result = await parseWordDocx(buffer);
    expect(result).toBeDefined();
    expect(typeof result.rawText).toBe('string');
  });

  it('phân tích chính xác file GK1-12-Chuyên Lê Hồng Phong.docx', async () => {
    const buffer = fs.readFileSync('GK1-12-Chuyên Lê Hồng Phong.docx');
    const result = await parseWordDocx(buffer);
    expect(result.questions.length).toBeGreaterThanOrEqual(13);

    const q1 = result.questions[0];
    expect(q1.type).toBe('single_choice');
    expect(q1.part).toBe(1);
    expect(q1.options.length).toBe(4);
    expect(q1.options.map((o: any) => o.id)).toEqual(['A', 'B', 'C', 'D']);
    expect(q1.content).toContain('Điểm cực tiểu của đồ thị hàm số có tọa độ là');
    expect(q1.content).toContain('<img src="data:');
    const textWithoutImg = q1.content.replace(/<img[^>]+>/g, '');
    expect(textWithoutImg).not.toContain('hUeXBlAABQ');
    expect(q1.explanation).not.toContain('hUeXBlAABQ');
  });

  it('phân tích chính xác file GK1-12-Xuân Trường.docx (chuẩn đề 2025: 12 TN + 4 ĐS + 6 TLN)', async () => {
    const filePath = 'E:/Nam2627/GK1-12/GK1-12-Xuân Trường.docx';
    if (!fs.existsSync(filePath)) return;
    const buffer = fs.readFileSync(filePath);
    const result = await parseWordDocx(buffer);

    console.log('--- XUÂN TRƯỜNG TOTAL QUESTIONS ---', result.questions.length);
    const p1 = result.questions.filter((q) => q.part === 1);
    const p2 = result.questions.filter((q) => q.part === 2);
    const p3 = result.questions.filter((q) => q.part === 3);
    console.log(`Phần I: ${p1.length}, Phần II: ${p2.length}, Phần III: ${p3.length}`);

    // Tổng số câu hỏi phải là 22 câu (12 Phần I, 4 Phần II, 6 Phần III)
    expect(result.questions.length).toBe(22);
    expect(p1.length).toBe(12);
    expect(p2.length).toBe(4);
    expect(p3.length).toBe(6);

    // Kiểm tra câu 1 Phần I
    expect(p1[0].type).toBe('single_choice');
    expect(p1[0].content).toContain('Điểm cực tiểu của hàm số');
    expect(p1[0].options.length).toBe(4);

    // Kiểm tra câu 2 Phần I
    expect(p1[1].type).toBe('single_choice');
    expect(p1[1].content).toContain('nghịch biến trên khoảng nào');
    expect(p1[1].options.length).toBe(4);

    // Kiểm tra câu 1 Phần II (Đúng/Sai)
    expect(p2[0].type).toBe('true_false');
    expect(p2[0].options.length).toBe(4);

    // Kiểm tra câu 1 Phần III (Điền số)
    expect(p3[0].type).toBe('short_answer');
  });
});
