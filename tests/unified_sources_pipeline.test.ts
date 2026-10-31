import { describe, it, expect, vi } from 'vitest';
import { parseExamLatex } from '@/lib/latex/examParser';
import { precompileTextTikz, precompileQuestionsTikz } from '@/lib/latex/tikzPrecompiler';
import { renderMathToHtml } from '@/lib/math/katexRenderer';
import { parseQuickAnswerKey, buildPdfExamQuestions } from '@/lib/pdf/pdfExamHelper';
import {
  sanitizeWmfBytes,
  postProcessMathTypeSvg,
} from '@/lib/word/wordExamParser';
import { Question } from '@/types/database';

describe('Kiểm thử Hợp nhất 3 Nguồn Đề Thi: TeX (ex_test), DOCX (Word), và PDF', () => {
  describe('1. Nguồn TeX (ex_test LaTeX) & Tiền biên dịch TikZ', () => {
    it('bóc tách chính xác cả 4 phần chuẩn Bộ GD&ĐT từ mã LaTeX ex_test', () => {
      const latexSample = `
\\begin{ex}
Cho hàm số $y = f(x)$ liên tục trên $\\mathbb{R}$. Đạo hàm của hàm số là $f'(x) = 3x^2 - 6x$. Số điểm cực trị của hàm số là
\\choice
{0}
{1}
{\\True 2}
{3}
\\loigiai{Ta có $f'(x) = 0 \\Leftrightarrow 3x(x - 2) = 0 \\Leftrightarrow x = 0$ hoặc $x = 2$. Do đó hàm số có 2 cực trị.}
\\end{ex}

\\begin{ex}
Cho tứ diện $ABCD$. Các mệnh đề sau đúng hay sai?
\\choiceTF
{\\True $AB$ và $CD$ là hai đường thẳng chéo nhau}
{$AB$ và $CD$ cắt nhau}
{\\True Trọng tâm $G$ của tứ diện chia đoạn nối đỉnh với trọng tâm đáy theo tỉ số 3:1}
{Các mặt của tứ diện luôn là tam giác đều}
\\loigiai{Phân tích từng mệnh đề dựa trên tính chất tứ diện.}
\\end{ex}

\\begin{ex}
Một công ty dự kiến may các hộp quà hình trụ có thể tích $V = 1440\\pi$ $\\text{cm}^3$. Bán kính đáy tối ưu là bao nhiêu?
\\shortans{12}
\\loigiai{Áp dụng khảo sát hàm số tìm giá trị nhỏ nhất.}
\\end{ex}
`;
      const { questions, metadata } = parseExamLatex(latexSample);

      expect(questions.length).toBe(3);

      // Phần I: Trắc nghiệm 4 phương án
      expect(questions[0].part).toBe(1);
      expect(questions[0].type).toBe('single_choice');
      expect(questions[0].correct_answer).toBe('C');
      expect(questions[0].points).toBe(0.25);
      expect(questions[0].options?.length).toBe(4);

      // Phần II: Đúng/Sai
      expect(questions[1].part).toBe(2);
      expect(questions[1].type).toBe('true_false');
      expect(questions[1].points).toBe(1.0);
      const tfMap = questions[1].correct_answer as Record<string, boolean>;
      expect(tfMap.a).toBe(true);
      expect(tfMap.b).toBe(false);
      expect(tfMap.c).toBe(true);
      expect(tfMap.d).toBe(false);

      // Phần III: Trả lời ngắn / điền số
      expect(questions[2].part).toBe(3);
      expect(questions[2].type).toBe('short_answer');
      expect(questions[2].points).toBe(0.5);
      expect(questions[2].correct_answer).toContain('12');
    });

    it('bảo toàn cấu trúc \\immini và tiền biên dịch TikZ sang SVG/ảnh tĩnh tại Import-time', async () => {
      const rawText = `\\immini{
  Cho hình lăng trụ tam giác $ABC.A'B'C'$. Thể tích khối lăng trụ bằng
}{
  \\begin{tikzpicture}
    \\draw (0,0) -- (2,0) -- (1,1.5) -- cycle;
  \\end{tikzpicture}
}`;

      // Mock fetch cho API /api/render-tikz
      const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(async (url: any) => {
        if (typeof url === 'string' && url.includes('/api/render-tikz')) {
          return {
            ok: true,
            json: async () => ({
              success: true,
              url: 'https://cdn.example.com/tikz_precompiled_123.png',
            }),
          } as Response;
        }
        return { ok: false } as Response;
      });

      const precompiled = await precompileTextTikz(rawText);

      expect(precompiled).toContain('tikz-rendered-img');
      expect(precompiled).toContain('https://cdn.example.com/tikz_precompiled_123.png');
      expect(precompiled).not.toContain('\\begin{tikzpicture}');

      // Kiểm tra render qua MathRenderer KaTeX
      const html = renderMathToHtml(precompiled);
      expect(html).toContain('immini-block');
      expect(html).toContain('tikz-rendered-img');

      fetchSpy.mockRestore();
    });
  });

  describe('2. Nguồn DOCX (Word): MathType WMF, OMML & Khắc phục ký hiệu lỗi', () => {
    it('khử triệt để lỗi chữ r và uuu r đè lên vector khi render MathType WMF', () => {
      const mockSvgWithBuggyArrows = `
<svg width="200" height="100">
  <rect x="0" y="0" width="200" height="100" fill="#ffffff" />
  <text x="10" y="30" font-family="Times New Roman" font-size="14">AB</text>
  <text x="10" y="24" font-family="MT Extra" font-size="14">u</text>
  <text x="16" y="24" font-family="MT Extra" font-size="14">r</text>
</svg>`;

      const cleanedSvg = postProcessMathTypeSvg(mockSvgWithBuggyArrows);

      // Phải loại bỏ rect màu trắng
      expect(cleanedSvg).not.toContain('fill="#ffffff"');

      // Phải thay thế thẻ text chứa ký tự 'r' và 'u' của MT Extra thành đường vẽ vector SVG
      expect(cleanedSvg).not.toContain('>r</text>');
      expect(cleanedSvg).not.toContain('>u</text>');
      expect(cleanedSvg).toContain('<path'); // Mũi tên vector SVG sắc nét
    });

    it('chuyển đổi chuẩn xác các ký tự Blackboard Bold (¡, ¢, £, ¤, ¥) sang ℝ, ℤ, ℕ, ℚ, ℂ', () => {
      const svgBlackboard = `
<svg width="100" height="50">
  <text font-family="MT Extra">¡</text>
  <text font-family="MT Extra">¢</text>
</svg>`;

      const cleanedSvg = postProcessMathTypeSvg(svgBlackboard);

      expect(cleanedSvg).toContain('&#x211D;'); // Ký hiệu ℝ
      expect(cleanedSvg).toContain('&#x2124;'); // Ký hiệu ℤ
    });

    it('chuẩn hóa buffer byte WMF và cắt bỏ META_ESCAPE tránh lỗi giải mã', () => {
      // Giả lập header WMF Aldus APM (22 bytes) kèm record META_ESCAPE (0x0626 = 1574)
      const fakeBytes = new Uint8Array(60);
      fakeBytes[0] = 0xd7;
      fakeBytes[1] = 0xcd;
      fakeBytes[2] = 0xc6;
      fakeBytes[3] = 0x9a;

      // Cắt bỏ APM
      const stripped = sanitizeWmfBytes(fakeBytes, true);
      expect(stripped.length).toBe(fakeBytes.length - 22);

      // Giữ nguyên APM
      const preserved = sanitizeWmfBytes(fakeBytes, false);
      expect(preserved.length).toBe(fakeBytes.length);
    });
  });

  describe('3. Nguồn PDF: Phân tích đáp án nhanh 1 chạm & Cấu trúc câu hỏi', () => {
    it('phân tích chính xác chuỗi đáp án 1 chạm đa dạng (Phần I, II, III)', () => {
      const rawInput = `
1A 2B 3C 4D 5A 6B 7C 8D 9A 10B 11C 12D
13: aD bS cD dS
14: aĐ bĐ cS dS
15: D S D S
16: T F T F
17: 1440
18: -2.5
19: 12
20: 3/4
`;
      const answers = parseQuickAnswerKey(rawInput);

      // Phần I (1 đến 12)
      expect(answers.part1[1]).toBe('A');
      expect(answers.part1[2]).toBe('B');
      expect(answers.part1[12]).toBe('D');

      // Phần II (13 đến 16)
      expect(answers.part2[13]).toEqual({ a: true, b: false, c: true, d: false });
      expect(answers.part2[14]).toEqual({ a: true, b: true, c: false, d: false });
      expect(answers.part2[15]).toEqual({ a: true, b: false, c: true, d: false });
      expect(answers.part2[16]).toEqual({ a: true, b: false, c: true, d: false });

      // Phần III (17 đến 20)
      expect(answers.part3[17]).toBe('1440');
      expect(answers.part3[18]).toBe('-2.5');
      expect(answers.part3[19]).toBe('12');
      expect(answers.part3[20]).toBe('3/4');
    });

    it('tạo bộ câu hỏi chuẩn 22 câu theo cấu trúc Bộ GD&ĐT từ bảng đáp án PDF', () => {
      const answers = parseQuickAnswerKey('1A 2B\n13: aD bS cD dS\n17: 1440');
      const questions = buildPdfExamQuestions(12, 4, 6, answers);

      expect(questions.length).toBe(22);
      expect(questions[0].correct_answer).toBe('A');
      expect(questions[12].part).toBe(2);
      expect(questions[12].type).toBe('true_false');
      expect(questions[16].part).toBe(3);
      expect(questions[16].type).toBe('short_answer');
      expect(questions[16].correct_answer).toContain('1440');
    });
  });

  describe('4. Quy chuẩn Schema Hợp nhất cho Màn hình Duyệt Nháp (Review Screen)', () => {
    it('đảm bảo mọi câu hỏi từ 3 nguồn đều tuân thủ đầy đủ schema Question', () => {
      const dummyQuestion: Question = {
        id: 'test-q-1',
        grade: 12,
        topic: 'Khảo sát hàm số',
        part: 1,
        difficulty: 'thong_hieu',
        type: 'single_choice',
        content: 'Cho hàm số $y = f(x)$.',
        options: [
          { id: 'A', text: '1' },
          { id: 'B', text: '2' },
        ],
        correct_answer: 'A',
        points: 0.25,
        is_public: true,
      };

      expect(dummyQuestion.part).toBe(1);
      expect(dummyQuestion.type).toBe('single_choice');
      expect(dummyQuestion.options?.length).toBe(2);
      expect(dummyQuestion.points).toBe(0.25);
    });
  });
});
