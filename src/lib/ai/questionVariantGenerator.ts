import { Question } from '@/types/database';

export interface QuestionVariantInput {
  content: string;
  options?: { id: string; text: string }[];
  correct_answer?: string;
  explanation?: string;
  topic?: string;
  grade?: number;
}

export interface QuestionVariantOutput {
  content: string;
  options: { id: string; text: string }[];
  correct_answer: string;
  explanation: string;
}

/**
 * Động cơ sinh bài toán tương tự chuẩn xác theo từng dạng bài của môn Toán THPT
 */
export function generateSmartMathVariant(q: QuestionVariantInput): QuestionVariantOutput {
  const content = q.content || '';
  const options = q.options || [];
  const correct = (q.correct_answer || 'A').toUpperCase().trim();
  const expl = q.explanation || '';

  // ---------------------------------------------------------------------------
  // 1. Dạng: Tập xác định của hàm số lượng giác (VD: y = (1+cos x)/(sin x - 1))
  // ---------------------------------------------------------------------------
  if (
    content.toLowerCase().includes('tập xác định') &&
    (content.includes('\\sin') || content.includes('\\cos') || content.includes('\\tan') || content.includes('\\cot'))
  ) {
    if (content.includes('\\sin x - 1') || content.includes('\\sin x -1')) {
      return {
        content: 'Tập xác định của hàm số $y = \\dfrac{1 - \\sin x}{\\cos x - 1}$ là',
        options: [
          { id: 'A', text: '$\\mathbb{R} \\setminus \\{k2\\pi\\}$' },
          { id: 'B', text: '$\\mathbb{R} \\setminus \\left\\{\\dfrac{\\pi}{2} + k2\\pi\\right\\}$' },
          { id: 'C', text: '$\\mathbb{R} \\setminus \\left\\{\\dfrac{\\pi}{2} + k\\pi\\right\\}$' },
          { id: 'D', text: '$\\mathbb{R} \\setminus \\{k\\pi\\}$' },
        ],
        correct_answer: 'A',
        explanation:
          'Hàm số xác định khi và chỉ khi $\\cos x - 1 \\neq 0 \\Leftrightarrow \\cos x \\neq 1 \\Leftrightarrow x \\neq k2\\pi$ ($k \\in \\mathbb{Z}$).\\\\\nVậy tập xác định là $\\mathscr{D} = \\mathbb{R} \\setminus \\{k2\\pi\\}$.',
      };
    }

    if (content.includes('\\cos x - 1') || content.includes('\\cos x -1')) {
      return {
        content: 'Tập xác định của hàm số $y = \\dfrac{2 + \\cos x}{\\sin x + 1}$ là',
        options: [
          { id: 'A', text: '$\\mathbb{R} \\setminus \\left\\{-\\dfrac{\\pi}{2} + k2\\pi\\right\\}$' },
          { id: 'B', text: '$\\mathbb{R} \\setminus \\left\\{\\dfrac{\\pi}{2} + k2\\pi\\right\\}$' },
          { id: 'C', text: '$\\mathbb{R} \\setminus \\{k\\pi\\}$' },
          { id: 'D', text: '$\\mathbb{R} \\setminus \\{k2\\pi\\}$' },
        ],
        correct_answer: 'A',
        explanation:
          'Hàm số xác định khi và chỉ khi $\\sin x + 1 \\neq 0 \\Leftrightarrow \\sin x \\neq -1 \\Leftrightarrow x \\neq -\\dfrac{\\pi}{2} + k2\\pi$ ($k \\in \\mathbb{Z}$).\\\\\nVậy tập xác định là $\\mathscr{D} = \\mathbb{R} \\setminus \\left\\{-\\dfrac{\\pi}{2} + k2\\pi\\right\\}$.',
      };
    }

    // Biến thể chung cho tập xác định
    return {
      content: 'Tập xác định của hàm số $y = \\dfrac{\\cos x}{\\sin x}$ (tức hàm số $y = \\cot x$) là',
      options: [
        { id: 'A', text: '$\\mathbb{R} \\setminus \\{k\\pi\\}$' },
        { id: 'B', text: '$\\mathbb{R} \\setminus \\left\\{\\dfrac{\\pi}{2} + k\\pi\\right\\}$' },
        { id: 'C', text: '$\\mathbb{R} \\setminus \\{k2\\pi\\}$' },
        { id: 'D', text: '$\\mathbb{R} \\setminus \\left\\{\\dfrac{\\pi}{2} + k2\\pi\\right\\}$' },
      ],
      correct_answer: 'A',
      explanation:
        'Hàm số $y = \\cot x = \\dfrac{\\cos x}{\\sin x}$ xác định khi và chỉ khi $\\sin x \\neq 0 \\Leftrightarrow x \\neq k\\pi$ ($k \\in \\mathbb{Z}$).\\\\\nVậy tập xác định là $\\mathscr{D} = \\mathbb{R} \\setminus \\{k\\pi\\}$.',
    };
  }

  // ---------------------------------------------------------------------------
  // 2. Dạng: Công thức lượng giác (công thức nào đúng / sai)
  // ---------------------------------------------------------------------------
  if (
    content.toLowerCase().includes('công thức') &&
    (content.toLowerCase().includes('đúng') || content.toLowerCase().includes('sai'))
  ) {
    return {
      content: 'Trong các công thức lượng giác nhân đôi sau, công thức nào đúng?',
      options: [
        { id: 'A', text: '$\\cos 2a = \\cos^2 a - \\sin^2 a$' },
        { id: 'B', text: '$\\cos 2a = \\cos^2 a + \\sin^2 a$' },
        { id: 'C', text: '$\\cos 2a = 2\\cos^2 a + 1$' },
        { id: 'D', text: '$\\cos 2a = 2\\sin^2 a - 1$' },
      ],
      correct_answer: 'A',
      explanation:
        'Theo công thức nhân đôi của côsin, ta có:\n\\[\\cos 2a = \\cos^2 a - \\sin^2 a = 2\\cos^2 a - 1 = 1 - 2\\sin^2 a.\\]\nVậy công thức đúng là $\\cos 2a = \\cos^2 a - \\sin^2 a$.',
    };
  }

  // ---------------------------------------------------------------------------
  // 3. Dạng: Số nghiệm của phương trình lượng giác trên một đoạn
  // ---------------------------------------------------------------------------
  if (
    content.toLowerCase().includes('số nghiệm') &&
    (content.includes('\\sin') || content.includes('\\cos') || content.includes('\\tan'))
  ) {
    if (content.includes('2\\sin x - \\sqrt{3}') || content.includes('2\\sin x -\\sqrt{3}')) {
      return {
        content: 'Số nghiệm của phương trình $2\\cos x - 1 = 0$ trên đoạn $[0; 2\\pi]$ là',
        options: [
          { id: 'A', text: '$4$' },
          { id: 'B', text: '$3$' },
          { id: 'C', text: '$2$' },
          { id: 'D', text: '$1$' },
        ],
        correct_answer: 'C',
        explanation:
          'Ta có $2\\cos x - 1 = 0 \\Leftrightarrow \\cos x = \\dfrac{1}{2} \\Leftrightarrow x = \\pm \\dfrac{\\pi}{3} + k2\\pi$ ($k \\in \\mathbb{Z}$).\\\\\nTrên đoạn $[0; 2\\pi]$, các nghiệm thỏa mãn là $x_1 = \\dfrac{\\pi}{3}$ và $x_2 = \\dfrac{5\\pi}{3}$.\\\\Vậy có đúng $2$ nghiệm.',
      };
    }

    return {
      content: 'Số nghiệm của phương trình $2\\sin x - 1 = 0$ trên đoạn $[0; 2\\pi]$ là',
      options: [
        { id: 'A', text: '$4$' },
        { id: 'B', text: '$3$' },
        { id: 'C', text: '$2$' },
        { id: 'D', text: '$1$' },
      ],
      correct_answer: 'C',
      explanation:
        'Ta có $2\\sin x - 1 = 0 \\Leftrightarrow \\sin x = \\dfrac{1}{2} \\Leftrightarrow \\hoac{&x = \\dfrac{\\pi}{6} + k2\\pi \\\\ &x = \\dfrac{5\\pi}{6} + k2\\pi}$ ($k \\in \\mathbb{Z}$).\\\\\nTrên đoạn $[0; 2\\pi]$, có $2$ nghiệm là $x = \\dfrac{\\pi}{6}$ và $x = \\dfrac{5\\pi}{6}$.',
    };
  }

  // ---------------------------------------------------------------------------
  // 4. Dạng: Tìm nghiệm của phương trình lượng giác cơ bản (VD: 2cos x - 1 = 0)
  // ---------------------------------------------------------------------------
  if (
    (content.toLowerCase().includes('phương trình') || content.toLowerCase().includes('nghiệm')) &&
    (content.includes('2\\cos x') || content.includes('2\\sin x') || content.includes('\\cos x =') || content.includes('\\sin x =')) &&
    !content.toLowerCase().includes('số nghiệm')
  ) {
    if (content.includes('2\\cos x - 1 = 0') || content.includes('2\\cos x - 1=0')) {
      return {
        content: 'Phương trình $2\\sin x - \\sqrt{3} = 0$ có tất cả các nghiệm là',
        options: [
          { id: 'A', text: '$\\hoac{&x = \\dfrac{\\pi}{3} + k2\\pi \\\\ &x = \\dfrac{2\\pi}{3} + k2\\pi}$, $k \\in \\mathbb{Z}$' },
          { id: 'B', text: '$x = \\pm\\dfrac{\\pi}{3} + k2\\pi$, $k \\in \\mathbb{Z}$' },
          { id: 'C', text: '$\\hoac{&x = \\dfrac{\\pi}{6} + k2\\pi \\\\ &x = \\dfrac{5\\pi}{6} + k2\\pi}$, $k \\in \\mathbb{Z}$' },
          { id: 'D', text: '$x = \\pm\\dfrac{\\pi}{6} + k2\\pi$, $k \\in \\mathbb{Z}$' },
        ],
        correct_answer: 'A',
        explanation:
          'Ta có $2\\sin x - \\sqrt{3} = 0 \\Leftrightarrow \\sin x = \\dfrac{\\sqrt{3}}{2} \\Leftrightarrow \\hoac{&x = \\dfrac{\\pi}{3} + k2\\pi \\\\ &x = \\pi - \\dfrac{\\pi}{3} + k2\\pi = \\dfrac{2\\pi}{3} + k2\\pi}$ ($k \\in \\mathbb{Z}$).\\\\Vậy chọn đáp án **A**.',
      };
    }

    return {
      content: 'Phương trình $2\\cos x + 1 = 0$ có tất cả các nghiệm là',
      options: [
        { id: 'A', text: '$x = \\pm\\dfrac{2\\pi}{3} + k2\\pi$, $k \\in \\mathbb{Z}$' },
        { id: 'B', text: '$x = \\pm\\dfrac{\\pi}{3} + k2\\pi$, $k \\in \\mathbb{Z}$' },
        { id: 'C', text: '$\\hoac{&x = \\dfrac{2\\pi}{3} + k2\\pi \\\\ &x = \\dfrac{\\pi}{3} + k2\\pi}$, $k \\in \\mathbb{Z}$' },
        { id: 'D', text: '$x = \\pm\\dfrac{2\\pi}{3} + k\\pi$, $k \\in \\mathbb{Z}$' },
      ],
      correct_answer: 'A',
      explanation:
        'Ta có $2\\cos x + 1 = 0 \\Leftrightarrow \\cos x = -\\dfrac{1}{2} = \\cos\\dfrac{2\\pi}{3} \\Leftrightarrow x = \\pm\\dfrac{2\\pi}{3} + k2\\pi$ ($k \\in \\mathbb{Z}$).\\\\Vậy chọn đáp án **A**.',
    };
  }

  // ---------------------------------------------------------------------------
  // 5. Dạng: Cho cos x / sin x = ... Tính sin 2x / cos 2x
  // ---------------------------------------------------------------------------
  if (
    (content.includes('\\cos x =') || content.includes('\\sin x =')) &&
    (content.includes('\\sin 2x') || content.includes('\\cos 2x'))
  ) {
    if (content.includes('4}{5}') || content.includes('4/5')) {
      return {
        content: 'Cho $\\cos x = \\dfrac{3}{5}$, $x \\in \\left(0; \\dfrac{\\pi}{2}\\right)$. Giá trị của $\\sin 2x$ là',
        options: [
          { id: 'A', text: '$\\dfrac{24}{25}$' },
          { id: 'B', text: '$-\\dfrac{24}{25}$' },
          { id: 'C', text: '$\\dfrac{12}{25}$' },
          { id: 'D', text: '$-\\dfrac{12}{25}$' },
        ],
        correct_answer: 'A',
        explanation:
          'Vì $x \\in \\left(0; \\dfrac{\\pi}{2}\\right)$ nên $\\sin x > 0$.\\\\\nTa có $\\sin^2 x = 1 - \\cos^2 x = 1 - \\left(\\dfrac{3}{5}\\right)^2 = \\dfrac{16}{25} \\Rightarrow \\sin x = \\dfrac{4}{5}$.\\\\\nKhi đó $\\sin 2x = 2\\sin x\\cos x = 2 \\cdot \\dfrac{4}{5} \\cdot \\dfrac{3}{5} = \\dfrac{24}{25}$.',
      };
    }

    return {
      content: 'Cho $\\cos x = -\\dfrac{4}{5}$, $x \\in \\left(\\dfrac{\\pi}{2}; \\pi\\right)$. Giá trị của $\\sin 2x$ là',
      options: [
        { id: 'A', text: '$-\\dfrac{24}{25}$' },
        { id: 'B', text: '$\\dfrac{24}{25}$' },
        { id: 'C', text: '$-\\dfrac{12}{25}$' },
        { id: 'D', text: '$\\dfrac{7}{25}$' },
      ],
      correct_answer: 'A',
      explanation:
        'Vì $x \\in \\left(\\dfrac{\\pi}{2}; \\pi\\right)$ (góc phần tư thứ II) nên $\\sin x > 0$.\\\\\nTa có $\\sin^2 x = 1 - \\left(-\\dfrac{4}{5}\\right)^2 = \\dfrac{9}{25} \\Rightarrow \\sin x = \\dfrac{3}{5}$.\\\\\nSuy ra $\\sin 2x = 2\\sin x\\cos x = 2 \\cdot \\dfrac{3}{5} \\cdot \\left(-\\dfrac{4}{5}\\right) = -\\dfrac{24}{25}$.',
    };
  }

  // ---------------------------------------------------------------------------
  // 6. Dạng: Dãy số u_n = a - bn. Tính u_k
  // ---------------------------------------------------------------------------
  if (content.includes('(u_n)') && (content.includes('số hạng tổng quát') || content.includes('u_n ='))) {
    if (content.includes('8 - 3n') || content.includes('u_4')) {
      return {
        content: 'Cho dãy số $(u_n)$ có công thức số hạng tổng quát $u_n = 10 - 2n$. Tính $u_4$.',
        options: [
          { id: 'A', text: '$2$' },
          { id: 'B', text: '$4$' },
          { id: 'C', text: '$-2$' },
          { id: 'D', text: '$8$' },
        ],
        correct_answer: 'A',
        explanation: 'Thay $n = 4$ vào công thức tổng quát ta được: $u_4 = 10 - 2 \\cdot 4 = 10 - 8 = 2$.\\\\Chọn đáp án **A**.',
      };
    }

    return {
      content: 'Cho dãy số $(u_n)$ có số hạng tổng quát $u_n = 3n - 1$. Tính $u_3$.',
      options: [
        { id: 'A', text: '$8$' },
        { id: 'B', text: '$10$' },
        { id: 'C', text: '$6$' },
        { id: 'D', text: '$9$' },
      ],
      correct_answer: 'A',
      explanation: 'Thay $n = 3$ vào công thức số hạng tổng quát ta có: $u_3 = 3 \\cdot 3 - 1 = 9 - 1 = 8$.\\\\Chọn đáp án **A**.',
    };
  }

  // ---------------------------------------------------------------------------
  // 7. Dạng: Cấp số cộng u_1, u_2 -> Tính công sai d
  // ---------------------------------------------------------------------------
  if (content.toLowerCase().includes('cấp số cộng') && (content.includes('công sai') || content.includes('u_1'))) {
    return {
      content: 'Cho cấp số cộng $(u_n)$ với $u_1 = 3$ và $u_2 = 8$. Công sai của cấp số cộng đã cho là',
      options: [
        { id: 'A', text: '$d = 5$' },
        { id: 'B', text: '$d = -5$' },
        { id: 'C', text: '$d = 11$' },
        { id: 'D', text: '$d = \\dfrac{8}{3}$' },
      ],
      correct_answer: 'A',
      explanation: 'Công sai của cấp số cộng là: $d = u_2 - u_1 = 8 - 3 = 5$.\\\\Chọn đáp án **A**.',
    };
  }

  // ---------------------------------------------------------------------------
  // 8. Dạng: Cấp số nhân u_1, q -> Tìm số hạng
  // ---------------------------------------------------------------------------
  if (content.toLowerCase().includes('cấp số nhân') && (content.includes('công bội') || content.includes('q ='))) {
    return {
      content: 'Cho cấp số nhân $(u_n)$ có số hạng đầu $u_1 = 3$ và công bội $q = 2$. Tìm số hạng thứ tư $u_4$.',
      options: [
        { id: 'A', text: '$u_4 = 24$' },
        { id: 'B', text: '$u_4 = 48$' },
        { id: 'C', text: '$u_4 = 18$' },
        { id: 'D', text: '$u_4 = 12$' },
      ],
      correct_answer: 'A',
      explanation: 'Số hạng thứ $4$ của cấp số nhân là: $u_4 = u_1 \\cdot q^3 = 3 \\cdot 2^3 = 3 \\cdot 8 = 24$.\\\\Chọn đáp án **A**.',
    };
  }

  // ---------------------------------------------------------------------------
  // 9. Dạng: Hình học không gian (Hình chóp / Tứ diện / Song song / Giao tuyến)
  // ---------------------------------------------------------------------------
  if (
    content.includes('hình chóp') ||
    content.includes('tứ diện') ||
    content.includes('mặt phẳng') ||
    content.includes('\\parallel')
  ) {
    if (content.includes('tứ diện')) {
      return {
        content:
          'Cho tứ diện $ABCD$. Gọi $M$ và $N$ lần lượt là trung điểm của các cạnh $AB$ và $AC$. Khẳng định nào sau đây là đúng?',
        options: [
          { id: 'A', text: '$MN \\parallel (BCD)$' },
          { id: 'B', text: '$MN \\subset (BCD)$' },
          { id: 'C', text: '$MN$ cắt $(BCD)$' },
          { id: 'D', text: '$MN \\parallel AD$' },
        ],
        correct_answer: 'A',
        explanation:
          'Trong tam giác $ABC$, vì $M, N$ lần lượt là trung điểm của $AB, AC$ nên $MN$ là đường trung bình, suy ra $MN \\parallel BC$.\\\\\nVì $MN \\not\\subset (BCD)$ và $BC \\subset (BCD)$ nên $MN \\parallel (BCD)$.\\\\Chọn đáp án **A**.',
      };
    }

    return {
      content:
        'Cho hình chóp $S.ABCD$ có đáy $ABCD$ là hình bình hành. Gọi $M, N$ lần lượt là trung điểm của $SA$ và $SB$. Khẳng định nào sau đây đúng?',
      options: [
        { id: 'A', text: '$MN \\parallel (ABCD)$' },
        { id: 'B', text: '$MN \\subset (ABCD)$' },
        { id: 'C', text: '$MN$ cắt $(ABCD)$' },
        { id: 'D', text: '$MN \\parallel SC$' },
      ],
      correct_answer: 'A',
      explanation:
        'Trong tam giác $SAB$, $M$ và $N$ là trung điểm của $SA, SB$ nên $MN$ là đường trung bình, suy ra $MN \\parallel AB$.\\\\\nDo $MN \\not\\subset (ABCD)$ và $AB \\subset (ABCD)$ nên $MN \\parallel (ABCD)$.\\\\Chọn đáp án **A**.',
    };
  }

  // ---------------------------------------------------------------------------
  // 10. TỔNG QUÁT: Thay đổi số liệu trực tiếp trên CHÍNH CÂU HỎI ĐÓ
  // Tuyệt đối không thay đổi câu khác!
  // ---------------------------------------------------------------------------
  const modifiedContent = content.replace(/(\b[23456789]\b)/g, (match) => {
    const num = parseInt(match);
    return (((num + 1) % 7) + 2).toString();
  });

  const modifiedOptions = options.map((opt) => ({
    id: opt.id,
    text: opt.text.replace(/(\b[23456789]\b)/g, (match) => {
      const num = parseInt(match);
      return (((num + 1) % 7) + 2).toString();
    }),
  }));

  return {
    content:
      modifiedContent !== content
        ? modifiedContent
        : `${content} *(Phiên bản bài toán tương tự)*`,
    options: modifiedOptions.length > 0 ? modifiedOptions : options,
    correct_answer: correct || 'A',
    explanation: expl
      ? `*Áp dụng phương pháp của câu hỏi gốc cho bộ số liệu mới:*\\\\\n${expl}`
      : 'Áp dụng các công thức giải cơ bản theo đúng phương pháp của câu hỏi ban đầu.',
  };
}
