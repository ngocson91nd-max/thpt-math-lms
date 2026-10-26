import { describe, it, expect } from 'vitest';
import fs from 'fs';
import { renderMathToHtml, renderTabularToHtml } from '../src/lib/math/katexRenderer';
import { parseTkzTabCode, generateTkzTabSvg } from '../src/lib/math/tkzTabRenderer';
import { parseExamLatex } from '../src/lib/latex/examParser';

describe('1. Kiểm thử môi trường Tabular và Bảng số liệu LaTeX', () => {
  it('Chuyển đổi \begin{tabular} thành HTML <table> có căn lề và công thức KaTeX', () => {
    const rawTabular = `\\begin{tabular}{|l|c|c|}
\\hline
Thời gian & $[0;20)$ & $[20;40)$ \\\\
\\hline
Số học sinh & $5$ & $8$ \\\\
\\hline
\\end{tabular}`;

    const html = renderTabularToHtml(rawTabular);
    expect(html).toContain('<table');
    expect(html).toContain('text-left');
    expect(html).toContain('text-center');
    expect(html).toContain('katex');
    expect(html).toContain('Thời gian');
    expect(html).toContain('Số học sinh');
  });

  it('renderMathToHtml xử lý được bảng tabular lồng trong đề bài', () => {
    const questionText = `Cho mẫu số liệu ghép nhóm:
\\begin{center}
\\begin{tabular}{|c|c|}
\\hline
Điểm & Số HS \\\\
\\hline
$10$ & $2$ \\\\
\\hline
\\end{tabular}
\\end{center}
Tính số trung bình.`;

    const rendered = renderMathToHtml(questionText);
    expect(rendered).toContain('<table');
    expect(rendered).toContain('Điểm');
    expect(rendered).toContain('Số HS');
  });
});

describe('2. Kiểm thử Vector và Ký hiệu toán học theo thietke.tex', () => {
  it('Chuyển đổi \\vv{AB}, \\vv{u}, \\vv a sang \\overrightarrow trong KaTeX', () => {
    const text1 = 'Cho hai vectơ $\\vv{AB}$ và $\\vv{u}$.';
    const html1 = renderMathToHtml(text1);
    expect(html1).toContain('katex');
    expect(html1).not.toContain('\\vv');

    const text2 = 'Biết $\\vv a + \\vv b = \\vv 0$.';
    const html2 = renderMathToHtml(text2);
    expect(html2).toContain('katex');
  });

  it('Xử lý macro \\heva và \\hoac chứa ngoặc lồng nhau (phân số \\dfrac)', () => {
    const hevaText = `$\\heva{&x_I=\\dfrac{x_A+x_B}{2}=\\dfrac{1+3}{2}=2\\\\ &y_I=\\dfrac{y_A+y_B}{2}=\\dfrac{2+0}{2}=1.}$`;
    const htmlHeva = renderMathToHtml(hevaText);
    expect(htmlHeva).toContain('katex');
    expect(htmlHeva).not.toContain('Lỗi:');

    const hoacText = `$\\hoac{x = \\dfrac{1}{2} \\\\ x = 3}$`;
    const htmlHoac = renderMathToHtml(hoacText);
    expect(htmlHoac).toContain('katex');
    expect(htmlHoac).not.toContain('Lỗi:');
  });
});

describe('3. Kiểm thử Bảng Biến Thiên (tkz-tab) sang SVG', () => {
  it('Phân tích cú pháp tkz-tab từ file Hue-HSG12-26-27.tex', () => {
    const tkzCode = `\\begin{tikzpicture}
      \\tkzTabInit[nocadre=false,lgt=1.2,espcl=2.5,deltacl=0.6]
      {$x$/0.6,$y'$/0.6,$y$/2}
      {$-\\infty$,$-1$,$4$,$+\\infty$}
      \\tkzTabLine{,+,0,-,0,+,}
      \\tkzTabVar{-/$-\\infty$,+/$10$,-/$-22$,+/$+\\infty$}
    \\end{tikzpicture}`;

    const parsed = parseTkzTabCode(tkzCode);
    expect(parsed).not.toBeNull();
    if (parsed) {
      expect(parsed.rows).toEqual(['x', "y'", 'y']);
      expect(parsed.xVals).toEqual(['-\\infty', '-1', '4', '+\\infty']);
      expect(parsed.signs).toEqual(['+', '0', '-', '0', '+']);
      expect(parsed.variations.length).toBe(4);

      const svg = generateTkzTabSvg(parsed);
      expect(svg).toContain('<svg');
      expect(svg).toContain('viewBox');
      expect(svg).toContain('-∞');
      expect(svg).toContain('+∞');
      expect(svg).toContain('10');
      expect(svg).toContain('-22');
      expect(svg).toContain('marker-end="url(#tab-arrow');
    }
  });
});

describe('4. Kiểm thử Phân tích Đề thi HSG Huế (Hue-HSG12-26-27.tex)', () => {
  it('Bóc tách đúng toàn bộ 27 câu hỏi và bảo tồn tất cả 6 hình vẽ TikZ trong \\immini', () => {
    const rawTex = fs.readFileSync('Hue-HSG12-26-27.tex', 'utf8');
    const { questions, metadata } = parseExamLatex(rawTex);

    expect(metadata.made).toBe('1252');
    expect(metadata.duration).toBe(150);
    expect(questions.length).toBe(27);

    // Kiểm tra câu có TikZ
    const questionsWithTikz = questions.filter((q) => q.content.includes('tikzpicture'));
    expect(questionsWithTikz.length).toBe(6);

    // Kiểm tra câu 12 có tabular
    const q12 = questions[11];
    expect(q12.content).toContain('tabular');

    // Kiểm tra câu 14 có choiceTF và TikZ trong immini
    const q14 = questions[13];
    expect(q14.type).toBe('true_false');
    expect(q14.content).toContain('tikzpicture');
    expect(q14.options.length).toBe(4);

    // Kiểm tra renderMathToHtml cho q12: bảng tabular sạch, không bị dính thẻ br làm hỏng
    const renderedQ12 = renderMathToHtml(q12.content);
    expect(renderedQ12).toContain('<table');
    expect(renderedQ12).not.toContain('<br /><table');
    expect(renderedQ12).not.toContain('<td<br />');

    // Kiểm tra renderMathToHtml cho q18 (Bảng biến thiên tkz-tab): SVG nguyên vẹn
    const q18 = questions[17];
    const renderedQ18 = renderMathToHtml(q18.content);
    expect(renderedQ18).toContain('<svg');
    expect(renderedQ18).not.toContain('<svg<br />');
    expect(renderedQ18).not.toContain('<rect<br />');
    expect(renderedQ18).not.toContain('<text<br />');

    // Kiểm tra renderMathToHtml cho q14 (TikZ đồ thị hàm số): script TikZ không bị dính thẻ br
    const renderedQ14 = renderMathToHtml(q14.content);
    expect(renderedQ14).toContain('text/tikz');
    expect(renderedQ14).not.toContain('<script type="text/tikz">\\begin{tikzpicture}<br />');
    expect(renderedQ14).not.toContain('<br />  \\draw');

    // Tìm câu có tkzTab trong explanation (hoặc loigiai)
    const qWithTabInLg = questions.find((q) => q.explanation && q.explanation.includes('tkzTab'));
    expect(qWithTabInLg).toBeDefined();
    if (qWithTabInLg && qWithTabInLg.explanation) {
      const renderedLg = renderMathToHtml(qWithTabInLg.explanation);
      expect(renderedLg).toContain('<svg');
      expect(renderedLg).toContain('viewBox');
    }

    // Kiểm tra căn bậc hai \sqrt không bị dính <br /> vào thẻ path của KaTeX
    const sqrtText = 'Độ dài cạnh $MK = \\sqrt{MH^2 + HK^2} = \\sqrt{\\left(\\dfrac{1}{2}\\right)^2 + \\left(\\dfrac{\\sqrt{3}}{2}\\right)^2} = 1$.';
    const renderedSqrt = renderMathToHtml(sqrtText);
    expect(renderedSqrt).toContain('katex');
    expect(renderedSqrt).not.toContain('<br />M1001');
    expect(renderedSqrt).not.toContain('z<br />');
  });
});
