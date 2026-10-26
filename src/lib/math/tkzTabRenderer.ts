/**
 * Bộ chuyển đổi mã nguồn tkz-tab (Bảng biến thiên LaTeX) sang SVG vector thuần.
 * Cho phép hiển thị bảng biến thiên ngay lập tức với tốc độ 0ms, không phụ thuộc WebAssembly hay TeX backend.
 */

export interface TkzTabParsed {
  rows: string[];
  xVals: string[];
  signs: string[];
  variations: { pos: '+' | '-' | '+D' | '-D' | 'R'; val: string }[];
}

export function parseTkzTabCode(code: string): TkzTabParsed | null {
  // Tìm lệnh \tkzTabInit
  const initMatch = code.match(/\\tkzTabInit(?:\[.*?\])?\s*\{([\s\S]*?)\}\s*\{([\s\S]*?)\}/);
  if (!initMatch) return null;

  // 1. Phân tích tiêu đề các hàng (VD: $x$, $y'$, $y$)
  const rows = initMatch[1]
    .split(',')
    .map((r) => r.split('/')[0].replace(/[\$]/g, '').trim())
    .filter(Boolean);

  // 2. Phân tích các điểm mốc trên trục x (VD: -\infty, -2, 2, +\infty)
  const xVals = initMatch[2]
    .split(',')
    .map((v) => v.replace(/[\$]/g, '').trim())
    .filter(Boolean);

  // 3. Phân tích các dấu trong hàng y' (VD: +, 0, -, 0, +)
  let signs: string[] = [];
  const lineMatch = code.match(/\\tkzTabLine\s*\{([\s\S]*?)\}/);
  if (lineMatch) {
    signs = lineMatch[1]
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s !== '');
  }

  // 4. Phân tích các mũi tên biến thiên trong hàng y (VD: -/$-\infty$, +/$10$, -/$-22$, +/$+\infty$)
  let variations: { pos: '+' | '-' | '+D' | '-D' | 'R'; val: string }[] = [];
  const varMatch = code.match(/\\tkzTabVar\s*\{([\s\S]*?)\}/);
  if (varMatch) {
    variations = varMatch[1]
      .split(',')
      .map((item) => {
        const parts = item.trim().split('/');
        const pos = (parts[0]?.trim().toUpperCase() || '-') as any;
        const val = parts[1]?.replace(/[\$]/g, '').trim() || '';
        return { pos, val };
      })
      .filter((item) => item.val !== '');
  }

  return { rows, xVals, signs, variations };
}

/**
 * Tạo chuỗi SVG hoàn chỉnh của Bảng Biến Thiên từ dữ liệu đã phân tích
 */
export function generateTkzTabSvg(parsed: TkzTabParsed): string {
  const { rows, xVals, signs, variations } = parsed;

  const headerW = 80;
  const colCount = Math.max(xVals.length - 1, 1);
  const colW = Math.max(90, Math.floor(460 / colCount));
  const totalW = headerW + colCount * colW + 40;

  const row1H = 36;
  const row2H = 36;
  const row3H = 90;
  const totalH = row1H + row2H + row3H;

  const row1Y = 0;
  const row2Y = row1H;
  const row3Y = row1H + row2H;

  // Tọa độ X của các điểm mốc
  const xCoords: number[] = [];
  for (let i = 0; i < xVals.length; i++) {
    xCoords.push(headerW + 20 + i * colW);
  }

  // Tiêu đề các dòng
  const rowLabelX = rows[0] || 'x';
  const rowLabelYPrime = rows[1] || "y'";
  const rowLabelY = rows[2] || 'y';

  // Xây dựng các mũi tên biến thiên
  let variationElements = '';
  const highY = row3Y + 24;
  const lowY = row3Y + row3H - 24;

  if (variations.length >= 2) {
    for (let i = 0; i < variations.length - 1; i++) {
      const cur = variations[i];
      const next = variations[i + 1];

      const startX = xCoords[i] !== undefined ? xCoords[i] : headerW + 20 + i * colW;
      const endX = xCoords[i + 1] !== undefined ? xCoords[i + 1] : headerW + 20 + (i + 1) * colW;

      const isCurHigh = cur.pos.includes('+');
      const isNextHigh = next.pos.includes('+');

      const startY = isCurHigh ? highY : lowY;
      const endY = isNextHigh ? highY : lowY;

      // Điểm điều chỉnh để mũi tên không đè lên chữ số
      const arrowStartX = startX + 14;
      const arrowEndX = endX - 14;
      const arrowStartY = isCurHigh ? startY + 8 : startY - 8;
      const arrowEndY = isNextHigh ? endY + 8 : endY - 8;

      // Vẽ đường mũi tên
      variationElements += `
        <line x1="${arrowStartX}" y1="${arrowStartY}" x2="${arrowEndX}" y2="${arrowEndY}" stroke="#2563eb" stroke-width="1.8" marker-end="url(#tab-arrow)" />
      `;

      // Giá trị tại điểm bắt đầu
      if (i === 0) {
        variationElements += `
          <text x="${startX}" y="${startY + 4}" fill="#0f172a" font-size="12" font-weight="600" text-anchor="middle" font-family="KaTeX_Main, serif">${cleanLatexSymbol(cur.val)}</text>
        `;
      }

      // Giá trị tại điểm kết thúc
      variationElements += `
        <text x="${endX}" y="${endY + 4}" fill="#0f172a" font-size="12" font-weight="600" text-anchor="middle" font-family="KaTeX_Main, serif">${cleanLatexSymbol(next.val)}</text>
      `;
    }
  }

  // Dấu ở hàng y' (signs)
  let signsElements = '';
  if (signs.length > 0) {
    // Phân bổ dấu dọc theo khoảng và điểm
    const stepX = (colCount * colW) / Math.max(signs.length - 1, 1);
    for (let i = 0; i < signs.length; i++) {
      const s = signs[i];
      if (!s) continue;
      const sx = headerW + 20 + i * stepX;
      const sy = row2Y + 22;

      if (s === 'd' || s === '||') {
        // Vạch đôi không xác định
        signsElements += `
          <line x1="${sx - 2}" y1="${row2Y + 6}" x2="${sx - 2}" y2="${row2Y + row2H - 6}" stroke="#dc2626" stroke-width="1.2" />
          <line x1="${sx + 2}" y1="${row2Y + 6}" x2="${sx + 2}" y2="${row2Y + row2H - 6}" stroke="#dc2626" stroke-width="1.2" />
        `;
      } else {
        const color = s === '+' ? '#16a34a' : s === '-' ? '#dc2626' : '#475569';
        signsElements += `
          <text x="${sx}" y="${sy}" fill="${color}" font-size="14" font-weight="bold" text-anchor="middle" font-family="KaTeX_Main, serif">${cleanLatexSymbol(s)}</text>
        `;
      }
    }
  }

  // Các điểm trên hàng x
  let xPointsElements = '';
  for (let i = 0; i < xVals.length; i++) {
    const xPos = xCoords[i];
    xPointsElements += `
      <text x="${xPos}" y="${row1Y + 22}" fill="#0f172a" font-size="12" font-weight="600" text-anchor="middle" font-family="KaTeX_Main, serif">${cleanLatexSymbol(xVals[i])}</text>
    `;
  }

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW} ${totalH}" class="w-full max-w-xl mx-auto my-3 bg-white rounded-xl shadow-xs border border-slate-200 select-none">
      <defs>
        <marker id="tab-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#2563eb" />
        </marker>
      </defs>

      <!-- Khung viền bảng -->
      <rect x="0" y="0" width="${totalW}" height="${totalH}" fill="#ffffff" stroke="#cbd5e1" stroke-width="1" rx="8" />

      <!-- Đường kẻ dọc ngăn cột tiêu đề -->
      <line x1="${headerW}" y1="0" x2="${headerW}" y2="${totalH}" stroke="#94a3b8" stroke-width="1.2" />

      <!-- Các đường kẻ ngang -->
      <line x1="0" y1="${row2Y}" x2="${totalW}" y2="${row2Y}" stroke="#cbd5e1" stroke-width="1" />
      <line x1="0" y1="${row3Y}" x2="${totalW}" y2="${row3Y}" stroke="#cbd5e1" stroke-width="1" />

      <!-- Cột tiêu đề bên trái -->
      <text x="${headerW / 2}" y="${row1Y + 22}" fill="#1e293b" font-size="13" font-style="italic" font-weight="bold" text-anchor="middle" font-family="KaTeX_Math, serif">${rowLabelX}</text>
      <text x="${headerW / 2}" y="${row2Y + 22}" fill="#1e293b" font-size="13" font-style="italic" font-weight="bold" text-anchor="middle" font-family="KaTeX_Math, serif">${rowLabelYPrime}</text>
      <text x="${headerW / 2}" y="${row3Y + row3H / 2 + 5}" fill="#1e293b" font-size="13" font-style="italic" font-weight="bold" text-anchor="middle" font-family="KaTeX_Math, serif">${rowLabelY}</text>

      <!-- Hàng 1: Các giá trị của x -->
      ${xPointsElements}

      <!-- Hàng 2: Dấu của y' -->
      ${signsElements}

      <!-- Hàng 3: Chiều biến thiên y và các mũi tên -->
      ${variationElements}
    </svg>
  `;
}

function cleanLatexSymbol(s: string): string {
  if (!s) return '';
  return s
    .replace(/\\infty/g, '∞')
    .replace(/\\cdot/g, '·')
    .replace(/\\pm/g, '±')
    .replace(/\\mp/g, '∓')
    .replace(/\{/g, '')
    .replace(/\}/g, '')
    .trim();
}
