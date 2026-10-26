import JSZip from 'jszip';
import mammoth from 'mammoth';
import { ommlToLatex } from 'dwml-ts';
import { Question, QuestionType, QuestionDifficulty } from '@/types/database';
import { detectMathTopic } from '@/lib/latex/examParser';

/**
 * Trích xuất toàn bộ hình ảnh và ánh xạ quan hệ rId trong file .docx
 */
async function extractDocxImages(zip: JSZip): Promise<Map<string, string>> {
  const rIdToDataUrl = new Map<string, string>();
  const filenameToDataUrl = new Map<string, string>();

  // 1. Đọc tất cả các file ảnh trong thư mục word/media/
  const mediaFiles = Object.keys(zip.files).filter((p) => p.startsWith('word/media/'));
  for (const path of mediaFiles) {
    const file = zip.file(path);
    if (!file) continue;

    const base64 = await file.async('base64');
    const lower = path.toLowerCase();
    let mime = 'image/png';
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) mime = 'image/jpeg';
    else if (lower.endsWith('.svg')) mime = 'image/svg+xml';
    else if (lower.endsWith('.gif')) mime = 'image/gif';
    else if (lower.endsWith('.wmf') || lower.endsWith('.emf')) mime = 'image/png'; // WMF fallback

    const dataUrl = `data:${mime};base64,${base64}`;
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
 * Phân tích trực tiếp XML nội bộ của file Word (OMML to LaTeX & Images)
 */
async function parseDocxXmlDirectly(arrayBuffer: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(arrayBuffer);
  const docFile = zip.file('word/document.xml');
  if (!docFile) throw new Error('Không tìm thấy word/document.xml trong file .docx');

  const rIdToDataUrl = await extractDocxImages(zip);
  let xml = await docFile.async('text');

  // 1. Chuyển đổi mọi khối công thức toán OMML <m:oMath> và <m:oMathPara> sang LaTeX
  xml = xml.replace(/<m:oMathPara[\s\S]*?<\/m:oMathPara>/gi, (m) => {
    try {
      const latex = ommlToLatex(m);
      return latex ? ` $${latex}$ ` : '';
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

  // 2. Thay thế các hình ảnh nhúng Drawing / Pict sang thẻ <img>
  xml = xml.replace(/<a:blip[^>]+r:embed="([^"]+)"[^>]*\/?>/gi, (_m, rId) => {
    const dataUrl = rIdToDataUrl.get(rId);
    return dataUrl ? ` <img src="${dataUrl}" class="max-w-md mx-auto my-3 rounded-xl border border-slate-200" alt="Hình vẽ đề thi" /> ` : '';
  });

  xml = xml.replace(/<v:imagedata[^>]+r:id="([^"]+)"[^>]*\/?>/gi, (_m, rId) => {
    const dataUrl = rIdToDataUrl.get(rId);
    return dataUrl ? ` <img src="${dataUrl}" class="max-w-md mx-auto my-3 rounded-xl border border-slate-200" alt="Hình vẽ đề thi" /> ` : '';
  });

  // 3. Xử lý các đoạn văn bản <w:p> và ô bảng <w:tc>
  // Chuyển <w:p> thành xuống dòng \n
  xml = xml.replace(/<\/w:p>/gi, '\n');
  xml = xml.replace(/<\/w:tc>/gi, '\t'); // Ô trong bảng cách nhau bằng tab
  xml = xml.replace(/<\/w:tr>/gi, '\n'); // Hàng trong bảng xuống dòng

  // 4. Giữ lại đánh dấu gạch chân (u) và in đậm (b) trong các text run <w:r>
  xml = xml.replace(/<w:r\b[\s\S]*?<\/w:r>/gi, (runXml) => {
    // Trích xuất text trong <w:t>
    const textMatches = runXml.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/gi);
    if (!textMatches) {
      // Có thể runXml chứa thẻ <img> hoặc $...$ đã thay thế ở trên
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

  // 5. Loại bỏ tất cả các thẻ XML OpenXML còn lại
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
 * Phân tích file Word .docx thành danh sách câu hỏi đề thi Toán THPT
 */
export async function parseWordDocx(fileOrBuffer: File | ArrayBuffer): Promise<{
  questions: Question[];
  rawText: string;
}> {
  let arrayBuffer: ArrayBuffer;
  if (fileOrBuffer instanceof File) {
    arrayBuffer = await fileOrBuffer.arrayBuffer();
  } else {
    arrayBuffer = fileOrBuffer;
  }

  let textWithMathAndImages = '';

  try {
    // Ưu tiên phương pháp phân tích sâu OOXML (OMML + Images)
    textWithMathAndImages = await parseDocxXmlDirectly(arrayBuffer);
  } catch (err) {
    console.warn('Fallback to mammoth parser:', err);
    // Phương pháp dự phòng qua mammoth
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

  // Tách câu hỏi theo biểu thức: "Câu 1:", "Câu 1.", "Câu 1 ", "Bài 1:"
  const questionSplitter = /(?=(?:^|\n)\s*(?:<b>|<strong>|<u>)*\s*(?:Câu|Bài)\s*\d+[\.:\s])/i;
  const rawBlocks = textWithMathAndImages.split(questionSplitter).map((b) => b.trim()).filter(Boolean);

  const questions: Question[] = [];
  let qIndex = 0;

  for (const block of rawBlocks) {
    const matchHead = block.match(/^(?:<b>|<strong>|<u>)*\s*(?:Câu|Bài)\s*(\d+)[\.:\s]*(?:<\/b>|<\/strong>|<\/u>)*([\s\S]*)$/i);
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

    // 2. Nhận diện các phương án trắc nghiệm A., B., C., D. (kể cả trong bảng hoặc cách nhau bởi tab)
    // Hỗ trợ A., A), [A], <u>A</u>., <b>A.</b>
    const choiceRegex = /(?:^|\n|\t|\s{2,})(?:<b>|<strong>|<u>)?\s*([A-D])[\.\)]\s*(?:<\/b>|<\/strong>|<\/u>)?/gi;
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

      if (!correctAnswer && explanation) {
        const ansMatch = explanation.match(/(?:Chọn|Đáp án|Đ\/A)[\s:]*([A-D])/i);
        if (ansMatch) correctAnswer = ansMatch[1].toUpperCase();
      }
      if (!correctAnswer) correctAnswer = 'A';
    } else {
      // Kiểm tra xem có phải là dạng Đúng / Sai (a, b, c, d)
      const tfMatches = Array.from(contentAndChoices.matchAll(/(?:^|\n|\t|\s{2,})\s*([a-d])\)\s*/gi));
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
        if (hasNumberAns || body.includes('Điền kết quả') || body.includes('bằng bao nhiêu')) {
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

    // Làm sạch câu hỏi nhưng giữ lại các thẻ <img>
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
