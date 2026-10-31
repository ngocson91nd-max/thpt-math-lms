import { Question } from '@/types/database';

/**
 * Tiền biên dịch mã nguồn TikZ sang ảnh tĩnh (PNG/SVG) tại thời điểm Nhập đề (Import-time).
 * Giúp giao diện hiển thị tức thì (0ms), không có nét thừa, không bị lỗi font hay xung đột DOM.
 */
export async function precompileTextTikz(text: string): Promise<string> {
  if (!text || !text.includes('\\begin{tikzpicture}')) {
    return text;
  }

  // Tìm tất cả các khối \begin{tikzpicture}...\end{tikzpicture}
  const tikzRegex = /\\begin\{tikzpicture\}([\s\S]*?)\\end\{tikzpicture\}/g;
  const matches = Array.from(text.matchAll(tikzRegex));

  if (matches.length === 0) return text;

  let result = text;

  for (const match of matches) {
    const rawTikz = match[0];
    try {
      const res = await fetch('/api/render-tikz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tikz: rawTikz }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.url) {
          const imgTag = `<img src="${data.url}" alt="Hình vẽ" class="tikz-rendered-img max-w-full h-auto mx-auto block my-2 rounded-lg shadow-2xs select-none" style="max-height: 380px;" />`;
          result = result.replace(rawTikz, imgTag);
        }
      }
    } catch (e) {
      console.warn('Không thể biên dịch trước khối TikZ qua server:', e);
    }
  }

  return result;
}

/**
 * Tiền biên dịch toàn bộ hình vẽ TikZ trong danh sách câu hỏi
 */
export async function precompileQuestionsTikz(
  questions: Question[],
  onProgress?: (done: number, total: number) => void
): Promise<Question[]> {
  const updated: Question[] = [];
  let count = 0;
  const total = questions.length;

  for (const q of questions) {
    let newContent = q.content;
    let newExplanation = q.explanation || '';

    if (newContent.includes('\\begin{tikzpicture}')) {
      newContent = await precompileTextTikz(newContent);
    }

    if (newExplanation.includes('\\begin{tikzpicture}')) {
      newExplanation = await precompileTextTikz(newExplanation);
    }

    updated.push({
      ...q,
      content: newContent,
      explanation: newExplanation,
    });

    count++;
    if (onProgress) onProgress(count, total);
  }

  return updated;
}
