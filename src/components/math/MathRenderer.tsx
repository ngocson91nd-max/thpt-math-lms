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

      const cacheKey = hashTikz(rawTikz);

      // A. KIỂM TRA BỘ NHỚ RAM -> HIỂN THỊ TỨC THÌ 0ms!
      if (inMemoryTikzCache.has(cacheKey)) {
        target.innerHTML = inMemoryTikzCache.get(cacheKey)!;
        return;
      }

      // B. KIỂM TRA LOCALSTORAGE -> HIỂN THỊ TỨC THÌ 0ms!
      try {
        const cachedSvg = localStorage.getItem(cacheKey);
        if (cachedSvg && cachedSvg.includes('<svg') && cachedSvg.length > 200 && !cachedSvg.includes('animate-spin')) {
          inMemoryTikzCache.set(cacheKey, cachedSvg);
          target.innerHTML = cachedSvg;
          return;
        }
        if (cachedSvg && cachedSvg.includes('animate-spin')) {
          localStorage.removeItem(cacheKey);
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

      // D. NẾU CHƯA CÓ SVG THUẦN: HIỂN THỊ KHUNG NẠP HÌNH ĐẸP MẮT CHO TIKZJAX WEBASSEMBLY
      // Kiểm tra xem đã có thẻ script text/tikz chưa
      const existingScriptTag = target.querySelector('script[type="text/tikz"]');
      if (!existingScriptTag) {
        target.innerHTML = `
          <div class="tikz-loading flex items-center justify-center gap-2 py-3 px-5 rounded-2xl bg-blue-50/70 border border-blue-200/70 text-blue-700 text-xs font-semibold my-2">
            <svg class="animate-spin h-3.5 w-3.5 text-blue-600 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Đang dựng hình vẽ TikZ...</span>
          </div>
        `;

        const scriptTag = document.createElement('script');
        scriptTag.type = 'text/tikz';
        scriptTag.setAttribute('data-tikz-libraries', 'arrows.meta,arrows,calc,positioning,shapes,through,intersections,patterns,decorations.pathmorphing,backgrounds');
        scriptTag.textContent = rawTikz;
        target.appendChild(scriptTag);
      }

      // E. MUTATION OBSERVER ĐỂ LƯU VÀO CACHE NGAY KHI TIKZJAX VẼ XONG SVG
      // TUYỆT ĐỐI CHỈ BẮT SVG DO TIKZJAX VẼ, KHÔNG ĐƯỢC BẮT SVG SPINNER CỦA LOADER!
      const observer = new MutationObserver((_mutations, obs) => {
        const svg = target.querySelector('svg.tikz, svg.tikzjax, svg:not(.animate-spin)');
        if (svg && !svg.classList.contains('animate-spin') && !svg.closest('.tikz-loading')) {
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
    });

    // 3. Đảm bảo nạp script TikZJax và Font CSS từ CDN JsDelivr tốc độ cao châu Á
    const existingScript = document.querySelector('script[src*="tikzjax"]');
    if (!existingScript) {
      const fontLink = document.createElement('link');
      fontLink.rel = 'stylesheet';
      fontLink.href = 'https://cdn.jsdelivr.net/npm/@rod2ik/tikzjax@1.6.0/dist/fonts.css';
      document.head.appendChild(fontLink);

      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@rod2ik/tikzjax@1.6.0/dist/tikzjax.min.js';
      script.async = true;
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
