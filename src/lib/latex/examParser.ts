import { Question, QuestionType, QuestionDifficulty } from '../../types/database';

function extractBracedGroup(str: string, pos: number): { text: string; nextPos: number } | null {
  let depth = 0;
  let start = -1;
  for (let i = pos; i < str.length; i++) {
    if (str[i] === '{') {
      if (depth === 0) start = i + 1;
      depth++;
    } else if (str[i] === '}') {
      depth--;
      if (depth === 0) {
        return { text: str.substring(start, i), nextPos: i + 1 };
      }
    }
  }
  return null;
}

export function detectMathTopic(content: string): string {
  const c = content.toLowerCase();
  if (c.includes('đạo hàm') || c.includes('tiệm cận') || c.includes('cực trị') || c.includes('bảng biến thiên') || c.includes('hàm số bậc ba') || c.includes('đồng biến') || c.includes('nghịch biến')) {
    return 'Khảo sát hàm số';
  }
  if (c.includes('\\ln') || c.includes('\\log') || c.includes('mũ') || c.includes('bất phương trình log')) {
    return 'Mũ & Logarit';
  }
  if (c.includes('\\int') || c.includes('tích phân') || c.includes('nguyên hàm') || c.includes('diện tích hình phẳng')) {
    return 'Nguyên hàm - Tích phân';
  }
  if (c.includes('tọa độ') || c.includes('oxyz') || c.includes('mặt cầu') || c.includes('mặt phẳng') || c.includes('đường thẳng') || c.includes('trung điểm') && c.includes('(')) {
    return 'Phương pháp tọa độ Oxyz';
  }
  if (c.includes('hình chóp') || c.includes('thể tích') || c.includes('lăng trụ') || c.includes('góc giữa') || c.includes('khoảng cách từ') || c.includes('góc nhị diện') || c.includes('hình thang cân')) {
    return 'Hình học không gian';
  }
  if (c.includes('xác suất') || c.includes('chọn ngẫu nhiên') || c.includes('biến cố') || c.includes('rô bốt') || c.includes('thống kê') || c.includes('mẫu số liệu') || c.includes('ghép nhóm') || c.includes('trung bình')) {
    return 'Xác suất & Thống kê';
  }
  if (c.includes('cấp số nhân') || c.includes('cấp số cộng') || c.includes('dãy số') || c.includes('(u_n)') || c.includes('số hạng đầu')) {
    return 'Dãy số & Cấp số';
  }
  if (c.includes('giới hạn') || c.includes('\\lim')) {
    return 'Giới hạn hàm số';
  }
  if (c.includes('\\sin') || c.includes('\\cos') || c.includes('lượng giác')) {
    return 'Lượng giác';
  }
  if (c.includes('chi phí') || c.includes('sản phẩm') || c.includes('doanh nghiệp') || c.includes('ao cá') || c.includes('thực tế') || c.includes('lợi nhuận')) {
    return 'Toán thực tế & Tối ưu hóa';
  }
  return 'Đại số & Giải tích';
}

export function parseExamLatex(rawTex: string): {
  questions: Question[];
  metadata: { title?: string; duration?: number; made?: string };
} {
  const metadata: { title?: string; duration?: number; made?: string } = {};

  // Trích xuất mã đề
  const madeMatch = rawTex.match(/\\MaDe\{([^}]+)\}/);
  if (madeMatch) metadata.made = madeMatch[1];

  // Trích xuất thời gian
  const timeMatch = rawTex.match(/Thời gian:\s*(\d+)\s*phút/i);
  if (timeMatch) metadata.duration = parseInt(timeMatch[1], 10);

  // Trích xuất tít đề
  if (rawTex.includes('\\TitDe')) {
    metadata.title = 'Đề Thi Toán THPT Chuẩn Định Dạng 2025';
  }

  // Tách theo \subsection*{Phần ...} nếu có
  const exRegex = /\\begin\{(?:ex|bt|cau)\}([\s\S]*?)\\end\{(?:ex|bt|cau)\}/g;
  let match;
  const questions: Question[] = [];
  let qIndex = 0;

  // Xác định vị trí các phần
  const p1Pos = rawTex.indexOf('Phần I');
  const p2Pos = rawTex.indexOf('Phần II');
  const p3Pos = rawTex.indexOf('Phần III');
  const p4Pos = rawTex.indexOf('Phần IV');

  while ((match = exRegex.exec(rawTex)) !== null) {
    qIndex++;
    const blockIndex = match.index;
    const block = match[1];

    // Trích xuất mã ID bài toán nếu có (ví dụ: \begin{ex}[2D1-1.1] hoặc [TH])
    const tagMatch = block.match(/^\s*\[(.*?)\]/);
    const customTag = tagMatch ? tagMatch[1].trim() : '';

    let part: 1 | 2 | 3 | 4 = 1;
    if (p4Pos !== -1 && blockIndex >= p4Pos) part = 4;
    else if (p3Pos !== -1 && blockIndex >= p3Pos) part = 3;
    else if (p2Pos !== -1 && blockIndex >= p2Pos) part = 2;
    else if (p1Pos !== -1 && blockIndex >= p1Pos) part = 1;

    let type: QuestionType = 'single_choice';
    if (block.includes('\\choiceTF')) type = 'true_false';
    else if (block.includes('\\choice')) type = 'single_choice';
    else if (block.includes('\\shortans')) type = 'short_answer';
    else if (part === 4 || block.includes('\\begin{enumerate}')) type = 'essay';

    // Bóc tách Lời giải \loigiai{...}
    let explanation = '';
    const lgIdx = block.indexOf('\\loigiai');
    if (lgIdx !== -1) {
      const g = extractBracedGroup(block, lgIdx);
      if (g) explanation = g.text.trim();
    }

    // Bóc tách nội dung đề bài (đặc biệt bảo toàn hình ảnh TikZ trong \immini)
    let content = '';
    const imminiIdx = block.indexOf('\\immini');

    if (imminiIdx !== -1) {
      let pos = imminiIdx + 7;
      while (pos < block.length && /\s/.test(block[pos])) pos++;
      // Hỗ trợ tham số tùy chọn ngoặc vuông: \immini[1]{...}{...} hoặc \immini[0.5]{...}{...}
      if (block[pos] === '[') {
        const closeBracket = block.indexOf(']', pos);
        if (closeBracket !== -1) {
          pos = closeBracket + 1;
          while (pos < block.length && /\s/.test(block[pos])) pos++;
        }
      }

      const g1 = extractBracedGroup(block, pos);
      if (g1) {
        pos = g1.nextPos;
        while (pos < block.length && /\s/.test(block[pos])) pos++;
        const g2 = extractBracedGroup(block, pos);
        if (g2) {
          // Kiểm tra xem g1 có chứa \choice / \choiceTF / \shortans hay không
          let cutInG1 = g1.text.length;
          ['\\choiceTF', '\\choice', '\\shortans'].forEach((cmd) => {
            const i = g1.text.indexOf(cmd);
            if (i !== -1 && i < cutInG1) cutInG1 = i;
          });

          const textPart = g1.text.substring(0, cutInG1).trim();
          const figurePart = g2.text.trim();
          const prefix = block.substring(0, imminiIdx).trim();

          // Lấy thêm phần văn bản sau \immini trước các khối lựa chọn / lời giải nếu có
          const afterImmini = block.substring(g2.nextPos);
          let cutAfter = afterImmini.length;
          ['\\choiceTF', '\\choice', '\\shortans', '\\loigiai', '\\sodong'].forEach((cmd) => {
            const i = afterImmini.indexOf(cmd);
            if (i !== -1 && i < cutAfter) cutAfter = i;
          });
          const suffix = afterImmini.substring(0, cutAfter).trim();

          content = `${prefix ? prefix + '\n' : ''}\\immini{\n${textPart}\n}{\n${figurePart}\n}${suffix ? '\n' + suffix : ''}`;
        }
      }
    }

    if (!content) {
      let cutIdx = block.length;
      ['\\choiceTF', '\\choice', '\\shortans', '\\loigiai', '\\sodong'].forEach((cmd) => {
        const i = block.indexOf(cmd);
        if (i !== -1 && i < cutIdx) cutIdx = i;
      });
      content = block.substring(0, cutIdx).trim();
    }

    // Bỏ chú thích % ... và lệnh \sodong{...}
    content = content
      .split('\n')
      .filter((line) => !line.trim().startsWith('%'))
      .join('\n')
      .replace(/\\sodong\s*\{[^}]*\}/g, '')
      .trim();

    explanation = explanation
      .replace(/\\sodong\s*\{[^}]*\}/g, '')
      .trim();

    // Bỏ thẻ mã câu hỏi [ID] ở đầu đề bài nếu có (ví dụ: [2D1-1.1] hoặc [TH])
    content = content.replace(/^\s*\[[^\]]+\]\s*/, '').trim();

    let options: any = [];
    let correct_answer: any = null;
    let points = 0.25;

    if (type === 'single_choice') {
      points = 0.25;
      const cIdx = block.indexOf('\\choice');
      if (cIdx !== -1) {
        let pos = cIdx + 7;
        while (pos < block.length && /\s/.test(block[pos])) pos++;
        // Hỗ trợ \choice[2]{A}{B}{C}{D} hoặc \choice[4]{...}
        if (block[pos] === '[') {
          const closeBracket = block.indexOf(']', pos);
          if (closeBracket !== -1) {
            pos = closeBracket + 1;
            while (pos < block.length && /\s/.test(block[pos])) pos++;
          }
        }
        const labels = ['A', 'B', 'C', 'D'];
        for (let i = 0; i < 4; i++) {
          while (pos < block.length && /\s/.test(block[pos])) pos++;
          const g = extractBracedGroup(block, pos);
          if (!g) break;
          pos = g.nextPos;
          let optText = g.text.trim();
          if (optText.includes('\\True')) {
            correct_answer = labels[i];
            optText = optText.replace(/\\True\s*/g, '').trim();
          }
          options.push({ id: labels[i], text: optText });
        }
      }
    } else if (type === 'true_false') {
      points = 1.0;
      const tfIdx = block.indexOf('\\choiceTF');
      if (tfIdx !== -1) {
        let pos = tfIdx + 9;
        while (pos < block.length && /\s/.test(block[pos])) pos++;
        // Hỗ trợ \choiceTF[t]{a}{b}{c}{d}
        if (block[pos] === '[') {
          const closeBracket = block.indexOf(']', pos);
          if (closeBracket !== -1) {
            pos = closeBracket + 1;
            while (pos < block.length && /\s/.test(block[pos])) pos++;
          }
        }
        const labels = ['a', 'b', 'c', 'd'];
        const correctMap: Record<string, boolean> = { a: false, b: false, c: false, d: false };
        for (let i = 0; i < 4; i++) {
          while (pos < block.length && /\s/.test(block[pos])) pos++;
          const g = extractBracedGroup(block, pos);
          if (!g) break;
          pos = g.nextPos;
          let optText = g.text.trim();
          const isTrue = optText.includes('\\True');
          if (isTrue) {
            correctMap[labels[i]] = true;
            optText = optText.replace(/\\True\s*/g, '').trim();
          }
          options.push({ id: labels[i], text: optText });
        }
        correct_answer = correctMap;
      }
    } else if (type === 'short_answer') {
      points = 0.5;
      const saIdx = block.indexOf('\\shortans');
      if (saIdx !== -1) {
        let pos = saIdx + 9;
        while (pos < block.length && /\s/.test(block[pos])) pos++;
        // Hỗ trợ \shortans[0]{$1440$} hoặc \shortans[0]{1440} hoặc \shortans{$1440$}
        if (block[pos] === '[') {
          const closeBracket = block.indexOf(']', pos);
          if (closeBracket !== -1) {
            const innerBracket = block.substring(pos + 1, closeBracket).trim();
            pos = closeBracket + 1;
            while (pos < block.length && /\s/.test(block[pos])) pos++;
            // Nếu không có cặp ngoặc nhọn theo sau, lấy luôn giá trị trong ngoặc vuông
            if (block[pos] !== '{' && innerBracket) {
              const ans = innerBracket.replace(/[\$]/g, '').replace(/\{,\}/g, ',').trim();
              correct_answer = [ans, ans.replace(',', '.')];
            }
          }
        }
        if (block[pos] === '{') {
          const g = extractBracedGroup(block, pos);
          if (g) {
            let ans = g.text.replace(/[\$]/g, '').trim();
            ans = ans.replace(/\{,\}/g, ',');
            correct_answer = [ans, ans.replace(',', '.')];
          }
        }
      }
    } else if (type === 'essay') {
      points = 2.0;
      correct_answer = explanation || 'Hướng dẫn chấm bài tự luận';
    }

    const topic = customTag || detectMathTopic(content);
    let difficulty: QuestionDifficulty = 'thong_hieu';
    if (part === 1 && qIndex <= 4) difficulty = 'nhan_biet';
    else if (part === 1) difficulty = 'thong_hieu';
    else if (part === 2 || part === 3) difficulty = 'van_dung';
    else if (part === 4) difficulty = 'van_dung_cao';

    questions.push({
      id: `tex-q-${Date.now()}-${qIndex}`,
      teacher_id: '11111111-1111-1111-1111-111111111111',
      grade: 12,
      topic,
      part,
      difficulty,
      type,
      content,
      options,
      correct_answer,
      explanation,
      points,
      is_public: true,
    });
  }

  return { questions, metadata };
}
