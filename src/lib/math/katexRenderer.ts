import katex from 'katex';
import { parseTkzTabCode, generateTkzTabSvg } from './tkzTabRenderer';

function extractBracedGroup(str: string, pos: number): { text: string; nextPos: number } | null {
  let depth = 0;
  let start = -1;
  for (let i = pos; i < str.length; i++) {
    if (str[i] === '{') {
      if (depth === 0) start = i + 1;
      depth++;
    } else if (str[i] === '}') {
      depth--;
      if (depth === 0) {
        return { text: str.substring(start, i), nextPos: i + 1 };
      }
    }
  }
  return null;
}

/**
 * Tiền xử lý các macro LaTeX chuẩn sư phạm Toán THPT (gói ex_test, tkz-tab, v.v.)
 * sang cú pháp mà KaTeX và trình duyệt web hiểu và render hoàn hảo.
 */
function preprocessLatex(raw: string): string {
  if (!raw) return '';

  let text = raw;

  // 1. Chuyển đổi dấu ngoặc kép tiếng Việt \lq\lq và \rq\rq
  text = text.replace(/\\lq\\lq/g, '“').replace(/\\rq\\rq/g, '”');
  text = text.replace(/\\lq/g, '‘').replace(/\\rq/g, '’');

  // 2. Chuyển đổi môi trường display math \[ ... \] thành $$ ... $$
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, '$$$$1$$$');

  // 3. Xử lý \immini{text}{sideContent}: tách văn bản và hình ảnh theo bố cục 2 cột có độ sâu ngoặc
  let imminiIdx = text.indexOf('\\immini');
  while (imminiIdx !== -1) {
    let pos = imminiIdx + 7;
    while (pos < text.length && /\s/.test(text[pos])) pos++;
    const g1 = extractBracedGroup(text, pos);
    if (!g1) break;
    pos = g1.nextPos;
    while (pos < text.length && /\s/.test(text[pos])) pos++;
    const g2 = extractBracedGroup(text, pos);
    if (!g2) break;

    const mainText = g1.text.trim();
    const sideContent = g2.text.trim();
    const replacement = `\n<div class="immini-block flex flex-col md:flex-row items-start justify-between gap-5 my-3"><div class="immini-content flex-1 leading-relaxed">${mainText}</div><div class="immini-figure shrink-0 w-full md:w-auto flex flex-col items-center justify-center">${sideContent}</div></div>\n`;

    text = text.substring(0, imminiIdx) + replacement + text.substring(g2.nextPos);
    imminiIdx = text.indexOf('\\immini', imminiIdx + replacement.length);
  }

  // 4. Xử lý khối TikZ \begin{tikzpicture} ... \end{tikzpicture}
  text = text.replace(/\\begin\{tikzpicture\}([\s\S]*?)\\end\{tikzpicture\}/g, (_m, body) => {
    const cleanTikz = `\\begin{tikzpicture}${body}\\end{tikzpicture}`;

    // Kiểm tra nếu là Bảng biến thiên (gói tkz-tab) -> Render SVG trực tiếp 0ms siêu nét!
    if (body.includes('\\tkzTabInit') || body.includes('tkzTab')) {
      const parsedTab = parseTkzTabCode(cleanTikz);
      if (parsedTab) {
        return `<div class="tkz-tab-wrapper my-3 overflow-x-auto flex flex-col items-center">${generateTkzTabSvg(parsedTab)}</div>`;
      }
    }

    return `<div class="tikz-wrapper my-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col items-center justify-center overflow-x-auto shadow-2xs w-full max-w-lg mx-auto">
      <div class="flex items-center gap-1.5 text-[11px] font-bold text-indigo-700 uppercase tracking-wider mb-2">
        <span class="h-2 w-2 rounded-full bg-indigo-600 animate-pulse"></span>
        Hình Vẽ Hình Học TikZ / Đồ Thị Hàm Số
      </div>
      <div class="tikz-target flex justify-center py-2" data-tikz="${encodeURIComponent(cleanTikz)}">
        <script type="text/tikz">${cleanTikz}</script>
      </div>
      <details class="text-[11px] text-slate-500 mt-2 cursor-pointer w-full text-center">
        <summary class="hover:text-indigo-600 font-medium">Xem mã nguồn TikZ gốc</summary>
        <pre class="mt-2 text-left p-2.5 bg-white border border-slate-200 rounded-xl font-mono text-[10px] overflow-x-auto text-slate-700 whitespace-pre-wrap">${cleanTikz}</pre>
      </details>
    </div>`;
  });

  // 5. Xử lý môi trường \begin{itemchoice} ... \end{itemchoice}
  text = text.replace(/\\begin\{itemchoice\}([\s\S]*?)\\end\{itemchoice\}/g, (_m, body) => {
    return body.replace(/\\itemch\s*/g, '\n• ');
  });

  // 6. Xử lý môi trường \begin{enumerate} ... \end{enumerate}
  text = text.replace(/\\begin\{enumerate\}(?:\[.*?\])?([\s\S]*?)\\end\{enumerate\}/g, (_m, body) => {
    let count = 0;
    const items = body.replace(/\\item\s*/g, () => {
      const label = String.fromCharCode(97 + count); // a, b, c, d
      count++;
      return `\n${label}) `;
    });
    return items;
  });

  // 7. Chuẩn hóa macro \heva và \hoac cho KaTeX
  text = text.replace(/\\heva\s*\{([\s\S]*?)\}/g, (_m, body) => {
    const cleaned = body.replace(/&/g, '').trim();
    return `\\begin{cases} ${cleaned} \\end{cases}`;
  });

  text = text.replace(/\\hoac\s*\{([\s\S]*?)\}/g, (_m, body) => {
    const cleaned = body.replace(/&/g, '').trim();
    return `\\left[\\begin{array}{l} ${cleaned} \\end{array}\\right.`;
  });

  // 8. Xử lý \mathscr{D} thành \mathcal{D} hoặc D
  text = text.replace(/\\mathscr\{([A-Za-z]+)\}/g, '\\mathcal{$1}');

  // 9. Bỏ các lệnh trang trí không ảnh hưởng công thức: \limits sau \lim
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

  // Bước 3: Hỗ trợ xuống dòng tự nhiên trong đề bài (trừ trong các thẻ HTML phức tạp)
  processed = processed.replace(/\n(?!(?:<div|<pre|<\/pre|<\/div))/g, '<br />');

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
  { label: 'Giới hạn', latex: '\\lim_{x\\to x_0} f(x)', preview: 'lim' },
  { label: 'Hệ phương trình', latex: '\\heva{x+y=1 \\\\ x-y=2}', preview: 'heva' },
  { label: 'Tuyển phương trình', latex: '\\hoac{x=1 \\\\ x=2}', preview: 'hoac' },
  { label: 'Vector', latex: '\\vec{u}', preview: 'u⃗' },
  { label: 'Vô cực', latex: '\\infty', preview: '∞' },
];
