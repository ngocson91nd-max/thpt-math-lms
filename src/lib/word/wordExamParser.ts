import mammoth from 'mammoth';
import { Question, QuestionType, QuestionDifficulty } from '@/types/database';
import { detectMathTopic } from '@/lib/latex/examParser';

/**
 * Chuẩn hóa các ký hiệu toán học phổ biến trong Word sang cú pháp LaTeX KaTeX ($...$)
 */
function normalizeWordMath(text: string): string {
  if (!text) return '';
  let str = text;

  // Bọc các biểu thức toán có chứa dấu phép tính toán học phổ biến vào $...$ nếu chưa có
  // Tránh bọc lại nếu đã nằm trong $...$
  const commonReplacements: [RegExp, string][] = [
    [/&lt;/g, '<'],
    [/&gt;/g, '>'],
    [/&amp;/g, '&'],
    [/&nbsp;/g, ' '],
    [/&plusmn;/g, '$\\pm$'],
    [/&le;/g, '$\\le$'],
    [/&ge;/g, '$\\ge$'],
    [/&ne;/g, '$\\ne$'],
    [/&infin;/g, '$\\infty$'],
    [/&rarr;/g, '$\\to$'],
    [/&harr;/g, '$\\iff$'],
    [/&pi;/g, '$\\pi$'],
    [/&alpha;/g, '$\\alpha$'],
    [/&beta;/g, '$\\beta$'],
    [/&int;/g, '$\\int$'],
    [/&sum;/g, '$\\sum$'],
    [/&radic;/g, '$\\sqrt{}$'],
    [/&times;/g, '$\\times$'],
    [/&divide;/g, '$\\div$'],
  ];

  for (const [regex, rep] of commonReplacements) {
    str = str.replace(regex, rep);
  }

  return str;
}

/**
 * Tách và phân tích tài liệu Word (.docx) thành danh sách câu hỏi chuẩn hóa
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

  // Cấu hình mammoth để trích xuất ảnh nhúng thành Data URI Base64
  const options = {
    convertImage: mammoth.images.imgElement((image: any) => {
      return image.read('base64').then((imageBuffer: string) => {
        return {
          src: `data:${image.contentType};base64,${imageBuffer}`,
        };
      });
    }),
  };

  const result = await mammoth.convertToHtml({ arrayBuffer }, options);
  const html = result.value;

  // Chuẩn hóa thẻ HTML về dạng dòng để dễ phân tích
  let cleanHtml = html
    .replace(/<\/p>/gi, '\n')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<div[^>]*>/gi, '')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<h[1-6][^>]*>/gi, '')
    .trim();

  // Nhận diện các câu hỏi bằng regex: "Câu 1:", "Câu 1.", "Câu 1 ", "Bài 1:"
  const questionSplitter = /(?=(?:^|\n)(?:Câu|Bài)\s*\d+[\.:\s])/i;
  const rawBlocks = cleanHtml.split(questionSplitter).map((b) => b.trim()).filter(Boolean);

  const questions: Question[] = [];
  let qIndex = 0;

  for (const block of rawBlocks) {
    // Kiểm tra xem block có phải là câu hỏi không
    const matchHead = block.match(/^(?:Câu|Bài)\s*(\d+)[\.:\s]*([\s\S]*)$/i);
    if (!matchHead) continue;

    qIndex++;
    const questionNumber = parseInt(matchHead[1], 10) || qIndex;
    const body = matchHead[2].trim();

    // 1. Kiểm tra Lời giải
    let contentAndChoices = body;
    let explanation = '';
    const lgMatch = body.match(/(?:Lời giải|Hướng dẫn giải|HDG)[\.:\s]*([\s\S]*)$/i);
    if (lgMatch) {
      explanation = lgMatch[1].trim();
      contentAndChoices = body.substring(0, lgMatch.index).trim();
    }

    // 2. Kiểm tra phương án trắc nghiệm A., B., C., D.
    const choiceRegex = /(?:^|\n|\s)(?:<b>|<strong>|<u>)?\s*([A-D])[\.\)]\s*(?:<\/b>|<\/strong>|<\/u>)?/gi;
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

        // Kiểm tra xem phương án có được gạch chân (<u>), in đậm (<b>), hoặc tô màu để đánh dấu đáp án đúng không
        const isMarked =
          cur.fullMatch.includes('<u>') ||
          cur.fullMatch.includes('<strong>') ||
          cur.fullMatch.includes('<b>') ||
          optText.includes('<u>') ||
          optText.includes('color: red') ||
          optText.includes('color:#f');

        // Làm sạch thẻ HTML trong option text nhưng giữ lại <img>
        optText = optText.replace(/<\/?(?:b|strong|u|span|p)[^>]*>/gi, '').trim();

        if (isMarked && !correctAnswer) {
          correctAnswer = cur.label;
        }

        options.push({
          id: cur.label,
          text: normalizeWordMath(optText),
        });
      }

      // Nếu chưa tìm thấy đáp án gạch chân, kiểm tra xem có "Chọn A", "Đáp án A", "Đ/a: A" trong lời giải không
      if (!correctAnswer && explanation) {
        const ansMatch = explanation.match(/(?:Chọn|Đáp án|Đ\/A)[\s:]*([A-D])/i);
        if (ansMatch) correctAnswer = ansMatch[1].toUpperCase();
      }
      if (!correctAnswer) correctAnswer = 'A'; // Mặc định A nếu đề không đánh dấu
    } else {
      // Kiểm tra xem có phải là dạng Đúng / Sai (a, b, c, d)
      const tfMatches = Array.from(contentAndChoices.matchAll(/(?:^|\n|\s)\s*([a-d])\)\s*/gi));
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
            text: normalizeWordMath(stmtText),
          });
        }
        correctAnswer = correctMap;
      } else {
        // Kiểm tra xem có phải dạng Trả lời ngắn (điền số) hay Tự luận
        const hasNumberAns = explanation && /Đáp số[\s:]*([\d\,\.\-\/]+)/i.test(explanation);
        if (hasNumberAns || body.includes('Điền kết quả') || body.includes('bằng bao nhiêu')) {
          type = 'short_answer';
          part = 3;
          points = 0.5;

          const numMatch = explanation.match(/Đáp số[\s:]*([\d\,\.\-\/]+)/i);
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

    // Làm sạch nội dung câu hỏi
    questionContent = questionContent.replace(/<\/?(?:b|strong|u|span|p)[^>]*>/gi, '').trim();
    questionContent = normalizeWordMath(questionContent);

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
      explanation: normalizeWordMath(explanation),
      points,
      is_public: true,
    });
  }

  return { questions, rawText: cleanHtml };
}
