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
    expect(result.questions.length).toBe(13);

    const q1 = result.questions[0];
    expect(q1.type).toBe('single_choice');
    expect(q1.part).toBe(1);
    expect(q1.options.length).toBe(4);
    expect(q1.options.map((o: any) => o.id)).toEqual(['A', 'B', 'C', 'D']);
    expect(q1.content).toContain('Điểm cực tiểu của đồ thị hàm số có tọa độ là');
    expect(q1.content).toContain('<img src="data:');
    // Không bị rò rỉ chuỗi base64 thô vào nội dung văn bản ngoài thẻ <img> hoặc lời giải
    const textWithoutImg = q1.content.replace(/<img[^>]+>/g, '');
    expect(textWithoutImg).not.toContain('hUeXBlAABQ');
    expect(q1.explanation).not.toContain('hUeXBlAABQ');
  });
});
