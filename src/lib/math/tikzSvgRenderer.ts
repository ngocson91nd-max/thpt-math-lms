/**
 * Pure TypeScript TikZ to SVG Renderer
 * Biên dịch trực tiếp mã nguồn TikZ (đồ thị hàm số THPT, hình học không gian, lưới tọa độ, trục số) sang SVG thuần túy trong 0.1ms.
 * Không phụ thuộc WebAssembly, không cần tải CDN, chạy mượt mà trên mọi thiết bị và trình duyệt.
 */

interface Point2D {
  x: number;
  y: number;
}

interface DefMap {
  [key: string]: number | string;
}

interface CoordMap {
  [key: string]: Point2D;
}

interface DrawItem {
  type: 'line' | 'grid' | 'plot' | 'point' | 'node';
  p1?: Point2D;
  p2?: Point2D;
  pt?: Point2D;
  text?: string;
  pos?: string;
  radius?: number;
  isArrow?: boolean;
  isDashed?: boolean;
  isThick?: boolean;
  expr?: string;
  startX?: number;
  endX?: number;
  color?: string;
}

function parseNumber(str: string, defs: DefMap = {}): number {
  let s = str.trim();
  for (const [k, v] of Object.entries(defs)) {
    s = s.replace(new RegExp(`\\\\${k}\\b`, 'g'), String(v));
  }
  s = s.replace(/pt|cm|mm/g, '');
  try {
    const val = Function(`"use strict"; return (${s});`)();
    return typeof val === 'number' && !isNaN(val) && isFinite(val) ? val : 0;
  } catch {
    return 0;
  }
}

function parsePoint(coordStr: string, coords: CoordMap = {}, defs: DefMap = {}): Point2D {
  let s = coordStr.trim();
  if (s.startsWith('(') && s.endsWith(')')) {
    s = s.slice(1, -1).trim();
  }

  // Tọa độ đã đặt tên e.g. "A", "S", "H"
  if (coords[s]) {
    return { ...coords[s] };
  }

  // Cú pháp nội suy hoặc vector calc e.g. "$(B)+(D)-(A)$" hoặc "$(A)!0.5!(B)$"
  if (s.startsWith('$') && s.endsWith('$')) {
    s = s.slice(1, -1).trim();
    const interpMatch = s.match(/^\(([^)]+)\)\s*!\s*([0-9.]+)\s*!\s*\(([^)]+)\)$/);
    if (interpMatch) {
      const p1 = coords[interpMatch[1]] || { x: 0, y: 0 };
      const ratio = parseFloat(interpMatch[2]);
      const p2 = coords[interpMatch[3]] || { x: 0, y: 0 };
      return {
        x: p1.x + ratio * (p2.x - p1.x),
        y: p1.y + ratio * (p2.y - p1.y),
      };
    }

    const parts = s.match(/([+-]?)\s*\(([^)]+)\)/g);
    if (parts) {
      let x = 0, y = 0;
      for (const part of parts) {
        const sign = part.trim().startsWith('-') ? -1 : 1;
        const name = part.replace(/[+-]/g, '').trim().slice(1, -1);
        const pt = coords[name] || { x: 0, y: 0 };
        x += sign * pt.x;
        y += sign * pt.y;
      }
      return { x, y };
    }
  }

  // Tọa độ thường (x, y)
  const commaIdx = s.indexOf(',');
  if (commaIdx !== -1) {
    const xPart = s.substring(0, commaIdx);
    const yPart = s.substring(commaIdx + 1);
    return {
      x: parseNumber(xPart, defs),
      y: parseNumber(yPart, defs),
    };
  }

  return { x: 0, y: 0 };
}

function evalPlotExpr(expr: string, xVal: number, defs: DefMap = {}): number | null {
  let clean = expr;
  for (const [k, v] of Object.entries(defs)) {
    clean = clean.replace(new RegExp(`\\\\${k}\\b`, 'g'), String(v));
  }

  // Thay thế các hàm toán học trước để không bị dính chữ x
  clean = clean
    .replace(/\^/g, '**')
    .replace(/exp\(/g, 'Math.exp(')
    .replace(/ln\(/g, 'Math.log(')
    .replace(/log10\(/g, 'Math.log10(')
    .replace(/sin\(([^)]+)\s+r\)/g, 'Math.sin($1)')
    .replace(/sin\(/g, 'Math.sin(')
    .replace(/cos\(([^)]+)\s+r\)/g, 'Math.cos($1)')
    .replace(/cos\(/g, 'Math.cos(')
    .replace(/tan\(/g, 'Math.tan(')
    .replace(/sqrt\(/g, 'Math.sqrt(')
    .replace(/abs\(/g, 'Math.abs(');

  // Thay thế biến \x, {\x} và x độc lập
  clean = clean
    .replace(/\{\s*\\x\s*\}/g, `(${xVal})`)
    .replace(/\\x\b/g, `(${xVal})`)
    .replace(/(?<![a-zA-Z_])x(?![a-zA-Z_])/g, `(${xVal})`);

  try {
    const val = Function(`"use strict"; return (${clean});`)();
    return typeof val === 'number' && !isNaN(val) && isFinite(val) ? val : null;
  } catch {
    return null;
  }
}

/**
 * Phân tích và tạo SVG hoàn chỉnh từ mã TikZ
 */
export function renderTikzToSvg(rawTikz: string): string | null {
  if (!rawTikz || !rawTikz.includes('\\begin{tikzpicture}')) {
    return null;
  }

  const defs: DefMap = {};
  const coords: CoordMap = {};
  const drawItems: DrawItem[] = [];

  // 1. Phân tích tham số quy mô \begin{tikzpicture}[scale=...]
  let globalScale = 1;
  const scaleMatch = rawTikz.match(/\[[^\]]*scale\s*=\s*([0-9.]+)[^\]]*\]/);
  if (scaleMatch) {
    globalScale = parseFloat(scaleMatch[1]) || 1;
  }

  // 2. Phân tích các định nghĩa biến: \def\xmin{-4.2}
  const defRegex = /\\def\\([a-zA-Z]+)\{([^}]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = defRegex.exec(rawTikz)) !== null) {
    defs[m[1]] = parseFloat(m[2]) || m[2];
  }

  let minX = typeof defs.xmin === 'number' ? (defs.xmin as number) : Infinity;
  let maxX = typeof defs.xmax === 'number' ? (defs.xmax as number) : -Infinity;
  let minY = typeof defs.ymin === 'number' ? (defs.ymin as number) : Infinity;
  let maxY = typeof defs.ymax === 'number' ? (defs.ymax as number) : -Infinity;

  const updateBounds = (x: number, y: number) => {
    if (isNaN(x) || isNaN(y) || !isFinite(x) || !isFinite(y)) return;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  };

  // 3. Phân tích tọa độ: \coordinate (A) at (x, y);
  const coordRegex = /\\coordinate\s*\(([^)]+)\)\s*at\s*(\([^;]+\));/g;
  while ((m = coordRegex.exec(rawTikz)) !== null) {
    const name = m[1].trim();
    const pt = parsePoint(m[2], coords, defs);
    coords[name] = pt;
    updateBounds(pt.x, pt.y);
  }

  // 4. Phân tích lưới tọa độ: \draw[thick] (0,0) grid (5,5);
  const gridRegex = /\\draw(?:\[[^\]]*\])?\s*\(([^)]+)\)\s*grid\s*\(([^)]+)\);/g;
  while ((m = gridRegex.exec(rawTikz)) !== null) {
    const p1 = parsePoint(m[1], coords, defs);
    const p2 = parsePoint(m[2], coords, defs);
    drawItems.push({ type: 'grid', p1, p2 });
    updateBounds(p1.x, p1.y);
    updateBounds(p2.x, p2.y);
  }

  // 5. PHÂN TÍCH HÀM SỐ ĐỒ THỊ (HỖ TRỢ CẢ GEOGEBRA & LATEX CHUẨN)
  // Quét chính xác câu lệnh \draw ... plot ...
  const plotPositions: { start: number; end: number }[] = [];
  let plotIdx = rawTikz.indexOf('plot');
  while (plotIdx !== -1) {
    const drawIdx = rawTikz.lastIndexOf('\\draw', plotIdx);
    let opts = '';
    if (drawIdx !== -1) {
      const between = rawTikz.substring(drawIdx + 5, plotIdx).trim();
      const optMatch = between.match(/^\[([^\]]*)\]/);
      if (optMatch) {
        opts = optMatch[1];
      }
    }

    const openParen = rawTikz.indexOf('(', plotIdx);
    if (openParen !== -1 && openParen - plotIdx < 12) {
      // Tìm dấu phẩy phân cách x và y
      let commaIdx = -1;
      let depth = 0;
      for (let i = openParen + 1; i < rawTikz.length; i++) {
        if (rawTikz[i] === '(' || rawTikz[i] === '{') depth++;
        else if (rawTikz[i] === ')' || rawTikz[i] === '}') depth--;
        else if (rawTikz[i] === ',' && depth === 0) {
          commaIdx = i;
          break;
        }
      }

      if (commaIdx !== -1) {
        // Tìm điểm đóng ngoặc của plot(...)
        let endParen = -1;
        depth = 0;
        for (let i = commaIdx + 1; i < rawTikz.length; i++) {
          if (rawTikz[i] === '(' || rawTikz[i] === '{') depth++;
          else if (rawTikz[i] === ')' || rawTikz[i] === '}') {
            if (depth === 0) {
              endParen = i;
              break;
            }
            depth--;
          }
        }

        if (endParen !== -1) {
          // Tìm dấu chấm phẩy kết thúc câu lệnh
          const semiIdx = rawTikz.indexOf(';', endParen);
          const stmtEnd = semiIdx !== -1 ? semiIdx + 1 : endParen + 1;

          let expr = rawTikz.substring(commaIdx + 1, endParen).trim();
          if (expr.startsWith('{') && expr.endsWith('}')) {
            expr = expr.slice(1, -1).trim();
          }

          let startX = -3.5, endX = 3.5;
          const domainMatch = opts.match(/domain=([^:]+):([^,\]]+)/);
          if (domainMatch) {
            startX = parseNumber(domainMatch[1], defs);
            endX = parseNumber(domainMatch[2], defs);
          }

          const isDashed = opts.includes('dashed');
          const color = opts.includes('blue') ? '#2563eb' : opts.includes('red') ? '#ef4444' : '#1e293b';

          drawItems.push({ type: 'plot', expr, startX, endX, isDashed, color });
          updateBounds(startX, 0);
          updateBounds(endX, 0);

          plotPositions.push({ start: drawIdx !== -1 ? drawIdx : plotIdx, end: stmtEnd });
        }
      }
    }

    plotIdx = rawTikz.indexOf('plot', plotIdx + 4);
  }

  // Tạo chuỗi đã bóc bỏ các câu lệnh plot, grid, coordinate để phân tích đường thẳng và node
  let cleanLines = rawTikz.replace(gridRegex, '').replace(coordRegex, '');
  // Xóa các khối plot ngược từ cuối lên đầu
  for (let i = plotPositions.length - 1; i >= 0; i--) {
    const { start, end } = plotPositions[i];
    cleanLines = cleanLines.substring(0, start) + cleanLines.substring(end);
  }

  // 6. PHÂN TÍCH NHÃN VĂN BẢN \node (HỖ TRỢ CẢ \node[pos] at ... VÀ \node at ... [pos])
  const nodeStmtRegex = /\\node\s*(?:\[([^\]]*)\])?\s*at\s*(\([^)]+\))\s*(?:\[([^\]]*)\])?\s*\{([^}]*)\};/g;
  while ((m = nodeStmtRegex.exec(cleanLines)) !== null) {
    const pos = (m[1] || m[3] || '').trim();
    const pt = parsePoint(m[2], coords, defs);
    let text = m[4].replace(/\$/g, '').trim();
    text = text
      .replace(/\\alpha/g, 'α')
      .replace(/\\beta/g, 'β')
      .replace(/\\pi/g, 'π')
      .replace(/\\infty/g, '∞')
      .replace(/\\Delta/g, 'Δ');
    drawItems.push({ type: 'node', pt, text, pos });
    updateBounds(pt.x, pt.y);
  }

  // Bắt nhãn node inline trong câu lệnh \draw: \draw[->] (...) -- (x, y) node[pos] {$x$};
  const inlineNodeRegex = /\\draw[^(;]*\([^;]+node\s*(?:\[([^\]]*)\])?\s*\{([^}]*)\}\s*;/g;
  while ((m = inlineNodeRegex.exec(cleanLines)) !== null) {
    const pos = (m[1] || '').trim();
    let text = m[2].replace(/\$/g, '').trim();
    const pts = m[0].match(/\([^)]+\)/g);
    if (pts && pts.length > 0) {
      const lastPt = parsePoint(pts[pts.length - 1], coords, defs);
      drawItems.push({ type: 'node', pt: lastPt, text, pos });
      updateBounds(lastPt.x, lastPt.y);
    }
  }

  // 7. PHÂN TÍCH ĐOẠN THẲNG & MŨI TÊN: \draw[options] (A) -- (B) ... ;
  const cleanLineOnly = cleanLines.replace(nodeStmtRegex, '');
  const lineStmtRegex = /\\draw(\[[^\]]*\])?\s*([^(;]*\([^;]+);/g;
  while ((m = lineStmtRegex.exec(cleanLineOnly)) !== null) {
    const opts = m[1] || '';
    const body = m[2];
    const isArrow = opts.includes('->') || opts.includes('>=stealth') || opts.includes('[-stealth]');
    const isDashed = opts.includes('dashed');
    const isThick = opts.includes('thick');

    const ptMatches = body.match(/\([^)]+\)/g) || [];
    for (let i = 0; i < ptMatches.length - 1; i++) {
      const p1 = parsePoint(ptMatches[i], coords, defs);
      const p2 = parsePoint(ptMatches[i + 1], coords, defs);
      drawItems.push({
        type: 'line',
        p1,
        p2,
        isArrow: isArrow && (i === ptMatches.length - 2),
        isDashed,
        isThick,
      });
      updateBounds(p1.x, p1.y);
      updateBounds(p2.x, p2.y);
    }
  }

  // 8. Phân tích điểm đặc biệt: \fill (x,y) circle (r);
  const fillRegex = /\\fill(?:\[([^\]]*)\])?\s*(\([^)]+\))\s*circle\s*\(([^)]+)\);/g;
  while ((m = fillRegex.exec(rawTikz)) !== null) {
    const pt = parsePoint(m[2], coords, defs);
    drawItems.push({ type: 'point', pt, radius: 2.5 });
    updateBounds(pt.x, pt.y);
  }

  // 9. Phân tích vòng lặp vạch chia trục: \foreach \x in {...} \draw (\x, 2pt) -- (\x, -2pt);
  const foreachRegex = /\\foreach\s*\\([xy])\s*in\s*\{([^}]+)\}\s*\\draw\s*\([^)]+\)\s*--\s*\([^)]+\);/g;
  while ((m = foreachRegex.exec(rawTikz)) !== null) {
    const axis = m[1];
    const vals = m[2].split(',').map((v) => parseFloat(v.trim())).filter((v) => !isNaN(v));
    vals.forEach((v) => {
      if (axis === 'x') {
        drawItems.push({
          type: 'line',
          p1: { x: v, y: 0.1 },
          p2: { x: v, y: -0.1 },
          isThick: false,
        });
        updateBounds(v, 0);
      } else {
        drawItems.push({
          type: 'line',
          p1: { x: -0.1, y: v },
          p2: { x: 0.1, y: v },
          isThick: false,
        });
        updateBounds(0, v);
      }
    });
  }

  if (minX === Infinity || maxX === -Infinity || drawItems.length === 0) {
    return null;
  }

  // Thiết lập không gian SVG
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const marginX = Math.max(0.4, spanX * 0.12);
  const marginY = Math.max(0.4, spanY * 0.12);
  const boundMinX = minX - marginX;
  const boundMaxX = maxX + marginX;
  const boundMinY = minY - marginY;
  const boundMaxY = maxY + marginY;

  const width = Math.max(260, Math.round(300 * globalScale));
  const height = Math.min(320, Math.max(200, Math.round(width * (spanY / spanX))));
  const pad = 24;

  const toSvgX = (x: number) => pad + ((x - boundMinX) / (boundMaxX - boundMinX)) * (width - 2 * pad);
  const toSvgY = (y: number) => height - (pad + ((y - boundMinY) / (boundMaxY - boundMinY)) * (height - 2 * pad));

  const svgElements: string[] = [];

  // Mũi tên trục tọa độ sắc nét
  svgElements.push(`
    <defs>
      <marker id="tikz-arrow-pure" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#334155" />
      </marker>
    </defs>
  `);

  // Render các thành phần
  for (const item of drawItems) {
    if (item.type === 'line' && item.p1 && item.p2) {
      const x1 = toSvgX(item.p1.x).toFixed(1);
      const y1 = toSvgY(item.p1.y).toFixed(1);
      const x2 = toSvgX(item.p2.x).toFixed(1);
      const y2 = toSvgY(item.p2.y).toFixed(1);
      const stroke = item.isArrow ? '#334155' : item.isDashed ? '#64748b' : '#1e293b';
      const strokeWidth = item.isThick ? '1.8' : '1.3';
      const dash = item.isDashed ? 'stroke-dasharray="4,4"' : '';
      const marker = item.isArrow ? 'marker-end="url(#tikz-arrow-pure)"' : '';
      svgElements.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${strokeWidth}" ${dash} ${marker} stroke-linecap="round" />`);
    } else if (item.type === 'grid' && item.p1 && item.p2) {
      const x1 = Math.min(item.p1.x, item.p2.x);
      const x2 = Math.max(item.p1.x, item.p2.x);
      const y1 = Math.min(item.p1.y, item.p2.y);
      const y2 = Math.max(item.p1.y, item.p2.y);
      for (let x = x1; x <= x2; x++) {
        svgElements.push(`<line x1="${toSvgX(x).toFixed(1)}" y1="${toSvgY(y1).toFixed(1)}" x2="${toSvgX(x).toFixed(1)}" y2="${toSvgY(y2).toFixed(1)}" stroke="#e2e8f0" stroke-width="1" />`);
      }
      for (let y = y1; y <= y2; y++) {
        svgElements.push(`<line x1="${toSvgX(x1).toFixed(1)}" y1="${toSvgY(y).toFixed(1)}" x2="${toSvgX(x2).toFixed(1)}" y2="${toSvgY(y).toFixed(1)}" stroke="#e2e8f0" stroke-width="1" />`);
      }
    } else if (item.type === 'plot' && item.expr !== undefined && item.startX !== undefined && item.endX !== undefined) {
      const steps = 80;
      const dx = (item.endX - item.startX) / steps;
      let pathD = '';
      let isDrawing = false;
      let prevY: number | null = null;

      for (let i = 0; i <= steps; i++) {
        const x = item.startX + i * dx;
        const y = evalPlotExpr(item.expr, x, defs);
        // Ngắt nét khi qua tiệm cận đứng (nhảy đột ngột giá trị)
        const isDiscontinuous = prevY !== null && y !== null && Math.abs(y - prevY) > spanY * 1.5;

        if (y !== null && isFinite(y) && y >= boundMinY - spanY * 2 && y <= boundMaxY + spanY * 2 && !isDiscontinuous) {
          const sx = toSvgX(x).toFixed(1);
          const sy = toSvgY(y).toFixed(1);
          if (!isDrawing) {
            pathD += ` M ${sx} ${sy}`;
            isDrawing = true;
          } else {
            pathD += ` L ${sx} ${sy}`;
          }
        } else {
          isDrawing = false;
        }
        prevY = y;
      }

      if (pathD) {
        svgElements.push(`<path d="${pathD}" fill="none" stroke="${item.color || '#2563eb'}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />`);
      }
    } else if (item.type === 'point' && item.pt) {
      const cx = toSvgX(item.pt.x).toFixed(1);
      const cy = toSvgY(item.pt.y).toFixed(1);
      svgElements.push(`<circle cx="${cx}" cy="${cy}" r="${item.radius || 2.5}" fill="#0f172a" />`);
    } else if (item.type === 'node' && item.pt && item.text) {
      const cx = toSvgX(item.pt.x);
      const cy = toSvgY(item.pt.y);
      let dx = 0, dy = 0;
      let anchor = 'middle';
      const pos = item.pos || '';
      
      const isBelow = pos.includes('below');
      const isAbove = pos.includes('above');
      const isLeft = pos.includes('left');
      const isRight = pos.includes('right');

      if (isBelow && isLeft) {
        dx = -8; dy = 14; anchor = 'end';
      } else if (isBelow && isRight) {
        dx = 8; dy = 14; anchor = 'start';
      } else if (isAbove && isLeft) {
        dx = -8; dy = -8; anchor = 'end';
      } else if (isAbove && isRight) {
        dx = 8; dy = -8; anchor = 'start';
      } else if (isBelow) {
        dy = 14; anchor = 'middle';
      } else if (isAbove) {
        dy = -8; anchor = 'middle';
      } else if (isLeft) {
        dx = -9; dy = 4; anchor = 'end';
      } else if (isRight) {
        dx = 9; dy = 4; anchor = 'start';
      } else {
        dy = 4; anchor = 'middle';
      }

      svgElements.push(`<text x="${(cx + dx).toFixed(1)}" y="${(cy + dy).toFixed(1)}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12.5" font-style="italic" font-weight="bold" fill="#0f172a" paint-order="stroke fill" stroke="#ffffff" stroke-width="3.5" stroke-linejoin="round" text-anchor="${anchor}">${item.text}</text>`);
    }
  }

  return `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" class="tikz-svg-pure mx-auto block select-none my-1" style="max-width: 100%; height: auto; min-width: 240px; display: block;" xmlns="http://www.w3.org/2000/svg">${svgElements.join('\n')}</svg>`;
}
