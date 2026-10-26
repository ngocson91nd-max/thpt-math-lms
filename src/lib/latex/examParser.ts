import { Question, QuestionType, QuestionDifficulty } from '@/types/database';

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
  const exRegex = /\\begin\{ex\}([\s\S]*?)\\end\{ex\}/g;
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

    // Bóc tách nội dung đề bài (phần trước \choice / \choiceTF / \shortans / \loigiai)
    let cutIdx = block.length;
    ['\\choiceTF', '\\choice', '\\shortans', '\\loigiai'].forEach((cmd) => {
      const i = block.indexOf(cmd);
      if (i !== -1 && i < cutIdx) cutIdx = i;
    });

    let content = block.substring(0, cutIdx).trim();
    // Bỏ chú thích % ...
    content = content
      .split('\n')
      .filter((line) => !line.trim().startsWith('%'))
      .join('\n')
      .trim();

    let options: any = [];
    let correct_answer: any = null;
    let points = 0.25;

    if (type === 'single_choice') {
      points = 0.25;
      const cIdx = block.indexOf('\\choice');
      if (cIdx !== -1) {
        let pos = cIdx + 7;
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
        const braceIdx = block.indexOf('{', saIdx);
        if (braceIdx !== -1) {
          const g = extractBracedGroup(block, braceIdx);
          if (g) {
            let ans = g.text.replace(/[\$]/g, '').trim();
            // Chuẩn hóa dấu phẩy thập phân ví dụ 2{,}25 thành 2.25 và 2,25
            ans = ans.replace(/\{,\}/g, ',');
            correct_answer = [ans, ans.replace(',', '.')];
          }
        }
      }
    } else if (type === 'essay') {
      points = 2.0;
      correct_answer = explanation || 'Hướng dẫn chấm bài tự luận';
    }

    const topic = detectMathTopic(content);
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
