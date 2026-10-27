import JSZip from 'jszip';
import mammoth from 'mammoth';
import { ommlToLatex } from 'dwml-ts';
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
 * 1. Cắt bỏ 22 byte tiêu đề Aldus APM (Placeable Metafile 0x9AC6CDD7) nếu có.
 * 2. Thay thế record META_ESCAPE 1574 (chứa comment MathType) thành dummy record
 *    để thư viện WMF giải mã trơn tru mà không bị văng Exception Escape Comment.
 */
export function sanitizeWmfBytes(bytes: Uint8Array): Uint8Array {
  let u = bytes;
  // Bóc tách 22 bytes Aldus APM header (0x9AC6CDD7) nếu có
  if (u.length >= 22 && u[0] === 0xd7 && u[1] === 0xcd && u[2] === 0xc6 && u[3] === 0x9a) {
    u = u.slice(22);
  }
  const copy = new Uint8Array(u);
  let offset = 18;
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
 * Trích xuất toàn bộ hình ảnh và ánh xạ quan hệ rId trong file .docx
 * Tự động chuyển đổi công thức MathType (WMF) sang PNG Base64 trong môi trường client (Canvas)
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

    // Xử lý chuyển đổi WMF của MathType sang PNG thông qua Canvas
    if ((lower.endsWith('.wmf') || lower.endsWith('.emf')) && WMF) {
      try {
        const rawBytes = await file.async('uint8array');
        const cleanBytes = sanitizeWmfBytes(rawBytes);

        if (typeof window !== 'undefined' && typeof document !== 'undefined') {
          const size = WMF.image_size(cleanBytes);
          const w = Math.max(size ? size[0] : 180, 40);
          const h = Math.max(size ? size[1] : 60, 20);
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          WMF.draw_canvas(cleanBytes, canvas);
          dataUrl = canvas.toDataURL('image/png');
        }
      } catch (e) {
        console.warn('WMF canvas conversion fallback:', e);
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

/**
 * Phân tích trực tiếp XML nội bộ của file Word (OMML to LaTeX, MathType & Images)
 */
async function parseDocxXmlDirectly(arrayBuffer: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(arrayBuffer);
  const docFile = zip.file('word/document.xml');
  if (!docFile) throw new Error('Không tìm thấy word/document.xml trong file .docx');

  const rIdToDataUrl = await extractDocxImages(zip);
  let xml = await docFile.async('text');

  // Chuẩn hóa ký tự khoảng trắng không ngắt \u00A0
  xml = xml.replace(/\u00A0/g, ' ');

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
    return dataUrl
      ? ` <img src="${dataUrl}" class="inline-math-img inline align-middle mx-1 my-0.5 max-h-8 object-contain" alt="công thức MathType" /> `
      : '';
  });

  xml = xml.replace(/<v:imagedata[^>]+(?:r:id|o:relid|id)="([^"]+)"[^>]*\/?>/gi, (_m, rId) => {
    const dataUrl = rIdToDataUrl.get(rId);
    return dataUrl
      ? ` <img src="${dataUrl}" class="inline-math-img inline align-middle mx-1 my-0.5 max-h-8 object-contain" alt="công thức MathType" /> `
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

  // 5. Xử lý các đoạn văn bản <w:p>
  xml = xml.replace(/<\/w:p>/gi, '\n');

  // 6. Giữ lại đánh dấu gạch chân (u), in đậm (b), và màu đỏ (đáp án) trong các text run <w:r>
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

  // 7. Loại bỏ tất cả các thẻ XML OpenXML còn lại (hỗ trợ mọi namespace w, w14, w15, w16, v, o, m, a, wp, pic...)
  let cleanText = xml
    .replace(/<\/?[a-zA-Z0-9_-]+:[^>]+>/gi, ' ')
    .trim();

  // Hợp nhất các thẻ in đậm, in nghiêng liền kề và xóa thẻ định dạng rỗng
  cleanText = cleanText
    .replace(/<\/b>\s*<b>/gi, ' ')
    .replace(/<\/strong>\s*<strong>/gi, ' ')
    .replace(/<\/u>\s*<u>/gi, ' ')
    .replace(/<(?:b|strong|u|span)[^>]*>\s*<\/(?:b|strong|u|span)>/gi, ' ');

  // Giải mã các thực thể HTML cơ bản
  cleanText = cleanText
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"');

  return cleanText;

  return cleanText;
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

  let textWithMathAndImages = '';

  try {
    textWithMathAndImages = await parseDocxXmlDirectly(arrayBuffer);
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
    textWithMathAndImages = res.value
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n');
  }

  // Cắt bỏ phần BẢNG ĐÁP ÁN / HƯỚNG DẪN GIẢI CHI TIẾT ở cuối đề thi nếu có
  const tailMatch = textWithMathAndImages.match(/(?:BẢNG ĐÁP ÁN|HƯỚNG DẪN GIẢI CHI TIẾT|ĐÁP ÁN VÀ LỜI GIẢI|ĐÁP ÁN CÁC CÂU)/i);
  let examContent = textWithMathAndImages;
  let answerKeyBlock = '';
  if (tailMatch && tailMatch.index) {
    examContent = textWithMathAndImages.substring(0, tailMatch.index);
    answerKeyBlock = textWithMathAndImages.substring(tailMatch.index);
  }

  // Quét bảng đáp án ở cuối đề thi nếu có (VD: "BẢNG ĐÁP ÁN: 1.A 2.B 3.C...")
  const answerKeyMap = new Map<number, string>();
  const targetAnsText = answerKeyBlock || textWithMathAndImages;
  const ansRegex = /(\d+)[\.\s:\-]+([A-D])/gi;
  let m;
  while ((m = ansRegex.exec(targetAnsText)) !== null) {
    answerKeyMap.set(parseInt(m[1], 10), m[2].toUpperCase());
  }

  // 0. BẢO VỆ TOÀN BỘ THẺ <img ...> VÀ DỮ LIỆU BASE64 TRƯỚC KHI TÁCH CÂU VÀ ĐÁP ÁN!
  // Đảm bảo tuyệt đối không để chuỗi base64 bị dính từ khóa như "HDG", "A.", "B.", v.v.
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

  // Vị trí các phần trong tài liệu (tính trên chuỗi an toàn safeExamContent đồng nhất với blockPos)
  const p1Pos = safeExamContent.search(/(?:PHẦN|Phần)\s*(?:I\b|1\b)/i);
  const p2Pos = safeExamContent.search(/(?:PHẦN|Phần)\s*(?:II\b|2\b)/i);
  const p3Pos = safeExamContent.search(/(?:PHẦN|Phần)\s*(?:III\b|3\b)/i);
  const p4Pos = safeExamContent.search(/(?:PHẦN|Phần)\s*(?:IV\b|4\b)/i);

  // Tách câu hỏi theo biểu thức đa dạng, hỗ trợ mọi thẻ lồng giữa "Câu" và số
  const questionSplitter = /(?=(?:^|\n)\s*(?:<[^>]+>|\s)*(?:\[|\()? *(?:Câu|Bài|CÂU|BÀI)(?:<[^>]+>|\s)*\d+(?:<[^>]+>|\s)*(?:\]|\)|\.|\:|\-|\s))/i;
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

    // 1. Tách Lời giải / Hướng dẫn giải (yêu cầu đầu dòng hoặc thẻ mở, và ranh giới từ \bHDG\b)
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

    // 2. Nhận diện các phương án trắc nghiệm A., B., C., D. (trên 1 dòng, nhiều dòng, hoặc ô bảng)
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

    const isPart1 = hasSections ? sectionPart === 1 : choicesMatches.length >= 3;
    const isPart2 = hasSections ? sectionPart === 2 : !isPart1 && tfMatches.length >= 3;
    const isPart3 = hasSections ? sectionPart === 3 : !isPart1 && !isPart2 && (body.includes('Điền kết quả') || body.includes('bằng bao nhiêu'));

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

          // Kiểm tra xem phương án có được gạch chân, in đậm hoặc bôi đỏ đáp án không
          const isMarked =
            cur.fullMatch.includes('<u>') ||
            cur.fullMatch.includes('<strong>') ||
            cur.fullMatch.includes('<b>') ||
            optText.includes('<u>') ||
            optText.includes('color:red') ||
            optText.includes('color: red') ||
            optText.includes('FF0000');

          optText = optText.replace(/<\/?(?:b|strong|u|span|p)[^>]*>/gi, '').trim();

          if (isMarked && !correctAnswer) {
            correctAnswer = cur.label;
          }

          options.push({
            id: cur.label,
            text: optText,
          });
        }

        // Kiểm tra thêm từ bảng đáp án ở cuối tài liệu
        if (!correctAnswer && answerKeyMap.has(questionNumber)) {
          correctAnswer = answerKeyMap.get(questionNumber);
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

        const correctMap: Record<string, boolean> = { a: false, b: false, c: false, d: false };

        for (let i = 0; i < tfMatches.length; i++) {
          const cur = tfMatches[i];
          const next = tfMatches[i + 1];
          const label = cur[1].toLowerCase();
          const start = (cur.index ?? 0) + cur[0].length;
          const end = next ? (next.index ?? 0) : contentAndChoices.length;
          let stmtText = contentAndChoices.substring(start, end).trim();

          const isTrue = /[\(\[]?\s*Đúng\s*[\)\]]?/i.test(stmtText);
          if (isTrue) correctMap[label] = true;

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

      const numMatch = explanation.match(/(?:Đáp số|Kết quả)[\s:]*([\d\,\.\-\/]+)/i);
      if (numMatch) {
        const rawAns = numMatch[1].trim();
        correctAnswer = [rawAns, rawAns.replace(',', '.')];
      } else {
        correctAnswer = ['0'];
      }
    } else {
      // Mặc định là Tự luận (Phần IV)
      type = 'essay';
      part = 4;
      points = 2.0;
      correctAnswer = explanation || 'Trình bày lời giải chi tiết';
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

  return { questions, rawText: textWithMathAndImages };
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
    const cleanBytes = sanitizeWmfBytes(bytes);
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
