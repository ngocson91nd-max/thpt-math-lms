/**
 * Pure TypeScript TikZ to SVG Renderer
 * Biên dịch trực tiếp mã nguồn TikZ (đồ thị hàm số, hình học, lưới tọa độ) sang SVG thuần túy trong 0.1ms.
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
  clean = clean
    .replace(/\\x/g, `(${xVal})`)
    .replace(/x/g, `(${xVal})`)
    .replace(/\^/g, '**')
    .replace(/exp\(/g, 'Math.exp(')
    .replace(/ln\(/g, 'Math.log(')
    .replace(/sin\(([^)]+) r\)/g, 'Math.sin($1)')
    .replace(/sin\(/g, 'Math.sin(')
    .replace(/cos\(([^)]+) r\)/g, 'Math.cos($1)')
    .replace(/cos\(/g, 'Math.cos(')
    .replace(/sqrt\(/g, 'Math.sqrt(')
    .replace(/abs\(/g, 'Math.abs(');

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

  // 5. Phân tích hàm số đồ thị: \draw[..., domain=a:b] plot (\x, {expr});
  const plotRegex = /\\draw\[([^\]]*)\]\s*plot\s*\(\\x,\s*\{([^}]+)\}\);/g;
  while ((m = plotRegex.exec(rawTikz)) !== null) {
    const opts = m[1];
    const expr = m[2];
    const domainMatch = opts.match(/domain=([^:]+):([^,\]]+)/);
    let startX = -3, endX = 3;
    if (domainMatch) {
      startX = parseNumber(domainMatch[1], defs);
      endX = parseNumber(domainMatch[2], defs);
    }
    const isDashed = opts.includes('dashed');
    const color = opts.includes('red') ? '#ef4444' : opts.includes('blue') ? '#2563eb' : '#1e293b';
    drawItems.push({ type: 'plot', expr, startX, endX, isDashed, color });
    updateBounds(startX, 0);
    updateBounds(endX, 0);
  }

  // 6. Phân tích đoạn thẳng & mũi tên: \draw[options] (A) -- (B) ... ;
  const cleanLines = rawTikz.replace(plotRegex, '').replace(gridRegex, '').replace(coordRegex, '');
  const lineStmtRegex = /\\draw(\[[^\]]*\])?\s*([^(;]*\([^;]+);/g;
  while ((m = lineStmtRegex.exec(cleanLines)) !== null) {
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

  // 7. Phân tích nhãn văn bản: \node[pos] at (x, y) {$text$};
  const nodeRegex = /\\node(?:\[([^\]]*)\])?\s*at\s*(\([^)]+\))\s*\{([^}]*)\};/g;
  while ((m = nodeRegex.exec(rawTikz)) !== null) {
    const pos = m[1] || '';
    const pt = parsePoint(m[2], coords, defs);
    let text = m[3].replace(/\$/g, '').trim();
    // Thay thế ký hiệu đặc biệt
    text = text
      .replace(/\\alpha/g, 'α')
      .replace(/\\beta/g, 'β')
      .replace(/\\pi/g, 'π')
      .replace(/\\infty/g, '∞')
      .replace(/\\Delta/g, 'Δ');
    drawItems.push({ type: 'node', pt, text, pos });
    updateBounds(pt.x, pt.y);
  }

  // 8. Phân tích điểm đặc biệt: \fill (x,y) circle (r);
  const fillRegex = /\\fill(?:\[([^\]]*)\])?\s*(\([^)]+\))\s*circle\s*\(([^)]+)\);/g;
  while ((m = fillRegex.exec(rawTikz)) !== null) {
    const pt = parsePoint(m[2], coords, defs);
    drawItems.push({ type: 'point', pt, radius: 2.5 });
    updateBounds(pt.x, pt.y);
  }

  // 9. Phân tích vòng lặp vạch dấu \foreach \x in {...} \draw (\x, 2pt) -- (\x, -2pt);
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
  const marginX = Math.max(0.4, spanX * 0.14);
  const marginY = Math.max(0.4, spanY * 0.14);
  const boundMinX = minX - marginX;
  const boundMaxX = maxX + marginX;
  const boundMinY = minY - marginY;
  const boundMaxY = maxY + marginY;

  const width = Math.round(280 * globalScale);
  const height = Math.min(320, Math.max(180, Math.round(width * (spanY / spanX))));
  const pad = 24;

  const toSvgX = (x: number) => pad + ((x - boundMinX) / (boundMaxX - boundMinX)) * (width - 2 * pad);
  const toSvgY = (y: number) => height - (pad + ((y - boundMinY) / (boundMaxY - boundMinY)) * (height - 2 * pad));

  const svgElements: string[] = [];

  // Mũi tên trục tọa độ
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
      const strokeWidth = item.isThick ? '1.8' : '1.2';
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
      const steps = 70;
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
        svgElements.push(`<path d="${pathD}" fill="none" stroke="${item.color || '#2563eb'}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />`);
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
      if (pos.includes('below')) dy = 14;
      if (pos.includes('above')) dy = -8;
      if (pos.includes('left')) { dx = -10; anchor = 'end'; }
      if (pos.includes('right')) { dx = 10; anchor = 'start'; }
      svgElements.push(`<text x="${(cx + dx).toFixed(1)}" y="${(cy + dy).toFixed(1)}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-style="italic" font-weight="bold" fill="#0f172a" text-anchor="${anchor}">${item.text}</text>`);
    }
  }

  return `<svg viewBox="0 0 ${width} ${height}" class="tikz-svg-pure mx-auto block max-w-full h-auto select-none my-1" style="max-height: 280px;" xmlns="http://www.w3.org/2000/svg">${svgElements.join('\n')}</svg>`;
}
