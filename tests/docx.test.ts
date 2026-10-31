import { describe, it, expect } from 'vitest';
import fs from 'fs';
import { parseWordDocx, validateNoBase64InQuestions, convertMathTypeSvgToLatex } from '../src/lib/word/wordExamParser';
import { getExamAsset } from '../src/lib/exam/assetRegistry';

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
    // Công thức MathType cơ bản được chuyển đổi trực tiếp sang mã LaTeX chuẩn
    expect(q1.content).toContain('$y = x^{3} - 3x^{2} + 2$');
    expect(q1.options[0].text).toContain('$(2; -2)$');
    // Công thức phân số MathType được chuyển đổi hoàn hảo sang mã LaTeX \frac{...}{...}
    expect(result.questions[2].content).toContain('$y = \\frac{4x + 1}{2x - 2}$');
    expect(q1.content).not.toContain('data:image');
    expect(validateNoBase64InQuestions(result.questions)).toBe(true);
  }, 20000);

  it('bóc tách chính xác đề thi và bảng đáp án THPT Xuân Trường', async () => {
    const filePath = 'E:/Nam2627/GK1-12/GK1-12-Xuân Trường.docx';
    if (!fs.existsSync(filePath)) return;

    const buf = fs.readFileSync(filePath);
    const res = await parseWordDocx(buf);

    expect(res.questions.length).toBe(22);
    const p1 = res.questions.filter((q) => q.part === 1);
    const p2 = res.questions.filter((q) => q.part === 2);
    const p3 = res.questions.filter((q) => q.part === 3);

    expect(p1.length).toBe(12);
    expect(p2.length).toBe(4);
    expect(p3.length).toBe(6);

    // Kiểm tra trích xuất bảng đáp án Phần 2 (Đúng / Sai)
    expect(p2[0].correct_answer).toEqual({ a: false, b: true, c: false, d: true });
    expect(p2[1].correct_answer).toEqual({ a: false, b: true, c: true, d: true });
    expect(p2[2].correct_answer).toEqual({ a: true, b: true, c: false, d: false });
    expect(p2[3].correct_answer).toEqual({ a: true, b: false, c: false, d: true });

    // Kiểm tra trích xuất bảng đáp án Phần 3 (Trả lời ngắn)
    expect(p3[0].correct_answer).toEqual(['2', '2']);
    expect(p3[1].correct_answer).toEqual(['10', '10']);
    expect(p3[2].correct_answer).toEqual(['6', '6']);
    expect(p3[3].correct_answer).toEqual(['7,46', '7.46']);

    // Kiểm tra công thức phân số MathType chuyển thành mã LaTeX \frac{...}{...}
    expect(p1[0].content).toContain('$y = \\frac{-x^{2} + 2x - 1}{x + 2}$');
    expect(p1[0].content).not.toContain('data:image');
    expect(validateNoBase64InQuestions(res.questions)).toBe(true);
  });

  it('bóc tách chính xác đề thi và bảng đáp án THPT Nguyễn Công Trứ', async () => {
    const filePath = 'E:/Nam2627/GK1-12/GK1-12-Nguyễn Công Trứ.docx';
    if (!fs.existsSync(filePath)) return;

    const buf = fs.readFileSync(filePath);
    const res = await parseWordDocx(buf);

    expect(res.questions.length).toBe(22);
    const p1 = res.questions.filter((q) => q.part === 1);
    const p2 = res.questions.filter((q) => q.part === 2);
    const p3 = res.questions.filter((q) => q.part === 3);

    expect(p1.length).toBe(12);
    expect(p2.length).toBe(4);
    expect(p3.length).toBe(6);

    // Phần 1: Bảng đáp án
    const p1Answers = p1.map((q) => q.correct_answer);
    expect(p1Answers).toEqual(['C', 'D', 'B', 'D', 'B', 'B', 'B', 'D', 'B', 'B', 'C', 'B']);

    // Phần 2: Đúng / Sai
    expect(p2[0].correct_answer).toEqual({ a: true, b: true, c: false, d: false });

    // Phần 3: Trả lời ngắn
    expect(p3[0].correct_answer).toEqual(['25', '25']);
    expect(p3[1].correct_answer).toEqual(['3', '3']);
    expect(p3[2].correct_answer).toEqual(['4', '4']);
    expect(validateNoBase64InQuestions(res.questions)).toBe(true);
  });

  it('nhận diện đầy đủ phương án A và số lượng câu ở file A Phủ Lý', async () => {
    const filePath = 'E:/Nam2627/GK1-12/GK1-12-A Phủ Lý.docx';
    if (!fs.existsSync(filePath)) return;

    const buf = fs.readFileSync(filePath);
    const res = await parseWordDocx(buf);

    expect(res.questions.length).toBeGreaterThanOrEqual(20);
    const q1 = res.questions[0];
    expect(q1.options.length).toBe(4);
    expect(q1.options[0].id).toBe('A');
    expect(q1.content).not.toContain('data:image');
    expect(validateNoBase64InQuestions(res.questions)).toBe(true);
  });

  it('nhận diện hoàn hảo công thức MathType và bóc tách đề thi THPT Giao Thủy B', async () => {
    const filePath = 'E:/Nam2627/GK1-12/GK1-12-Giao Thủy B.docx';
    if (!fs.existsSync(filePath)) return;

    const buf = fs.readFileSync(filePath);
    const res = await parseWordDocx(buf);

    expect(res.questions.length).toBe(22);

    // Kiểm tra Câu 4 (vectơ u = 3j - i - 5k)
    const q4 = res.questions.find((q) => q.content.includes('cho  vectơ') || q.content.includes('cho vectơ'));
    expect(q4).toBeDefined();
    if (q4) {
      expect(q4.type).toBe('single_choice');
      expect(q4.options.length).toBe(4);
      expect(q4.options[0].id).toBe('A');
      // Đảm bảo không còn chuỗi data URI trong content
      expect(q4.content).not.toContain('data:image');
      // Công thức vectơ MathType được chuyển đổi hoàn hảo thành LaTeX dùng \overrightarrow theo chuẩn
      expect(q4.content).toContain('\\overrightarrow{u} = 3\\overrightarrow{j} - \\overrightarrow{i} - 5\\overrightarrow{k}');

      // Đảm bảo các phương án A, B, C, D chuyển thành tọa độ LaTeX và không chứa data:image
      expect(q4.options[0].text).toContain('(6; -2; 10)');
      expect(q4.options[0].text).not.toContain('data:image');
    }

    // Kiểm tra Câu 5 (điểm A, B và vectơ BA)
    const q5 = res.questions[4];
    expect(q5).toBeDefined();
    expect(q5.type).toBe('single_choice');
    expect(q5.options.length).toBe(4);
    expect(q5.options[0].id).toBe('A');
    expect(q5.content).toContain('cho hai điểm');
    expect(validateNoBase64InQuestions(res.questions)).toBe(true);
  });

  it('nhận diện chính xác ký hiệu giá trị lớn nhất max/min có underscript trong file Nho Quan C', async () => {
    const filePath = 'E:/Nam2627/GK1-12/GK1-12-Nho Quan C.docx';
    if (!fs.existsSync(filePath)) return;

    const buf = fs.readFileSync(filePath);
    const res = await parseWordDocx(buf);

    const q10 = res.questions.find((q) => q.content.includes('[-1; 3]') && q.content.includes('như hình vẽ bên'));
    expect(q10).toBeDefined();
    if (q10) {
      expect(q10.options[0].text).toContain('\\max_{[-1; 3]}');
      expect(q10.options[0].text).not.toContain('m_{[-1}');
    }
  });

  it('chuyển đổi hoàn hảo phân số và vectơ sang \\frac và \\overrightarrow trong SVG MathType', () => {
    // Test phân số: y = (x^2 - 3x + 3) / (x - 2)
    const fracSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="200" height="60">
        <text x="10" y="30" font-size="16" font-style="italic">y</text>
        <text x="25" y="30" font-size="16">=</text>
        <path d="M 40 25 L 140 25" stroke="#000000" stroke-width="1.5" />
        <text x="45" y="18" font-size="16" font-style="italic">x</text>
        <text x="55" y="10" font-size="11">2</text>
        <text x="65" y="18" font-size="16">-</text>
        <text x="75" y="18" font-size="16">3</text>
        <text x="85" y="18" font-size="16" font-style="italic">x</text>
        <text x="95" y="18" font-size="16">+</text>
        <text x="105" y="18" font-size="16">3</text>
        <text x="75" y="45" font-size="16" font-style="italic">x</text>
        <text x="85" y="45" font-size="16">-</text>
        <text x="95" y="45" font-size="16">2</text>
      </svg>
    `;
    const fracLatex = convertMathTypeSvgToLatex(fracSvg);
    expect(fracLatex).toBe('$y = \\frac{x^{2} - 3x + 3}{x - 2}$');

    // Test vectơ: \overrightarrow{a} vuông góc \overrightarrow{b}
    const vectorSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="200" height="40">
        <path d="M 10 10 L 25 10 l -3 -2 m 3 2 l -3 2" stroke="#000000" />
        <text x="12" y="25" font-size="16" font-style="italic">a</text>
        <text x="35" y="25" font-size="16" font-family="Symbol">^</text>
        <path d="M 55 10 L 70 10 l -3 -2 m 3 2 l -3 2" stroke="#000000" />
        <text x="57" y="25" font-size="16" font-style="italic">b</text>
      </svg>
    `;
    const vectorLatex = convertMathTypeSvgToLatex(vectorSvg);
    expect(vectorLatex).toContain('\\overrightarrow{a}');
    expect(vectorLatex).toContain('\\perp');
    expect(vectorLatex).toContain('\\overrightarrow{b}');

    // Test với mọi \forall trong Symbol font
    const forallSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="200" height="40">
        <text x="10" y="25" font-size="16" font-family="Symbol">"</text>
        <text x="25" y="25" font-size="16" font-style="italic">x</text>
        <text x="40" y="25" font-size="16">&#x2208;</text>
        <text x="55" y="25" font-size="16">&#x211D;</text>
      </svg>
    `;
    const forallLatex = convertMathTypeSvgToLatex(forallSvg);
    expect(forallLatex).toContain('\\forall');
    expect(forallLatex).toContain('\\in');
    expect(forallLatex).toContain('\\mathbb{R}');
  });

  it('bóc tách hoàn hảo 22 câu đề thi có đánh số tự động OpenXML (Chuyên LHP 2025)', async () => {
    const filePath = 'Tổ 22_Đợt 3_Giải đề giữa hk 1_lớp 12_Chuyên LHP _Ninh Bình năm 2025.docx';
    if (!fs.existsSync(filePath)) return;

    const buf = fs.readFileSync(filePath);
    const res = await parseWordDocx(buf);

    expect(res.questions.length).toBe(22);
    const p1 = res.questions.filter((q) => q.part === 1);
    const p2 = res.questions.filter((q) => q.part === 2);
    const p3 = res.questions.filter((q) => q.part === 3);

    expect(p1.length).toBe(12);
    expect(p2.length).toBe(4);
    expect(p3.length).toBe(6);

    // Kiểm tra câu 1 Phần I có đủ 4 phương án và đáp án
    expect(p1[0].options.length).toBe(4);
    expect(p1[0].correct_answer).toBe('A');

    // Kiểm tra câu 4 Phần II chỉ có đúng 4 mệnh đề a, b, c, d
    expect(p2[3].options.length).toBe(4);
    expect(p2[3].options.map((o: any) => o.id)).toEqual(['a', 'b', 'c', 'd']);

    // Kiểm tra không chứa base64
    expect(validateNoBase64InQuestions(res.questions)).toBe(true);
  });

  it('bóc tách chuẩn xác 22 câu đề thi ĐỢT 1-TỔ 25 có lời giải inline và gạch chân ý đúng', async () => {
    const filePath = 'ĐỢT 1-TỔ 25-SÁNG TÁC ĐỀ GHKI-K12-ĐỀ 1.docx';
    if (!fs.existsSync(filePath)) return;

    const buf = fs.readFileSync(filePath);
    const res = await parseWordDocx(buf);

    expect(res.questions.length).toBe(22);
    const p1 = res.questions.filter((q) => q.part === 1);
    const p2 = res.questions.filter((q) => q.part === 2);
    const p3 = res.questions.filter((q) => q.part === 3);

    expect(p1.length).toBe(12);
    expect(p2.length).toBe(4);
    expect(p3.length).toBe(6);

    // Phần 1: Đáp án A-D
    expect(p1[0].correct_answer).toBe('C');
    expect(p1[0].content).toContain('có bảng xét dấu của đạo hàm như sau:');
    expect(p1[0].content).toContain('\\includegraphics{mathtype_7dc72a116375a.svg}');

    // Phần 2: Đúng / Sai nhận diện qua gạch chân (u) ý đúng hoặc lời giải inline
    expect(p2[0].correct_answer).toEqual({ a: false, b: false, c: true, d: true });
    expect(p2[1].correct_answer).toEqual({ a: true, b: true, c: false, d: true });
    expect(p2[2].correct_answer).toEqual({ a: true, b: true, c: false, d: false });
    expect(p2[3].correct_answer).toEqual({ a: true, b: false, c: true, d: true });

    // Phần 3: Trả lời ngắn bóc tách đáp số từ lời giải inline
    expect(p3[0].correct_answer).toEqual(['269', '269']);
    expect(p3[1].correct_answer).toEqual(['27,5', '27.5']);
    expect(p3[2].correct_answer).toEqual(['1,48', '1.48']);
    expect(p3[3].correct_answer).toEqual(['16', '16']);
    expect(p3[4].correct_answer).toEqual(['33,6', '33.6']);
    expect(p3[5].correct_answer).toEqual(['1', '1']);

    expect(validateNoBase64InQuestions(res.questions)).toBe(true);
  });
});
