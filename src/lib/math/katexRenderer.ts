import katex from 'katex';

/**
 * Phân tích và chuyển đổi chuỗi chứa công thức LaTeX ($...$ hoặc $$...$$) thành HTML an toàn.
 * Hỗ trợ cú pháp:
 * - Khối hiển thị (Display mode): $$công_thức$$
 * - Cùng dòng (Inline mode): $công_thức$
 * - Ký tự xuống dòng và các đoạn văn bản tiếng Việt
 */
export function renderMathToHtml(content: string): string {
  if (!content) return '';

  // Bước 1: Thay thế các khối display math $$...$$
  let processed = content.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => {
    try {
      return `<div class="my-3 overflow-x-auto text-center">${katex.renderToString(math.trim(), {
        displayMode: true,
        throwOnError: false,
      })}</div>`;
    } catch {
      return `<div class="text-rose-600 font-mono text-sm">[Lỗi LaTeX: ${math}]</div>`;
    }
  });

  // Bước 2: Thay thế các công thức inline $...$
  // Chú ý regex cẩn thận không khớp với khoảng trắng rỗng hoặc tiền tệ thông thường
  processed = processed.replace(/(?<!\\)\$([^\$\n]+?)\$/g, (_, math) => {
    try {
      return katex.renderToString(math.trim(), {
        displayMode: false,
        throwOnError: false,
      });
    } catch {
      return `<span class="text-rose-600 font-mono text-sm">[Lỗi: $${math}$]</span>`;
    }
  });

  // Bước 3: Hỗ trợ xuống dòng tự nhiên trong đề bài
  processed = processed.replace(/\n/g, '<br />');

  return processed;
}

/**
 * Danh sách các ký hiệu toán học phổ biến THPT để hỗ trợ thanh công cụ gõ nhanh
 */
export const THPT_MATH_SYMBOLS = [
  { label: 'Phân số', latex: '\\frac{a}{b}', preview: 'a/b' },
  { label: 'Căn bậc hai', latex: '\\sqrt{x}', preview: '√x' },
  { label: 'Căn bậc n', latex: '\\sqrt[n]{x}', preview: 'ⁿ√x' },
  { label: 'Lũy thừa', latex: 'x^{2}', preview: 'x²' },
  { label: 'Chỉ số dưới', latex: 'x_{1}', preview: 'x₁' },
  { label: 'Tích phân', latex: '\\int_{a}^{b} f(x) \\, \\mathrm{d}x', preview: '∫' },
  { label: 'Đạo hàm', latex: "f'(x)", preview: "f'" },
  { label: 'Giới hạn', latex: '\\lim_{x \\to x_0} f(x)', preview: 'lim' },
  { label: 'Vectơ', latex: '\\vec{u}', preview: 'u⃗' },
  { label: 'Góc', latex: '\\widehat{ABC}', preview: '∠' },
  { label: 'Tập số thực R', latex: '\\mathbb{R}', preview: 'ℝ' },
  { label: 'Tương đương', latex: '\\iff', preview: '⟺' },
  { label: 'Suy ra', latex: '\\implies', preview: '⟹' },
  { label: 'Thuộc', latex: '\\in', preview: '∈' },
  { label: 'Không thuộc', latex: '\\notin', preview: '∉' },
  { label: 'Vuông góc', latex: '\\perp', preview: '⟂' },
  { label: 'Song song', latex: '\\parallel', preview: '∥' },
  { label: 'Vô cực', latex: '\\infty', preview: '∞' },
  { label: 'Pi', latex: '\\pi', preview: 'π' },
  { label: 'Delta', latex: '\\Delta', preview: 'Δ' },
  { label: 'Hệ phương trình', latex: '\\begin{cases} x + y = 1 \\\\ x - y = 0 \\end{cases}', preview: '{…' },
];
