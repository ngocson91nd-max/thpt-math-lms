/**
 * Pure TypeScript TikZ to SVG Renderer
 * Biên dịch trực tiếp mã nguồn TikZ (đồ thị hàm số THPT, lưới tọa độ, trục số Oxy) sang SVG thuần túy trong 0.1ms.
 * Không phụ thuộc WebAssembly, không cần tải CDN, chạy mượt mà trên mọi thiết bị và trình duyệt.
 * Đối với hình học không gian 3D hoặc TikZ đặc thù: chủ động trả về null để nhường cho TikzJax hoặc ảnh chụp chất lượng cao.
 */

interface Point2D {
  x: number;
  y: number;
  offsetX?: number;
  offsetY?: number;
}

interface DefMap {
  [key: string]: number | string;
}

interface CoordMap {
  [key: string]: Point2D;
}

export function hashTikz(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

interface DrawItem {
  type: 'line' | 'grid' | 'plot' | 'point' | 'node' | 'ellipse' | 'arc' | 'arc_sector';
  p1?: Point2D;
  p2?: Point2D;
  pt?: Point2D;
  text?: string;
  pos?: string;
  radius?: number;
  rx?: number;
  ry?: number;
  startPt?: Point2D;
  origin?: Point2D;
  startAngle?: number;
  endAngle?: number;
  isArrow?: boolean;
  isDashed?: boolean;
  isThick?: boolean;
  expr?: string;
  startX?: number;
  endX?: number;
  color?: string;
  fill?: string;
  stroke?: string;
}

function parseTikzColor(col: string): string {
  const c = (col || '').trim().toLowerCase();
  if (c.includes('cyan!20') || c.includes('cyan')) return '#cffafe';
  if (c.includes('green!20') || c.includes('green')) return '#dcfce7';
  if (c.includes('orange!20') || c.includes('orange')) return '#ffedd5';
  if (c.includes('blue!20') || c.includes('blue')) return '#dbeafe';
  if (c.includes('gray!15') || c.includes('gray!20')) return '#f1f5f9';
  if (c.includes('gray!35') || c.includes('gray!40')) return '#e2e8f0';
  if (c.includes('gray!55') || c.includes('gray!60')) return '#cbd5e1';
  if (c.includes('red')) return '#fee2e2';
  return '#f8fafc';
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

  // Cú pháp nội suy hoặc vector calc e.g. "$(B)+(D)-(A)$" hoặc "$(A)!0.5!(B)$" hoặc "$(S)!2/3!(H)$"
  if (s.startsWith('$') && s.endsWith('$')) {
    s = s.slice(1, -1).trim();
    const interpMatch = s.match(/^\(([^)]+)\)\s*!\s*([0-9./]+)\s*!\s*\(([^)]+)\)$/);
    if (interpMatch) {
      const p1 = coords[interpMatch[1]] || { x: 0, y: 0 };
      let ratio = 0.5;
      if (interpMatch[2].includes('/')) {
        const [n, d] = interpMatch[2].split('/').map(Number);
        ratio = d ? n / d : 0.5;
      } else {
        ratio = parseFloat(interpMatch[2]) || 0.5;
      }
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
        if (name.includes(',')) {
          const off = parsePoint(name, coords, defs);
          x += sign * off.x;
          y += sign * off.y;
        } else {
          const pt = coords[name] || { x: 0, y: 0 };
          x += sign * pt.x;
          y += sign * pt.y;
        }
      }
      return { x, y };
    }
  }

  // Tọa độ 3D không gian: (x, y, z)
  const parts = s.split(',').map((p) => p.trim());
  if (parts.length === 3) {
    const x3d = parseNumber(parts[0], defs);
    const y3d = parseNumber(parts[1], defs);
    const z3d = parseNumber(parts[2], defs);
    // Phép chiếu phối cảnh song song (Cabinet/Cavalier projection chuẩn hình học không gian THPT):
    // Trục Oz thẳng đứng lên trên: z3d
    // Trục Oy nằm ngang sang phải: y3d
    // Trục Ox xiên chéo 135 độ xuống dưới sang trái: x3d
    const angle = (135 * Math.PI) / 180;
    const factor = 0.5;
    const sx = y3d + x3d * factor * Math.cos(angle);
    const sy = z3d + x3d * factor * Math.sin(angle);
    return { x: sx, y: sy };
  }

  // Tọa độ phẳng 2D: (x, y) hoặc tọa độ có bù trừ độ dài pixel (vd: 2pt, -2pt cho vạch chia trục)
  if (parts.length === 2) {
    const xPart = parts[0];
    const yPart = parts[1];

    let offsetX = 0;
    let offsetY = 0;
    let xVal = 0;
    let yVal = 0;

    if (xPart.endsWith('pt')) {
      offsetX = (parseFloat(xPart) || 0) * 1.33;
      xVal = 0;
    } else {
      xVal = parseNumber(xPart, defs);
    }

    if (yPart.endsWith('pt')) {
      offsetY = (parseFloat(yPart) || 0) * 1.33;
      yVal = 0;
    } else {
      yVal = parseNumber(yPart, defs);
    }

    return {
      x: xVal,
      y: yVal,
      offsetX,
      offsetY,
    };
  }

  // Tọa độ cực (polar): (angle:radius) hoặc (angle:rx and ry)
  const colonIdx = s.indexOf(':');
  if (colonIdx !== -1 && !s.includes(',')) {
    const anglePart = s.substring(0, colonIdx).trim();
    const radPart = s.substring(colonIdx + 1).trim();
    const angleDeg = parseNumber(anglePart, defs);
    const rad = (angleDeg * Math.PI) / 180;
    if (radPart.includes(' and ')) {
      const [rxStr, ryStr] = radPart.split(' and ');
      const rx = parseNumber(rxStr, defs);
      const ry = parseNumber(ryStr, defs);
      return { x: rx * Math.cos(rad), y: ry * Math.sin(rad) };
    } else {
      const r = parseNumber(radPart, defs);
      return { x: r * Math.cos(rad), y: r * Math.sin(rad) };
    }
  }

  return { x: 0, y: 0 };
}

function evalPlotExpr(expr: string, xVal: number, defs: DefMap = {}): number | null {
  let clean = expr;
  for (const [k, v] of Object.entries(defs)) {
    clean = clean.replace(new RegExp(`\\\\${k}\\b`, 'g'), String(v));
  }

  // Hỗ trợ phân số \frac{a}{b} hoặc \dfrac{a}{b}
  let prevFrac = '';
  while (prevFrac !== clean) {
    prevFrac = clean;
    clean = clean.replace(/\\d?frac\{([^{}]+)\}\{([^{}]+)\}/g, '(($1)/($2))');
  }

  clean = clean
    .replace(/\\cdot|\\times/g, '*')
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

  // Hỗ trợ phép nhân ẩn: 3(x) -> 3*(x) hoặc (x)(x-1) -> (x)*(x-1)
  clean = clean
    .replace(/([0-9.]+)\s*\(/g, '$1*(')
    .replace(/\)\s*\(/g, ')*(')
    .replace(/\)\s*([0-9.]+)/g, ')*$1');

  // Xử lý toán tử lũy thừa với dấu trừ đứng trước trong JavaScript:
  // JS ném SyntaxError khi gặp -2**2 hoặc -(-0.5)**3 vì cần ngoặc đơn
  let prevClean = '';
  while (prevClean !== clean) {
    prevClean = clean;
    clean = clean.replace(/(^|[(,+=*/-])\s*-\s*([a-zA-Z0-9_.]+|\([^)]+\))\s*\*\*\s*([a-zA-Z0-9_.]+|\([^)]+\))/g, '$1((-1)*($2**$3))');
  }

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
export function cleanTikzNodeText(raw: string): string {
  let text = raw.replace(/\$/g, '').trim();

  // Vector TeX: \overrightarrow{F}_C -> F⃗_C, \vec{P} -> P⃗, \vv{AB} -> AB⃗
  text = text
    .replace(/\\(?:overrightarrow|vec|vv)\{([^{}]+)\}/g, '$1⃗')
    .replace(/\\(?:overrightarrow|vec|vv)\s*([a-zA-Z])/g, '$1⃗');

  // Bóc lớp \mathrm{...}, \text{...}, \mathbf{...} lồng nhau
  let prevText = '';
  while (text !== prevText) {
    prevText = text;
    text = text
      .replace(/\\mathrm\{([^}]*)\}/g, '$1')
      .replace(/\\text(?:rm|bf|it)?\{([^}]*)\}/g, '$1')
      .replace(/\\mathbf\{([^}]*)\}/g, '$1')
      .replace(/\\mathit\{([^}]*)\}/g, '$1')
      .replace(/\\mathscr\{([^}]*)\}/g, '$1')
      .replace(/\\mathcal\{([^}]*)\}/g, '$1');
  }

  // Số mũ và chỉ số dưới thường gặp trong toán học
  // Dấu phẩy đạo hàm / đỉnh: A' -> A′
  text = text.replace(/\\prime/g, '′');
  text = text.replace(/([A-Za-z0-9])''/g, '$1″');
  text = text.replace(/([A-Za-z0-9])'/g, '$1′');

  // Số mũ toán học
  text = text
    .replace(/\^3/g, '³')
    .replace(/\^2/g, '²')
    .replace(/\^4/g, '⁴')
    .replace(/\^0/g, '⁰')
    .replace(/\^\{3\}/g, '³')
    .replace(/\^\{2\}/g, '²')
    .replace(/\^\{4\}/g, '⁴')
    .replace(/\^\{0\}/g, '⁰')
    .replace(/\^\{\\circ\}/g, '°')
    .replace(/\^\\circ/g, '°');

  // Chỉ số dưới (subscript) toán học: A_1 -> A₁, x_0 -> x₀, G_1 -> G₁, F_C -> F_C
  const subscriptMap: { [k: string]: string } = {
    '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
    '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
    'x': 'ₓ', 'y': 'ᵧ',
    'A': 'ᴀ', 'B': 'ʙ', 'C': 'ᴄ', 'D': 'ᴅ',
    'a': 'ₐ', 'b': 'ᵦ', 'c': '꜀',
  };
  text = text.replace(/_\{([0-9a-zA-Z])\}/g, (_m, d) => subscriptMap[d] || `_${d}`);
  text = text.replace(/_([0-9a-zA-Z])\b/g, (_m, d) => subscriptMap[d] || `_${d}`);
  text = text.replace(/([A-Za-z])([0-9])\b/g, (_m, l, d) => l + (subscriptMap[d] || d));

  // Ký tự Hy Lạp & Toán học
  text = text
    .replace(/\\alpha/g, 'α')
    .replace(/\\beta/g, 'β')
    .replace(/\\gamma/g, 'γ')
    .replace(/\\pi/g, 'π')
    .replace(/\\infty/g, '∞')
    .replace(/\\Delta/g, 'Δ')
    .replace(/\\theta/g, 'θ')
    .replace(/\\circ/g, '°');

  // Xóa khoảng trắng LaTeX "\ ", "\," và dấu gạch chéo TeX đơn độc
  text = text.replace(/\\\s+/g, ' ').replace(/\\,/g, ' ').replace(/\\/g, '');

  return text.trim();
}

/**
 * Mở rộng tự động các macro \newcommand có tham số (như \drawcube{4}{0}{0} cho bài toán khối lập phương)
 */
function expandMacros(tikz: string): string {
  let res = tikz;
  let newcmdIdx = res.indexOf('\\newcommand');
  let safetyLoop = 0;
  while (newcmdIdx !== -1 && safetyLoop < 10) {
    safetyLoop++;
    const g1 = extractBracedContent(res, newcmdIdx + 11);
    if (!g1) break;
    const macroName = g1.content.replace(/\\/g, '').trim();

    let pos = g1.endIndex + 1;
    let paramCount = 0;
    while (pos < res.length && /\s/.test(res[pos])) pos++;
    if (res[pos] === '[') {
      const closeBracket = res.indexOf(']', pos);
      paramCount = parseInt(res.substring(pos + 1, closeBracket), 10) || 0;
      pos = closeBracket + 1;
    }

    const g2 = extractBracedContent(res, pos);
    if (!g2) break;
    const template = g2.content;

    res = res.substring(0, newcmdIdx) + res.substring(g2.endIndex + 1);

    const callRegex = new RegExp(`\\\\${macroName}((?:\\s*\\{[^}]*\\}){${paramCount}})`, 'g');
    res = res.replace(callRegex, (_m, argsBlock) => {
      const args = Array.from(argsBlock.matchAll(/\{([^}]*)\}/g)).map((match: any) => match[1]);
      let instance = template;
      for (let i = 0; i < args.length; i++) {
        instance = instance.replace(new RegExp(`#${i + 1}`, 'g'), args[i]);
      }
      return instance;
    });

    newcmdIdx = res.indexOf('\\newcommand');
  }
  return res;
}

/**
 * Tự động mở rộng các vòng lặp \\foreach để hỗ trợ hình học THPT (đỉnh S.ABCD, lăng trụ, v.v.)
 */
function expandForeachLoops(tikz: string): string {
  let res = tikz;

  // 1. Dạng cặp biến: \\foreach \\p/\\pos in {S/above, A/above left, ...} \\fill (\\p) circle (1.2pt) node[\\pos] {$\\p$};
  const foreachPairRegex = /\\foreach\s*\\([a-zA-Z]+)\s*\/\s*\\([a-zA-Z]+)\s*in\s*\{([^}]+)\}\s*(?:\{([\s\S]*?)\}|([^\n;]*;))/g;
  res = res.replace(foreachPairRegex, (_m, var1, var2, listStr, blockBody, lineBody) => {
    let rawBody = (blockBody || lineBody || '').trim();
    // Chuẩn hóa cú pháp \\fill (\\p) circle (...) node[...] {...}
    rawBody = rawBody.replace(/\\fill\s*\(([^)]+)\)\s*circle\s*\(([^)]+)\)\s*node\s*\[([^\]]*)\]\s*\{([^}]*)\}/g, 
      '\\fill ($1) circle ($2); \\node[$3] at ($1) {$4}');

    const items = listStr.split(',').map((s: string) => s.trim()).filter(Boolean);
    let expanded = '';
    for (const item of items) {
      if (!item.includes('/')) continue;
      const [val1, val2] = item.split('/').map((s: string) => s.trim());
      let b = rawBody;
      b = b.replace(new RegExp(`\\\\${var1}\\b`, 'g'), val1);
      b = b.replace(new RegExp(`\\\\${var2}\\b`, 'g'), val2);
      b = b.replace(new RegExp(`\\(\\s*\\\\?${var1}\\s*\\)`, 'g'), `(${val1})`);
      b = b.replace(new RegExp(`\\{\\s*\\$?\\\\?${var1}\\$?\\s*\\}`, 'g'), `{$${val1}$}`);
      b = b.replace(new RegExp(`\\[\\s*\\\\?${var2}\\s*\\]`, 'g'), `[${val2}]`);
      expanded += b + '\n';
    }
    return expanded;
  });

  // 2. Dạng đơn: \\foreach \\p in {A, B, C} \\fill (\\p) circle (1.2pt);
  const foreachSingleRegex = /\\foreach\s*\\([a-zA-Z]+)\s*in\s*\{([^}]+)\}\s*(?:\{([\s\S]*?)\}|([^\n;]*;))/g;
  res = res.replace(foreachSingleRegex, (_m, var1, listStr, blockBody, lineBody) => {
    const rawBody = (blockBody || lineBody || '').trim();
    if (rawBody.includes('--')) return _m; // Nhường cho bộ vạch chia trục
    const items = listStr.split(',').map((s: string) => s.trim()).filter(Boolean);
    let expanded = '';
    for (const item of items) {
      let b = rawBody;
      const val = item.trim();
      b = b.replace(new RegExp(`\\\\${var1}\\b`, 'g'), val);
      b = b.replace(new RegExp(`\\(\\s*\\\\?${var1}\\s*\\)`, 'g'), `(${val})`);
      b = b.replace(new RegExp(`\\{\\s*\\$?\\\\?${var1}\\$?\\s*\\}`, 'g'), `{$${val}$}`);
      expanded += b + '\n';
    }
    return expanded;
  });

  return res;
}

/**
 * Phân tích và tạo SVG hoàn chỉnh từ mã TikZ (cho đồ thị hàm số và hình phẳng 2D Oxy)
 */
export function renderTikzToSvg(rawTikz: string): string | null {
  if (!rawTikz || !rawTikz.includes('\\begin{tikzpicture}')) {
    return null;
  }

  // 0. Nếu là hình học không gian 3D, hình học phẳng đa giác, vector hoặc chứa gói chuyên sâu:
  // Nhường 100% cho Server TeX Engine để đạt độ chuẩn xác tuyệt đối từng milimet
  const is3DOrComplex =
    /tdplot|\\tdplotsetmaincoords|tkz-euclide|\\tkzDefPoint|\\tkzDraw|Oxyz|\[[^\]]*\b3d\b/i.test(
      rawTikz
    ) ||
    /\((?:-?[0-9.]+\s*,\s*){2}-?[0-9.]+\)/.test(rawTikz) || // Tọa độ 3D (x,y,z)
    /\bz\s*=\s*\{/.test(rawTikz) || // Trục z={(...)}
    /\b[A-Z]['′](?![a-zA-Z0-9(])/.test(rawTikz) || // Đỉnh lăng trụ / hình hộp A', B', C', D'
    (/\bellipse\b/i.test(rawTikz) && /\b(?:S|top|dinh)\b/.test(rawTikz)) || // Đèn chùm đĩa elip và đỉnh treo S
    (/\b(?:S|top|dinh)\b/.test(rawTikz) && /\((?:A|B|C|D)\)/.test(rawTikz) && /--/.test(rawTikz)) || // Hình chóp S.ABCD
    (/\((?:M|N|P|Q)\)/.test(rawTikz) && /\((?:A|B|C|D)\)/.test(rawTikz)); // Hình lồng nhau MNPQ trong ABCD (trang sách SGK)

  if (is3DOrComplex) {
    return null;
  }

  // 0a. Mở rộng tự động vòng lặp \\foreach & các macro \\newcommand nếu có
  rawTikz = expandForeachLoops(rawTikz);
  rawTikz = expandMacros(rawTikz);

  // 0b. Làm sạch chú thích TeX (%...) để không làm vỡ các biểu thức và regex
  rawTikz = rawTikz.replace(/(^|[^\\])%.*$/gm, '$1');

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

  const updateBounds = (x: number, y: number, pt?: Point2D) => {
    if (isNaN(x) || isNaN(y) || !isFinite(x) || !isFinite(y)) return;
    if (pt && ((pt.offsetX !== undefined && pt.offsetX !== 0) || (pt.offsetY !== undefined && pt.offsetY !== 0))) {
      return;
    }
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  };

  // 2b. Phân tích vùng clip nếu có: \clip (xmin, ymin) rectangle (xmax, ymax);
  let clipRect: { x1: number; y1: number; x2: number; y2: number } | null = null;
  const clipMatch = rawTikz.match(/\\clip\s*(\([^)]+\))\s*rectangle\s*(\([^)]+\));/);
  if (clipMatch) {
    const cp1 = parsePoint(clipMatch[1], coords, defs);
    const cp2 = parsePoint(clipMatch[2], coords, defs);
    clipRect = {
      x1: Math.min(cp1.x, cp2.x),
      y1: Math.min(cp1.y, cp2.y),
      x2: Math.max(cp1.x, cp2.x),
      y2: Math.max(cp1.y, cp2.y),
    };
  }

  // 3. Phân tích tọa độ: \coordinate (A) at (x, y); hoặc \coordinate[label=...] (A) at (x, y);
  const coordRegex = /\\coordinate(?:\s*\[([^\]]*)\])?\s*\(([^)]+)\)\s*at\s*(\([^;]+\));/g;
  while ((m = coordRegex.exec(rawTikz)) !== null) {
    const opts = m[1] || '';
    const name = m[2].trim();
    const pt = parsePoint(m[3], coords, defs);
    coords[name] = pt;
    updateBounds(pt.x, pt.y);

    // Nếu có label ví dụ label=above:$S$ hoặc label=below right:$A$
    const labelMatch = opts.match(/label=([^:]+):\{?\$?([^$}]+)\$?\}?/);
    if (labelMatch) {
      const pos = labelMatch[1].trim();
      const text = cleanTikzNodeText(labelMatch[2].trim());
      drawItems.push({ type: 'node', pt, text, pos });
    }
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

          // Lấy mẫu các điểm của đồ thị để cập nhật chính xác biên độ trục Y, không bao giờ bị cắt cụt cực trị
          for (let s = 0; s <= 20; s++) {
            const sx = startX + (s * (endX - startX)) / 20;
            const sy = evalPlotExpr(expr, sx, defs);
            if (sy !== null && isFinite(sy) && Math.abs(sy) < 50) {
              updateBounds(sx, sy);
            }
          }

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

  // Loại bỏ các câu lệnh \foreach vạch chia trục khỏi cleanLines để Section 7 không phân tích nhầm
  cleanLines = cleanLines.replace(/\\foreach\s*\\([xy])\s*in\s*\{[^}]+\}\s*\\draw\s*\([^)]+\)\s*--\s*\([^)]+\);/g, '');

  // 6. PHÂN TÍCH NHÃN VĂN BẢN (CẢ \node VÀ INLINE node TRONG \draw)
  let nodeSearchIdx = 0;
  while (nodeSearchIdx < cleanLines.length) {
    const match = cleanLines.substring(nodeSearchIdx).match(/(?:\\node|(?<=[^a-zA-Z0-9_\\])node)\s*(?:\[([^\]]*)\])?\s*(?:at\s*(\([^)]+\)))?\s*\{/);
    if (!match || match.index === undefined) break;

    const absoluteStart = nodeSearchIdx + match.index;
    const pos = match[1] || '';
    let coordStr = match[2] || null;

    const openBraceIdx = absoluteStart + match[0].length - 1;
    const braced = extractBracedContent(cleanLines, openBraceIdx);
    if (!braced) {
      nodeSearchIdx = absoluteStart + match[0].length;
      continue;
    }

    nodeSearchIdx = braced.endIndex + 1;

    // Nếu không có "at (x,y)", tìm tọa độ trong câu lệnh hiện tại
    if (!coordStr) {
      const beforeStr = cleanLines.substring(Math.max(0, absoluteStart - 120), absoluteStart);
      const pts = Array.from(beforeStr.matchAll(/\(([^)]+)\)/g));
      if (pos.includes('midway') && pts.length >= 2) {
        const pt1 = parsePoint(pts[pts.length - 2][1], coords, defs);
        const pt2 = parsePoint(pts[pts.length - 1][1], coords, defs);
        const midPt = { x: (pt1.x + pt2.x) / 2, y: (pt1.y + pt2.y) / 2 };
        const text = cleanTikzNodeText(braced.content);
        if (text) {
          drawItems.push({ type: 'node', pt: midPt, text, pos });
          updateBounds(midPt.x, midPt.y);
        }
        continue;
      } else if (pts.length > 0) {
        coordStr = pts[pts.length - 1][1];
      }
    }

    if (coordStr) {
      const pt = parsePoint(coordStr, coords, defs);
      const text = cleanTikzNodeText(braced.content);
      if (text) {
        drawItems.push({ type: 'node', pt, text, pos });
        updateBounds(pt.x, pt.y);
      }
    }
  }

  // 7. PHÂN TÍCH ĐOẠN THẲNG, MŨI TÊN & HÌNH CHỮ NHẬT: \draw[options] ... ;
  const lineStmtRegex = /\\(?:draw|filldraw|fill|shade|path)(\[[^\]]*\])?\s*([^(;]*\([^;]+);/g;
  while ((m = lineStmtRegex.exec(cleanLines)) !== null) {
    const opts = m[1] || '';
    const body = m[2];

    // Loại bỏ các khối node{...} khỏi body để không nhận nhầm ngoặc đơn trong công thức làm tọa độ
    const bodyWithoutNodes = body.replace(/node\s*(?:\[[^\]]*\])?\s*\{[\s\S]*?\}/g, '');

    const isArrow = opts.includes('->') || opts.includes('>=stealth') || opts.includes('[-stealth]');
    const isDashed = opts.includes('dashed');
    const isThick = opts.includes('thick');

    // Kiểm tra lệnh rectangle: (p1) rectangle (p2)
    const rectRegex = /\(([^)]+)\)\s*rectangle\s*\(([^)]+)\)/g;
    let rectMatch;
    let hasRectangle = false;
    while ((rectMatch = rectRegex.exec(bodyWithoutNodes)) !== null) {
      hasRectangle = true;
      const p1 = parsePoint(rectMatch[1], coords, defs);
      const p2 = parsePoint(rectMatch[2], coords, defs);
      const c1 = { x: p1.x, y: p1.y };
      const c2 = { x: p2.x, y: p1.y };
      const c3 = { x: p2.x, y: p2.y };
      const c4 = { x: p1.x, y: p2.y };
      const corners = [c1, c2, c3, c4];
      for (let i = 0; i < 4; i++) {
        drawItems.push({
          type: 'line',
          p1: corners[i],
          p2: corners[(i + 1) % 4],
          isArrow: false,
          isDashed,
          isThick,
        });
      }
      corners.forEach((c) => updateBounds(c.x, c.y, c));
    }
    if (hasRectangle) continue;

    const normalizedBody = bodyWithoutNodes.replace(/\s+to(?:\s*\[[^\]]*\])?\s+/g, ' -- ');

    // Tách các chuỗi subpaths: "(A) -- (B) -- (C)" hoặc "(A) -- (B) -- cycle"
    const subpaths = normalizedBody.match(/(?:\([^)]+\)\s*--\s*)+(?:\([^)]+\)|cycle)/g) || [];
    if (subpaths.length > 0) {
      for (const sp of subpaths) {
        const rawPts = Array.from(sp.matchAll(/\(([^)]+)\)|cycle/g)).map((match) => match[1] || match[0]);
        for (let i = 0; i < rawPts.length - 1; i++) {
          const p1Str = rawPts[i];
          const p2Str = rawPts[i + 1] === 'cycle' ? rawPts[0] : rawPts[i + 1];
          const p1 = parsePoint(p1Str, coords, defs);
          const p2 = parsePoint(p2Str, coords, defs);
          drawItems.push({
            type: 'line',
            p1,
            p2,
            isArrow: isArrow && (i === rawPts.length - 2),
            isDashed,
            isThick,
          });
          updateBounds(p1.x, p1.y, p1);
          updateBounds(p2.x, p2.y, p2);
        }
      }
    } else {
      const ptMatches = bodyWithoutNodes.match(/\(([^)]+)\)/g) || [];
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
        updateBounds(p1.x, p1.y, p1);
        updateBounds(p2.x, p2.y, p2);
      }
    }
  }

  // 7b. Phân tích hình elip: \filldraw[...] (cx, cy) ellipse (rx and ry); hoặc \draw (cx, cy) ellipse (...);
  const ellipseRegex = /\\(?:filldraw|fill|draw)(\[[^\]]*\])?\s*(\([^)]+\))\s*ellipse\s*\(([^)]+)\)/g;
  while ((m = ellipseRegex.exec(cleanLines)) !== null) {
    const opts = m[1] || '';
    const centerPt = parsePoint(m[2], coords, defs);
    const radiiStr = m[3];
    const [rxStr, ryStr] = radiiStr.split('and').map((s) => s.trim().replace(/cm|pt|mm/g, ''));
    const rx = parseFloat(rxStr) || 1;
    const ry = parseFloat(ryStr || rxStr) || 1;

    let fill = 'none';
    if (opts.includes('fill=')) {
      const fillMatch = opts.match(/fill=([a-zA-Z0-9!]+)/);
      if (fillMatch) {
        fill = parseTikzColor(fillMatch[1]);
      }
    }
    const stroke = opts.includes('draw=black') || opts.includes('draw') ? '#0f172a' : '#334155';

    drawItems.push({
      type: 'ellipse',
      pt: centerPt,
      rx,
      ry,
      fill,
      stroke,
    });

    updateBounds(centerPt.x - rx, centerPt.y - ry);
    updateBounds(centerPt.x + rx, centerPt.y + ry);
  }

  // 7c. Phân tích cung tròn và hình quạt góc: \fill[...] (C) -- (x,y) arc (start:end:r) -- cycle;
  const arcFillRegex = /\\fill(\[[^\]]*\])?\s*(\([^)]+\))\s*--\s*(\([^)]+\))\s*arc\s*\(([0-9.-]+):([0-9.-]+):([0-9.-]+)\)\s*--\s*cycle/g;
  while ((m = arcFillRegex.exec(cleanLines)) !== null) {
    const opts = m[1] || '';
    const origin = parsePoint(m[2], coords, defs);
    const startPt = parsePoint(m[3], coords, defs);
    const startAngle = parseFloat(m[4]);
    const endAngle = parseFloat(m[5]);
    const radius = parseFloat(m[6]);

    let fill = '#dcfce7'; // green!20
    if (opts.includes('orange')) fill = '#ffedd5';
    else if (opts.includes('cyan')) fill = '#cffafe';
    else if (opts.includes('fill=')) {
      const fillMatch = opts.match(/fill=([a-zA-Z0-9!]+)/);
      if (fillMatch) fill = parseTikzColor(fillMatch[1]);
    }

    drawItems.push({
      type: 'arc_sector',
      origin,
      startPt,
      startAngle,
      endAngle,
      radius,
      fill,
    });
  }

  const arcDrawRegex = /\\draw(\[[^\]]*\])?\s*(\([^)]+\))\s*arc\s*\(([0-9.-]+):([0-9.-]+):([0-9.-]+)\)/g;
  while ((m = arcDrawRegex.exec(cleanLines)) !== null) {
    const startPt = parsePoint(m[2], coords, defs);
    const startAngle = parseFloat(m[3]);
    const endAngle = parseFloat(m[4]);
    const radius = parseFloat(m[5]);

    drawItems.push({
      type: 'arc',
      startPt,
      startAngle,
      endAngle,
      radius,
      stroke: '#334155',
    });
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
          p1: { x: v, y: 0, offsetY: 3 },
          p2: { x: v, y: 0, offsetY: -3 },
          isThick: false,
        });
        updateBounds(v, 0);
      } else {
        drawItems.push({
          type: 'line',
          p1: { x: 0, y: v, offsetX: -3 },
          p2: { x: 0, y: v, offsetX: 3 },
          isThick: false,
        });
        updateBounds(0, v);
      }
    });
  }

  if (minX === Infinity || maxX === -Infinity || drawItems.length === 0) {
    return null;
  }

  // Thiết lập kích thước SVG thoáng rộng, to rõ và sắc nét
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const marginX = (defs.xmin !== undefined && defs.xmax !== undefined) ? 0.25 : Math.max(0.3, spanX * 0.12);
  const marginY = (defs.ymin !== undefined && defs.ymax !== undefined) ? 0.25 : Math.max(0.3, spanY * 0.12);
  const boundMinX = (typeof defs.xmin === 'number' ? defs.xmin : minX) - marginX;
  const boundMaxX = (typeof defs.xmax === 'number' ? defs.xmax : maxX) + marginX;
  const boundMinY = (typeof defs.ymin === 'number' ? defs.ymin : minY) - marginY;
  const boundMaxY = (typeof defs.ymax === 'number' ? defs.ymax : maxY) + marginY;

  const pad = 28;
  const targetW = Math.max(340, Math.round(380 * globalScale));
  // Tỉ lệ scale đẳng cự (isometric) cho cả X và Y để đảm bảo góc vuông, đường tròn và hình học không gian không bị biến dạng
  const scale = Math.min((targetW - 2 * pad) / (boundMaxX - boundMinX), 70);
  const width = Math.max(340, Math.round((boundMaxX - boundMinX) * scale + 2 * pad));
  const height = Math.max(220, Math.round((boundMaxY - boundMinY) * scale + 2 * pad));

  const toSvgX = (pt: Point2D | number) => {
    if (typeof pt === 'number') return pad + (pt - boundMinX) * scale;
    return pad + (pt.x - boundMinX) * scale + (pt.offsetX || 0);
  };
  const toSvgY = (pt: Point2D | number) => {
    if (typeof pt === 'number') return height - (pad + (pt - boundMinY) * scale);
    return height - (pad + (pt.y - boundMinY) * scale) - (pt.offsetY || 0);
  };

  const svgElements: string[] = [];

  const uniqueClipId = `tikz-clip-${hashTikz(rawTikz)}`;

  // Mũi tên trục tọa độ stealth sắc nét chuẩn LaTeX
  let defsBlock = `
    <defs>
      <marker id="tikz-arrow-pure" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
        <path d="M 0 1.5 Q 4 5 0 8.5 L 10 5 Z" fill="#0f172a" />
      </marker>`;

  if (clipRect) {
    const clipX = toSvgX(clipRect.x1);
    const clipY = toSvgY(clipRect.y2);
    const clipW = Math.max(1, toSvgX(clipRect.x2) - clipX);
    const clipH = Math.max(1, toSvgY(clipRect.y1) - clipY);
    defsBlock += `
      <clipPath id="${uniqueClipId}">
        <rect x="${clipX.toFixed(1)}" y="${clipY.toFixed(1)}" width="${clipW.toFixed(1)}" height="${clipH.toFixed(1)}" />
      </clipPath>`;
  }

  defsBlock += `
    </defs>`;
  svgElements.push(defsBlock);

  // Render các thành phần
  for (const item of drawItems) {
    if (item.type === 'line' && item.p1 && item.p2) {
      const x1 = toSvgX(item.p1).toFixed(1);
      const y1 = toSvgY(item.p1).toFixed(1);
      const x2 = toSvgX(item.p2).toFixed(1);
      const y2 = toSvgY(item.p2).toFixed(1);
      const stroke = item.isArrow ? '#0f172a' : item.isDashed ? '#64748b' : '#1e293b';
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
      const steps = 90;
      const dx = (item.endX - item.startX) / steps;
      let pathD = '';
      let isDrawing = false;
      let prevY: number | null = null;

      for (let i = 0; i <= steps; i++) {
        const x = item.startX + i * dx;
        const y = evalPlotExpr(item.expr, x, defs);
        // Chỉ coi là có tiệm cận đứng nếu biểu thức thực sự có chia cho ẩn số biến thiên (ví dụ: /((\x)...) hoặc tan
        const hasAsymptote = (/\/\s*\(?[^)]*(?:\\x|\bx\b)/.test(item.expr)) || item.expr.includes('tan');
        const isDiscontinuous = hasAsymptote && prevY !== null && y !== null && Math.abs(y - prevY) > spanY * 1.5;

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
        const clipAttr = clipRect ? `clip-path="url(#${uniqueClipId})"` : '';
        svgElements.push(`<path d="${pathD}" fill="none" stroke="${item.color || '#2563eb'}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" ${clipAttr} />`);
      }
    } else if (item.type === 'point' && item.pt) {
      const cx = toSvgX(item.pt).toFixed(1);
      const cy = toSvgY(item.pt).toFixed(1);
      svgElements.push(`<circle cx="${cx}" cy="${cy}" r="${item.radius || 2.4}" fill="#0f172a" />`);
    } else if (item.type === 'ellipse' && item.pt && item.rx && item.ry) {
      const cx = toSvgX(item.pt).toFixed(1);
      const cy = toSvgY(item.pt).toFixed(1);
      const rx = (item.rx * ((width - 2 * pad) / (boundMaxX - boundMinX))).toFixed(1);
      const ry = (item.ry * ((height - 2 * pad) / (boundMaxY - boundMinY))).toFixed(1);
      svgElements.push(`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${item.fill || '#cffafe'}" stroke="${item.stroke || '#0f172a'}" stroke-width="1.8" />`);
    } else if (item.type === 'arc_sector' && item.origin && item.startPt && item.startAngle !== undefined && item.endAngle !== undefined && item.radius !== undefined) {
      const r = item.radius;
      const startRad = (item.startAngle * Math.PI) / 180;
      const endRad = (item.endAngle * Math.PI) / 180;
      const centerX = item.startPt.x - r * Math.cos(startRad);
      const centerY = item.startPt.y - r * Math.sin(startRad);
      const endPtX = centerX + r * Math.cos(endRad);
      const endPtY = centerY + r * Math.sin(endRad);

      const ox = toSvgX(item.origin).toFixed(1);
      const oy = toSvgY(item.origin).toFixed(1);
      const sx = toSvgX(item.startPt).toFixed(1);
      const sy = toSvgY(item.startPt).toFixed(1);
      const ex = toSvgX(endPtX).toFixed(1);
      const ey = toSvgY(endPtY).toFixed(1);
      const rSvg = (r * ((width - 2 * pad) / (boundMaxX - boundMinX))).toFixed(1);

      const sweep = item.endAngle > item.startAngle ? 0 : 1;
      const pathD = `M ${ox} ${oy} L ${sx} ${sy} A ${rSvg} ${rSvg} 0 0 ${sweep} ${ex} ${ey} Z`;
      svgElements.push(`<path d="${pathD}" fill="${item.fill || '#dcfce7'}" stroke="none" />`);
    } else if (item.type === 'arc' && item.startPt && item.startAngle !== undefined && item.endAngle !== undefined && item.radius !== undefined) {
      const r = item.radius;
      const startRad = (item.startAngle * Math.PI) / 180;
      const endRad = (item.endAngle * Math.PI) / 180;
      const centerX = item.startPt.x - r * Math.cos(startRad);
      const centerY = item.startPt.y - r * Math.sin(startRad);
      const endPtX = centerX + r * Math.cos(endRad);
      const endPtY = centerY + r * Math.sin(endRad);

      const sx = toSvgX(item.startPt).toFixed(1);
      const sy = toSvgY(item.startPt).toFixed(1);
      const ex = toSvgX(endPtX).toFixed(1);
      const ey = toSvgY(endPtY).toFixed(1);
      const rSvg = (r * ((width - 2 * pad) / (boundMaxX - boundMinX))).toFixed(1);

      const sweep = item.endAngle > item.startAngle ? 0 : 1;
      const pathD = `M ${sx} ${sy} A ${rSvg} ${rSvg} 0 0 ${sweep} ${ex} ${ey}`;
      svgElements.push(`<path d="${pathD}" fill="none" stroke="${item.stroke || '#0f172a'}" stroke-width="1.6" />`);
    } else if (item.type === 'node' && item.pt && item.text) {
      const cx = toSvgX(item.pt);
      const cy = toSvgY(item.pt);
      let dx = 0, dy = 0;
      let anchor = 'middle';
      const pos = item.pos || '';
      
      const isBelow = pos.includes('below');
      const isAbove = pos.includes('above');
      const isLeft = pos.includes('left');
      const isRight = pos.includes('right');

      if (isBelow && isLeft) {
        dx = -8; dy = 13; anchor = 'end';
      } else if (isBelow && isRight) {
        dx = 8; dy = 13; anchor = 'start';
      } else if (isAbove && isLeft) {
        dx = -8; dy = -8; anchor = 'end';
      } else if (isAbove && isRight) {
        dx = 8; dy = -8; anchor = 'start';
      } else if (isBelow) {
        dy = 13; anchor = 'middle';
      } else if (isAbove) {
        dy = -8; anchor = 'middle';
      } else if (isLeft) {
        dx = -9; dy = 4; anchor = 'end';
      } else if (isRight) {
        dx = 9; dy = 4; anchor = 'start';
      } else {
        dy = 4; anchor = 'middle';
      }

      const isPureNumber = /^-?[0-9]+(?:\.[0-9]+)?$/.test(item.text);
      const fontStyle = isPureNumber ? 'normal' : 'italic';
      const fontFamily = "KaTeX_Math, 'Cambria Math', 'Times New Roman', Times, STIXGeneral, serif";

      svgElements.push(`<text x="${(cx + dx).toFixed(1)}" y="${(cy + dy).toFixed(1)}" font-family="${fontFamily}" font-size="14.5" font-style="${fontStyle}" font-weight="normal" fill="#0f172a" paint-order="stroke fill" stroke="#ffffff" stroke-width="2.5" stroke-linejoin="round" text-anchor="${anchor}">${item.text}</text>`);
    }
  }

  return `<svg viewBox="0 0 ${width} ${height}" class="tikz-svg-pure mx-auto block select-none my-2 max-w-full h-auto" style="max-width: 100%; height: auto; display: block;" xmlns="http://www.w3.org/2000/svg">${svgElements.join('\n')}</svg>`;
}
