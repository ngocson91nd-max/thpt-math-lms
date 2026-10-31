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

function replaceNestedFractions(s: string): string {
  let res = s;
  const fracRegex = /\\d?frac\s*\{/;
  let match;
  let safety = 0;
  while ((match = res.match(fracRegex)) !== null && safety < 10) {
    safety++;
    const numStart = match.index! + match[0].length;
    let depth = 1;
    let i = numStart;
    while (i < res.length && depth > 0) {
      if (res[i] === '{') depth++;
      else if (res[i] === '}') depth--;
      i++;
    }
    if (depth !== 0) break;
    const num = res.slice(numStart, i - 1);

    const rest = res.slice(i);
    const denMatch = rest.match(/^\s*\{/);
    if (!denMatch) {
      res = res.slice(0, match.index!) + replaceNestedFractions(num) + res.slice(i);
      break;
    }
    const denStart = i + denMatch[0].length;
    depth = 1;
    let j = denStart;
    while (j < res.length && depth > 0) {
      if (res[j] === '{') depth++;
      else if (res[j] === '}') depth--;
      j++;
    }
    if (depth !== 0) break;
    const den = res.slice(denStart, j - 1);

    const before = res.slice(0, match.index!);
    const after = res.slice(j);
    res = before + `${replaceNestedFractions(num)}/${replaceNestedFractions(den)}` + after;
  }
  return res
    .replace(/\\d?frac\s*([0-9a-zA-Z])\s+([0-9a-zA-Z])/g, '$1/$2')
    .replace(/\\d?frac\s*/g, '');
}

export function cleanLatexSymbol(s: string): string {
  if (!s) return '';
  let str = s
    .replace(/\\limits/g, '')
    .replace(/\\left/g, '')
    .replace(/\\right/g, '')
    .replace(/\\infty/g, '∞');

  str = replaceNestedFractions(str);

  str = str
    .replace(/\\ln/g, 'ln ')
    .replace(/\\log/g, 'log ')
    .replace(/\\exp/g, 'e^')
    .replace(/\\sqrt\[3\]\{([^}]+)\}/g, '∛$1')
    .replace(/\\sqrt\{([^}]+)\}/g, '√$1')
    .replace(/\\cdot/g, '·')
    .replace(/\\pm/g, '±')
    .replace(/\\mp/g, '∓')
    .replace(/\\pi/g, 'π')
    .replace(/\\prime/g, '′')
    .replace(/'/g, '′')
    .replace(/\^2/g, '²')
    .replace(/\^3/g, '³')
    .replace(/_\{([0-9])\}/g, (_m, d) => ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'][parseInt(d, 10)] || d)
    .replace(/_([0-9])/g, (_m, d) => ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'][parseInt(d, 10)] || d)
    .replace(/\{/g, '')
    .replace(/\}/g, '')
    .replace(/[\$]/g, '')
    .trim();

  // Escape XML entities
  str = str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return str;
}

function splitByTopLevelComma(text: string): string[] {
  const result: string[] = [];
  let current = '';
  let braceDepth = 0;
  let inDollar = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '$') {
      inDollar = !inDollar;
      current += char;
    } else if (char === '{' && !inDollar) {
      braceDepth++;
      current += char;
    } else if (char === '}' && !inDollar) {
      braceDepth = Math.max(0, braceDepth - 1);
      current += char;
    } else if (char === ',' && braceDepth === 0 && !inDollar) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) {
    result.push(current.trim());
  }
  return result;
}

function extractBalancedBraces(text: string, startIndex: number): { content: string; endIndex: number } | null {
  const openIdx = text.indexOf('{', startIndex);
  if (openIdx === -1) return null;

  let depth = 1;
  let i = openIdx + 1;
  while (i < text.length && depth > 0) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') depth--;
    i++;
  }

  if (depth !== 0) return null;
  return {
    content: text.slice(openIdx + 1, i - 1),
    endIndex: i,
  };
}

export function parseTkzTabCode(code: string): TkzTabParsed | null {
  // Tìm lệnh \tkzTabInit
  const initIdx = code.indexOf('\\tkzTabInit');
  if (initIdx === -1) return null;

  // Bỏ qua phần tùy chọn [nocadre=false, ...] nếu có
  let searchIdx = initIdx + '\\tkzTabInit'.length;
  const bracketIdx = code.indexOf('[', searchIdx);
  const nextOpenBrace = code.indexOf('{', searchIdx);
  if (bracketIdx !== -1 && bracketIdx < nextOpenBrace) {
    const bracketEnd = code.indexOf(']', bracketIdx);
    if (bracketEnd !== -1) {
      searchIdx = bracketEnd + 1;
    }
  }

  // 1. Phân tích tiêu đề các hàng (arg 1)
  const arg1 = extractBalancedBraces(code, searchIdx);
  if (!arg1) return null;
  const rows = splitByTopLevelComma(arg1.content)
    .map((r) => r.split('/')[0].replace(/[\$]/g, '').trim())
    .filter(Boolean);

  // 2. Phân tích các điểm mốc trên trục x (arg 2)
  const arg2 = extractBalancedBraces(code, arg1.endIndex);
  if (!arg2) return null;
  const xVals = splitByTopLevelComma(arg2.content)
    .map((v) => v.replace(/[\$]/g, '').trim())
    .filter(Boolean);

  // 3. Phân tích các dấu trong hàng y' (VD: ,-,d,-,0,+,)
  let signs: string[] = [];
  const lineIdx = code.indexOf('\\tkzTabLine');
  if (lineIdx !== -1) {
    const lineArg = extractBalancedBraces(code, lineIdx + '\\tkzTabLine'.length);
    if (lineArg) {
      let rawTokens = lineArg.content.split(',').map((s) => s.trim());
      if (rawTokens.length > 0 && rawTokens[0] === '') rawTokens.shift();
      if (rawTokens.length > 0 && rawTokens[rawTokens.length - 1] === '') rawTokens.pop();
      signs = rawTokens;
    }
  }

  // 4. Phân tích các chiều biến thiên trong hàng y (tkzTabVar)
  let variations: TkzTabParsedItem[] = [];
  const varIdx = code.indexOf('\\tkzTabVar');
  if (varIdx !== -1) {
    const varArg = extractBalancedBraces(code, varIdx + '\\tkzTabVar'.length);
    if (varArg) {
      const rawItems = splitByTopLevelComma(varArg.content).filter(Boolean);

      for (let idx = 0; idx < rawItems.length; idx++) {
        const item = rawItems[idx];
        const firstSlash = item.indexOf('/');
        const rawPos = (firstSlash >= 0 ? item.slice(0, firstSlash) : item).trim().toUpperCase() || '-';
        const restContent = firstSlash >= 0 ? item.slice(firstSlash + 1).trim() : '';

        // Kiểm tra xem mục này có chứa vạch kép / tiệm cận đứng (-D+, +D-, -D-, +D+, -D, +D, D) không
        if (rawPos.includes('D')) {
          let leftPos = rawPos.includes('+') && rawPos.indexOf('+') < rawPos.indexOf('D') ? '+' : '-';
          let rightPos = rawPos.endsWith('+') || (rawPos.includes('+') && rawPos.indexOf('+') > rawPos.indexOf('D')) ? '+' : '-';

          // Tách 2 giá trị theo dấu / ngoài ngoặc nhọn
          let leftVal = '';
          let rightVal = '';
          let depth = 0;
          let sepIdx = -1;
          for (let c = 0; c < restContent.length; c++) {
            if (restContent[c] === '{') depth++;
            else if (restContent[c] === '}') depth = Math.max(0, depth - 1);
            else if (restContent[c] === '/' && depth === 0) {
              sepIdx = c;
              break;
            }
          }

          if (sepIdx >= 0) {
            leftVal = restContent.slice(0, sepIdx).replace(/[\$]/g, '').trim();
            rightVal = restContent.slice(sepIdx + 1).replace(/[\$]/g, '').trim();
          } else {
            leftVal = restContent.replace(/[\$]/g, '').trim();
          }

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
          const val = restContent.replace(/[\$]/g, '').trim();
          variations.push({ pos, val, isDiscontinuity: false });
        }
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

  const headerW = 105;
  const colCount = Math.max(xVals.length - 1, 1);
  const colW = Math.max(140, Math.floor(660 / colCount));
  const totalW = headerW + colCount * colW + 40;

  // Nâng chiều cao các hàng để bảng to rõ, thoáng đạt, font lớn.
  // Tự động ẩn hàng 3 nếu chỉ là Bảng xét dấu đạo hàm (không có \tkzTabVar)
  const hasRow3 = variations.length > 0;
  const row1H = 50;
  const row2H = 50;
  const row3H = hasRow3 ? 150 : 0;
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
        signsElements += `<text x="${sx}" y="${sy}" fill="${color}" font-size="18" font-weight="bold" text-anchor="middle" font-family="KaTeX_Main, 'Cambria Math', 'Times New Roman', Times, STIXGeneral, serif">${cleanLatexSymbol(s)}</text>`;
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
      variationElements += `<text x="${x - 24}" y="${leftY + 6}" fill="#0f172a" font-size="16.5" font-weight="bold" text-anchor="middle" font-family="KaTeX_Main, 'Cambria Math', 'Times New Roman', Times, STIXGeneral, serif">${cleanLatexSymbol(leftText)}</text>`;

      // Bên phải vạch đôi
      const rightY = (item.rightPos || '+').includes('+') ? highY : lowY;
      const rightText = item.rightVal || '+\\infty';
      variationElements += `<text x="${x + 24}" y="${rightY + 6}" fill="#0f172a" font-size="16.5" font-weight="bold" text-anchor="middle" font-family="KaTeX_Main, 'Cambria Math', 'Times New Roman', Times, STIXGeneral, serif">${cleanLatexSymbol(rightText)}</text>`;
    } else {
      // ĐIỂM CỰC TRỊ / ĐIỂM BÌNH THƯỜNG
      const y = item.pos.includes('+') ? highY : lowY;
      variationElements += `<text x="${x}" y="${y + 6}" fill="#0f172a" font-size="16.5" font-weight="bold" text-anchor="middle" font-family="KaTeX_Main, 'Cambria Math', 'Times New Roman', Times, STIXGeneral, serif">${cleanLatexSymbol(item.val)}</text>`;
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
      startX = xCoords[col] + 24;
      startY = (cur.rightPos || '+').includes('+') ? highY : lowY;
    } else {
      startY = cur.pos.includes('+') ? highY : lowY;
    }

    // Tọa độ kết thúc
    let endX = xCoords[col + 1];
    let endY = lowY;
    if (nextIsDouble) {
      endX = xCoords[col + 1] - 24;
      endY = (next.leftPos || next.pos).includes('+') ? highY : lowY;
    } else {
      endY = next.pos.includes('+') ? highY : lowY;
    }

    const isStartHigh = startY === highY;
    const isEndHigh = endY === highY;

    // Khoảng cách an toàn để mũi tên không đè lên chữ số
    const arrowStartX = startX + 22;
    const arrowEndX = endX - 22;
    const arrowStartY = isStartHigh ? startY + 14 : startY - 14;
    const arrowEndY = isEndHigh ? endY + 14 : endY - 14;

    variationElements += `<line x1="${arrowStartX}" y1="${arrowStartY}" x2="${arrowEndX}" y2="${arrowEndY}" stroke="#2563eb" stroke-width="2.2" marker-end="url(#${markerId})" stroke-linecap="round" />`;
  }

  // Các điểm trên hàng x
  let xPointsElements = '';
  for (let i = 0; i < xVals.length; i++) {
    const xPos = xCoords[i];
    xPointsElements += `<text x="${xPos}" y="${row1Y + 31}" fill="#0f172a" font-size="17" font-weight="bold" text-anchor="middle" font-family="KaTeX_Main, 'Cambria Math', 'Times New Roman', Times, STIXGeneral, serif">${cleanLatexSymbol(xVals[i])}</text>`;
  }

  const row3Line = hasRow3 ? `<line x1="0" y1="${row3Y}" x2="${totalW}" y2="${row3Y}" stroke="#cbd5e1" stroke-width="1.2" />` : '';
  const row3Label = hasRow3 ? `<text x="${headerW / 2}" y="${row3Y + row3H / 2 + 7}" fill="#1e293b" font-size="18" font-style="italic" font-weight="bold" text-anchor="middle" font-family="KaTeX_Math, 'Cambria Math', 'Times New Roman', Times, STIXGeneral, serif">${rowLabelY}</text>` : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW} ${totalH}" class="w-full max-w-3xl lg:max-w-4xl mx-auto my-3 bg-white rounded-2xl shadow-xs border border-slate-300 select-none" style="max-width: 100%; height: auto; display: block;"><defs><marker id="${markerId}" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="7" markerHeight="7" orient="auto"><path d="M 1 2.5 L 11 6 L 1 9.5 L 3.2 6 z" fill="#2563eb" /></marker></defs><rect x="0" y="0" width="${totalW}" height="${totalH}" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.2" rx="12" /><line x1="${headerW}" y1="0" x2="${headerW}" y2="${totalH}" stroke="#94a3b8" stroke-width="1.4" /><line x1="0" y1="${row2Y}" x2="${totalW}" y2="${row2Y}" stroke="#cbd5e1" stroke-width="1.2" />${row3Line}<text x="${headerW / 2}" y="${row1Y + 32}" fill="#1e293b" font-size="18" font-style="italic" font-weight="bold" text-anchor="middle" font-family="KaTeX_Math, 'Cambria Math', 'Times New Roman', Times, STIXGeneral, serif">${rowLabelX}</text><text x="${headerW / 2}" y="${row2Y + 32}" fill="#1e293b" font-size="18" font-style="italic" font-weight="bold" text-anchor="middle" font-family="KaTeX_Math, 'Cambria Math', 'Times New Roman', Times, STIXGeneral, serif">${rowLabelYPrime}</text>${row3Label}${doubleBarLines}${xPointsElements}${signsElements}${variationElements}</svg>`;
}
