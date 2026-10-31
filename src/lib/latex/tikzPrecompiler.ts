import { Question } from '@/types/database';
import { parseTkzTabCode, generateTkzTabSvg } from '@/lib/math/tkzTabRenderer';
import { renderTikzToSvg } from '@/lib/math/tikzSvgRenderer';

// Bộ nhớ đệm RAM cho kết quả tiền biên dịch TikZ -> Ảnh tĩnh
const precompileCache = new Map<string, string>();

function hashTikzCode(code: string): string {
  let hash = 0;
  for (let i = 0; i < code.length; i++) {
    hash = (hash << 5) - hash + code.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Tiền biên dịch mã nguồn TikZ sang ảnh tĩnh (PNG/SVG) tại thời điểm Nhập đề (Import-time).
 * Giúp giao diện học sinh hiển thị tức thì (0ms), không tốn RAM/CPU client, không bị đè chữ hay lệch toạ độ.
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
    const hash = hashTikzCode(rawTikz);

    // 1. Kiểm tra RAM cache
    if (precompileCache.has(hash)) {
      result = result.replace(rawTikz, precompileCache.get(hash)!);
      continue;
    }

    // 2. Kiểm tra LocalStorage cache (nếu chạy ở Browser)
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(`tikz_pre_${hash}`);
        if (stored && stored.startsWith('<img') && stored.includes('src=')) {
          precompileCache.set(hash, stored);
          result = result.replace(rawTikz, stored);
          continue;
        }
      } catch {}
    }

    // 3. Nếu là Bảng biến thiên (tkz-tab) -> Render SVG trực tiếp siêu tốc 0ms
    if (rawTikz.includes('\\tkzTabInit') || rawTikz.includes('tkzTab')) {
      const parsedTab = parseTkzTabCode(rawTikz);
      if (parsedTab) {
        const svg = generateTkzTabSvg(parsedTab);
        const svgWrapper = `<div class="tkz-tab-wrapper my-3 w-full overflow-x-auto flex flex-col items-center select-none">${svg}</div>`;
        precompileCache.set(hash, svgWrapper);
        result = result.replace(rawTikz, svgWrapper);
        continue;
      }
    }

    // 4. Gọi TeX Server API (/api/render-tikz) để biên dịch sang PNG/SVG sắc nét
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 16000);

      const res = await fetch('/api/render-tikz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tikz: rawTikz }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.url) {
          const imgTag = `<img src="${data.url}" alt="Hình vẽ TikZ" class="tikz-rendered-img max-w-full h-auto mx-auto block my-2 rounded-xl shadow-2xs select-none" style="max-height: 380px;" />`;
          precompileCache.set(hash, imgTag);

          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem(`tikz_pre_${hash}`, imgTag);
            } catch {}
          }

          result = result.replace(rawTikz, imgTag);
          continue;
        }
      }
    } catch (e) {
      console.warn('Biên dịch TikZ qua TeX Server không thành công, giữ nguyên để render client:', e);
    }

    // 5. Nếu Server chưa phản hồi, thử Pure TS Parser dựng SVG trực tiếp
    try {
      const pureSvg = renderTikzToSvg(rawTikz);
      if (pureSvg) {
        const svgTag = `<div class="tikz-rendered-svg my-2 flex justify-center max-w-full overflow-hidden select-none">${pureSvg}</div>`;
        precompileCache.set(hash, svgTag);
        result = result.replace(rawTikz, svgTag);
      }
    } catch {}
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
    let hasTikz = newContent.includes('\\begin{tikzpicture}') || newExplanation.includes('\\begin{tikzpicture}');

    if (newContent.includes('\\begin{tikzpicture}')) {
      newContent = await precompileTextTikz(newContent);
    }

    if (newExplanation.includes('\\begin{tikzpicture}')) {
      newExplanation = await precompileTextTikz(newExplanation);
    }

    // Tiền biên dịch các phương án nếu phương án có hình TikZ
    let newOptions = q.options;
    if (newOptions && Array.isArray(newOptions)) {
      const updatedOpts = [];
      for (const opt of newOptions) {
        if (opt.text && opt.text.includes('\\begin{tikzpicture}')) {
          const newOptText = await precompileTextTikz(opt.text);
          updatedOpts.push({ ...opt, text: newOptText });
        } else {
          updatedOpts.push(opt);
        }
      }
      newOptions = updatedOpts;
    }

    updated.push({
      ...q,
      content: newContent,
      explanation: newExplanation,
      options: newOptions,
    });

    count++;
    if (onProgress) onProgress(count, total);
  }

  return updated;
}
