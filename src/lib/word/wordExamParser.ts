import JSZip from 'jszip';
import mammoth from 'mammoth';
import { ommlToLatex } from 'dwml-ts';
import { renderToSvg } from 'wmf-emf-renderer';
import { Question, QuestionType, QuestionDifficulty } from '../../types/database';
import { detectMathTopic } from '../latex/examParser';
import {
  registerExamAsset,
  sanitizeNoBase64OrRawHtml,
  containsBase64OrImgTag,
  getAllExamAssets,
} from '../exam/assetRegistry';

let WMF: any = null;
try {
  WMF = require('wmf');
} catch {
  // Fallback if wmf is unavailable
}

/**
 * Chuẩn hóa buffer byte WMF:
 * 1. Giữ nguyên 22 byte tiêu đề Aldus APM (0x9AC6CDD7) khi render sang SVG (stripApm = false)
 *    để wmf-emf-renderer xác định đúng tỷ lệ khung hình (aspect ratio) và kích thước chuẩn xác.
 * 2. Cắt bỏ 22 byte khi dùng với thư viện WMF canvas thuần túy (stripApm = true).
 * 3. Thay thế record META_ESCAPE 1574 (chứa comment MathType) thành dummy record META_SAVEDC
 *    để thư viện WMF / SVG giải mã trơn tru mà không bị văng Exception.
 */
export function sanitizeWmfBytes(bytes: Uint8Array, stripApm = false): Uint8Array {
  const hasApm = bytes.length >= 22 && bytes[0] === 0xd7 && bytes[1] === 0xcd && bytes[2] === 0xc6 && bytes[3] === 0x9a;
  let u = bytes;
  if (stripApm && hasApm) {
    u = bytes.slice(22);
  }
  const copy = new Uint8Array(u);
  let offset = (!stripApm && hasApm) ? 22 + 18 : 18;

  while (offset + 6 <= copy.length) {
    const rdSize = (copy[offset] | (copy[offset + 1] << 8) | (copy[offset + 2] << 16) | (copy[offset + 3] << 24)) >>> 0;
    const rdFunc = copy[offset + 4] | (copy[offset + 5] << 8);
    if (rdSize === 0 || rdFunc === 0) break;
    // META_ESCAPE (0x0626 = 1574) -> chuyển sang no-op 0x001e (META_SAVEDC)
    if (rdFunc === 0x0626) {
      copy[offset + 4] = 0x1e;
      copy[offset + 5] = 0x00;
    }
    offset += rdSize * 2;
  }
  return copy;
}

/**
 * Hậu xử lý SVG sinh ra từ MathType WMF để hiển thị siêu nét, chuẩn sư phạm trên mọi trình duyệt:
 * 1. Khử triệt để lỗi chữ 'r' (hoặc 'u u u r') hiển thị đè lên các chữ cái vector:
 *    Chuyển đổi ký tự mũi tên của MT Extra & Euclid Extra thành đường vẽ SVG path vector tuyệt đẹp.
 * 2. Thay thế ký hiệu tập hợp Blackboard Bold (¡, ¢, £, ¤, ¥) thành ℝ, ℤ, ℕ, ℚ, ℂ chuẩn Unicode.
 * 3. Thay thế dấu trừ '-' trong Symbol font thành ký tự toán học Unicode minus '−' (U+2212).
 * 4. Chuẩn hóa font-family sang các font toán quốc tế có sẵn trên mọi hệ điều hành (Cambria Math, Times New Roman, STIXGeneral).
 * 5. Loại bỏ khung viền trắng đặc để công thức toán hòa nhập tự nhiên vào giao diện ứng dụng.
 */
export function postProcessMathTypeSvg(rawSvg: string): string {
  if (!rawSvg) return rawSvg;

  // 1. Xóa rect nền trắng đặc
  let svg = rawSvg.replace(/<rect\s+[^>]*fill="#ffffff"[^>]*\/>/gi, '');

  // 2. Chuyển đổi các ký tự MT Extra blackboard bold và ký hiệu đặc biệt
  svg = svg.replace(/<text([^>]+font-family="(?:MT Extra|Euclid Extra)"[^>]*)>([^<]+)<\/text>/g, (match, attrs, char) => {
    let mapped = char;
    if (char === '¡') mapped = '&#x211D;'; // ℝ
    else if (char === '¢') mapped = '&#x2124;'; // ℤ
    else if (char === '£') mapped = '&#x2115;'; // ℕ
    else if (char === '¤') mapped = '&#x211A;'; // ℚ
    else if (char === '¥') mapped = '&#x2102;'; // ℂ
    else if (char === '`' || char === '\'') mapped = '&#x2032;'; // ′ prime
    
    if (mapped !== char) {
      const newAttrs = attrs.replace(/font-family="[^"]+"/, 'font-family="\'Cambria Math\', \'Times New Roman\', serif"');
      return `<text${newAttrs}>${mapped}</text>`;
    }
    return match;
  });

  // 3. XỬ LÝ VECTOR ARROWS TRONG MT EXTRA / EUCLID EXTRA (chuỗi 'u...r' hoặc 'r' đơn)
  interface ArrowPart {
    fullTag: string;
    char: string;
    x: number;
    y: number;
    fontSize: number;
  }
  
  const arrowRegex = /<text\s+([^>]*x="([^"]+)"[^>]*y="([^"]+)"[^>]*font-family="(?:MT Extra|Euclid Extra)"[^>]*font-size="([^"]+)"[^>]*)>([ur])<\/text>/gi;
  const parts: ArrowPart[] = [];
  let m;
  while ((m = arrowRegex.exec(svg)) !== null) {
    parts.push({
      fullTag: m[0],
      char: m[5],
      x: parseFloat(m[2]),
      y: parseFloat(m[3]),
      fontSize: parseFloat(m[4]),
    });
  }

  // Nhóm các phần tử mũi tên theo cao độ y và khoảng cách ngang liền kề (dx <= fontSize * 0.8)
  const groups: ArrowPart[][] = [];
  parts.sort((a, b) => a.x - b.x);

  for (const part of parts) {
    let placed = false;
    for (const group of groups) {
      const last = group[group.length - 1];
      const sameY = Math.abs(last.y - part.y) <= last.fontSize * 0.15;
      const closeX = (part.x - last.x) <= last.fontSize * 0.8;
      if (sameY && closeX) {
        group.push(part);
        placed = true;
        break;
      }
    }
    if (!placed) {
      groups.push([part]);
    }
  }

  // Thay thế từng nhóm thành đường vẽ mũi tên SVG (path)
  for (const group of groups) {
    const first = group[0];
    const last = group[group.length - 1];
    const fontSize = first.fontSize;
    const yBase = first.y;

    const startX = first.x;
    let endX: number;
    let headWidth = fontSize * 0.18;
    let headHeight = fontSize * 0.12;

    if (group.length === 1 && first.char === 'r') {
      // Mũi tên đơn trên 1 chữ cái vector (như \vec{u}, \vec{j}, \vec{i}, \vec{k})
      endX = startX + fontSize * 0.48;
    } else {
      // Mũi tên kép trên 2 chữ cái vector trở lên (như \overrightarrow{AB}, \overrightarrow{BA})
      endX = last.x + fontSize * 0.22;
      headWidth = fontSize * 0.20;
      headHeight = fontSize * 0.14;
    }

    const lineY = yBase - fontSize * 0.12;
    const strokeW = Math.max(fontSize * 0.065, 1.5);

    const pathD = `M ${startX.toFixed(1)} ${lineY.toFixed(1)} L ${endX.toFixed(1)} ${lineY.toFixed(1)} l -${headWidth.toFixed(1)} -${headHeight.toFixed(1)} m ${headWidth.toFixed(1)} ${headHeight.toFixed(1)} l -${headWidth.toFixed(1)} ${headHeight.toFixed(1)}`;
    const pathTag = `<path d="${pathD}" stroke="#000000" stroke-width="${strokeW.toFixed(1)}" fill="none" stroke-linecap="round" stroke-linejoin="round" />`;

    let replacedFirst = false;
    for (const item of group) {
      if (!replacedFirst) {
        svg = svg.replace(item.fullTag, pathTag);
        replacedFirst = true;
      } else {
        svg = svg.replace(item.fullTag, '');
      }
    }
  }

  // 4. Chuẩn hóa các ký hiệu toán học đặc biệt từ Symbol / MT Extra font sang Unicode entities
  svg = svg.replace(/<text([^>]+font-family="(?:Symbol|Euclid Symbol)"[^>]*)>-<\/text>/g, (_m, attrs) => {
    return `<text${attrs}>&#x2212;</text>`;
  });
  // Vuông góc \perp (0x5E '^' trong MT Extra/Symbol)
  svg = svg.replace(/<text([^>]+font-family="(?:Symbol|Euclid Symbol|MT Extra|Euclid Extra)"[^>]*)>\^<\/text>/g, (_m, attrs) => {
    return `<text${attrs}>&#x22A5;</text>`;
  });
  // Với mọi \forall (0x22 '"' trong Symbol)
  svg = svg.replace(/<text([^>]+font-family="(?:Symbol|Euclid Symbol)"[^>]*)>"<\/text>/g, (_m, attrs) => {
    return `<text${attrs}>&#x2200;</text>`;
  });
  // Tồn tại \exists (0x24 '$' trong Symbol)
  svg = svg.replace(/<text([^>]+font-family="(?:Symbol|Euclid Symbol)"[^>]*)>\$<\/text>/g, (_m, attrs) => {
    return `<text${attrs}>&#x2203;</text>`;
  });

  // 5. Chuẩn hóa font-family sang các font có độ tương thích cao trên mọi OS
  svg = svg.replace(/font-family="(?:Symbol|Euclid Symbol)"/g, 'font-family="\'Cambria Math\', \'Times New Roman\', \'STIXGeneral\', serif"');
  svg = svg.replace(/font-family="(?:MT Extra|Euclid Extra)"/g, 'font-family="\'Cambria Math\', \'Times New Roman\', serif"');

  return svg;
}

interface MathTextElement {
  char: string;
  x: number;
  y: number;
  fontSize: number;
  isItalic: boolean;
  fontFamily: string;
}

/**
 * Kiểm tra xem công thức có chứa cấu trúc 2D phức tạp (phân số nhiều tầng, ma trận, căn thức nhiều tầng) không.
 * Nếu có các ký tự cỡ chữ cơ sở chồng chéo theo phương ngang nhưng lệch hẳn theo phương đứng,
 * trả về true để giữ nguyên ảnh vector SVG sắc nét 100% thay vì chuyển đổi lỗi.
 */
function hasComplexVerticalOverlap(elements: MathTextElement[], maxFontSize: number): boolean {
  for (let i = 0; i < elements.length; i++) {
    for (let j = i + 1; j < elements.length; j++) {
      const e1 = elements[i];
      const e2 = elements[j];
      const dy = Math.abs(e1.y - e2.y);
      const isE1Small = e1.fontSize < maxFontSize * 0.75;
      const isE2Small = e2.fontSize < maxFontSize * 0.75;
      if (dy > maxFontSize * 0.65 && !isE1Small && !isE2Small) {
        const dx = Math.abs(e1.x - e2.x);
        if (dx < maxFontSize * 0.6) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Phân tích một nhóm phần tử văn bản toán học thành chuỗi LaTeX phẳng
 */
export function parseSubExpression(
  elements: MathTextElement[],
  vectorPaths: { startX: number; endX: number }[],
  maxFontSize: number,
  avgBaseY: number
): string {
  if (elements.length === 0) return '';

  const subItems: MathTextElement[] = [];
  const supItems: MathTextElement[] = [];
  const baseItems: MathTextElement[] = [];

  for (const el of elements) {
    const isSmaller = el.fontSize <= maxFontSize * 0.82;
    const dy = el.y - avgBaseY;
    if (isSmaller && dy > el.fontSize * 0.15) {
      subItems.push(el);
    } else if (isSmaller && dy < -el.fontSize * 0.25) {
      supItems.push(el);
    } else {
      baseItems.push(el);
    }
  }

  baseItems.sort((a, b) => a.x - b.x);
  subItems.sort((a, b) => a.x - b.x);
  supItems.sort((a, b) => a.x - b.x);

  const consumedSubIdxs = new Set<number>();
  let result = '';

  for (let i = 0; i < baseItems.length; i++) {
    const b = baseItems[i];
    const b2 = baseItems[i + 1];
    const b3 = baseItems[i + 2];

    const threeWord = (b.char + (b2?.char || '') + (b3?.char || '')).toLowerCase();
    const isOp3 = (threeWord === 'max' || threeWord === 'min' || threeWord === 'lim' || threeWord === 'sup' || threeWord === 'inf') &&
      b2 && b3 && Math.abs(b2.x - b.x) < maxFontSize * 1.5 && Math.abs(b3.x - b2.x) < maxFontSize * 1.5;

    if (isOp3) {
      const opName = threeWord;
      const opXStart = b.x;
      const opXEnd = b3.x + b3.fontSize * 0.8;

      const attachedSubs: MathTextElement[] = [];
      subItems.forEach((sub, sIdx) => {
        if (!consumedSubIdxs.has(sIdx) && sub.x >= opXStart - b.fontSize * 0.4 && sub.x <= opXEnd + maxFontSize * 1.8) {
          attachedSubs.push(sub);
          consumedSubIdxs.add(sIdx);
        }
      });

      let opLatex = `\\${opName}`;
      if (attachedSubs.length > 0) {
        let subStr = '';
        for (const s of attachedSubs) {
          if (s.char === ';') subStr += '; ';
          else if (s.char === ',') subStr += ', ';
          else subStr += s.char;
        }
        opLatex += `_{${subStr.trim()}}`;
      }
      result += ` ${opLatex} `;
      i += 2;
      continue;
    }

    let charText = b.char;

    // Vector arrow: Thầy Sơn yêu cầu dùng \overrightarrow{...} chuẩn sư phạm
    const hasVector = vectorPaths.some(
      (vp) => b.x >= vp.startX - b.fontSize * 0.3 && b.x <= vp.endX + b.fontSize * 0.3
    );
    if (hasVector && /^[a-zA-Z]$/.test(charText)) {
      charText = `\\overrightarrow{${charText}}`;
    }

    // Các toán tử và dấu
    if (charText === '=') result += ' = ';
    else if (charText === '+') result += ' + ';
    else if (charText === '-') {
      const prev = baseItems[i - 1]?.char;
      if (prev && /[0-9a-zA-Z\)\}]/.test(prev)) result += ' - ';
      else result += '-';
    } else if (charText === ';') result += '; ';
    else if (charText === ',') result += ', ';
    else if (charText.startsWith('\\') && !charText.startsWith('\\overrightarrow')) result += `${charText} `;
    else result += charText;

    // Subscript
    const nextBaseX = baseItems[i + 1]?.x ?? Infinity;
    const attachedNormalSubs: MathTextElement[] = [];
    subItems.forEach((sub, sIdx) => {
      if (!consumedSubIdxs.has(sIdx) && sub.x >= b.x - 5 && sub.x < nextBaseX) {
        attachedNormalSubs.push(sub);
        consumedSubIdxs.add(sIdx);
      }
    });
    if (attachedNormalSubs.length > 0) {
      result += `_{${attachedNormalSubs.map(s => s.char).join('')}}`;
    }

    // Superscript
    const attachedSups = supItems.filter((sup) => sup.x >= b.x - 5 && sup.x < nextBaseX);
    if (attachedSups.length > 0) {
      result += `^{${attachedSups.map(s => s.char).join('')}}`;
    }
  }

  result = result.trim().replace(/\s+/g, ' ');
  // Gộp các vectơ ký tự kề nhau: \overrightarrow{A}\overrightarrow{B} -> \overrightarrow{AB}
  result = result.replace(/\\overrightarrow\{([A-Z])\}\s*\\overrightarrow\{([A-Z])\}/g, '\\overrightarrow{$1$2}');
  result = result.replace(/\\overrightarrow\{([A-Za-z]{1,2})\}\s*'/g, "\\overrightarrow{$1}'");
  result = result.replace(/\\overrightarrow\{([A-Za-z]{1,2})\}\s*_{([^}]+)}/g, '\\overrightarrow{$1}_{$2}');
  result = result.replace(/\\overrightarrow\{([A-Za-z]{1,2})\}\s*_{([0-9a-zA-Z])}/g, '\\overrightarrow{$1}_{$2}');
  return result;
}

/**
 * Chuyển đổi SVG sinh ra từ MathType WMF thành công thức toán LaTeX chuẩn ($...$)
 * Hỗ trợ hoàn hảo:
 * - Phân số: \frac{...}{...}
 * - Căn thức: \sqrt{...}
 * - Tên biến, hằng số, tham số: x, y, z, t, a, b, c, d, m, B, h, V, S, I, P, Q, N, M...
 * - Tọa độ không gian và mặt phẳng: Oxyz, Oxy, (Oxy), (Oxyz), (P), (Q), (ABC)...
 * - Khoảng, đoạn, nửa khoảng: (-1; 2), (0; 1), [0; 2], (-∞; 1), (1; +∞)...
 * - Điểm và tọa độ điểm: A(1; 2; 3), M(1; -1), B(0; 2; 1)...
 * - Ký hiệu hàm số: y = f(x), f(x), f'(x), y = f'(x), f(0), f(1)...
 * - Tập hợp số: \mathbb{R}, \mathbb{Z}, \mathbb{N}, \mathbb{Q}, \mathbb{C}
 * - Đa thức và phương trình: y = x^3 - 3x^2 + 2, x = 3, y = 2, V = Bh...
 * - Vectơ toán học: \overrightarrow{u}, \overrightarrow{v}, \overrightarrow{a}, \overrightarrow{b}, \overrightarrow{AB}...
 * - Ký hiệu quan hệ và lượng từ: \perp, \parallel, \forall, \exists, \in, \notin, \le, \ge, \ne...
 * 
 * Khi phát hiện công thức quá phức tạp (phân số nhiều tầng, ma trận...), hàm trả về null
 * để hệ thống tự động giữ nguyên vector SVG siêu nét, không bao giờ làm sai lệch công thức của giáo viên.
 */
export function convertMathTypeSvgToLatex(svg: string): string | null {
  if (!svg || !svg.includes('<svg')) return null;

  // 1. Trích xuất tất cả các text element bằng attribute matcher chính xác
  const tagRegex = /<text\b([^>]*)>([\s\S]*?)<\/text>/gi;
  const elements: MathTextElement[] = [];

  let match;
  while ((match = tagRegex.exec(svg)) !== null) {
    const attrs = match[1];
    const xMatch = attrs.match(/\bx="([^"]+)"/i);
    const yMatch = attrs.match(/\by="([^"]+)"/i);
    const fsMatch = attrs.match(/\bfont-size="([^"]+)"/i);
    const ffMatch = attrs.match(/\bfont-family="([^"]+)"/i);

    if (!xMatch || !yMatch || !fsMatch) continue;
    const x = parseFloat(xMatch[1]);
    const y = parseFloat(yMatch[1]);
    const fontSize = parseFloat(fsMatch[1]);
    const fontFamily = ffMatch ? ffMatch[1] : '';
    let char = match[2].trim();
    if (!char) continue;

    // Chuyển đổi ký hiệu từ font Symbol / MT Extra nếu chưa được chuẩn hóa
    const isSymbol = fontFamily.includes('Symbol') || fontFamily.includes('MT Extra');
    if (isSymbol) {
      if (char === '^') char = '\\perp ';
      else if (char === '"') char = '\\forall ';
      else if (char === '$') char = '\\exists ';
    }

    // Decode HTML entities và ký tự toán học Unicode
    char = char
      .replace(/&#x2212;/g, '-')
      .replace(/&#x211D;/g, '\\mathbb{R}')
      .replace(/&#x2124;/g, '\\mathbb{Z}')
      .replace(/&#x2115;/g, '\\mathbb{N}')
      .replace(/&#x211A;/g, '\\mathbb{Q}')
      .replace(/&#x2102;/g, '\\mathbb{C}')
      .replace(/&#x2032;/g, "'")
      .replace(/&#x221E;/g, '\\infty')
      .replace(/&#x2208;/g, '\\in ')
      .replace(/&#x2209;/g, '\\notin ')
      .replace(/&#x2264;/g, '\\le ')
      .replace(/&#x2265;/g, '\\ge ')
      .replace(/&#x2260;/g, '\\ne ')
      .replace(/&#x22A5;/g, '\\perp ')
      .replace(/&#x2225;/g, '\\parallel ')
      .replace(/&#x2200;/g, '\\forall ')
      .replace(/&#x2203;/g, '\\exists ')
      .replace(/&#x00B1;/g, '\\pm ')
      .replace(/&#x2248;/g, '\\approx ')
      .replace(/&#x2192;/g, '\\to ')
      .replace(/&#x03B1;/g, '\\alpha ')
      .replace(/&#x03B2;/g, '\\beta ')
      .replace(/&#x03C0;/g, '\\pi ')
      .replace(/&#x0394;/g, '\\Delta ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/∞/g, '\\infty')
      .replace(/∈/g, '\\in ')
      .replace(/∉/g, '\\notin ')
      .replace(/≤/g, '\\le ')
      .replace(/≥/g, '\\ge ')
      .replace(/≠/g, '\\ne ')
      .replace(/⊥/g, '\\perp ')
      .replace(/∥/g, '\\parallel ')
      .replace(/∀/g, '\\forall ')
      .replace(/∃/g, '\\exists ')
      .replace(/±/g, '\\pm ')
      .replace(/≈/g, '\\approx ')
      .replace(/→/g, '\\to ')
      .replace(/π/g, '\\pi ')
      .replace(/Δ/g, '\\Delta ')
      .replace(/′/g, "'");

    const isItalic = attrs.includes('font-style="italic"');
    elements.push({ char, x, y, fontSize, isItalic, fontFamily });
  }

  if (elements.length === 0) return null;

  // 2. Trích xuất các vector arrows (<path ...>) sinh ra từ postProcessMathTypeSvg
  const vectorPaths: { startX: number; endX: number }[] = [];
  const pathRegex = /<path\s+d="M\s*([\d\.]+)\s+[\d\.]+\s+L\s*([\d\.]+)[^"]*l\s*-\d/gi;
  let pm;
  while ((pm = pathRegex.exec(svg)) !== null) {
    vectorPaths.push({
      startX: parseFloat(pm[1]),
      endX: parseFloat(pm[2]),
    });
  }

  // 3. Trích xuất đường kẻ phân số (fraction bar): đường thẳng ngang không phải mũi tên vector
  const fractionBars: { x1: number; y: number; x2: number; width: number }[] = [];
  const lineRegex = /<path\s+d="M\s*([\d\.]+)\s+([\d\.]+)\s+L\s*([\d\.]+)\s+([\d\.]+)"[^>]*stroke="#000000"/gi;
  let lm;
  while ((lm = lineRegex.exec(svg)) !== null) {
    if (lm[0].includes('l -')) continue; // Bỏ qua mũi tên vector
    const x1 = parseFloat(lm[1]);
    const y1 = parseFloat(lm[2]);
    const x2 = parseFloat(lm[3]);
    const y2 = parseFloat(lm[4]);
    if (Math.abs(y1 - y2) <= 1.5 && Math.abs(x2 - x1) >= 15) {
      fractionBars.push({
        x1: Math.min(x1, x2),
        x2: Math.max(x1, x2),
        y: (y1 + y2) / 2,
        width: Math.abs(x2 - x1),
      });
    }
  }

  const fontSizes = elements.map((e) => e.fontSize);
  const maxFontSize = Math.max(...fontSizes);

  // 4. XỬ LÝ PHÂN SỐ VÀ CĂN BẬC HAI
  if (fractionBars.length === 1) {
    const bar = fractionBars[0];
    const prefixEls = elements.filter(e => e.x < bar.x1 - 10);
    const numEls = elements.filter(e => e.x >= bar.x1 - 10 && e.x <= bar.x2 + 10 && e.y < bar.y);
    const denEls = elements.filter(e => e.x >= bar.x1 - 10 && e.x <= bar.x2 + 10 && e.y > bar.y);
    const suffixEls = elements.filter(e => e.x > bar.x2 + 10);

    const numBaseY = numEls.length > 0 ? Math.max(...numEls.map(e => e.y)) : bar.y - 10;
    const denBaseY = denEls.length > 0 ? Math.max(...denEls.map(e => e.y)) : bar.y + 10;
    const prefBaseY = prefixEls.length > 0 ? Math.max(...prefixEls.map(e => e.y)) : bar.y;
    const suffBaseY = suffixEls.length > 0 ? Math.max(...suffixEls.map(e => e.y)) : bar.y;

    const prefixStr = parseSubExpression(prefixEls, vectorPaths, maxFontSize, prefBaseY);
    const numStr = parseSubExpression(numEls, vectorPaths, maxFontSize, numBaseY);
    const denStr = parseSubExpression(denEls, vectorPaths, maxFontSize, denBaseY);
    const suffixStr = parseSubExpression(suffixEls, vectorPaths, maxFontSize, suffBaseY);

    let latex = '';
    if (prefixStr) latex += `${prefixStr} `;

    // Nếu không có phần tử tử số mà có phần tử dưới thanh bar -> CĂN THỨC \sqrt{...}
    if (numEls.length === 0 && denEls.length > 0) {
      latex += `\\sqrt{${denStr}}`;
    } else {
      latex += `\\frac{${numStr}}{${denStr}}`;
    }

    if (suffixStr) latex += ` ${suffixStr}`;

    latex = latex.trim().replace(/\s+/g, ' ');
    let trailingPunct = '';
    if (latex.endsWith('.')) {
      trailingPunct = '.';
      latex = latex.slice(0, -1).trim();
    } else if (latex.endsWith(',')) {
      trailingPunct = ',';
      latex = latex.slice(0, -1).trim();
    }
    return `$${latex}$${trailingPunct}`;
  }

  // 5. CÔNG THỨC KHÔNG CÓ PHÂN SỐ
  if (fractionBars.length > 1 || hasComplexVerticalOverlap(elements, maxFontSize)) {
    return null;
  }

  const baseLineElements = elements.filter((e) => e.fontSize >= maxFontSize * 0.82);
  const avgBaseY = baseLineElements.length > 0
    ? baseLineElements.reduce((acc, e) => acc + e.y, 0) / baseLineElements.length
    : elements[0].y;

  let latex = parseSubExpression(elements, vectorPaths, maxFontSize, avgBaseY);

  let trailingPunct = '';
  if (latex.endsWith('.')) {
    trailingPunct = '.';
    latex = latex.slice(0, -1).trim();
  } else if (latex.endsWith(',')) {
    trailingPunct = ',';
    latex = latex.slice(0, -1).trim();
  }

  return `$${latex}$${trailingPunct}`;
}

export interface DocxMediaInfo {
  assetId: string;
  isMathType: boolean;
  latexText?: string | null;
}

/**
 * Trích xuất toàn bộ hình ảnh và ánh xạ quan hệ rId trong file .docx
 * Tự động chuyển đổi công thức MathType (WMF/EMF) sang SVG vector siêu nét và lưu vào Asset Registry
 */
export async function extractDocxImages(zip: JSZip): Promise<Map<string, DocxMediaInfo>> {
  const rIdToMediaInfo = new Map<string, DocxMediaInfo>();
  const filenameToMediaInfo = new Map<string, DocxMediaInfo>();

  // 1. Đọc tất cả các file ảnh trong thư mục word/media/
  const mediaFiles = Object.keys(zip.files).filter((p) => p.startsWith('word/media/'));
  for (const path of mediaFiles) {
    const file = zip.file(path);
    if (!file) continue;

    const lower = path.toLowerCase();
    let assetId = '';
    let latexText: string | null = null;
    const isMathType = lower.endsWith('.wmf') || lower.endsWith('.emf');

    // Xử lý chuyển đổi WMF/EMF của MathType sang SVG vector chuẩn
    if (isMathType) {
      try {
        const rawBytes = await file.async('uint8array');
        // Giữ nguyên 22 byte APM header để SVG có đúng tỷ lệ khung hình thật (aspect ratio)
        const cleanBytes = sanitizeWmfBytes(rawBytes, false);
        const svg = renderToSvg(cleanBytes);
        if (svg && svg.includes('<svg')) {
          const cleanSvg = postProcessMathTypeSvg(svg);
          latexText = convertMathTypeSvgToLatex(cleanSvg);
          const base64 = typeof Buffer !== 'undefined'
            ? Buffer.from(cleanSvg).toString('base64')
            : btoa(unescape(encodeURIComponent(cleanSvg)));
          assetId = registerExamAsset(base64, 'image/svg+xml', 'svg', 'mathtype');
        }
      } catch (e) {
        // Fallback canvas nếu renderToSvg gặp sự cố
        try {
          if (typeof window !== 'undefined' && typeof document !== 'undefined' && WMF) {
            const rawBytes = await file.async('uint8array');
            const cleanBytes = sanitizeWmfBytes(rawBytes, true);
            const size = WMF.image_size(cleanBytes);
            const w = Math.max(size ? size[0] : 180, 40);
            const h = Math.max(size ? size[1] : 60, 20);
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            WMF.draw_canvas(cleanBytes, canvas);
            const dataUrl = canvas.toDataURL('image/png');
            const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
            assetId = registerExamAsset(base64, 'image/png', 'png', 'mathtype');
          }
        } catch {
          //
        }
      }
    }

    if (!assetId) {
      const base64 = await file.async('base64');
      let mime = 'image/png';
      let ext = 'png';
      if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
        mime = 'image/jpeg';
        ext = 'jpg';
      } else if (lower.endsWith('.svg')) {
        mime = 'image/svg+xml';
        ext = 'svg';
      } else if (lower.endsWith('.gif')) {
        mime = 'image/gif';
        ext = 'gif';
      } else if (lower.endsWith('.wmf') || lower.endsWith('.emf')) {
        mime = 'image/wmf';
        ext = 'wmf';
      }
      assetId = registerExamAsset(base64, mime, ext, isMathType ? 'mathtype' : 'fig');
    }

    const filename = path.replace('word/media/', '').trim();
    filenameToMediaInfo.set(filename, { assetId, isMathType, latexText });
  }

  // 2. Đọc file quan hệ word/_rels/document.xml.rels để liên kết rId -> filename
  const relsFile = zip.file('word/_rels/document.xml.rels');
  if (relsFile) {
    const relsXml = await relsFile.async('text');
    const relRegex = /<Relationship[^>]+Id="([^"]+)"[^>]+Target="([^"]+)"[^>]*\/?>/gi;
    let match;
    while ((match = relRegex.exec(relsXml)) !== null) {
      const rId = match[1];
      const target = match[2];
      const filename = target.replace(/^.*[\\\/]/, '');
      const mediaInfo = filenameToMediaInfo.get(filename);
      if (mediaInfo) {
        rIdToMediaInfo.set(rId, mediaInfo);
      }
    }
  }

  return rIdToMediaInfo;
}

export interface ParsedTailAnswers {
  part1: Map<number, string>;
  part2: Map<number, Record<string, boolean>>;
  part3: Map<number, string[]>;
  explanations: Map<string, string>;
}

/**
 * Phân tích phần đuôi đề thi: BẢNG ĐÁP ÁN và HƯỚNG DẪN GIẢI CHI TIẾT
 * Bóc tách đáp án Phần I (A,B,C,D), Phần II (Đúng/Sai), Phần III (Điền số) và lời giải chi tiết
 */
export function parseAnswerKeySection(tailXmlOrText: string): ParsedTailAnswers {
  const result: ParsedTailAnswers = {
    part1: new Map(),
    part2: new Map(),
    part3: new Map(),
    explanations: new Map(),
  };

  // Cắt bỏ phần Ma trận đề thi / Bản đặc tả đề thi nếu có ở cuối
  const matrixMatch = tailXmlOrText.search(/(?:MA\s*TRẬN|BẢN\s*ĐẶC\s*TẢ)/i);
  const cleanTail = matrixMatch !== -1 ? tailXmlOrText.substring(0, matrixMatch) : tailXmlOrText;

  // Xác định vị trí các phần trong đuôi tài liệu
  const p1Pos = cleanTail.search(/(?:PHẦN|Phần)\s*(?:I\b|1\b)/i);
  const p2Pos = cleanTail.search(/(?:PHẦN|Phần)\s*(?:II\b|2\b)/i);
  const p3Pos = cleanTail.search(/(?:PHẦN|Phần)\s*(?:III\b|3\b)/i);
  const lgPos = cleanTail.search(/(?:HƯỚNG\s*DẪN\s*GIẢI\s*CHI\s*TIẾT|LỜI\s*GIẢI\s*CHI\s*TIẾT|HƯỚNG\s*DẪN\s*GIẢI\s*ĐỀ)/i);

  let p1Block = '';
  let p2Block = '';
  let p3Block = '';
  let lgBlock = '';

  if (p1Pos !== -1) {
    const end = p2Pos !== -1 ? p2Pos : p3Pos !== -1 ? p3Pos : lgPos !== -1 ? lgPos : cleanTail.length;
    p1Block = cleanTail.substring(p1Pos, end);
  }
  if (p2Pos !== -1) {
    const end = p3Pos !== -1 ? p3Pos : lgPos !== -1 ? lgPos : cleanTail.length;
    p2Block = cleanTail.substring(p2Pos, end);
  }
  if (p3Pos !== -1) {
    const end = lgPos !== -1 ? lgPos : cleanTail.length;
    p3Block = cleanTail.substring(p3Pos, end);
  }
  if (lgPos !== -1) {
    lgBlock = cleanTail.substring(lgPos);
  }

  // Helper trích xuất các ô trong bảng OpenXML
  const extractRows = (block: string): string[][] => {
    const rows: string[][] = [];
    const rowMatches = block.match(/<w:tr\b[\s\S]*?<\/w:tr>/gi);
    if (!rowMatches) return rows;
    for (const tr of rowMatches) {
      const cells = tr.match(/<w:tc\b[\s\S]*?<\/w:tc>/gi) || [];
      const rowData = cells.map((c) => {
        const textMatches = c.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/gi) || [];
        return textMatches
          .map((t) => t.replace(/<[^>]+>/g, ''))
          .join('')
          .replace(/\u00A0/g, ' ')
          .trim();
      });
      if (rowData.some((cell) => cell.length > 0)) {
        rows.push(rowData);
      }
    }
    return rows;
  };

  // 1. PHẦN I: Trắc nghiệm nhiều lựa chọn
  if (p1Block) {
    const p1Rows = extractRows(p1Block);
    for (let r = 0; r < p1Rows.length; r++) {
      const row = p1Rows[r];
      // Dạng hàng ngang: [Mã đề/Câu, 1, 2, 3... 12], Hàng dưới: [1201, D, B, C...]
      const numIdxs: { col: number; qNum: number }[] = [];
      row.forEach((cell, cIdx) => {
        const n = parseInt(cell.trim(), 10);
        if (!isNaN(n) && n >= 1 && n <= 12) {
          numIdxs.push({ col: cIdx, qNum: n });
        }
      });
      if (numIdxs.length >= 4 && r + 1 < p1Rows.length) {
        const nextRow = p1Rows[r + 1];
        for (const item of numIdxs) {
          const ans = (nextRow[item.col] || '').trim().toUpperCase();
          if (/^[A-D]$/.test(ans) && !result.part1.has(item.qNum)) {
            result.part1.set(item.qNum, ans);
          }
        }
      }
      // Dạng cột dọc: [1, D, C, A...], [2, A, B, C...]
      const firstNum = parseInt((row[0] || '').replace(/Câu\s*/i, '').trim(), 10);
      if (!isNaN(firstNum) && firstNum >= 1 && firstNum <= 12 && row.length >= 2) {
        for (let c = 1; c < row.length; c++) {
          const val = row[c].trim().toUpperCase();
          if (/^[A-D]$/.test(val)) {
            if (!result.part1.has(firstNum)) result.part1.set(firstNum, val);
            break;
          }
        }
      }
    }
    // Dạng văn bản inline: "1.A 2.B 3.C..."
    const inlineRegex = /(?:^|\s|\>)(?:Câu\s*)?(\d+)[\.\s:\-]+([A-D])(?:\s|$|\<)/gi;
    let m;
    while ((m = inlineRegex.exec(p1Block)) !== null) {
      const q = parseInt(m[1], 10);
      const a = m[2].toUpperCase();
      if (q >= 1 && q <= 12 && !result.part1.has(q)) {
        result.part1.set(q, a);
      }
    }
  }

  // 2. PHẦN II: Trắc nghiệm đúng sai
  if (p2Block) {
    const p2Rows = extractRows(p2Block);
    for (let r = 0; r < p2Rows.length; r++) {
      const row = p2Rows[r];
      row.forEach((cell, cIdx) => {
        // Khớp "a)S - b)Đ - c)S - d)Đ"
        const tfParts = Array.from(cell.matchAll(/([a-d])[\s\)\.\:\-]+([ĐSđsDSds])/gi));
        if (tfParts.length >= 4) {
          let qNum = cIdx;
          if (p2Rows[r - 1] && p2Rows[r - 1][cIdx]) {
            const hNum = parseInt(p2Rows[r - 1][cIdx].replace(/\D/g, ''), 10);
            if (!isNaN(hNum)) qNum = hNum;
          }
          if (qNum >= 1 && qNum <= 4 && !result.part2.has(qNum)) {
            const tfMap: Record<string, boolean> = {};
            tfParts.forEach((p) => {
              const letter = p[1].toLowerCase();
              const val = p[2].toUpperCase();
              tfMap[letter] = val === 'Đ' || val === 'D';
            });
            result.part2.set(qNum, tfMap);
          }
        }

        // Khớp "S S Đ Đ", "Đ S S Đ", "ĐSSĐ"
        const cleanTF = cell.replace(/[\s\-\,]/g, '').toUpperCase();
        if (/^[ĐS]{4}$/.test(cleanTF)) {
          let qNum = 0;
          const rowHeadNum = parseInt((row[0] || '').replace(/\D/g, ''), 10);
          if (!isNaN(rowHeadNum) && rowHeadNum >= 1 && rowHeadNum <= 4) qNum = rowHeadNum;
          else if (p2Rows[r - 1] && p2Rows[r - 1][cIdx]) {
            const hNum = parseInt(p2Rows[r - 1][cIdx].replace(/\D/g, ''), 10);
            if (!isNaN(hNum)) qNum = hNum;
          }
          if (qNum >= 1 && qNum <= 4 && !result.part2.has(qNum)) {
            const chars = cleanTF.split('');
            result.part2.set(qNum, {
              a: chars[0] === 'Đ',
              b: chars[1] === 'Đ',
              c: chars[2] === 'Đ',
              d: chars[3] === 'Đ',
            });
          }
        }
      });
    }
  }

  // 3. PHẦN III: Trắc nghiệm trả lời ngắn (điền số)
  if (p3Block) {
    const p3Rows = extractRows(p3Block);
    for (let r = 0; r < p3Rows.length; r++) {
      const row = p3Rows[r];
      // Hàng ngang có header câu 1..6
      if (p3Rows[r - 1]) {
        const prev = p3Rows[r - 1];
        const prevHeaders = prev.map((h) => parseInt(h.replace(/\D/g, ''), 10));
        const hasQCols = prevHeaders.some((h) => !isNaN(h) && h >= 1 && h <= 6);
        if (hasQCols) {
          prevHeaders.forEach((qNum, cIdx) => {
            if (!isNaN(qNum) && qNum >= 1 && qNum <= 6 && row[cIdx] && !result.part3.has(qNum)) {
              const rawVal = row[cIdx].trim();
              if (/^[\-\+]?[\d\.\,]+$/.test(rawVal)) {
                result.part3.set(qNum, [rawVal, rawVal.replace(',', '.')]);
              }
            }
          });
        }
      }
      // Dạng cột dọc: Ô 0 là Câu 1, các ô sau là đáp án
      const firstNum = parseInt((row[0] || '').replace(/Câu\s*/i, '').trim(), 10);
      if (!isNaN(firstNum) && firstNum >= 1 && firstNum <= 6 && row.length >= 2 && !result.part3.has(firstNum)) {
        for (let c = 1; c < row.length; c++) {
          const rawVal = row[c].trim();
          if (/^[\-\+]?[\d\.\,]+$/.test(rawVal)) {
            result.part3.set(firstNum, [rawVal, rawVal.replace(',', '.')]);
            break;
          }
        }
      }
    }
  }

  // 4. HƯỚNG DẪN GIẢI CHI TIẾT
  if (lgBlock) {
    const splitter = /(?=(?:^|\n)\s*(?:<[^>]+>|\s)*(?:\[|\()? *(?:Câu|Bài|CÂU|BÀI)\s*\d+)/i;
    const blocks = lgBlock.split(splitter);
    blocks.forEach((b) => {
      const m = b.match(/^(?:<[^>]+>|\s)*(?:\[|\()? *(?:Câu|Bài|CÂU|BÀI)\s*(\d+)[\.\:\-\s]*(?:<[^>]+>|\s)*([\s\S]*)$/i);
      if (m) {
        const qNum = parseInt(m[1], 10);
        const explText = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (explText.length > 5) {
          result.explanations.set(`q-${qNum}`, explText);
        }
      }
    });
  }

  return result;
}

/**
 * Phân tích trực tiếp XML nội bộ của file Word (OMML to LaTeX, MathType & Images)
 */
async function parseDocxXmlDirectly(arrayBuffer: ArrayBuffer): Promise<{
  cleanText: string;
  tailAnswers: ParsedTailAnswers;
}> {
  const zip = await JSZip.loadAsync(arrayBuffer);
  const docFile = zip.file('word/document.xml');
  if (!docFile) throw new Error('Không tìm thấy word/document.xml trong file .docx');

  const rIdToMediaInfo = await extractDocxImages(zip);
  let xml = await docFile.async('text');

  // Chuẩn hóa ký tự khoảng trắng không ngắt \u00A0
  xml = xml.replace(/\u00A0/g, ' ');

  // 0. Xử lý danh sách đánh số tự động (Automatic Numbering <w:numPr>) từ word/numbering.xml
  // Giáo viên thường dùng tính năng Numbering tự động của Word khiến text "Câu 1.", "Câu 2." không nằm trong <w:t>
  const numFile = zip.file('word/numbering.xml');
  if (numFile) {
    try {
      const numXml = await numFile.async('text');
      const numIdToAbstractId = new Map<string, string>();
      const abstractIdToDef = new Map<string, { prefix: string; start: number }>();

      const abstractRegex = /<w:abstractNum\s+w:abstractNumId="(\d+)"[\s\S]*?<\/w:abstractNum>/gi;
      let am;
      while ((am = abstractRegex.exec(numXml)) !== null) {
        const absId = am[1];
        const aXml = am[0];
        const lvl0Match = aXml.match(/<w:lvl\s+w:ilvl="0"[\s\S]*?<\/w:lvl>/i);
        const lvlXml = lvl0Match ? lvl0Match[0] : aXml;
        const textMatch = lvlXml.match(/<w:lvlText\s+w:val="([^"]*)"/i);
        const startMatch = lvlXml.match(/<w:start\s+w:val="(\d+)"/i);
        abstractIdToDef.set(absId, {
          prefix: textMatch ? textMatch[1] : 'Câu %1:',
          start: startMatch ? parseInt(startMatch[1], 10) : 1,
        });
      }

      const numRegex = /<w:num\s+w:numId="(\d+)"[\s\S]*?<\/w:num>/gi;
      let nm;
      while ((nm = numRegex.exec(numXml)) !== null) {
        const numId = nm[1];
        const absMatch = nm[0].match(/<w:abstractNumId\s+w:val="(\d+)"/i);
        if (absMatch) numIdToAbstractId.set(numId, absMatch[1]);
      }

      const numCounters = new Map<string, number>();

      xml = xml.replace(/<w:p\b([\s\S]*?)<\/w:p>/gi, (pFull, pInner) => {
        const numMatch = pInner.match(/<w:numId\s+w:val="(\d+)"/i);
        const ilvlMatch = pInner.match(/<w:ilvl\s+w:val="(\d+)"/i);
        if (!numMatch) return pFull;

        const numId = numMatch[1];
        const ilvl = ilvlMatch ? parseInt(ilvlMatch[1], 10) : 0;
        if (ilvl !== 0) return pFull;

        const absId = numIdToAbstractId.get(numId);
        const def = absId ? abstractIdToDef.get(absId) : null;
        let prefixPattern = def?.prefix || 'Câu %1:';
        if (!prefixPattern.toLowerCase().includes('câu') && !prefixPattern.toLowerCase().includes('bài')) {
          prefixPattern = 'Câu %1.';
        }

        const curCount = (numCounters.get(numId) ?? ((def?.start ?? 1) - 1)) + 1;
        numCounters.set(numId, curCount);

        const resolvedText = prefixPattern.replace('%1', String(curCount));
        const prefixRun = `<w:r><w:rPr><w:b/></w:rPr><w:t>${resolvedText} </w:t></w:r>`;

        const pPrEndIdx = pInner.indexOf('</w:pPr>');
        if (pPrEndIdx !== -1) {
          const before = pInner.substring(0, pPrEndIdx + '</w:pPr>'.length);
          const after = pInner.substring(pPrEndIdx + '</w:pPr>'.length);
          return `<w:p${before}${prefixRun}${after}</w:p>`;
        }
        return `<w:p>${prefixRun}${pInner}</w:p>`;
      });
    } catch {
      // Bỏ qua nếu numbering.xml có cấu trúc bất thường
    }
  }

  // BÓC TÁCH ĐÁP ÁN VÀ LỜI GIẢI TỪ RAW XML TRƯỚC KHI BỎ CÁC THẺ BẢNG VÀ ĐOẠN VĂN!
  // Chỉ khớp tiêu đề bắt đầu thẻ <w:t>, tránh nhầm lẫn với cụm từ "điền đáp án", "chọn đáp án"
  const tailRegex = /<w:t[^>]*>\s*(?:BẢNG\s+ĐÁP\s+ÁN|HƯỚNG\s+DẪN\s+CHẤM|HƯỚNG\s+DẪN\s+GIẢI|ĐÁP\s+ÁN\s+VÀ\s+LỜI\s+GIẢI|ĐÁP\s+ÁN\s+CÁC\s+CÂU|ĐÁP\s+ÁN\s+KIỂM\s+TRA|ĐÁP\s+ÁN\s+ĐỀ\s+KIỂM\s+TRA|LỜI\s+GIẢI\s+CHI\s+TIẾT|LỜI\s+GIẢI|ĐÁP\s+ÁN)\b/i;
  const tailMatch = xml.match(tailRegex);
  let tailAnswers: ParsedTailAnswers = {
    part1: new Map(),
    part2: new Map(),
    part3: new Map(),
    explanations: new Map(),
  };

  if (tailMatch && tailMatch.index) {
    const pStart = xml.lastIndexOf('<w:p', tailMatch.index);
    const cutPos = pStart !== -1 ? pStart : tailMatch.index;
    const answerKeyXml = xml.substring(cutPos);
    tailAnswers = parseAnswerKeySection(answerKeyXml);
    // Cắt bỏ phần đáp án/hướng dẫn giải khỏi nội dung đề bài chính
    xml = xml.substring(0, cutPos);
  }

  // 1. Chuyển đổi mọi khối công thức toán OMML <m:oMath> và <m:oMathPara> sang LaTeX
  xml = xml.replace(/<m:oMathPara[\s\S]*?<\/m:oMathPara>/gi, (m) => {
    try {
      const latex = ommlToLatex(m);
      return latex ? `\n$$ ${latex} $$\n` : '';
    } catch {
      return '';
    }
  });

  xml = xml.replace(/<m:oMath[\s\S]*?<\/m:oMath>/gi, (m) => {
    try {
      const latex = ommlToLatex(m);
      return latex ? ` $${latex}$ ` : '';
    } catch {
      return '';
    }
  });

  // 2. Thay thế toàn bộ khối MathType (<w:object>) và <v:imagedata> thành công thức LaTeX hoặc \includegraphics chuẩn
  xml = xml.replace(/<w:object\b[\s\S]*?<\/w:object>/gi, (objXml) => {
    const idMatch =
      objXml.match(/<v:imagedata[^>]+r:id="([^"]+)"/i) ||
      objXml.match(/<v:imagedata[^>]+(?:o:relid|id)="([^"]+)"/i) ||
      objXml.match(/r:id="([^"]+)"/i);
    if (!idMatch) return '';
    const rId = idMatch[1];
    const media = rIdToMediaInfo.get(rId);
    if (!media) return '';

    // Ưu tiên hiển thị trực tiếp công thức LaTeX ($...$) nếu đã chuyển đổi thành công
    // Giúp giáo viên đọc, sửa dễ dàng trong Textarea và KaTeX hiển thị 0ms không bao giờ bị vỡ ảnh
    if (media.latexText) {
      return ` ${media.latexText} `;
    }

    // Trích xuất chiều cao từ Word XML (pt hoặc dxa) để tự động căn chỉnh tỷ lệ cân đối theo cỡ chữ
    let heightEm = 1.45;
    const styleMatch = objXml.match(/height:\s*([\d\.]+)\s*pt/i);
    if (styleMatch) {
      const pt = parseFloat(styleMatch[1]);
      if (!isNaN(pt) && pt > 0) heightEm = Math.max(1.1, Math.min(6.0, pt / 13.0));
    } else {
      const dyaMatch = objXml.match(/w:dyaOrig="(\d+)"/i);
      if (dyaMatch) {
        const pt = parseInt(dyaMatch[1], 10) / 20.0;
        if (!isNaN(pt) && pt > 0) heightEm = Math.max(1.1, Math.min(6.0, pt / 13.0));
      }
    }

    return ` \\includegraphics[height=${heightEm.toFixed(2)}em]{${media.assetId}} `;
  });

  xml = xml.replace(/<v:imagedata[^>]+(?:r:id|o:relid|id)="([^"]+)"[^>]*\/?>/gi, (_m, rId) => {
    const media = rIdToMediaInfo.get(rId);
    if (!media) return '';
    if (media.latexText) {
      return ` ${media.latexText} `;
    }
    return ` \\includegraphics{${media.assetId}} `;
  });

  // 3. Thay thế các hình ảnh vẽ đồ thị / hình học (<w:drawing> / <a:blip>) thành \includegraphics
  xml = xml.replace(/<a:blip[^>]+r:embed="([^"]+)"[^>]*\/?>/gi, (_m, rId) => {
    const media = rIdToMediaInfo.get(rId);
    return media
      ? `\n\\begin{center}\n\\includegraphics{${media.assetId}}\n\\end{center}\n`
      : '';
  });

  // 4. Xử lý các bảng trong Word:
  // Nếu là bảng phương án trắc nghiệm A, B, C, D -> phân tách bằng tab \t
  // Nếu là bảng số liệu thống kê -> tạo thành thẻ <table> để giữ nguyên cấu trúc
  xml = xml.replace(/<w:tbl\b[\s\S]*?<\/w:tbl>/gi, (tblXml) => {
    const isChoiceTable = /(?:^|\s|\>)(?:[A-D][\.\)]|[a-d]\))/i.test(tblXml);
    if (isChoiceTable) {
      return tblXml
        .replace(/<\/w:tc>/gi, '\t')
        .replace(/<\/w:tr>/gi, '\n');
    }

    // Bảng dữ liệu thống kê: chuyển thành <table> HTML
    const rows = tblXml.match(/<w:tr\b[\s\S]*?<\/w:tr>/gi) || [];
    const tableRowsHtml = rows
      .map((row) => {
        const cells = row.match(/<w:tc\b[\s\S]*?<\/w:tc>/gi) || [];
        const cellsHtml = cells
          .map((cell) => {
            const textMatch = cell.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/gi) || [];
            const cellText = textMatch.map((t) => t.replace(/<w:t[^>]*>/i, '').replace(/<\/w:t>/i, '')).join('').trim();
            return `<td class="border border-slate-300 px-3 py-2 text-center text-sm">${cellText}</td>`;
          })
          .join('');
        return `<tr>${cellsHtml}</tr>`;
      })
      .join('');

    return `\n<div class="my-4 overflow-x-auto flex justify-center"><table class="border-collapse border border-slate-300 bg-white rounded-lg shadow-2xs"><tbody>${tableRowsHtml}</tbody></table></div>\n`;
  });

  // 5. Xử lý danh sách đánh số tự động <w:numPr> cho các phương án trắc nghiệm
  // Nếu đoạn có <w:numPr> và chứa các lựa chọn B. hoặc b) thì chèn thêm nhãn A. hoặc a)
  xml = xml.replace(/<w:p\b[\s\S]*?<\/w:p>/gi, (pXml) => {
    if (/<w:numPr\b/i.test(pXml)) {
      if (/(?:<w:tab[^>]*>|\t|\s+)(?:<b>|<strong>)?\s*B[\.\)]/i.test(pXml) && !/(?:^|\>)\s*A[\.\)]/i.test(pXml)) {
        pXml = pXml.replace(/(<w:r\b[\s\S]*?<w:t[^>]*>)/i, '$1A. ');
      } else if (/(?:<w:tab[^>]*>|\t|\s+)(?:<b>|<strong>)?\s*b[\.\)]/i.test(pXml) && !/(?:^|\>)\s*a[\.\)]/i.test(pXml)) {
        pXml = pXml.replace(/(<w:r\b[\s\S]*?<w:t[^>]*>)/i, '$1a) ');
      }
    }
    return pXml;
  });

  // 6. Xử lý các đoạn văn bản <w:p>
  xml = xml.replace(/<w:p\b[^>]*>/gi, '\n');
  xml = xml.replace(/<\/w:p>/gi, '\n');

  // 7. Giữ lại đánh dấu gạch chân (u), in đậm (b), và màu đỏ (đáp án) trong các text run <w:r>
  xml = xml.replace(/<w:r\b[\s\S]*?<\/w:r>/gi, (runXml) => {
    // Trích xuất các lệnh \includegraphics hoặc math $...$ nằm trong runXml (nếu có)
    const includegraphicsMatches = runXml.match(/\\includegraphics(?:\[.*?\])?\{[^}]+\}/g) || [];
    const includegraphicsStr = includegraphicsMatches.join(' ');

    const mathMatches = runXml.match(/\$[^$]+\$/g) || [];
    const mathStr = mathMatches.join(' ');

    const textMatches = runXml.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/gi);
    if (!textMatches) {
      if (runXml.includes('<img') || runXml.includes('$') || includegraphicsStr) {
        return runXml.replace(/<w:[^>]+>/g, '').replace(/<\/w:[^>]+>/g, '').trim();
      }
      return '';
    }

    let runText = textMatches.map((t) => t.replace(/<w:t[^>]*>/i, '').replace(/<\/w:t>/i, '')).join('');

    const isUnderline = /<w:u\b/i.test(runXml);
    const isBold = /<w:b\b/i.test(runXml);
    const isRed = /<w:color[^>]+val="(?:FF0000|red|ED1C24)"/i.test(runXml);

    if (isUnderline) runText = `<u>${runText}</u>`;
    if (isBold) runText = `<b>${runText}</b>`;
    if (isRed) runText = `<span style="color:red">${runText}</span>`;

    if (includegraphicsStr) {
      runText = `${runText} ${includegraphicsStr}`;
    }
    if (mathStr && !runText.includes(mathStr)) {
      runText = `${runText} ${mathStr}`;
    }

    return runText;
  });

  // 8. Loại bỏ tất cả các thẻ XML OpenXML còn lại
  let cleanText = xml
    .replace(/<\/?[a-zA-Z0-9_-]+:[^>]+>/gi, ' ')
    .trim();

  // Hợp nhất các thẻ liền kề chỉ cách nhau bởi khoảng trắng ngang, không nuốt dòng ngắt \n
  cleanText = cleanText
    .replace(/<\/b>[ \t]*<b>/gi, ' ')
    .replace(/<\/strong>[ \t]*<strong>/gi, ' ')
    .replace(/<\/u>[ \t]*<u>/gi, ' ')
    .replace(/<(?:b|strong|u|span)[^>]*>[ \t]*<\/(?:b|strong|u|span)>/gi, ' ');

  // Giải mã các thực thể HTML cơ bản
  cleanText = cleanText
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"');

  // 9. Chuẩn hóa các ký hiệu toán học phổ biến trong văn bản Word:
  // - Chuẩn hóa tập xác định: D = \mathbb{R}\{-2\} -> $D = \mathbb{R} \setminus \{-2\}$
  cleanText = cleanText.replace(/\$?\s*(?:D\s*=\s*)?\\mathbb\{R\}\s*\\?\s*\{([^}]+)\}\s*\$?/, (_m, p1) => {
    return ` $D = \\mathbb{R} \\setminus \\{${p1.trim()}\\} $ `;
  });
  cleanText = cleanText.replace(/\\mathbb\{R\}\s*\\?\s*\{([^}]+)\}/g, '\\mathbb{R} \\setminus \\{$1\\}');

  // - Chuẩn hóa toàn bộ vector sang định dạng \overrightarrow{...}
  cleanText = cleanText.replace(/\\vec\{/g, '\\overrightarrow{');

  // - Chuẩn hóa ký hiệu vuông góc bị dính dạng mũ \overrightarrow{d}^\overrightarrow{a} -> \overrightarrow{d} \perp \overrightarrow{a}
  cleanText = cleanText.replace(/\\overrightarrow\{([a-zA-Z])\}\s*\^\s*\\overrightarrow\{([a-zA-Z])\}/g, '\\overrightarrow{$1} \\perp \\overrightarrow{$2}');

  // - Chuẩn hóa ký hiệu lượng từ với mọi "x -> \forall x
  cleanText = cleanText.replace(/<\s*0\s*"\s*x/g, '< 0, \\forall x');

  // - Đảm bảo khoảng trắng sau các lệnh macro toán học tránh dính chữ (ví dụ \gef(40m) -> \ge f(40m))
  cleanText = cleanText.replace(/\\(ge|le|perp|parallel|forall|exists|in|notin|ne|pm|approx|to)\b([a-zA-Z0-9\(])/g, '\\$1 $2');

  return { cleanText, tailAnswers };
}

export interface ExamSectionBlock {
  part: 1 | 2 | 3 | 4;
  title: string;
  body: string;
}

/**
 * Phân chia văn bản đề thi thành các Section chuẩn Bộ Giáo dục & Đào tạo 2025.
 * Chịu được mọi lỗi OCR (hoa/thường, có dấu/không dấu: PHẦN, PHAN, Phần, Phan, phan)
 * Dòng tiêu đề Section kết thúc câu trước và là mốc bắt đầu phần mới, KHÔNG thuộc câu nào!
 */
export function splitDocumentIntoSections(text: string): ExamSectionBlock[] {
  const sectionHeaderRegex = /(?:^|\n)\s*(?:<[^>]+>|\s)*(?:(?:PHẦN|PHAN|Phần|Phan|phan|Ph\u1EA7n)\b(?:<[^>]+>|\s)*([I|V|X]+|[1-4])\b[^\n]*|(?:(?:PHẦN|PHAN|Phần|Phan|phan)\s+)?TỰ\s*LUẬN\b[^\n]*)/gi;
  const matches = Array.from(text.matchAll(sectionHeaderRegex));

  if (matches.length === 0) {
    return [{ part: 1, title: '', body: text }];
  }

  const sections: ExamSectionBlock[] = [];

  // Nếu trước section đầu tiên có câu hỏi (hoặc văn bản), cho vào phần mở đầu
  const firstMatch = matches[0];
  const firstIndex = firstMatch.index ?? 0;
  if (firstIndex > 0) {
    const preText = text.substring(0, firstIndex).trim();
    if (preText && /(?:Câu|Bài)\s*\d+/i.test(preText)) {
      sections.push({
        part: 1,
        title: 'MỞ ĐẦU',
        body: preText,
      });
    }
  }

  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i];
    const next = matches[i + 1];
    const headerStr = cur[0].trim();
    let part: 1 | 2 | 3 | 4 = 1;

    if (/TỰ\s*LUẬN/i.test(headerStr)) {
      part = 4;
    } else if (cur[1]) {
      const p = cur[1].toUpperCase();
      if (p === 'IV' || p === '4') part = 4;
      else if (p === 'III' || p === '3') part = 3;
      else if (p === 'II' || p === '2') part = 2;
      else part = 1;
    }

    const startIdx = (cur.index ?? 0) + cur[0].length;
    const endIdx = next ? (next.index ?? text.length) : text.length;
    const bodyStr = text.substring(startIdx, endIdx).trim();

    sections.push({
      part,
      title: headerStr,
      body: bodyStr,
    });
  }

  return sections;
}

/**
 * Loại bỏ triệt để và di trú toàn bộ chuỗi base64 hoặc thẻ <img src="data:..."> khỏi Question
 */
export function cleanLegacyBase64FromQuestions(questions: Question[]): Question[] {
  return questions.map((q) => {
    const cleanContent = sanitizeNoBase64OrRawHtml(q.content);
    const cleanOptions = (q.options || []).map((opt: any) => {
      if (typeof opt === 'string') {
        return sanitizeNoBase64OrRawHtml(opt);
      }
      return {
        ...opt,
        text: sanitizeNoBase64OrRawHtml(opt.text || ''),
      };
    });
    const cleanExplanation = q.explanation ? sanitizeNoBase64OrRawHtml(q.explanation) : q.explanation;
    return {
      ...q,
      content: cleanContent,
      options: cleanOptions,
      explanation: cleanExplanation,
    };
  });
}

/**
 * Kiểm tra xem danh sách câu hỏi có còn bị dính base64 hoặc HTML thô <img> hay không
 */
export function validateNoBase64InQuestions(questions: Question[]): boolean {
  for (const q of questions) {
    if (containsBase64OrImgTag(q.content)) return false;
    for (const opt of q.options || []) {
      const text = typeof opt === 'string' ? opt : opt.text || '';
      if (containsBase64OrImgTag(text)) return false;
    }
    if (q.explanation && containsBase64OrImgTag(q.explanation)) return false;
  }
  return true;
}

/**
 * Phân tích file Word .docx thành danh sách câu hỏi đề thi Toán THPT chuẩn định dạng
 */
export async function parseWordDocx(fileOrBuffer: File | ArrayBuffer | Uint8Array | Buffer): Promise<{
  questions: Question[];
  rawText: string;
  assets?: any[];
}> {
  let arrayBuffer: ArrayBuffer;
  if (typeof File !== 'undefined' && fileOrBuffer instanceof File) {
    arrayBuffer = await fileOrBuffer.arrayBuffer();
  } else if (fileOrBuffer instanceof ArrayBuffer) {
    arrayBuffer = fileOrBuffer;
  } else {
    // Buffer hoặc Uint8Array từ Node.js
    const buf = fileOrBuffer as Uint8Array;
    arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  }

  let examContent = '';
  let tailAnswers: ParsedTailAnswers = {
    part1: new Map(),
    part2: new Map(),
    part3: new Map(),
    explanations: new Map(),
  };

  try {
    const parsed = await parseDocxXmlDirectly(arrayBuffer);
    examContent = parsed.cleanText;
    tailAnswers = parsed.tailAnswers;
  } catch (err) {
    console.warn('Fallback to mammoth parser:', err);
    const options = {
      convertImage: mammoth.images.imgElement((image: any) => {
        return image.read('base64').then((buf: string) => {
          const mime = image.contentType || 'image/png';
          const ext = mime.split('/')[1] || 'png';
          const assetId = registerExamAsset(buf, mime, ext, 'fig');
          return { src: assetId };
        });
      }),
    };
    const res = await mammoth.convertToHtml({ arrayBuffer }, options);
    examContent = res.value
      .replace(/<img\b[^>]*src=["'](asset_[^"']+)["'][^>]*>/gi, '\\includegraphics{$1}')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n');
  }

  // Tách câu hỏi theo biểu thức đa dạng, hỗ trợ mọi thẻ lồng giữa "Câu" và số
  const questionSplitter = /(?=(?:^|\n)\s*(?:<[^>]+>|\s)*(?:\[|\()? *(?:Câu|Bài|CÂU|BÀI)\s*\d+(?:<[^>]+>|\s)*(?:\]|\)|\.|\:|\-|\s))/i;

  // 1. CHIA TÀI LIỆU THÀNH CÁC PHẦN (SECTION) ĐỘC LẬP TRƯỚC KHI TÁCH CÂU
  const sections = splitDocumentIntoSections(examContent);
  const questions: Question[] = [];
  let globalQIndex = 0;

  for (const section of sections) {
    const rawBlocks = section.body.split(questionSplitter).map((b) => b.trim()).filter(Boolean);

    for (const block of rawBlocks) {
      const matchHead = block.match(/^(?:<[^>]+>|\s)*(?:\[|\()? *(?:Câu|Bài|CÂU|BÀI)(?:<[^>]+>|\s)*(\d+)(?:<[^>]+>|\s)*(?:\]|\)|\.|\:|\-|\s)*(?:<[^>]+>|\s)*([\s\S]*)$/i);
      if (!matchHead) continue;

      globalQIndex++;
      const questionNumber = parseInt(matchHead[1], 10) || globalQIndex;
      const body = matchHead[2].trim();

      // Tách Lời giải / Hướng dẫn giải inline nếu có
      let contentAndChoices = body;
      let explanation = '';
      const lgMatch = body.match(/(?:^|\n)\s*(?:<b>|<strong>|<u>|<p[^>]*>)?\s*(?:Lời\s*giải|Hướng\s*dẫn\s*giải|\bHDG\b|\bBeginLG\b|\bFB\s*tác\s*giả\b)[\.:\s]*([\s\S]*)$/i);
      if (lgMatch) {
        explanation = lgMatch[1].trim();
        contentAndChoices = body.substring(0, lgMatch.index).trim();
      }

      // Đảm bảo không dính bất kỳ tiêu đề Section nào ở đuôi
      contentAndChoices = contentAndChoices.replace(/(?:^|\n)\s*(?:PHẦN|PHAN|Phần|Phan|phan)\s*(?:[I|V|X]+|[1-4])\b[^\n]*/gi, '').trim();

      const choiceRegex = /(?:^|[\n\t\r\.\,\;]|\s+)(?:<[^>]+>|\s)*\s*(?:\[|\()?([A-D])(?:<[^>]+>|\s)*(?:\]|\)|\.|\:|\-)(?:<[^>]+>|\s)*/gi;
      const tfRegex = /(?:^|[\n\t\r\.\,\;]|\s+)(?:<[^>]+>|\s)*\s*(?:\[|\()?([a-d])(?:<[^>]+>|\s)*(?:\]|\)|\.|\:|\-)(?:<[^>]+>|\s)*/gi;

      const choicesMatches = Array.from(contentAndChoices.matchAll(choiceRegex));
      const tfMatches = Array.from(contentAndChoices.matchAll(tfRegex));

      let type: QuestionType = 'single_choice';
      let part: 1 | 2 | 3 | 4 = section.part;
      let points = 0.25;
      let options: any[] = [];
      let correctAnswer: any = null;
      let questionContent = contentAndChoices;

      if (part === 1) {
        // PHẦN I: Trắc nghiệm 4 lựa chọn A, B, C, D
        type = 'single_choice';
        points = 0.25;

        if (choicesMatches.length >= 3) {
          const firstChoicePos = choicesMatches[0].index ?? 0;
          questionContent = contentAndChoices.substring(0, firstChoicePos).trim();

          for (let i = 0; i < choicesMatches.length; i++) {
            const cur = choicesMatches[i];
            const next = choicesMatches[i + 1];
            const label = cur[1].toUpperCase();
            if (options.some((o) => o.id === label)) {
              if (!explanation) {
                explanation = contentAndChoices.substring(cur.index ?? 0).trim();
              }
              break;
            }
            const optStart = (cur.index ?? 0) + cur[0].length;
            const optEnd = next ? (next.index ?? contentAndChoices.length) : contentAndChoices.length;
            let optText = contentAndChoices.substring(optStart, optEnd).trim();

            // QUY TẮC CẮT BỎ TIÊU ĐỀ PHẦN KHỎI PHƯƠNG ÁN CUỐI CÙNG (CÂU 12 PHƯƠNG ÁN D)
            optText = optText.replace(/(?:^|\n)\s*(?:PHẦN|PHAN|Phần|Phan|phan)\s*(?:[I|V|X]+|[1-4])\b[\s\S]*$/i, '').trim();

            const isMarked =
              cur[0].includes('<u>') ||
              optText.includes('<u>') ||
              optText.includes('color:red') ||
              optText.includes('color: red') ||
              optText.includes('FF0000') ||
              cur[0].includes('color:red') ||
              cur[0].includes('color: red') ||
              cur[0].includes('FF0000');

            optText = optText.replace(/<\/?(?:b|strong|u|span|p)[^>]*>/gi, '').trim();

            if (isMarked && !correctAnswer) {
              correctAnswer = label;
            }

            options.push({
              id: label,
              text: optText,
            });
          }

          // Lấy đáp án từ bảng đáp án nếu có
          if (!correctAnswer && tailAnswers.part1.has(questionNumber)) {
            correctAnswer = tailAnswers.part1.get(questionNumber);
          }
          if (!correctAnswer && explanation) {
            const ansMatch = explanation.match(/(?:Chọn|Đáp án|Đ\/A)[\s:]*([A-D])/i);
            if (ansMatch) correctAnswer = ansMatch[1].toUpperCase();
          }
          if (!correctAnswer) correctAnswer = 'A';
        }
      } else if (part === 2) {
        // PHẦN II: Trắc nghiệm Đúng / Sai 4 ý a, b, c, d
        type = 'true_false';
        points = 1.0;

        if (tfMatches.length >= 3) {
          const firstTfPos = tfMatches[0].index ?? 0;
          questionContent = contentAndChoices.substring(0, firstTfPos).trim();

          const tailTf = tailAnswers.part2.get(questionNumber);
          const correctMap: Record<string, boolean> = tailTf
            ? { ...tailTf }
            : { a: false, b: false, c: false, d: false };

          for (let i = 0; i < tfMatches.length; i++) {
            const cur = tfMatches[i];
            const next = tfMatches[i + 1];
            const label = cur[1].toLowerCase();
            if (options.some((o) => o.id === label)) {
              if (!explanation) {
                explanation = contentAndChoices.substring(cur.index ?? 0).trim();
              }
              break;
            }
            const start = (cur.index ?? 0) + cur[0].length;
            const end = next ? (next.index ?? contentAndChoices.length) : contentAndChoices.length;
            let stmtText = contentAndChoices.substring(start, end).trim();

            // Cắt bỏ bất kỳ chữ PHẦN nào còn sót
            stmtText = stmtText.replace(/(?:^|\n)\s*(?:PHẦN|PHAN|Phần|Phan|phan)\s*(?:[I|V|X]+|[1-4])\b[\s\S]*$/i, '').trim();

            if (!tailTf) {
              const isTrue = /[\(\[]?\s*Đúng\s*[\)\]]?/i.test(stmtText);
              if (isTrue) correctMap[label] = true;
            }

            stmtText = stmtText.replace(/[\(\[]?\s*(?:Đúng|Sai)\s*[\)\]]?/gi, '').trim();
            stmtText = stmtText.replace(/<\/?(?:b|strong|u|span|p)[^>]*>/gi, '').trim();
            options.push({
              id: label,
              text: stmtText,
            });
          }
          correctAnswer = correctMap;
        }
      } else if (part === 3) {
        // PHẦN III: Trả lời ngắn / Điền số
        type = 'short_answer';
        points = 0.5;
        questionContent = contentAndChoices.trim();

        if (tailAnswers.part3.has(questionNumber)) {
          correctAnswer = tailAnswers.part3.get(questionNumber);
        } else {
          const numMatch = explanation.match(/(?:Đáp số|Kết quả)[\s:]*([\d\,\.\-\/]+)/i);
          if (numMatch) {
            const rawAns = numMatch[1].trim();
            correctAnswer = [rawAns, rawAns.replace(',', '.')];
          } else {
            correctAnswer = ['0'];
          }
        }
      } else {
        // PHẦN IV: Tự luận
        type = 'essay';
        points = 2.0;
        questionContent = contentAndChoices.trim();
        correctAnswer = explanation || 'Trình bày lời giải chi tiết';
      }

      // Bổ sung lời giải chi tiết từ đuôi đề nếu có
      if (!explanation && tailAnswers.explanations.has(`q-${questionNumber}`)) {
        explanation = tailAnswers.explanations.get(`q-${questionNumber}`)!;
      }

      // Làm sạch thẻ HTML OpenXML còn sót trong questionContent
      questionContent = questionContent.replace(/<\/?(?:b|strong|u|span|p)[^>]*>/gi, '').trim();

      const topic = detectMathTopic(questionContent + ' ' + explanation);
      let difficulty: QuestionDifficulty = 'thong_hieu';
      if (part === 1) difficulty = questionNumber <= 4 ? 'nhan_biet' : 'thong_hieu';
      else if (part === 2 || part === 3) difficulty = 'van_dung';
      else if (part === 4) difficulty = 'van_dung_cao';

      questions.push({
        id: `word-q-${Date.now()}-${questionNumber}`,
        teacher_id: '11111111-1111-1111-1111-111111111111',
        grade: 12,
        topic,
        part,
        difficulty,
        type,
        content: questionContent,
        options,
        correct_answer: correctAnswer,
        explanation,
        points,
        is_public: true,
      });
    }
  }

  // Khử sạch 100% mọi chuỗi base64 hoặc thẻ <img trước khi trả về
  const cleanQuestions = cleanLegacyBase64FromQuestions(questions);

  return { questions: cleanQuestions, rawText: examContent, assets: getAllExamAssets() };
}

/**
 * Chuyển đổi một chuỗi Base64 Data URL định dạng WMF/EMF sang PNG Base64 thông qua Canvas trình duyệt
 */
export function convertWmfDataUrlToPng(dataUrl: string): string {
  if (typeof window === 'undefined' || typeof document === 'undefined' || !WMF) return dataUrl;
  if (!dataUrl.startsWith('data:image/wmf;base64,') && !dataUrl.startsWith('data:image/emf;base64,')) {
    return dataUrl;
  }
  try {
    const base64 = dataUrl.split(',')[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const cleanBytes = sanitizeWmfBytes(bytes, true);
    const size = WMF.image_size(cleanBytes);
    const w = Math.max(size ? size[0] : 180, 40);
    const h = Math.max(size ? size[1] : 60, 20);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    WMF.draw_canvas(cleanBytes, canvas);
    return canvas.toDataURL('image/png');
  } catch (e) {
    console.warn('convertWmfDataUrlToPng fallback error:', e);
    return dataUrl;
  }
}

/**
 * Quét toàn bộ nội dung câu hỏi, đáp án, lời giải và chuyển đổi các ảnh WMF còn sót sang PNG
 */
export function convertWmfQuestionsToPng(questions: Question[]): Question[] {
  if (typeof window === 'undefined' || typeof document === 'undefined') return questions;
  return questions.map((q) => {
    let content = q.content;
    let explanation = q.explanation || '';
    const replacer = (_m: string, dataUrl: string) => {
      const pngUrl = convertWmfDataUrlToPng(dataUrl);
      return `src="${pngUrl}"`;
    };
    content = content.replace(/src="(data:image\/(?:wmf|emf);base64,[^"]+)"/gi, replacer);
    explanation = explanation.replace(/src="(data:image\/(?:wmf|emf);base64,[^"]+)"/gi, replacer);
    const options = (q.options || []).map((opt: any) => ({
      ...opt,
      text: (opt.text || '').replace(/src="(data:image\/(?:wmf|emf);base64,[^"]+)"/gi, replacer),
    }));
    return {
      ...q,
      content,
      explanation,
      options,
    };
  });
}
