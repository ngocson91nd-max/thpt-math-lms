import JSZip from 'jszip';
import mammoth from 'mammoth';
import { ommlToLatex } from 'dwml-ts';
import { renderToSvg } from 'wmf-emf-renderer';
import { Question, QuestionType, QuestionDifficulty } from '../../types/database';
import { detectMathTopic } from '../latex/examParser';

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

  // 4. Chuẩn hóa dấu trừ '-' trong Symbol font thành ký tự toán học Unicode minus '−' (U+2212)
  svg = svg.replace(/<text([^>]+font-family="(?:Symbol|Euclid Symbol)"[^>]*)>-<\/text>/g, (_m, attrs) => {
    return `<text${attrs}>&#x2212;</text>`;
  });

  // 5. Chuẩn hóa font-family sang các font có độ tương thích cao trên mọi OS
  svg = svg.replace(/font-family="(?:Symbol|Euclid Symbol)"/g, 'font-family="\'Cambria Math\', \'Times New Roman\', \'STIXGeneral\', serif"');
  svg = svg.replace(/font-family="(?:MT Extra|Euclid Extra)"/g, 'font-family="\'Cambria Math\', \'Times New Roman\', serif"');

  return svg;
}

/**
 * Trích xuất toàn bộ hình ảnh và ánh xạ quan hệ rId trong file .docx
 * Tự động chuyển đổi công thức MathType (WMF/EMF) sang SVG vector siêu nét, hiển thị mượt mà trên mọi trình duyệt
 */
async function extractDocxImages(zip: JSZip): Promise<Map<string, string>> {
  const rIdToDataUrl = new Map<string, string>();
  const filenameToDataUrl = new Map<string, string>();

  // 1. Đọc tất cả các file ảnh trong thư mục word/media/
  const mediaFiles = Object.keys(zip.files).filter((p) => p.startsWith('word/media/'));
  for (const path of mediaFiles) {
    const file = zip.file(path);
    if (!file) continue;

    const lower = path.toLowerCase();
    let dataUrl = '';

    // Xử lý chuyển đổi WMF/EMF của MathType sang SVG vector chuẩn
    if (lower.endsWith('.wmf') || lower.endsWith('.emf')) {
      try {
        const rawBytes = await file.async('uint8array');
        // Giữ nguyên 22 byte APM header để SVG có đúng tỷ lệ khung hình thật (aspect ratio)
        const cleanBytes = sanitizeWmfBytes(rawBytes, false);
        const svg = renderToSvg(cleanBytes);
        if (svg && svg.includes('<svg')) {
          const cleanSvg = postProcessMathTypeSvg(svg);
          const base64 = typeof Buffer !== 'undefined'
            ? Buffer.from(cleanSvg).toString('base64')
            : btoa(unescape(encodeURIComponent(cleanSvg)));
          dataUrl = `data:image/svg+xml;base64,${base64}`;
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
            dataUrl = canvas.toDataURL('image/png');
          }
        } catch {
          //
        }
      }
    }

    if (!dataUrl) {
      const base64 = await file.async('base64');
      let mime = 'image/png';
      if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) mime = 'image/jpeg';
      else if (lower.endsWith('.svg')) mime = 'image/svg+xml';
      else if (lower.endsWith('.gif')) mime = 'image/gif';
      else if (lower.endsWith('.wmf') || lower.endsWith('.emf')) mime = 'image/wmf';
      dataUrl = `data:${mime};base64,${base64}`;
    }

    const filename = path.replace('word/media/', '').trim();
    filenameToDataUrl.set(filename, dataUrl);
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
      const dataUrl = filenameToDataUrl.get(filename);
      if (dataUrl) {
        rIdToDataUrl.set(rId, dataUrl);
      }
    }
  }

  return rIdToDataUrl;
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

  const rIdToDataUrl = await extractDocxImages(zip);
  let xml = await docFile.async('text');

  // Chuẩn hóa ký tự khoảng trắng không ngắt \u00A0
  xml = xml.replace(/\u00A0/g, ' ');

  // BÓC TÁCH ĐÁP ÁN VÀ LỜI GIẢI TỪ RAW XML TRƯỚC KHI BỎ CÁC THẺ BẢNG VÀ ĐOẠN VĂN!
  const tailRegex = /(?:BẢNG\s+ĐÁP\s+ÁN|HƯỚNG\s+DẪN\s+CHẤM|HƯỚNG\s+DẪN\s+GIẢI|ĐÁP\s+ÁN\s+VÀ\s+LỜI\s+GIẢI|ĐÁP\s+ÁN\s+CÁC\s+CÂU|ĐÁP\s+ÁN\s+ĐỀ\s+KIỂM\s+TRA|ĐÁP\s+ÁN)/i;
  const tailMatch = xml.match(tailRegex);
  let tailAnswers: ParsedTailAnswers = {
    part1: new Map(),
    part2: new Map(),
    part3: new Map(),
    explanations: new Map(),
  };

  if (tailMatch && tailMatch.index) {
    const answerKeyXml = xml.substring(tailMatch.index);
    tailAnswers = parseAnswerKeySection(answerKeyXml);
    // Cắt bỏ phần đáp án/hướng dẫn giải khỏi nội dung đề bài chính
    xml = xml.substring(0, tailMatch.index);
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

  // 2. Thay thế toàn bộ khối MathType (<w:object>) và <v:imagedata> thành hình ảnh công thức toán inline
  xml = xml.replace(/<w:object\b[\s\S]*?<\/w:object>/gi, (objXml) => {
    const idMatch =
      objXml.match(/<v:imagedata[^>]+r:id="([^"]+)"/i) ||
      objXml.match(/<v:imagedata[^>]+(?:o:relid|id)="([^"]+)"/i) ||
      objXml.match(/r:id="([^"]+)"/i);
    if (!idMatch) return '';
    const rId = idMatch[1];
    const dataUrl = rIdToDataUrl.get(rId);
    if (!dataUrl) return '';

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

    return ` <img src="${dataUrl}" class="inline-math-svg inline align-middle mx-1 my-0.5 object-contain" style="height:${heightEm.toFixed(2)}em;width:auto;vertical-align:-0.32em;" alt="công thức MathType" /> `;
  });

  xml = xml.replace(/<v:imagedata[^>]+(?:r:id|o:relid|id)="([^"]+)"[^>]*\/?>/gi, (_m, rId) => {
    const dataUrl = rIdToDataUrl.get(rId);
    return dataUrl
      ? ` <img src="${dataUrl}" class="inline-math-svg inline align-middle mx-1 my-0.5 object-contain" style="height:1.45em;width:auto;vertical-align:-0.32em;" alt="công thức MathType" /> `
      : '';
  });

  // 3. Thay thế các hình ảnh vẽ đồ thị / hình học (<w:drawing> / <a:blip>)
  xml = xml.replace(/<a:blip[^>]+r:embed="([^"]+)"[^>]*\/?>/gi, (_m, rId) => {
    const dataUrl = rIdToDataUrl.get(rId);
    return dataUrl
      ? `\n<div class="my-3 flex justify-center"><img src="${dataUrl}" class="max-w-md rounded-xl border border-slate-200 shadow-2xs" alt="Hình vẽ đề thi" /></div>\n`
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
    const textMatches = runXml.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/gi);
    if (!textMatches) {
      if (runXml.includes('<img') || runXml.includes('$')) {
        return runXml.replace(/<w:[^>]+>/g, '').replace(/<\/w:[^>]+>/g, '');
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

  return { cleanText, tailAnswers };
}

/**
 * Phân tích file Word .docx thành danh sách câu hỏi đề thi Toán THPT chuẩn định dạng
 */
export async function parseWordDocx(fileOrBuffer: File | ArrayBuffer | Uint8Array | Buffer): Promise<{
  questions: Question[];
  rawText: string;
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
        return image.read('base64').then((buf: string) => ({
          src: `data:${image.contentType};base64,${buf}`,
        }));
      }),
    };
    const res = await mammoth.convertToHtml({ arrayBuffer }, options);
    examContent = res.value
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n');
  }

  // 0. BẢO VỆ TOÀN BỘ THẺ <img ...> VÀ DỮ LIỆU BASE64 TRƯỚC KHI TÁCH CÂU VÀ ĐÁP ÁN!
  const imgPlaceholders = new Map<string, string>();
  let imgCounter = 0;
  const safeExamContent = examContent.replace(/<img\b[^>]*>/gi, (imgTag) => {
    const token = `@@DOCX_IMG_${imgCounter++}@@`;
    imgPlaceholders.set(token, imgTag);
    return token;
  });

  const restoreDocxImages = (str: string): string => {
    if (!str) return str;
    return str.replace(/@@DOCX_IMG_\d+@@/g, (token) => imgPlaceholders.get(token) || token);
  };

  // Vị trí các phần trong tài liệu (hỗ trợ cả chữ La Mã, số Ả Rập và từ khóa Tự luận)
  const p1Pos = safeExamContent.search(/(?:PHẦN|Phần)\s*(?:I\b|1\b)/i);
  const p2Pos = safeExamContent.search(/(?:PHẦN|Phần)\s*(?:II\b|2\b)/i);
  const p3Pos = safeExamContent.search(/(?:PHẦN|Phần)\s*(?:III\b|3\b)/i);
  const p4Pos = safeExamContent.search(/(?:PHẦN|Phần)\s*(?:IV\b|4\b)|(?:PHẦN\s+)?TỰ\s*LUẬN\b|BÀI\s*TẬP\s*TỰ\s*LUẬN\b/i);

  // Tách câu hỏi theo biểu thức đa dạng, hỗ trợ mọi thẻ lồng giữa "Câu" và số
  const questionSplitter = /(?=(?:^|\n)\s*(?:<[^>]+>|\s)*(?:\[|\()? *(?:Câu|Bài|CÂU|BÀI)\s*\d+(?:<[^>]+>|\s)*(?:\]|\)|\.|\:|\-|\s))/i;
  const rawBlocks = safeExamContent.split(questionSplitter).map((b) => b.trim()).filter(Boolean);

  const questions: Question[] = [];
  let qIndex = 0;
  let currentCursor = 0;

  for (const block of rawBlocks) {
    const matchHead = block.match(/^(?:<[^>]+>|\s)*(?:\[|\()? *(?:Câu|Bài|CÂU|BÀI)(?:<[^>]+>|\s)*(\d+)(?:<[^>]+>|\s)*(?:\]|\)|\.|\:|\-|\s)*(?:<[^>]+>|\s)*([\s\S]*)$/i);
    if (!matchHead) continue;

    qIndex++;
    const questionNumber = parseInt(matchHead[1], 10) || qIndex;
    const body = matchHead[2].trim();

    // 1. Tách Lời giải / Hướng dẫn giải inline
    let contentAndChoices = body;
    let explanation = '';
    const lgMatch = body.match(/(?:^|\n)\s*(?:<b>|<strong>|<u>|<p[^>]*>)?\s*(?:Lời\s*giải|Hướng\s*dẫn\s*giải|\bHDG\b)[\.:\s]*([\s\S]*)$/i);
    if (lgMatch) {
      explanation = lgMatch[1].trim();
      contentAndChoices = body.substring(0, lgMatch.index).trim();
    }

    // Xác định phần của câu hỏi dựa trên vị trí con trỏ trong tài liệu
    let blockPos = safeExamContent.indexOf(block, currentCursor);
    if (blockPos === -1) {
      blockPos = safeExamContent.indexOf(block);
    } else {
      currentCursor = blockPos + 20;
    }

    const hasSections = p1Pos !== -1 || p2Pos !== -1 || p3Pos !== -1 || p4Pos !== -1;
    let sectionPart: 1 | 2 | 3 | 4 = 1;
    if (p4Pos !== -1 && blockPos >= p4Pos) sectionPart = 4;
    else if (p3Pos !== -1 && blockPos >= p3Pos) sectionPart = 3;
    else if (p2Pos !== -1 && blockPos >= p2Pos) sectionPart = 2;
    else if (p1Pos !== -1 && blockPos >= p1Pos) sectionPart = 1;

    // 2. Nhận diện các phương án trắc nghiệm A., B., C., D. và a), b), c), d)
    const choiceRegex = /(?:^|[\n\t\r\.\,\;]|\s+)(?:<[^>]+>|\s)*\s*(?:\[|\()?([A-D])(?:<[^>]+>|\s)*(?:\]|\)|\.|\:|\-)(?:<[^>]+>|\s)*/gi;
    const tfRegex = /(?:^|[\n\t\r\.\,\;]|\s+)(?:<[^>]+>|\s)*\s*(?:\[|\()?([a-d])(?:<[^>]+>|\s)*(?:\]|\)|\.|\:|\-)(?:<[^>]+>|\s)*/gi;

    const choicesMatches = Array.from(contentAndChoices.matchAll(choiceRegex));
    const tfMatches = Array.from(contentAndChoices.matchAll(tfRegex));

    let type: QuestionType = 'single_choice';
    let part: 1 | 2 | 3 | 4 = sectionPart;
    let points = 0.25;
    let options: any[] = [];
    let correctAnswer: any = null;
    let questionContent = contentAndChoices;

    // Kiểm tra câu tự luận rõ ràng hoặc nằm trong Phần Tự luận
    const isExplicitEssay =
      sectionPart === 4 ||
      /(?:^|\s)(?:Tự\s*luận|TỰ\s*LUẬN|Bài\s*toán|Chứng\s*minh\s*rằng|Giải\s*phương\s*trình)/i.test(body);

    const hasTrueFalseKeywords = /(?:Đúng|Sai|\[Đ\]|\[S\])/i.test(contentAndChoices);

    const isPart1 = hasSections ? sectionPart === 1 : (choicesMatches.length >= 3 && !isExplicitEssay);
    const isPart2 = hasSections ? sectionPart === 2 : (!isPart1 && tfMatches.length >= 3 && !isExplicitEssay && (hasTrueFalseKeywords || tailAnswers.part2.has(questionNumber)));
    const isPart3 = hasSections ? sectionPart === 3 : (!isPart1 && !isPart2 && (body.includes('Điền kết quả') || body.includes('bằng bao nhiêu') || tailAnswers.part3.has(questionNumber)) && !isExplicitEssay);

    if (isPart1) {
      // Dạng Trắc nghiệm 4 lựa chọn (Phần I)
      type = 'single_choice';
      part = 1;
      points = 0.25;

      if (choicesMatches.length >= 3) {
        const firstChoicePos = choicesMatches[0].index ?? 0;
        questionContent = contentAndChoices.substring(0, firstChoicePos).trim();

        const choicePositions: { label: string; start: number; fullMatch: string }[] = [];
        choicesMatches.forEach((m) => {
          choicePositions.push({
            label: m[1].toUpperCase(),
            start: m.index ?? 0,
            fullMatch: m[0],
          });
        });

        for (let i = 0; i < choicePositions.length; i++) {
          const cur = choicePositions[i];
          const next = choicePositions[i + 1];
          const optStart = cur.start + cur.fullMatch.length;
          const optEnd = next ? next.start : contentAndChoices.length;
          let optText = contentAndChoices.substring(optStart, optEnd).trim();

          // Chỉ xem là được đánh dấu đáp án nếu gạch chân <u> hoặc có màu đỏ
          const isMarked =
            cur.fullMatch.includes('<u>') ||
            optText.includes('<u>') ||
            optText.includes('color:red') ||
            optText.includes('color: red') ||
            optText.includes('FF0000') ||
            cur.fullMatch.includes('color:red') ||
            cur.fullMatch.includes('color: red') ||
            cur.fullMatch.includes('FF0000');

          optText = optText.replace(/<\/?(?:b|strong|u|span|p)[^>]*>/gi, '').trim();

          if (isMarked && !correctAnswer) {
            correctAnswer = cur.label;
          }

          options.push({
            id: cur.label,
            text: optText,
          });
        }

        // Ưu tiên lấy đáp án từ bảng đáp án ở cuối tài liệu nếu có
        if (!correctAnswer && tailAnswers.part1.has(questionNumber)) {
          correctAnswer = tailAnswers.part1.get(questionNumber);
        }

        if (!correctAnswer && explanation) {
          const ansMatch = explanation.match(/(?:Chọn|Đáp án|Đ\/A)[\s:]*([A-D])/i);
          if (ansMatch) correctAnswer = ansMatch[1].toUpperCase();
        }
        if (!correctAnswer) correctAnswer = 'A';
      }
    } else if (isPart2) {
      // Dạng Đúng / Sai (Phần II)
      type = 'true_false';
      part = 2;
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
          const start = (cur.index ?? 0) + cur[0].length;
          const end = next ? (next.index ?? 0) : contentAndChoices.length;
          let stmtText = contentAndChoices.substring(start, end).trim();

          if (!tailTf) {
            const isTrue = /[\(\[]?\s*Đúng\s*[\)\]]?/i.test(stmtText);
            if (isTrue) correctMap[label] = true;
          }

          stmtText = stmtText.replace(/[\(\[]?\s*(?:Đúng|Sai)\s*[\)\]]?/gi, '').trim();
          options.push({
            id: label,
            text: stmtText,
          });
        }
        correctAnswer = correctMap;
      }
    } else if (isPart3) {
      // Dạng Trả lời ngắn / điền số (Phần III)
      type = 'short_answer';
      part = 3;
      points = 0.5;

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
      // Mặc định là Tự luận (Phần IV)
      type = 'essay';
      part = 4;
      points = 2.0;
      correctAnswer = explanation || 'Trình bày lời giải chi tiết';
    }

    // Nếu chưa có lời giải inline, lấy từ phần HƯỚNG DẪN GIẢI CHI TIẾT ở đuôi tài liệu
    if (!explanation && tailAnswers.explanations.has(`q-${questionNumber}`)) {
      explanation = tailAnswers.explanations.get(`q-${questionNumber}`)!;
    }

    // Làm sạch câu hỏi nhưng giữ lại các thẻ <img> và <table>
    questionContent = questionContent.replace(/<\/?(?:b|strong|u|span|p)[^>]*>/gi, '').trim();

    // 3. Phục hồi toàn bộ thẻ ảnh <img> từ placeholders sau khi đã hoàn tất bóc tách câu hỏi và đáp án
    questionContent = restoreDocxImages(questionContent);
    explanation = restoreDocxImages(explanation);
    const restoredOptions = options.map((opt: any) => ({
      ...opt,
      text: restoreDocxImages(opt.text),
    }));

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
      options: restoredOptions,
      correct_answer: correctAnswer,
      explanation,
      points,
      is_public: true,
    });
  }

  return { questions, rawText: examContent };
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
