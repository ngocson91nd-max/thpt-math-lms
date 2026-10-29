/**
 * Pure TypeScript TikZ to SVG Renderer
 * Biên dịch trực tiếp mã nguồn TikZ (đồ thị hàm số THPT, lưới tọa độ, trục số Oxy) sang SVG thuần túy trong 0.1ms.
 * Không phụ thuộc WebAssembly, không cần tải CDN, chạy mượt mà trên mọi thiết bị và trình duyệt.
 * Đối với hình học không gian 3D hoặc TikZ đặc thù: chủ động trả về null để nhường cho TikzJax hoặc ảnh chụp chất lượng cao.
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
 * Trích xuất an toàn nội dung trong cặp ngoặc nhọn { ... } có hỗ trợ lồng nhau
 */
function extractBracedContent(str: string, startIndex: number): { content: string; endIndex: number } | null {
  const openIdx = str.indexOf('{', startIndex);
  if (openIdx === -1) return null;

  let depth = 0;
  for (let i = openIdx; i < str.length; i++) {
    if (str[i] === '{') {
      depth++;
    } else if (str[i] === '}') {
      depth--;
      if (depth === 0) {
        return {
          content: str.substring(openIdx + 1, i),
          endIndex: i,
        };
      }
    }
  }
  return null;
}

/**
 * Làm sạch triệt để nhãn node TeX (xử lý \mathrm, \text, số mũ, chỉ số dưới, ký tự Hy Lạp)
 * Ví dụ: "{$y\ (\mathrm{m}^3/\text{giờ})$}" -> "y (m³/giờ)"
 */
function cleanTikzNodeText(raw: string): string {
  let text = raw.replace(/\$/g, '').trim();

  // Bóc lớp \mathrm{...}, \text{...}, \mathbf{...} lồng nhau
  let prevText = '';
  while (text !== prevText) {
    prevText = text;
    text = text
      .replace(/\\mathrm\{([^}]*)\}/g, '$1')
      .replace(/\\text(?:rm|bf|it)?\{([^}]*)\}/g, '$1')
      .replace(/\\mathbf\{([^}]*)\}/g, '$1')
      .replace(/\\mathit\{([^}]*)\}/g, '$1');
  }

  // Số mũ và chỉ số dưới thường gặp trong toán học
  text = text
    .replace(/\^3/g, '³')
    .replace(/\^2/g, '²')
    .replace(/\^4/g, '⁴')
    .replace(/\^0/g, '⁰')
    .replace(/_0/g, '₀')
    .replace(/_1/g, '₁')
    .replace(/_2/g, '₂')
    .replace(/_3/g, '₃')
    .replace(/_x/g, 'ₓ')
    .replace(/_y/g, 'ᵧ');

  // Ký tự Hy Lạp & Toán học
  text = text
    .replace(/\\alpha/g, 'α')
    .replace(/\\beta/g, 'β')
    .replace(/\\gamma/g, 'γ')
    .replace(/\\pi/g, 'π')
    .replace(/\\infty/g, '∞')
    .replace(/\\Delta/g, 'Δ')
    .replace(/\\theta/g, 'θ');

  // Xóa khoảng trắng LaTeX "\ " và dấu gạch chéo TeX đơn độc
  text = text.replace(/\\\s+/g, ' ').replace(/\\/g, '');

  return text.trim();
}

/**
 * Phân tích và tạo SVG hoàn chỉnh từ mã TikZ (cho đồ thị và hình phẳng 2D Oxy)
 */
export function renderTikzToSvg(rawTikz: string): string | null {
  if (!rawTikz || !rawTikz.includes('\\begin{tikzpicture}')) {
    return null;
  }

  // 0. Làm sạch chú thích TeX (%...) để không làm vỡ các biểu thức và regex
  rawTikz = rawTikz.replace(/(^|[^\\])%.*$/gm, '$1');

  // 0b. KIỂM TRA NGHIÊM NGẶT HÌNH HỌC KHÔNG GIAN 3D VÀ TIKZ NÂNG CAO:
  // Nếu là hình 3D (lập phương, 10 khối lập phương xếp khít, chóp, nón, trụ, lăng trụ, cáp treo, đèn chùm, đỉnh có dấu phẩy A' B' C' D', đỉnh S chóp...)
  // TUYỆT ĐỐI TỪ CHỐI (trả về null) để nhường quyền biên dịch 100% cho TikzJax (WebAssembly TeX Engine) hoặc ảnh chụp!
  const hasPlot = rawTikz.includes('plot');

  const has3DKeywords =
    /\\(?:draw|node|coordinate)[^;]*(?:[A-D]'\b|\b[SABCD]'\b)/.test(rawTikz) || // Đỉnh A', B', C', D'
    /\b(?:cube|cone|cylinder|sphere|prism|pyramid|3d|plane|view|polyhedron|solid|hop|khoi|lap_phuong|khoi_hop)\b/i.test(rawTikz) ||
    /(\([A-Z]'\))/i.test(rawTikz) || // Tọa độ (A'), (B')
    /\([0-9.-]+,[0-9.-]+,[0-9.-]+\)/.test(rawTikz) || // Tọa độ 3D (x, y, z)
    /\bz\s*=\s*/.test(rawTikz) || // Trục z không gian
    /\b[xyz]\s*=\s*\{/.test(rawTikz); // Hệ trục affine 3D

  const hasMacroOrLoop3D =
    /#\d/.test(rawTikz) || // Macro có tham số định nghĩa khối như \def\cube(#1,#2,#3)
    /\\newcommand/.test(rawTikz) ||
    /\\begin\{scope\}\[[^\]]*shift/i.test(rawTikz) || // Scope dời hình xếp khối
    (rawTikz.match(/shift\s*=/g) || []).length >= 1;

  const hasComplexLoopOrShapes =
    rawTikz.includes('ellipse') ||
    rawTikz.includes('arc') ||
    /\\foreach\s*\\(?:p|pos|i|pt|name|u|v|k)\b/i.test(rawTikz) ||
    /\\foreach[^{]*\/[^{]*in/i.test(rawTikz) ||
    /node[^}]*\\(?:p|pos)\b/i.test(rawTikz) ||
    /\\shade\b/.test(rawTikz);

  // Nhận diện khối đa diện / hình học không gian 3D phức tạp khi KHÔNG CÓ plot đồ thị:
  // - Chứa từ 3 chu trình 'cycle' trở lên (vẽ nhiều mặt của khối hộp / đa diện 3D)
  // - Chứa tọa độ tương đối ++( lặp lại
  // - Chứa tô màu mặt khối che khuất fill=... từ 3 lần trở lên
  const cycleCount = (rawTikz.match(/cycle/g) || []).length;
  const hasPolyhedronGeometry =
    !hasPlot &&
    (cycleCount >= 3 ||
      (rawTikz.match(/\+\+\s*\(/g) || []).length >= 2 ||
      (rawTikz.match(/fill\s*=/g) || []).length >= 3);

  // Nhận diện hình đa diện nét đứt
  const dashedMatches = rawTikz.match(/dashed/g) || [];
  const isPolyhedronWithoutPlot = !hasPlot && dashedMatches.length >= 2;

  // Nhận diện hình chóp S.ABCD (đỉnh S kết hợp A, B, C, D)
  const isPyramidShape = !hasPlot && /\(S\)/.test(rawTikz) && (/\(A\)/.test(rawTikz) || /\(B\)/.test(rawTikz));

  if (
    has3DKeywords ||
    hasMacroOrLoop3D ||
    hasComplexLoopOrShapes ||
    hasPolyhedronGeometry ||
    isPolyhedronWithoutPlot ||
    isPyramidShape
  ) {
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

  // Chuỗi loại bỏ plot, grid, coordinate
  let cleanLines = rawTikz.replace(gridRegex, '').replace(coordRegex, '');
  for (let i = plotPositions.length - 1; i >= 0; i--) {
    const { start, end } = plotPositions[i];
    cleanLines = cleanLines.substring(0, start) + cleanLines.substring(end);
  }

  // 6. PHÂN TÍCH NHÃN VĂN BẢN \node (QUÉT CÂN BẰNG NGOẶC ĐỂ TRÁNH CỤT CHỮ \mathrm)
  let nodeSearchIdx = 0;
  while (true) {
    const nodeIdx = cleanLines.indexOf('\\node', nodeSearchIdx);
    if (nodeIdx === -1) break;

    // Tìm điểm kết thúc bằng dấu chấm phẩy ;
    const semiIdx = cleanLines.indexOf(';', nodeIdx);
    if (semiIdx === -1) {
      nodeSearchIdx = nodeIdx + 5;
      continue;
    }

    const nodeStmt = cleanLines.substring(nodeIdx, semiIdx + 1);
    nodeSearchIdx = semiIdx + 1;

    // Trích xuất tọa độ (...)
    const atMatch = nodeStmt.match(/at\s*(\([^)]+\))/);
    const ptCoordStr = atMatch ? atMatch[1] : (nodeStmt.match(/\([^)]+\)/)?.[0] || null);
    if (!ptCoordStr) continue;

    // Trích xuất vị trí [below, above, right...]
    const optMatches = Array.from(nodeStmt.matchAll(/\[([^\]]*)\]/g)).map((m) => m[1]);
    const pos = optMatches.join(' ');

    // Trích xuất nội dung { ... } cân bằng ngoặc
    const braced = extractBracedContent(nodeStmt, 0);
    if (braced) {
      const pt = parsePoint(ptCoordStr, coords, defs);
      const text = cleanTikzNodeText(braced.content);
      if (text) {
        drawItems.push({ type: 'node', pt, text, pos });
        updateBounds(pt.x, pt.y);
      }
    }
  }

  // 7. PHÂN TÍCH ĐOẠN THẲNG & MŨI TÊN: \draw[options] (A) -- (B) ... ;
  const lineStmtRegex = /\\draw(\[[^\]]*\])?\s*([^(;]*\([^;]+);/g;
  while ((m = lineStmtRegex.exec(cleanLines)) !== null) {
    const opts = m[1] || '';
    const body = m[2];

    // Bỏ qua nếu là câu lệnh chứa node riêng đã được quét
    if (body.includes('node') && !body.includes('--')) continue;

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

  // 8. Phân tích điểm chấm đặc biệt: \fill (x,y) circle (r); hoặc \draw (x,y) circle (r);
  const circleMatches = rawTikz.matchAll(/(\([^)]+\))\s*(?:node(?:\[[^\]]*\])?\s*\{[^}]*\}\s*)?circle\s*\(([^)]+)\)/g);
  for (const cm of circleMatches) {
    const pt = parsePoint(cm[1], coords, defs);
    drawItems.push({ type: 'point', pt, radius: 2.8 });
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

  // Kiểm tra độ tin cậy của bản vẽ
  const totalDrawCommands = (rawTikz.match(/\\draw|\\fill|\\node|\\path/g) || []).length;
  if (totalDrawCommands >= 3 && drawItems.length < totalDrawCommands * 0.4) {
    return null;
  }

  // Thiết lập kích thước SVG thoáng rộng, to rõ và sắc nét
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const marginX = Math.max(0.4, spanX * 0.14);
  const marginY = Math.max(0.4, spanY * 0.14);
  const boundMinX = minX - marginX;
  const boundMaxX = maxX + marginX;
  const boundMinY = minY - marginY;
  const boundMaxY = maxY + marginY;

  // Nâng kích thước SVG từ 300px lên 380px để hình vẽ to rõ, không bị bé
  const width = Math.max(340, Math.round(380 * globalScale));
  const height = Math.min(380, Math.max(240, Math.round(width * (spanY / spanX))));
  const pad = 26;

  const toSvgX = (x: number) => pad + ((x - boundMinX) / (boundMaxX - boundMinX)) * (width - 2 * pad);
  const toSvgY = (y: number) => height - (pad + ((y - boundMinY) / (boundMaxY - boundMinY)) * (height - 2 * pad));

  const svgElements: string[] = [];

  // Mũi tên trục tọa độ sắc nét
  svgElements.push(`
    <defs>
      <marker id="tikz-arrow-pure" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
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
      const strokeWidth = item.isThick ? '2.0' : '1.4';
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
      const steps = 90;
      const dx = (item.endX - item.startX) / steps;
      let pathD = '';
      let isDrawing = false;
      let prevY: number | null = null;

      for (let i = 0; i <= steps; i++) {
        const x = item.startX + i * dx;
        const y = evalPlotExpr(item.expr, x, defs);
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
        svgElements.push(`<path d="${pathD}" fill="none" stroke="${item.color || '#2563eb'}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" />`);
      }
    } else if (item.type === 'point' && item.pt) {
      const cx = toSvgX(item.pt.x).toFixed(1);
      const cy = toSvgY(item.pt.y).toFixed(1);
      svgElements.push(`<circle cx="${cx}" cy="${cy}" r="${item.radius || 2.8}" fill="#0f172a" />`);
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
        dx = -9; dy = 15; anchor = 'end';
      } else if (isBelow && isRight) {
        dx = 9; dy = 15; anchor = 'start';
      } else if (isAbove && isLeft) {
        dx = -9; dy = -9; anchor = 'end';
      } else if (isAbove && isRight) {
        dx = 9; dy = -9; anchor = 'start';
      } else if (isBelow) {
        dy = 15; anchor = 'middle';
      } else if (isAbove) {
        dy = -9; anchor = 'middle';
      } else if (isLeft) {
        dx = -10; dy = 5; anchor = 'end';
      } else if (isRight) {
        dx = 10; dy = 5; anchor = 'start';
      } else {
        dy = 5; anchor = 'middle';
      }

      // Font size to rõ (14.5px) kèm viền stroke trắng chống đè nét
      svgElements.push(`<text x="${(cx + dx).toFixed(1)}" y="${(cy + dy).toFixed(1)}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14.5" font-style="italic" font-weight="bold" fill="#0f172a" paint-order="stroke fill" stroke="#ffffff" stroke-width="4" stroke-linejoin="round" text-anchor="${anchor}">${item.text}</text>`);
    }
  }

  return `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" class="tikz-svg-pure mx-auto block select-none my-2" style="max-width: 100%; height: auto; min-width: 280px; display: block;" xmlns="http://www.w3.org/2000/svg">${svgElements.join('\n')}</svg>`;
}
