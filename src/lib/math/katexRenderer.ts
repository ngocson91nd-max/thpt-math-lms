import katex from 'katex';

/**
 * Tiền xử lý các macro LaTeX chuẩn sư phạm Toán THPT (gói ex_test, tkz-tab, v.v.)
 * sang cú pháp mà KaTeX hiểu và render hoàn hảo.
 */
function preprocessLatex(raw: string): string {
  if (!raw) return '';

  let text = raw;

  // 1. Chuyển đổi dấu ngoặc kép tiếng Việt \lq\lq và \rq\rq
  text = text.replace(/\\lq\\lq/g, '“').replace(/\\rq\\rq/g, '”');

  // 2. Chuyển đổi môi trường display math \[ ... \] thành $$ ... $$
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, '$$$$1$$$');

  // 3. Xử lý \immini{text}{tikzpicture}: lấy phần text trước, phần sau hiển thị gọn
  text = text.replace(/\\immini\s*\{([\s\S]*?)\}\s*\{([\s\S]*?)\}/g, (_m, mainText, _side) => {
    return mainText;
  });

  // 4. Xử lý môi trường \begin{itemchoice} ... \end{itemchoice}
  text = text.replace(/\\begin\{itemchoice\}([\s\S]*?)\\end\{itemchoice\}/g, (_m, body) => {
    return body.replace(/\\itemch\s*/g, '\n• ');
  });

  // 5. Chuẩn hóa macro \heva và \hoac cho KaTeX
  // \heva{&x=1\\ &y=2} -> \begin{cases} x=1 \\ y=2 \end{cases}
  text = text.replace(/\\heva\s*\{([\s\S]*?)\}/g, (_m, body) => {
    const cleaned = body.replace(/&/g, '').trim();
    return `\\begin{cases} ${cleaned} \\end{cases}`;
  });

  // \hoac{&x=1\\ &x=2} -> \left[ \begin{array}{l} x=1 \\ x=2 \end{array} \right.
  text = text.replace(/\\hoac\s*\{([\s\S]*?)\}/g, (_m, body) => {
    const cleaned = body.replace(/&/g, '').trim();
    return `\\left[\\begin{array}{l} ${cleaned} \\end{array}\\right.`;
  });

  // 6. Xử lý \mathscr{D} thành \mathcal{D} hoặc D
  text = text.replace(/\\mathscr\{([A-Za-z]+)\}/g, '\\mathcal{$1}');

  // 7. Bỏ các lệnh trang trí không ảnh hưởng công thức: \limits sau \lim
  text = text.replace(/\\lim\\limits/g, '\\lim');
  text = text.replace(/\\max\\limits/g, '\\max');
  text = text.replace(/\\min\\limits/g, '\\min');

  return text;
}

/**
 * Phân tích và chuyển đổi chuỗi chứa công thức LaTeX ($...$ hoặc $$...$$) thành HTML an toàn.
 */
export function renderMathToHtml(content: string): string {
  if (!content) return '';

  const preprocessed = preprocessLatex(content);

  // Bước 1: Thay thế các khối display math $$...$$
  let processed = preprocessed.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => {
    try {
      return `<div class="my-3 overflow-x-auto text-center">${katex.renderToString(math.trim(), {
        displayMode: true,
        throwOnError: false,
      })}</div>`;
    } catch {
      return `<div class="text-rose-600 font-mono text-sm">[Lỗi LaTeX: ${math}]</div>`;
    }
  });

  // Bước 2: Thay thế các công thức inline $...$
  processed = processed.replace(/(?<!\\)\$([^\$\n]+?)\$/g, (_, math) => {
    try {
      return katex.renderToString(math.trim(), {
        displayMode: false,
        throwOnError: false,
      });
    } catch {
      return `<span class="text-rose-600 font-mono text-sm">[Lỗi: $${math}$]</span>`;
    }
  });

  // Bước 3: Hỗ trợ xuống dòng tự nhiên trong đề bài
  processed = processed.replace(/\n/g, '<br />');

  return processed;
}

/**
 * Danh sách các ký hiệu toán học phổ biến THPT để hỗ trợ thanh công cụ gõ nhanh
 */
export const THPT_MATH_SYMBOLS = [
  { label: 'Phân số', latex: '\\frac{a}{b}', preview: 'a/b' },
  { label: 'Căn bậc hai', latex: '\\sqrt{x}', preview: '√x' },
  { label: 'Căn bậc n', latex: '\\sqrt[n]{x}', preview: 'ⁿ√x' },
  { label: 'Lũy thừa', latex: 'x^{2}', preview: 'x²' },
  { label: 'Chỉ số dưới', latex: 'x_{1}', preview: 'x₁' },
  { label: 'Tích phân', latex: '\\int_{a}^{b} f(x) \\, \\mathrm{d}x', preview: '∫' },
  { label: 'Đạo hàm', latex: "f'(x)", preview: "f'" },
  { label: 'Giới hạn', latex: '\\lim_{x \\to x_0} f(x)', preview: 'lim' },
  { label: 'Vectơ', latex: '\\vec{u}', preview: 'u⃗' },
  { label: 'Góc', latex: '\\widehat{ABC}', preview: '∠' },
  { label: 'Tập số thực R', latex: '\\mathbb{R}', preview: 'ℝ' },
  { label: 'Tương đương', latex: '\\iff', preview: '⟺' },
  { label: 'Suy ra', latex: '\\implies', preview: '⟹' },
  { label: 'Thuộc', latex: '\\in', preview: '∈' },
  { label: 'Không thuộc', latex: '\\notin', preview: '∉' },
  { label: 'Vuông góc', latex: '\\perp', preview: '⟂' },
  { label: 'Song song', latex: '\\parallel', preview: '∥' },
  { label: 'Vô cực', latex: '\\infty', preview: '∞' },
  { label: 'Pi', latex: '\\pi', preview: 'π' },
  { label: 'Delta', latex: '\\Delta', preview: 'Δ' },
  { label: 'Hệ phương trình', latex: '\\begin{cases} x + y = 1 \\\\ x - y = 0 \\end{cases}', preview: '{…' },
];
