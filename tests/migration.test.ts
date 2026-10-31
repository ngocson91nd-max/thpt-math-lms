import { describe, it, expect } from 'vitest';
import {
  sanitizePublicContent,
  sanitizePublicOptions,
  normalizeLegacyShortAnswer,
  transformLegacyQuestion,
} from '../scripts/migrateLegacyData';
import { QuestionPublicSchema, QuestionKeySchema } from '../src/lib/exam/schema';

describe('Legacy Data Migration Script Tests', () => {
  it('sanitizePublicContent completely strips \\True and \\loigiai blocks', () => {
    const raw = 'Cho hàm số $y=f(x)$. Mệnh đề nào đúng? \\loigiai{Ta có $f\'(x) = 3x^2 \\ge 0$. Do đó hàm số đồng biến.}';
    const clean = sanitizePublicContent(raw);

    expect(clean).not.toContain('\\loigiai');
    expect(clean).not.toContain('Ta có $f\'(x)');
    expect(clean).toBe('Cho hàm số $y=f(x)$. Mệnh đề nào đúng?');

    // Thử với các từ khóa \True, \choiceTF, \shortans
    const rawChoice = '\\choice {A} {\\True B} {C} {D}';
    const cleanChoice = sanitizePublicContent(rawChoice);
    expect(cleanChoice).not.toContain('\\True');
    expect(cleanChoice).toBe('\\choice {A} {B} {C} {D}');
  });

  it('sanitizePublicOptions removes \\True from option texts', () => {
    const options = [
      { id: 'A', text: 'Nghiệm bằng 1' },
      { id: 'B', text: '\\True Nghiệm bằng 2' },
      { id: 'C', text: 'Vô nghiệm' },
      { id: 'D', text: 'Vô số nghiệm' },
    ];
    const cleaned = sanitizePublicOptions(options);
    expect(cleaned[1].text).toBe('Nghiệm bằng 2');
    expect(cleaned.some((o: any) => o.text.includes('\\True'))).toBe(false);
  });

  it('normalizeLegacyShortAnswer converts array ["0.5", "1/2"] to numeric value and alternatives', () => {
    // Trường hợp mảng chuỗi cũ
    const res1 = normalizeLegacyShortAnswer(['0.5', '1/2', '5/10']);
    expect(res1.value).toBe('0.5');
    expect(res1.alternatives).toEqual(['1/2', '5/10']);

    // Trường hợp chuỗi có dấu phẩy "0,25"
    const res2 = normalizeLegacyShortAnswer('0,25');
    expect(res2.value).toBe('0.25');

    // Trường hợp phân số thuần túy "1/4"
    const res3 = normalizeLegacyShortAnswer('1/4');
    expect(res3.value).toBe('0.25');
    expect(res3.alternatives).toContain('1/4');
  });

  it('transformLegacyQuestion splits into valid QuestionPublic and QuestionKey matching Zod schemas', () => {
    const legacyQ = {
      id: '00000000-0000-0000-0000-000000000001',
      type: 'single_choice',
      grade: 12,
      topic: 'Khảo sát hàm số',
      difficulty: 'thong_hieu',
      content: 'Giá trị cực đại của hàm số $y = x^3 - 3x + 2$ là: \\loigiai{f\'(x)=3x^2-3=0 => x=1 hoặc x=-1. y(-1)=4.}',
      options: [
        { id: 'A', text: '4' },
        { id: 'B', text: '0' },
        { id: 'C', text: '2' },
        { id: 'D', text: '-2' },
      ],
      correct_answer: 'A',
      explanation: 'f\'(x)=0 <=> x=-1 => y=4.',
      raw_tex: '\\begin{ex}...\\end{ex}',
    };

    const { questionVersion, questionKey } = transformLegacyQuestion(legacyQ, true);

    // 1. Kiểm tra questionVersion không còn rò rỉ lời giải
    expect(questionVersion.content).not.toContain('\\loigiai');
    expect(questionVersion.status).toBe('published');
    expect(() => QuestionPublicSchema.parse(questionVersion)).not.toThrow();

    // 2. Kiểm tra questionKey hợp lệ theo QuestionKeySchema
    expect(() =>
      QuestionKeySchema.parse({
        type: questionKey.type,
        ...questionKey.key,
        explanation: questionKey.explanation,
        raw_tex: questionKey.raw_tex,
      })
    ).not.toThrow();
  });
});
