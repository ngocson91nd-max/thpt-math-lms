/**
 * Bộ chuyển đổi mã nguồn tkz-tab (Bảng biến thiên LaTeX) sang SVG vector thuần.
 * Cho phép hiển thị bảng biến thiên ngay lập tức với tốc độ 0ms, không phụ thuộc WebAssembly hay TeX backend.
 * Thiết kế to rõ, kích thước chuẩn đề thi THPT Quốc gia, sắc nét trên mọi màn hình.
 */

export interface TkzTabParsedItem {
  pos: string;
  val: string;
  isDiscontinuity?: boolean;
  leftPos?: string;
  leftVal?: string;
  rightPos?: string;
  rightVal?: string;
}

export interface TkzTabParsed {
  rows: string[];
  xVals: string[];
  signs: string[];
  variations: TkzTabParsedItem[];
}

export function cleanLatexSymbol(s: string): string {
  if (!s) return '';
  let str = s
    .replace(/\\limits/g, '')
    .replace(/\\left/g, '')
    .replace(/\\right/g, '')
    .replace(/\\infty/g, '∞')
    .replace(/\\dfrac\{([^}]+)\}\{([^}]+)\}/g, '$1/$2')
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1/$2')
    .replace(/\\sqrt\{([^}]+)\}/g, '√$1')
    .replace(/\\cdot/g, '·')
    .replace(/\\pm/g, '±')
    .replace(/\\mp/g, '∓')
    .replace(/\\pi/g, 'π')
    .replace(/\{/g, '')
    .replace(/\}/g, '')
    .replace(/[\$]/g, '')
    .trim();

  // Escape XML entities
  str = str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return str;
}

export function parseTkzTabCode(code: string): TkzTabParsed | null {
  // Tìm lệnh \tkzTabInit
  const initMatch = code.match(/\\tkzTabInit(?:\[.*?\])?\s*\{([\s\S]*?)\}\s*\{([\s\S]*?)\}/);
  if (!initMatch) return null;

  // 1. Phân tích tiêu đề các hàng (VD: $x$, $y'$, $y$ hoặc $t$, $y'(t)$, $y(t)$)
  const rows = initMatch[1]
    .split(',')
    .map((r) => r.split('/')[0].replace(/[\$]/g, '').trim())
    .filter(Boolean);

  // 2. Phân tích các điểm mốc trên trục x (VD: -\infty, 1, 2, +\infty)
  const xVals = initMatch[2]
    .split(',')
    .map((v) => v.replace(/[\$]/g, '').trim())
    .filter(Boolean);

  // 3. Phân tích các dấu trong hàng y' (VD: ,-,d,-,0,+,)
  let signs: string[] = [];
  const lineMatch = code.match(/\\tkzTabLine\s*\{([\s\S]*?)\}/);
  if (lineMatch) {
    let rawTokens = lineMatch[1].split(',').map((s) => s.trim());
    if (rawTokens.length > 0 && rawTokens[0] === '') rawTokens.shift();
    if (rawTokens.length > 0 && rawTokens[rawTokens.length - 1] === '') rawTokens.pop();
    signs = rawTokens;
  }

  // 4. Phân tích các chiều biến thiên trong hàng y (tkzTabVar)
  let variations: TkzTabParsedItem[] = [];
  const varMatch = code.match(/\\tkzTabVar\s*\{([\s\S]*?)\}/);
  if (varMatch) {
    const rawItems = varMatch[1].split(',').map((item) => item.trim()).filter(Boolean);

    for (let idx = 0; idx < rawItems.length; idx++) {
      const item = rawItems[idx];
      const parts = item.split('/');
      const rawPos = parts[0]?.trim().toUpperCase() || '-';

      // Kiểm tra xem mục này có chứa vạch kép / tiệm cận đứng (-D+, +D-, -D-, +D+, -D, +D, D) không
      if (rawPos.includes('D')) {
        let leftPos = rawPos.includes('+') && rawPos.indexOf('+') < rawPos.indexOf('D') ? '+' : '-';
        let rightPos = rawPos.endsWith('+') || (rawPos.includes('+') && rawPos.indexOf('+') > rawPos.indexOf('D')) ? '+' : '-';

        let leftVal = parts[1]?.replace(/[\$]/g, '').trim() || '';
        let rightVal = parts[2]?.replace(/[\$]/g, '').trim() || '';

        // Nếu giáo viên chỉ ghi 1 giá trị thì tự suy luận giá trị bên phải từ dấu y'
        if (!rightVal && leftVal) {
          const signIdx = idx * 2 + 1;
          const nextSign = signs[signIdx] || '-';
          rightPos = nextSign === '+' ? '-' : '+';
          rightVal = rightPos === '+' ? '+\\infty' : '-\\infty';
        }

        variations.push({
          pos: rawPos,
          val: leftVal,
          isDiscontinuity: true,
          leftPos,
          leftVal,
          rightPos,
          rightVal,
        });
      } else {
        const pos = rawPos.includes('+') ? '+' : '-';
        const val = parts[1]?.replace(/[\$]/g, '').trim() || '';
        variations.push({ pos, val, isDiscontinuity: false });
      }
    }
  }

  return { rows, xVals, signs, variations };
}

/**
 * Tạo chuỗi SVG hoàn chỉnh của Bảng Biến Thiên to rõ, sắc nét chuẩn sư phạm
 */
export function generateTkzTabSvg(parsed: TkzTabParsed): string {
  const { rows, xVals, signs, variations } = parsed;

  const headerW = 95;
  const colCount = Math.max(xVals.length - 1, 1);
  const colW = Math.max(120, Math.floor(540 / colCount));
  const totalW = headerW + colCount * colW + 40;

  // Nâng chiều cao các hàng để bảng to rõ, thoáng đạt
  const row1H = 46;
  const row2H = 46;
  const row3H = 130;
  const totalH = row1H + row2H + row3H;

  const row1Y = 0;
  const row2Y = row1H;
  const row3Y = row1H + row2H;

  const markerId = `tab-arrow-${Math.floor(Math.random() * 100000)}`;

  // Tọa độ X của các điểm mốc trên trục x
  const xCoords: number[] = [];
  for (let i = 0; i < xVals.length; i++) {
    xCoords.push(headerW + 20 + i * colW);
  }

  // Tiêu đề các dòng
  const rowLabelX = cleanLatexSymbol(rows[0] || 'x');
  const rowLabelYPrime = cleanLatexSymbol(rows[1] || "y'");
  const rowLabelY = cleanLatexSymbol(rows[2] || 'y');

  // Xác định các cột có vạch đôi không xác định
  const doubleBarCols = new Set<number>();
  for (let i = 0; i < signs.length; i++) {
    const s = signs[i];
    if (s === 'd' || s === '||') {
      const col = Math.floor((i + 1) / 2);
      doubleBarCols.add(col);
    }
  }

  // Xây dựng các phần tử dấu ở hàng y' (signs) và đường kẻ đôi xuyên suốt cả bảng
  let signsElements = '';
  let doubleBarLines = '';

  if (signs.length > 0) {
    for (let i = 0; i < signs.length; i++) {
      const s = signs[i];
      if (!s) continue;

      let sx = 0;
      if (i % 2 === 0) {
        // Vị trí khoảng (giữa hai điểm x[k] và x[k+1])
        const k = Math.floor(i / 2);
        const p1 = xCoords[k] !== undefined ? xCoords[k] : headerW + 20;
        const p2 = xCoords[k + 1] !== undefined ? xCoords[k + 1] : p1 + colW;
        sx = (p1 + p2) / 2;
      } else {
        // Vị trí điểm mốc (tại điểm x[k])
        const k = Math.floor((i + 1) / 2);
        sx = xCoords[k] !== undefined ? xCoords[k] : headerW + 20 + k * colW;
      }

      const sy = row2Y + 28;

      if (s === 'd' || s === '||') {
        // Vạch đôi không xác định: KÉO DÀI TỪ HÀNG y' XUYÊN SUỐT HẾT HÀNG y XUỐNG ĐÁY BẢNG
        doubleBarLines += `<line x1="${sx - 2.5}" y1="${row2Y}" x2="${sx - 2.5}" y2="${totalH}" stroke="#334155" stroke-width="1.3" /><line x1="${sx + 2.5}" y1="${row2Y}" x2="${sx + 2.5}" y2="${totalH}" stroke="#334155" stroke-width="1.3" />`;
      } else {
        const color = s === '+' ? '#16a34a' : s === '-' ? '#dc2626' : '#475569';
        signsElements += `<text x="${sx}" y="${sy}" fill="${color}" font-size="18" font-weight="bold" text-anchor="middle" font-family="KaTeX_Main, serif">${cleanLatexSymbol(s)}</text>`;
      }
    }
  }

  // Xây dựng các mũi tên và nhãn giá trị của hàng y (variations)
  let variationElements = '';
  const highY = row3Y + 26;
  const lowY = row3Y + row3H - 26;

  // Lập bản đồ điểm biến thiên cho từng cột
  for (let col = 0; col < xVals.length; col++) {
    const item = variations[col];
    if (!item) continue;

    const x = xCoords[col];
    const isDouble = item.isDiscontinuity || doubleBarCols.has(col);

    if (isDouble) {
      // ĐIỂM TIỆM CẬN / BẤT LIÊN TỤC VẠCH ĐÔI
      // Bên trái vạch đôi
      const leftY = (item.leftPos || item.pos).includes('+') ? highY : lowY;
      const leftText = item.leftVal || item.val || '-\\infty';
      variationElements += `<text x="${x - 22}" y="${leftY + 5}" fill="#0f172a" font-size="15.5" font-weight="bold" text-anchor="middle" font-family="KaTeX_Main, serif">${cleanLatexSymbol(leftText)}</text>`;

      // Bên phải vạch đôi
      const rightY = (item.rightPos || '+').includes('+') ? highY : lowY;
      const rightText = item.rightVal || '+\\infty';
      variationElements += `<text x="${x + 22}" y="${rightY + 5}" fill="#0f172a" font-size="15.5" font-weight="bold" text-anchor="middle" font-family="KaTeX_Main, serif">${cleanLatexSymbol(rightText)}</text>`;
    } else {
      // ĐIỂM CỰC TRỊ / ĐIỂM BÌNH THƯỜNG
      const y = item.pos.includes('+') ? highY : lowY;
      variationElements += `<text x="${x}" y="${y + 5}" fill="#0f172a" font-size="15.5" font-weight="bold" text-anchor="middle" font-family="KaTeX_Main, serif">${cleanLatexSymbol(item.val)}</text>`;
    }
  }

  // Vẽ các mũi tên kết nối các khoảng (KHÔNG BAO GIỜ BĂNG QUA VẠCH ĐÔI)
  for (let col = 0; col < xVals.length - 1; col++) {
    const cur = variations[col];
    const next = variations[col + 1];
    if (!cur || !next) continue;

    const curIsDouble = cur.isDiscontinuity || doubleBarCols.has(col);
    const nextIsDouble = next.isDiscontinuity || doubleBarCols.has(col + 1);

    // Tọa độ bắt đầu
    let startX = xCoords[col];
    let startY = lowY;
    if (curIsDouble) {
      startX = xCoords[col] + 22;
      startY = (cur.rightPos || '+').includes('+') ? highY : lowY;
    } else {
      startY = cur.pos.includes('+') ? highY : lowY;
    }

    // Tọa độ kết thúc
    let endX = xCoords[col + 1];
    let endY = lowY;
    if (nextIsDouble) {
      endX = xCoords[col + 1] - 22;
      endY = (next.leftPos || next.pos).includes('+') ? highY : lowY;
    } else {
      endY = next.pos.includes('+') ? highY : lowY;
    }

    const isStartHigh = startY === highY;
    const isEndHigh = endY === highY;

    // Khoảng cách an toàn để mũi tên không đè lên chữ số
    const arrowStartX = startX + 18;
    const arrowEndX = endX - 18;
    const arrowStartY = isStartHigh ? startY + 10 : startY - 10;
    const arrowEndY = isEndHigh ? endY + 10 : endY - 10;

    variationElements += `<line x1="${arrowStartX}" y1="${arrowStartY}" x2="${arrowEndX}" y2="${arrowEndY}" stroke="#2563eb" stroke-width="2.5" marker-end="url(#${markerId})" stroke-linecap="round" />`;
  }

  // Các điểm trên hàng x
  let xPointsElements = '';
  for (let i = 0; i < xVals.length; i++) {
    const xPos = xCoords[i];
    xPointsElements += `<text x="${xPos}" y="${row1Y + 28}" fill="#0f172a" font-size="15.5" font-weight="bold" text-anchor="middle" font-family="KaTeX_Main, serif">${cleanLatexSymbol(xVals[i])}</text>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW} ${totalH}" class="w-full max-w-2xl mx-auto my-4 bg-white rounded-2xl shadow-sm border border-slate-200 select-none"><defs><marker id="${markerId}" viewBox="0 0 10 10" refX="6.5" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse"><path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#2563eb" /></marker></defs><rect x="0" y="0" width="${totalW}" height="${totalH}" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.2" rx="12" /><line x1="${headerW}" y1="0" x2="${headerW}" y2="${totalH}" stroke="#94a3b8" stroke-width="1.4" /><line x1="0" y1="${row2Y}" x2="${totalW}" y2="${row2Y}" stroke="#cbd5e1" stroke-width="1.2" /><line x1="0" y1="${row3Y}" x2="${totalW}" y2="${row3Y}" stroke="#cbd5e1" stroke-width="1.2" /><text x="${headerW / 2}" y="${row1Y + 29}" fill="#1e293b" font-size="16" font-style="italic" font-weight="bold" text-anchor="middle" font-family="KaTeX_Math, serif">${rowLabelX}</text><text x="${headerW / 2}" y="${row2Y + 29}" fill="#1e293b" font-size="16" font-style="italic" font-weight="bold" text-anchor="middle" font-family="KaTeX_Math, serif">${rowLabelYPrime}</text><text x="${headerW / 2}" y="${row3Y + row3H / 2 + 6}" fill="#1e293b" font-size="16" font-style="italic" font-weight="bold" text-anchor="middle" font-family="KaTeX_Math, serif">${rowLabelY}</text>${doubleBarLines}${xPointsElements}${signsElements}${variationElements}</svg>`;
}
