import katex from 'katex';
import { parseTkzTabCode, generateTkzTabSvg } from './tkzTabRenderer';

export function extractBracedGroup(str: string, pos: number): { text: string; nextPos: number } | null {
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
 * Thay thế macro có đối số ngoặc nhọn lồng nhau (như \heva{...}, \hoac{...})
 */
function replaceBracedMacro(
  text: string,
  macroName: string,
  replacer: (inner: string) => string
): string {
  let idx = text.indexOf(macroName);
  while (idx !== -1) {
    let pos = idx + macroName.length;
    while (pos < text.length && /\s/.test(text[pos])) pos++;
    const group = extractBracedGroup(text, pos);
    if (!group) break;

    const replacement = replacer(group.text.trim());
    text = text.substring(0, idx) + replacement + text.substring(group.nextPos);
    idx = text.indexOf(macroName, idx + replacement.length);
  }
  return text;
}

/**
 * Chuyển đổi môi trường \begin{tabular} ... \end{tabular} sang HTML <table> chuẩn Tailwind CSS
 * Hỗ trợ công thức KaTeX trong từng ô và căn lề theo định dạng cột (l, c, r).
 */
export function renderTabularToHtml(tabularBlock: string): string {
  const match = tabularBlock.match(/\\begin\{tabular\}(?:\[.*?\])?\{([^}]+)\}([\s\S]*?)\\end\{tabular\}/);
  if (!match) return tabularBlock;

  const colSpec = match[1];
  const body = match[2];

  // Trích xuất định dạng căn lề từng cột: l (left), c (center), r (right)
  const colMatches = colSpec.match(/[lcr]|p\{[^}]+\}/g) || [];
  const alignments = colMatches.map((c) => {
    if (c.startsWith('r')) return 'text-right';
    if (c.startsWith('l') || c.startsWith('p')) return 'text-left';
    return 'text-center';
  });

  // Tách các hàng theo dấu ngắt dòng \\
  const rawRows = body.split(/\\\\/);
  const rowsHtml: string[] = [];

  rawRows.forEach((rawRow, rowIdx) => {
    // Loại bỏ lệnh kẻ ngang \hline, \cline{...}
    const cleanRow = rawRow
      .replace(/\\hline/g, '')
      .replace(/\\cline\{[^}]+\}/g, '')
      .trim();

    if (!cleanRow) return;

    // Tách các ô trong hàng theo dấu &
    const cells = cleanRow.split('&');
    const cellsHtml: string[] = [];

    cells.forEach((cell, colIdx) => {
      let cellText = cell.trim();
      // Render công thức toán KaTeX nếu có bên trong ô
      cellText = cellText.replace(/(?<!\\)\$([^\$\n]+?)\$/g, (_, math) => {
        try {
          return katex.renderToString(math.trim(), {
            displayMode: false,
            throwOnError: false,
          });
        } catch {
          return math;
        }
      });

      const alignClass = alignments[colIdx] || 'text-center';
      const isHeaderRow = rowIdx === 0;
      const cellBg = isHeaderRow ? 'bg-slate-50 font-semibold text-slate-900' : 'text-slate-800';

      cellsHtml.push(
        `<td class="border border-slate-300 px-3.5 py-2 ${alignClass} text-xs sm:text-sm ${cellBg}">${cellText}</td>`
      );
    });

    const trBg = rowIdx === 0 ? '' : 'hover:bg-slate-50/80 transition-colors';
    rowsHtml.push(`<tr class="${trBg}">${cellsHtml.join('')}</tr>`);
  });

  return `<div class="my-4 overflow-x-auto flex justify-center w-full"><table class="border-collapse border border-slate-300 text-sm bg-white rounded-xl shadow-xs overflow-hidden mx-auto"><tbody class="divide-y divide-slate-200">${rowsHtml.join('')}</tbody></table></div>`;
}

/**
 * Phân tích và chuyển đổi chuỗi chứa công thức LaTeX, TikZ, Bảng biến thiên (tkz-tab),
 * và Bảng số liệu (tabular) thành HTML an toàn, bảo vệ nguyên vẹn cấu trúc mã nguồn.
 */
export function renderMathToHtml(content: string): string {
  if (!content) return '';

  const placeholders = new Map<string, string>();
  let tokenCounter = 0;

  const savePlaceholder = (html: string): string => {
    const token = `@@MATH_BLOCK_${tokenCounter++}@@`;
    placeholders.set(token, html);
    return token;
  };

  let text = content;

  // 1. Chuyển đổi dấu ngoặc kép tiếng Việt
  text = text.replace(/\\lq\\lq/g, '“').replace(/\\rq\\rq/g, '”');
  text = text.replace(/\\lq/g, '‘').replace(/\\rq/g, '’');

  // 2. Chuyển đổi môi trường display math \[ ... \] thành $$ ... $$
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, '$$$$1$$$');

  // 3. Xử lý vector esvect: \vv{AB}, \vv{u}, \vv a sang \overrightarrow
  text = text.replace(/\\vv\s*\{([^}]+)\}/g, '\\overrightarrow{$1}');
  text = text.replace(/\\vv\s*([a-zA-Z0-9])/g, '\\overrightarrow{$1}');

  // 4. Xử lý \mathscr thành \mathcal
  text = text.replace(/\\mathscr\{([A-Za-z]+)\}/g, '\\mathcal{$1}');

  // 5. Bỏ các lệnh trang trí không ảnh hưởng công thức
  text = text.replace(/\\lim\\limits/g, '\\lim');
  text = text.replace(/\\max\\limits/g, '\\max');
  text = text.replace(/\\min\\limits/g, '\\min');
  text = text.replace(/\\sodong\s*\{[^}]*\}/g, '');
  text = text.replace(/\\Opensolutionfile\s*\{[^}]*\}\s*(?:\[[^\]]*\])?/g, '');
  text = text.replace(/\\hethet/g, '');
  text = text.replace(/\\dapan/g, '');

  // 6. Chuẩn hóa macro \heva và \hoac có ngoặc lồng nhau
  text = replaceBracedMacro(text, '\\heva', (inner) => `\\left\\{\\begin{aligned} ${inner} \\end{aligned}\\right.`);
  text = replaceBracedMacro(text, '\\hoac', (inner) => `\\left[\\begin{aligned} ${inner} \\end{aligned}\\right.`);

  // 7. Xử lý môi trường \begin{itemchoice} và \begin{enumerate}
  text = text.replace(/\\begin\{itemchoice\}([\s\S]*?)\\end\{itemchoice\}/g, (_m, body) => {
    return body.replace(/\\itemch\s*/g, '\n• ');
  });
  text = text.replace(/\\begin\{enumerate\}(?:\[.*?\])?([\s\S]*?)\\end\{enumerate\}/g, (_m, body) => {
    let count = 0;
    return body.replace(/\\item\s*/g, () => {
      const label = String.fromCharCode(97 + count);
      count++;
      return `\n${label}) `;
    });
  });

  // 8. XỬ LÝ KHỐI TIKZ \begin{tikzpicture} ... \end{tikzpicture}
  // Bóc tách trước và lưu thành placeholder để không bị bất kỳ regex nào làm hỏng cú pháp TeX
  text = text.replace(/\\begin\{tikzpicture\}([\s\S]*?)\\end\{tikzpicture\}/g, (_m, body) => {
    const cleanTikz = `\\begin{tikzpicture}${body}\\end{tikzpicture}`.trim();

    // 8a. Kiểm tra nếu là Bảng biến thiên (tkz-tab) -> Render SVG trực tiếp 0ms siêu nét!
    if (body.includes('\\tkzTabInit') || body.includes('tkzTab')) {
      const parsedTab = parseTkzTabCode(cleanTikz);
      if (parsedTab) {
        const svg = generateTkzTabSvg(parsedTab);
        const svgWrapper = `<div class="tkz-tab-wrapper my-3 overflow-x-auto flex flex-col items-center select-none">${svg}</div>`;
        return savePlaceholder(svgWrapper);
      }
    }

    // 8b. Hình vẽ hình học / Đồ thị hàm số TikZ
    const encodedTikz = encodeURIComponent(cleanTikz);
    const tikzWrapper = `<div class="tikz-wrapper my-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col items-center justify-center overflow-x-auto shadow-2xs w-full max-w-lg mx-auto select-none"><div class="flex items-center gap-1.5 text-[11px] font-bold text-indigo-700 uppercase tracking-wider mb-2"><span class="h-2 w-2 rounded-full bg-indigo-600 animate-pulse"></span>Hình Vẽ TikZ / Đồ Thị Hàm Số</div><div class="tikz-target flex justify-center py-2 w-full" data-tikz="${encodedTikz}"><script type="text/tikz" data-tikz-libraries="arrows.meta,calc,positioning,shapes,through,intersections">${cleanTikz}</script></div><details class="text-[11px] text-slate-500 mt-2 cursor-pointer w-full text-center"><summary class="hover:text-indigo-600 font-medium">Xem mã nguồn TikZ gốc</summary><pre class="mt-2 text-left p-2.5 bg-white border border-slate-200 rounded-xl font-mono text-[10px] overflow-x-auto text-slate-700 whitespace-pre-wrap">${cleanTikz}</pre></details></div>`;

    return savePlaceholder(tikzWrapper);
  });

  // 9. XỬ LÝ BẢNG SỐ LIỆU \begin{tabular} ... \end{tabular}
  text = text.replace(/\\begin\{tabular\}(?:\[.*?\])?\{[^}]+\}[\s\S]*?\\end\{tabular\}/g, (match) => {
    const tableHtml = renderTabularToHtml(match);
    return savePlaceholder(tableHtml);
  });

  // 10. XỬ LÝ \immini{mainText}{figure} với độ sâu ngoặc nhọn chuẩn xác
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
    const imminiHtml = `<div class="immini-block flex flex-col md:flex-row items-start justify-between gap-6 my-4"><div class="immini-content flex-1 leading-relaxed">${mainText}</div><div class="immini-figure shrink-0 w-full md:w-auto flex flex-col items-center justify-center">${sideContent}</div></div>`;
    const token = savePlaceholder(imminiHtml);

    text = text.substring(0, imminiIdx) + token + text.substring(g2.nextPos);
    imminiIdx = text.indexOf('\\immini', imminiIdx + token.length);
  }

  // 11. XỬ LÝ \begin{center} ... \end{center}
  text = text.replace(/\\begin\{center\}([\s\S]*?)\\end\{center\}/g, (_m, body) => {
    const centerHtml = `<div class="text-center my-3 flex flex-col items-center justify-center w-full">${body.trim()}</div>`;
    return savePlaceholder(centerHtml);
  });

  // 12. XỬ LÝ DISPLAY MATH $$...$$
  text = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => {
    try {
      const rendered = katex.renderToString(math.trim(), {
        displayMode: true,
        throwOnError: false,
      });
      return savePlaceholder(`<div class="my-3 overflow-x-auto text-center">${rendered}</div>`);
    } catch {
      return savePlaceholder(`<div class="text-rose-600 font-mono text-sm">[Lỗi LaTeX: ${math}]</div>`);
    }
  });

  // 13. XỬ LÝ INLINE MATH $...$
  text = text.replace(/(?<!\\)\$([^\$\n]+?)\$/g, (_, math) => {
    try {
      const rendered = katex.renderToString(math.trim(), {
        displayMode: false,
        throwOnError: false,
      });
      return savePlaceholder(rendered);
    } catch {
      return savePlaceholder(`<span class="text-rose-600 font-mono text-sm">[Lỗi: $${math}$]</span>`);
    }
  });

  // 14. XỬ LÝ XUỐNG DÒNG TRONG VĂN BẢN THUẦN TÚY (Lúc này không còn thẻ HTML, SVG hay Script nào trong text!)
  text = text.replace(/\\\\(?:\s*\[\s*\d+\w*\s*\])?/g, '<br />');
  text = text.replace(/\n\n+/g, '<br /><br />');
  text = text.replace(/\n/g, '<br />');

  // 15. PHỤC HỒI TẤT CẢ CÁC PLACEHOLDER ĐÃ ĐƯỢC BẢO VỆ
  let loopCount = 0;
  while (text.includes('@@MATH_BLOCK_') && loopCount < 10) {
    loopCount++;
    text = text.replace(/@@MATH_BLOCK_\d+@@/g, (token) => {
      return placeholders.get(token) || token;
    });
  }

  return text;
}

/**
 * Danh sách các ký hiệu toán học phổ biến THPT để hỗ trợ thanh công cụ gõ nhanh
 */
export const THPT_MATH_SYMBOLS = [
  { label: 'Phân số', latex: '\\dfrac{a}{b}', preview: 'a/b' },
  { label: 'Căn bậc hai', latex: '\\sqrt{x}', preview: '√x' },
  { label: 'Căn bậc n', latex: '\\sqrt[n]{x}', preview: 'ⁿ√x' },
  { label: 'Lũy thừa', latex: 'x^{2}', preview: 'x²' },
  { label: 'Chỉ số dưới', latex: 'x_{1}', preview: 'x₁' },
  { label: 'Tích phân', latex: '\\int_{a}^{b} f(x) \\, \\mathrm{d}x', preview: '∫' },
  { label: 'Đạo hàm', latex: "f'(x)", preview: "f'" },
  { label: 'Giới hạn', latex: '\\lim_{x\\to x_0} f(x)', preview: 'lim' },
  { label: 'Hệ phương trình', latex: '\\heva{x+y=1 \\\\ x-y=2}', preview: 'heva' },
  { label: 'Tuyển phương trình', latex: '\\hoac{x=1 \\\\ x=2}', preview: 'hoac' },
  { label: 'Vector đoạn', latex: '\\vv{AB}', preview: 'AB⃗' },
  { label: 'Vector đơn', latex: '\\vv{u}', preview: 'u⃗' },
  { label: 'Bảng số liệu', latex: '\\begin{tabular}{|c|c|c|}\\hline A & B & C \\\\\\hline\\end{tabular}', preview: 'table' },
  { label: 'Vô cực', latex: '\\infty', preview: '∞' },
];
