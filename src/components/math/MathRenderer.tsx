'use client';

import React, { useMemo, useEffect, useRef } from 'react';
import { renderMathToHtml } from '@/lib/math/katexRenderer';
import { renderTikzToSvg } from '@/lib/math/tikzSvgRenderer';

interface MathRendererProps {
  content: string;
  className?: string;
  inline?: boolean;
}

// Bộ nhớ đệm RAM cho đồ thị TikZ đã render SVG (hiển thị 0ms)
const inMemoryTikzCache = new Map<string, string>();

let tikzJaxLoadPromise: Promise<void> | null = null;

function ensureTikzJaxLoaded(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if ((window as any).tikzjax) return Promise.resolve();
  if (tikzJaxLoadPromise) return tikzJaxLoadPromise;

  tikzJaxLoadPromise = new Promise((resolve) => {
    // 1. Thêm CSS font nếu chưa có
    if (!document.getElementById('tikzjax-fonts-css')) {
      const link = document.createElement('link');
      link.id = 'tikzjax-fonts-css';
      link.rel = 'stylesheet';
      link.type = 'text/css';
      link.href = 'https://cdn.jsdelivr.net/npm/@rod2ik/tikzjax@1.6.0/dist/fonts.css';
      document.head.appendChild(link);
    }

    // 2. Thêm script nếu chưa có
    const existingScript = document.getElementById('tikzjax-js') as HTMLScriptElement | null;
    if (existingScript) {
      if ((window as any).tikzjax) resolve();
      else existingScript.addEventListener('load', () => resolve());
      return;
    }

    const script = document.createElement('script');
    script.id = 'tikzjax-js';
    script.src = 'https://cdn.jsdelivr.net/npm/@rod2ik/tikzjax@1.6.0/dist/tikzjax.min.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.head.appendChild(script);
  });

  return tikzJaxLoadPromise;
}

function hashTikz(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return 'tikz_v4_' + Math.abs(hash).toString(36);
}

export const MathRenderer: React.FC<MathRendererProps> = ({
  content,
  className = '',
  inline = false,
}) => {
  const containerRef = useRef<HTMLDivElement | HTMLSpanElement>(null);

  const html = useMemo(() => {
    return renderMathToHtml(content || '');
  }, [content]);

  // Kiểm tra xem nội dung đã render có chứa các phần tử khối (div, table, svg, details, pre, v.v.) hay không
  // Nếu có, bắt buộc phải dùng thẻ <div> để tránh lỗi thẻ <div> lồng trong thẻ <span> làm vỡ cấu trúc DOM của trình duyệt
  const containsBlockElement = useMemo(() => {
    return /<(?:div|table|svg|pre|ul|ol|details|script)/i.test(html);
  }, [html]);

  const shouldUseDiv = !inline || containsBlockElement;

  // Kích hoạt render TikZ WebAssembly khi có hình vẽ TikZ trong nội dung
  useEffect(() => {
    if (typeof window === 'undefined' || !containerRef.current) return;

    const container = containerRef.current;
    const tikzTargets = container.querySelectorAll('.tikz-target[data-tikz]');
    if (tikzTargets.length === 0) return;

    // 1. Cấu hình TikzJaxOptions toàn cục với đầy đủ thư viện mũi tên & đồ thị
    if (!(window as any).TikzJaxOptions) {
      (window as any).TikzJaxOptions = {
        renderTimeout: 35000,
        tex: {
          tikzLibraries: [
            'arrows.meta',
            'arrows',
            'calc',
            'positioning',
            'shapes',
            'through',
            'intersections',
            'patterns',
            'decorations.pathmorphing',
            'backgrounds',
          ],
          addToPreamble: '\\usepackage{amsmath,amssymb}',
        },
      };
    }

    // 2. Chèn script tag TikZ hoặc nạp ngay từ Cache 0ms
    tikzTargets.forEach((target) => {
      // Nếu target đã có SVG đồ thị hợp lệ (từ pureSvg hoặc Tikzjax), không can thiệp đè lại
      const existingSvg = target.querySelector('svg.tikz-svg-pure, svg.tikz, svg.tikzjax');
      if (existingSvg) return;

      const rawTikz = decodeURIComponent(target.getAttribute('data-tikz') || '');
      if (!rawTikz) return;

      const cacheKey = `tikz_v4_${hashTikz(rawTikz)}`;

      // A. KIỂM TRA BỘ NHỚ RAM -> HIỂN THỊ TỨC THÌ 0ms!
      if (inMemoryTikzCache.has(cacheKey)) {
        target.innerHTML = inMemoryTikzCache.get(cacheKey)!;
        return;
      }

      // B. KIỂM TRA LOCALSTORAGE -> HIỂN THỊ TỨC THÌ 0ms!
      try {
        const cachedSvg = localStorage.getItem(cacheKey);
        // Loại bỏ ngay lập tức bất kỳ bản cache nào bị lỗi trước đây (chứa chữ \p, \pos, \mathrm cụt, hoặc spinner)
        if (
          cachedSvg &&
          (cachedSvg.includes('animate-spin') ||
            cachedSvg.includes('\\p') ||
            cachedSvg.includes('\\pos') ||
            cachedSvg.includes('\\x') ||
            cachedSvg.includes('\\mathrm') ||
            cachedSvg.includes('\\text'))
        ) {
          localStorage.removeItem(cacheKey);
        } else if (cachedSvg && cachedSvg.includes('<svg') && cachedSvg.length > 200) {
          inMemoryTikzCache.set(cacheKey, cachedSvg);
          target.innerHTML = cachedSvg;
          return;
        }
      } catch {}

      // C. THỬ RENDER BẰNG PURE TS TIKZ-TO-SVG ENGINE TRỰC TIẾP (0.1ms, KHÔNG CẦN CHỜ CDN)
      const pureSvg = renderTikzToSvg(rawTikz);
      if (pureSvg) {
        target.innerHTML = pureSvg;
        inMemoryTikzCache.set(cacheKey, pureSvg);
        try {
          localStorage.setItem(cacheKey, pureSvg);
        } catch {}
        return;
      }

      // D. NẾU CHƯA CÓ SVG THUẦN: TẠO THẺ SCRIPT SỐNG CHO TIKZJAX WEBASSEMBLY
      target.innerHTML = '';
      const loaderDiv = document.createElement('div');
      loaderDiv.className = 'tikz-loading flex items-center justify-center gap-2 py-3 px-5 rounded-2xl bg-blue-50/70 border border-blue-200/70 text-blue-700 text-xs font-semibold my-2';
      loaderDiv.innerHTML = `
        <svg class="animate-spin h-3.5 w-3.5 text-blue-600 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>Đang dựng hình vẽ TikZ...</span>
      `;
      target.appendChild(loaderDiv);

      const scriptTag = document.createElement('script');
      scriptTag.type = 'text/tikz';
      scriptTag.setAttribute('data-tikz-libraries', 'arrows.meta,arrows,calc,positioning,shapes,through,intersections,patterns,decorations.pathmorphing,backgrounds');
      scriptTag.textContent = rawTikz;
      target.appendChild(scriptTag);

      // Kích hoạt TikzJax WebAssembly quét và render thẻ script mới vừa chèn (Tự động nạp script nếu chưa có)
      if (typeof window !== 'undefined') {
        ensureTikzJaxLoaded().then(() => {
          try {
            if (typeof (window as any).tikzjax === 'function') {
              (window as any).tikzjax();
            } else if (typeof (window as any).tikzjax?.process === 'function') {
              (window as any).tikzjax.process();
            } else {
              window.dispatchEvent(new Event('DOMContentLoaded'));
            }
          } catch {}
        });
      }

      // E. MUTATION OBSERVER ĐỂ LƯU VÀO CACHE NGAY KHI TIKZJAX VẼ XONG SVG
      let isRendered = false;
      const observer = new MutationObserver((_mutations, obs) => {
        const svg = target.querySelector('svg.tikz, svg.tikzjax, svg:not(.animate-spin)');
        if (svg && !svg.classList.contains('animate-spin') && !svg.closest('.tikz-loading')) {
          isRendered = true;
          const loader = target.querySelector('.tikz-loading');
          if (loader) loader.remove();

          const svgOuter = svg.outerHTML;
          inMemoryTikzCache.set(cacheKey, svgOuter);
          try {
            localStorage.setItem(cacheKey, svgOuter);
          } catch {}
          obs.disconnect();
        }
      });
      observer.observe(target, { childList: true, subtree: true });

      // F. TIMEOUT AN TOÀN (2 GIÂY): NẾU TIKZJAX HOẶC CDN CHẬM THÌ KHÔNG ĐỂ TREO SPINNER VÔ TẬN
      setTimeout(() => {
        const hasRealSvg = target.querySelector('svg.tikz, svg.tikzjax, svg:not(.animate-spin)');
        if (!isRendered && !hasRealSvg) {
          observer.disconnect();
          const cleanSnippet = rawTikz
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .trim();

          // Nhận diện loại hình vẽ để hiển thị tiêu đề sư phạm
          let shapeLabel = 'Hình vẽ hình học';
          if (/\\widehat\{|góc|tam giác|trạm/i.test(rawTikz)) shapeLabel = 'Hình học tam giác & góc';
          else if (/lap_phuong|khối|lập phương|cube/i.test(rawTikz)) shapeLabel = 'Hình khối lập phương 3D';
          else if (/chóp|pyramid|nón|trụ/i.test(rawTikz)) shapeLabel = 'Hình không gian 3D';

          target.innerHTML = `
            <div class="my-2 rounded-2xl border border-blue-200/90 bg-gradient-to-b from-blue-50/60 to-slate-50 p-3.5 text-center shadow-2xs max-w-sm mx-auto">
              <div class="flex items-center justify-between mb-2 pb-1.5 border-b border-blue-100 text-xs font-bold text-blue-900">
                <span class="flex items-center gap-1.5">📐 ${shapeLabel}</span>
                <button type="button" class="retry-tikz-btn text-[11px] font-semibold text-blue-600 hover:text-blue-800 bg-white px-2 py-0.5 rounded-lg border border-blue-200 shadow-2xs cursor-pointer hover:bg-blue-50 transition">
                  🔄 Dựng lại
                </button>
              </div>
              <pre class="text-[10.5px] text-slate-700 font-mono text-left bg-white p-2 rounded-xl border border-slate-200 overflow-x-auto max-h-32 leading-relaxed">${cleanSnippet}</pre>
            </div>
          `;

          // Gắn sự kiện cho nút Dựng lại
          const retryBtn = target.querySelector('.retry-tikz-btn');
          if (retryBtn) {
            retryBtn.addEventListener('click', (e) => {
              e.preventDefault();
              try {
                if (typeof (window as any).tikzjax === 'function') {
                  (window as any).tikzjax();
                } else if (typeof (window as any).tikzjax?.process === 'function') {
                  (window as any).tikzjax.process();
                }
              } catch {}
            });
          }
        }
      }, 2000);
    });

    // 3. Đảm bảo nạp script TikZJax và Font CSS từ CDN JsDelivr tốc độ cao với CDN Unpkg dự phòng
    const existingScript = document.querySelector('script[src*="tikzjax"]');
    if (!existingScript) {
      const fontLink = document.createElement('link');
      fontLink.rel = 'stylesheet';
      fontLink.href = 'https://cdn.jsdelivr.net/npm/@rod2ik/tikzjax@1.6.0/dist/fonts.css';
      document.head.appendChild(fontLink);

      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@rod2ik/tikzjax@1.6.0/dist/tikzjax.min.js';
      script.async = true;
      script.onerror = () => {
        // Fallback CDN Unpkg nếu JsDelivr bị lỗi hoặc bị chặn mạng
        const fallbackScript = document.createElement('script');
        fallbackScript.src = 'https://unpkg.com/@rod2ik/tikzjax@1.6.0/dist/tikzjax.min.js';
        fallbackScript.async = true;
        document.head.appendChild(fallbackScript);
      };
      document.head.appendChild(script);
    }
  }, [html]);

  if (shouldUseDiv) {
    return (
      <div
        ref={containerRef as any}
        className={`math-content ${inline ? 'inline-block align-top' : 'leading-relaxed'} text-slate-800 ${className}`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return (
    <span
      ref={containerRef as any}
      className={`math-content inline ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export default MathRenderer;
