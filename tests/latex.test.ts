import { describe, it, expect } from 'vitest';
import fs from 'fs';
import { renderMathToHtml, renderTabularToHtml } from '../src/lib/math/katexRenderer';
import { parseTkzTabCode, generateTkzTabSvg } from '../src/lib/math/tkzTabRenderer';
import { parseExamLatex } from '../src/lib/latex/examParser';
import { renderTikzToSvg } from '../src/lib/math/tikzSvgRenderer';

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

  it('Xử lý Bảng Biến Thiên có tiệm cận đứng / vạch đôi (tiệm cận đứng x=1 với -D+)', () => {
    const asymptoteTab = `\\begin{tikzpicture}
      \\tkzTabInit[nocadre=false,lgt=1.2,espcl=2.5,deltacl=0.6]
      {$x$/0.6,$y'$/0.6,$y$/2}
      {$-\\infty$,$1$,$2$,$+\\infty$}
      \\tkzTabLine{,-,d,-,0,+,}
      \\tkzTabVar{+/$-1$,-D+/$-\\infty$/$+\\infty$,-/$1$,+/$2$}
    \\end{tikzpicture}`;

    const parsed = parseTkzTabCode(asymptoteTab);
    expect(parsed).not.toBeNull();
    if (parsed) {
      expect(parsed.xVals).toEqual(['-\\infty', '1', '2', '+\\infty']);
      expect(parsed.variations.length).toBe(4);
      expect(parsed.variations[1].isDiscontinuity).toBe(true);
      expect(parsed.variations[1].leftVal).toBe('-\\infty');
      expect(parsed.variations[1].rightVal).toBe('+\\infty');

      const svg = generateTkzTabSvg(parsed);
      expect(svg).toContain('<svg');
      // Vạch đôi kéo dài từ hàng y' xuống tận đáy bảng y
      expect(svg).toContain('y2="176"');
      expect(svg).toContain('-1');
      expect(svg).toContain('-∞');
      expect(svg).toContain('+∞');
      expect(svg).toContain('1');
      expect(svg).toContain('2');
    }
  });
});

describe('4. Kiểm thử Định dạng chữ LaTeX (\\textbf, \\textit, \\underline)', () => {
  it('Chuyển đổi \\textbf{sai} thành <strong>sai</strong> mà không làm hỏng \\mathrm{e} trong công thức', () => {
    const text = 'Khẳng định nào sau đây \\textbf{sai}? Cho hàm số $y = x \\cdot \\mathrm{e}^{-x}$.';
    const rendered = renderMathToHtml(text);
    expect(rendered).toContain('<strong>sai</strong>');
    expect(rendered).not.toContain('\\textbf');
    expect(rendered).not.toContain('<span> e </span>');
    expect(rendered).not.toContain('<span>e</span>');
  });

  it('Công thức phân số có \\mathrm{e} không bị dính thẻ span', () => {
    const fracText = 'Giá trị là $\\dfrac{1}{\\mathrm{e}}$ và $\\dfrac{2}{\\mathrm{e}^2}$.';
    const rendered = renderMathToHtml(fracText);
    expect(rendered).toContain('katex');
    expect(rendered).toContain('mathvariant="normal">e');
    expect(rendered).not.toContain('<span> e </span>');
    expect(rendered).not.toContain('<span>e</span>');
  });

  it('Chuyển đổi \\textit và \\underline', () => {
    const text = 'Chọn mệnh đề \\textit{đúng} và \\underline{chính xác}.';
    const rendered = renderMathToHtml(text);
    expect(rendered).toContain('<em>đúng</em>');
    expect(rendered).toContain('<u>chính xác</u>');
  });
});

describe('5. Kiểm thử Phân tích Đề thi HSG Huế (Hue-HSG12-26-27.tex)', () => {
  it('Bóc tách đúng toàn bộ 27 câu hỏi và bảo tồn tất cả 6 hình vẽ TikZ trong \\immini', () => {
    const rawTex = fs.readFileSync('Hue-HSG12-26-27.tex', 'utf8');
    const { questions, metadata } = parseExamLatex(rawTex);

    expect(metadata.made).toBe('1252');
    expect(metadata.duration).toBe(150);
    expect(questions.length).toBe(27);

    // Kiểm tra câu có TikZ trong đề bài (Q14, Q21, Q22)
    const questionsWithTikzInContent = questions.filter((q) => q.content.includes('tikzpicture'));
    expect(questionsWithTikzInContent.length).toBe(3);

    // Kiểm tra câu có TikZ trong toàn bộ câu hỏi và lời giải (bảo toàn không sót hình nào: Q14, Q15, Q20, Q21, Q22, Q23, Q27)
    const allQuestionsWithTikz = questions.filter((q) => q.content.includes('tikzpicture') || (q.explanation && q.explanation.includes('tikzpicture')));
    expect(allQuestionsWithTikz.length).toBe(7);

    // Tuyệt đối không để rò rỉ lời giải vào nội dung đề bài
    expect(questions.every((q) => !q.content.includes('\\loigiai'))).toBe(true);

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

    // Kiểm tra renderMathToHtml cho q14 (TikZ đồ thị hàm số): SVG thuần túy được dựng tức thì
    const renderedQ14 = renderMathToHtml(q14.content);
    expect(renderedQ14).toContain('<svg');
    expect(renderedQ14).toContain('tikz-wrapper');
    expect(renderedQ14).not.toContain('<svg<br />');

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

  it('renderMathToHtml render toàn bộ công thức toán và vector bên trong khối \\immini', () => {
    const rawImmini = `\\immini{
Một chiếc đèn chùm treo có khối lượng $m = 5\\text{ kg}$ tại điểm $O$ bởi các dây $OA$, $OB$, $OC$.
Cho biết $\\vv{F_1} + \\vv{F_2} + \\vv{F_3} = \\vv{P}$ và $|\\vv{F_1}| = 5000\\,\\text{N}$.
}{
\\begin{tikzpicture}
\\draw (0,0) -- (1,1);
\\end{tikzpicture}
}`;

    const rendered = renderMathToHtml(rawImmini);
    expect(rendered).toContain('immini-block');
    expect(rendered).toContain('katex');
    // Các công thức toán trong mainText phải được render thành KaTeX, không còn sót $...$ thô
    expect(rendered).not.toContain('$m = 5');
    expect(rendered).not.toContain('$OA$');
    expect(rendered).not.toContain('$\\vv{F_1}');
    expect(rendered).not.toContain('5000\\,\\text{N}$');
    // Hình TikZ được render thành SVG thuần túy và bao gói chính xác
    expect(rendered).toContain('tikz-wrapper');
    expect(rendered).toContain('<svg');
  });

  it('Bóc tách chuẩn xác \\immini có tham số dòng ngoặc vuông \\immini[1]{...}{...} và \\choice[2]', () => {
    const rawQuestion = `\\begin{ex}
\\immini[1]{
  Cho hàm số $y=ax^3+bx^2+cx+d$ có đồ thị như hình vẽ.
  \\choice[2]
  {\\True $a > 0$}
  {$a < 0$}
  {$b > 0$}
  {$c < 0$}
}{
  \\begin{tikzpicture}[>=stealth, samples=150]
    \\draw[->] (-2,0) -- (2,0) node[right] {$x$};
    \\draw[->] (0,-2) -- (0,2) node[above] {$y$};
    \\draw[thick, domain=-1.5:1.5] plot (\\x, {(\\x)^3 - (\\x)});
  \\end{tikzpicture}
}
\\loigiai{Nhìn vào đồ thị ta thấy nhánh cuối đi lên nên $a > 0$.}
\\end{ex}`;

    const { questions } = parseExamLatex(rawQuestion);
    expect(questions.length).toBe(1);
    const q = questions[0];
    expect(q.type).toBe('single_choice');
    expect(q.options.length).toBe(4);
    expect(q.correct_answer).toBe('A');
    expect(q.content).toContain('tikzpicture');
    expect(q.content).toContain('\\immini');

    const rendered = renderMathToHtml(q.content);
    expect(rendered).toContain('immini-block');
    expect(rendered).toContain('tikz-wrapper');
    expect(rendered).toContain('<svg');
    expect(rendered).toContain('viewBox=');
  });

  it('renderTikzToSvg biên dịch đồ thị hàm số và hình học không gian THPT thành SVG thuần túy (0ms)', () => {
    // Đồ thị hàm số phân thức hữu tỉ có tiệm cận đứng (giống câu 7 trong đề thi)
    const rationalGraphTikz = `\\begin{tikzpicture}[scale=0.65, >=stealth]
      \\def\\xmin{-4.2} \\def\\xmax{3.8}
      \\def\\ymin{-0.8} \\def\\ymax{5.8}
      \\clip (\\xmin,\\ymin) rectangle (\\xmax,\\ymax);
      \\draw[thick] (-1,\\ymin) -- (-1,\\ymax);
      \\draw[thick, samples=60, domain=\\xmin:-1.7] plot (\\x, {3/((\\x)+1)^2});
      \\draw[thick, samples=60, domain=-0.3:\\xmax] plot (\\x, {3/((\\x)+1)^2});
      \\draw[->] (\\xmin,0) -- (\\xmax,0) node[below] {$x$};
      \\draw[->] (0,\\ymin) -- (0,\\ymax) node[left] {$y$};
      \\node at (0,3) {$3$};
      \\fill (0,3) circle (1.5pt);
    \\end{tikzpicture}`;

    const rendered = renderMathToHtml(rationalGraphTikz);
    expect(rendered).toContain('tikz-svg-pure');
    expect(rendered).toContain('<svg');
    expect(rendered).toContain('viewBox="0 0');
    expect(rendered).toContain('marker id="tikz-arrow-pure"');
    // Đảm bảo không bị kẹt spinner, có sẵn SVG nhúng trực tiếp
    expect(rendered).toContain('<path d="');
  });

  it('renderTikzToSvg biên dịch đồ thị hàm trùng phương chữ W với nhãn tọa độ và nét đứt chuẩn xác', () => {
    const wGraphCode = `\\begin{tikzpicture}[scale=0.7, font=\\footnotesize, line join=round, line cap=round, >=stealth]
      \\draw[->] (-3,0) -- (3,0) node[below] {$x$};
      \\draw[->] (0,-4.5) -- (0,2) node[right] {$y$};
      \\draw (0,0) node[above right] {$0$};
      \\draw[thick, samples=100, domain=-2.1:2.1] plot (\\x, {(\\x)^4 - 4*(\\x)^2});
      \\draw[dashed] (-1.414,0) -- (-1.414,-4) -- (1.414,-4) -- (1.414,0);
      \\draw[dashed] (-1.414,-4) -- (0,-4) node[left] {$-4$};
      \\draw (1,0) node[below] {$1$};
    \\end{tikzpicture}`;

    const svg = renderTikzToSvg(wGraphCode);
    expect(svg).not.toBeNull();
    expect(svg).toContain('tikz-svg-pure');
    expect(svg).toContain('<path d="');
    expect(svg).toContain('stroke-dasharray="4,4"');
  });
});

describe('6. Kiểm thử Display Math \\[...\\] và Môi trường Danh sách (itemize, enumerate, itemchoice)', () => {
  it('Công thức display math \\[...\\] được render bằng KaTeX và KHÔNG bị biến thành số 1', () => {
    const raw = `Số sản phẩm xuất khẩu là
\\[ E(x)=R(x)-Q(x)=(x-500)-(5500-x)=2x-6000\\text{ (sản phẩm)}. \\]
Do đó doanh nghiệp có lãi.`;

    const html = renderMathToHtml(raw);
    expect(html).toContain('katex-display');
    expect(html).toContain('2x-6000');
    expect(html).toContain('sản phẩm');
    // Tuyệt đối không bị lỗi chuỗi replace $$$$1$$$ biến công thức thành số 1 trơ trọi
    expect(html).not.toMatch(/<span class="katex-display">[^<]*1[^<]*<\/span>/);
  });

  it('Môi trường \\begin{itemize} ... \\end{itemize} hiển thị danh sách dạng dấu chấm không bị rò rỉ mã TeX', () => {
    const raw = `Một con rô bốt hút bụi di chuyển:
\\begin{itemize}
  \\item Nếu đang ở vị trí $A$, xác suất là $0{,}5$.
  \\item Nếu đang ở vị trí $B$, xác suất là $0{,}6$.
\\end{itemize}
Ban đầu rô bốt ở vị trí $A$.`;

    const html = renderMathToHtml(raw);
    expect(html).toContain('<ul class="list-disc');
    expect(html).toContain('<li class="leading-relaxed pl-1">');
    expect(html).not.toContain('\\begin{itemize}');
    expect(html).not.toContain('\\end{itemize}');
    expect(html).not.toContain('\\item');
    expect(html).toContain('katex');
  });

  it('Môi trường \\begin{itemchoice} hiển thị huy hiệu Đúng / Sai và bảo vệ công thức display math bên trong', () => {
    const raw = `\\begin{itemchoice}
  \\itemch Đúng. Số sản phẩm là
  \\[ E(x)=2x-6000. \\]
  \\itemch Sai. Tiền lãi là $4y$.
\\end{itemchoice}`;

    const html = renderMathToHtml(raw);
    expect(html).toContain('itemchoice-list');
    expect(html).toContain('bg-emerald-100');
    expect(html).toContain('Đúng');
    expect(html).toContain('bg-rose-100');
    expect(html).toContain('Sai');
    expect(html).toContain('katex-display');
    expect(html).toContain('2x-6000');
    expect(html).not.toContain('\\begin{itemchoice}');
    expect(html).not.toContain('\\itemch');
  });

  it('Môi trường \\begin{enumerate} hỗ trợ đánh số a), b) hoặc 1., 2.', () => {
    const rawAlpha = `\\begin{enumerate}[a)]
  \\item Tìm tập xác định của $y=f(x)$.
  \\item Khảo sát sự biến thiên.
\\end{enumerate}`;

    const htmlAlpha = renderMathToHtml(rawAlpha);
    expect(htmlAlpha).toContain('<ol class="list-[lower-alpha]');
    expect(htmlAlpha).not.toContain('\\begin{enumerate}');

    const rawNum = `\\begin{enumerate}
  \\item Ý thứ nhất.
  \\item Ý thứ hai.
\\end{enumerate}`;

    const htmlNum = renderMathToHtml(rawNum);
    expect(htmlNum).toContain('<ol class="list-decimal');
  });
});

