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
      if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        try {
          const uint8 = await file.async('uint8array');
          const size = WMF.image_size(uint8);
          const w = Math.max(size ? size[0] : 180, 40);
          const h = Math.max(size ? size[1] : 60, 20);
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          WMF.draw_canvas(uint8, canvas);
          dataUrl = canvas.toDataURL('image/png');
        } catch (e) {
          console.warn('WMF canvas conversion fallback:', e);
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

  // 2. Thay thế MathType (<w:object> / <v:imagedata>) thành hình ảnh công thức toán inline
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

  // 7. Loại bỏ tất cả các thẻ XML OpenXML còn lại
  let cleanText = xml
    .replace(/<w:[^>]+>/gi, '')
    .replace(/<\/w:[^>]+>/gi, '')
    .replace(/<m:[^>]+>/gi, '')
    .replace(/<\/m:[^>]+>/gi, '')
    .replace(/<v:[^>]+>/gi, '')
    .replace(/<\/v:[^>]+>/gi, '')
    .replace(/<a:[^>]+>/gi, '')
    .replace(/<\/a:[^>]+>/gi, '')
    .replace(/<wp:[^>]+>/gi, '')
    .replace(/<\/wp:[^>]+>/gi, '')
    .replace(/<pic:[^>]+>/gi, '')
    .replace(/<\/pic:[^>]+>/gi, '')
    .trim();

  // Giải mã các thực thể HTML cơ bản
  cleanText = cleanText
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"');

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

  // Quét bảng đáp án ở cuối đề thi nếu có (VD: "BẢNG ĐÁP ÁN: 1.A 2.B 3.C...")
  const answerKeyMap = new Map<number, string>();
  const answerKeyBlockMatch = textWithMathAndImages.match(/(?:BẢNG ĐÁP ÁN|ĐÁP ÁN CÁC CÂU)[\s\S]*$/i);
  if (answerKeyBlockMatch) {
    const ansRegex = /(\d+)[\.\s:\-]+([A-D])/gi;
    let m;
    while ((m = ansRegex.exec(answerKeyBlockMatch[0])) !== null) {
      answerKeyMap.set(parseInt(m[1], 10), m[2].toUpperCase());
    }
  }

  // Vị trí các phần trong tài liệu nếu có
  const p1Pos = textWithMathAndImages.search(/(?:PHẦN|Phần)\s*(?:I\b|1\b)/i);
  const p2Pos = textWithMathAndImages.search(/(?:PHẦN|Phần)\s*(?:II\b|2\b)/i);
  const p3Pos = textWithMathAndImages.search(/(?:PHẦN|Phần)\s*(?:III\b|3\b)/i);
  const p4Pos = textWithMathAndImages.search(/(?:PHẦN|Phần)\s*(?:IV\b|4\b)/i);

  // Tách câu hỏi theo biểu thức đa dạng: "Câu 1:", "Câu 1.", "Câu 1 ", "Bài 1:", "[Câu 1]", "CÂU 1"
  const questionSplitter = /(?=(?:^|\n)\s*(?:<b>|<strong>|<u>|<p[^>]*>)*\s*(?:\[|\()? *(?:Câu|Bài|CÂU|BÀI) *\d+ *(?:\]|\)|\.|\:|\-|\s))/i;
  const rawBlocks = textWithMathAndImages.split(questionSplitter).map((b) => b.trim()).filter(Boolean);

  const questions: Question[] = [];
  let qIndex = 0;

  for (const block of rawBlocks) {
    const matchHead = block.match(/^(?:<b>|<strong>|<u>|<p[^>]*>)*\s*(?:\[|\()? *(?:Câu|Bài|CÂU|BÀI) *(\d+) *(?:\]|\)|\.|\:|\-|\s)*(?:<\/b>|<\/strong>|<\/u>|<\/p>)*([\s\S]*)$/i);
    if (!matchHead) continue;

    qIndex++;
    const questionNumber = parseInt(matchHead[1], 10) || qIndex;
    const body = matchHead[2].trim();

    // 1. Tách Lời giải / Hướng dẫn giải
    let contentAndChoices = body;
    let explanation = '';
    const lgMatch = body.match(/(?:Lời giải|Hướng dẫn giải|HDG)[\.:\s]*([\s\S]*)$/i);
    if (lgMatch) {
      explanation = lgMatch[1].trim();
      contentAndChoices = body.substring(0, lgMatch.index).trim();
    }

    // 2. Nhận diện các phương án trắc nghiệm A., B., C., D. (trên 1 dòng, nhiều dòng, hoặc ô bảng)
    const choiceRegex = /(?:^|\n|\t|\s{2,})(?:<b>|<strong>|<u>|<span[^>]*>)?\s*(?:\[|\()?([A-D])(?:\]|\)|\.|\:)(?:\s*<\/(?:b|strong|u|span)>)?\s*/gi;
    const choicesMatches = Array.from(contentAndChoices.matchAll(choiceRegex));

    let type: QuestionType = 'single_choice';
    let part: 1 | 2 | 3 | 4 = 1;
    let points = 0.25;
    let options: any[] = [];
    let correctAnswer: any = null;
    let questionContent = contentAndChoices;

    if (choicesMatches.length >= 3) {
      // Dạng Trắc nghiệm 4 lựa chọn (Phần I)
      type = 'single_choice';
      part = 1;
      points = 0.25;

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
    } else {
      // Kiểm tra xem có phải là dạng Đúng / Sai (a, b, c, d)
      const tfMatches = Array.from(contentAndChoices.matchAll(/(?:^|\n|\t|\s{2,})(?:<b>|<strong>|<u>)?\s*(?:\[|\()?([a-d])(?:\]|\)|\.|\:)(?:\s*<\/(?:b|strong|u)>)?\s*/gi));
      if (tfMatches.length >= 3) {
        type = 'true_false';
        part = 2;
        points = 1.0;

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
      } else {
        // Kiểm tra xem có phải dạng Trả lời ngắn (điền số)
        const hasNumberAns = explanation && /(?:Đáp số|Kết quả)[\s:]*([\d\,\.\-\/]+)/i.test(explanation);
        if (hasNumberAns || body.includes('Điền kết quả') || body.includes('bằng bao nhiêu') || (p3Pos !== -1 && p4Pos === -1)) {
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
      }
    }

    // Làm sạch câu hỏi nhưng giữ lại các thẻ <img> và <table>
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

  return { questions, rawText: textWithMathAndImages };
}
