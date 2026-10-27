'use client';

import React, { useMemo, useEffect, useRef } from 'react';
import { renderMathToHtml } from '@/lib/math/katexRenderer';

interface MathRendererProps {
  content: string;
  className?: string;
  inline?: boolean;
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

    // 2. Chèn script tag TikZ thật sự vào từng target để kích hoạt MutationObserver của TikzJax
    tikzTargets.forEach((target) => {
      // Nếu đã có SVG được TikZJax render rồi thì không chèn lại
      if (target.querySelector('svg.tikz, svg.tikzjax, svg')) return;

      const rawTikz = decodeURIComponent(target.getAttribute('data-tikz') || '');
      if (!rawTikz) return;

      // Xóa các thẻ cũ nếu có và tạo element script thật để MutationObserver bắt được
      target.innerHTML = '';
      const scriptTag = document.createElement('script');
      scriptTag.type = 'text/tikz';
      scriptTag.setAttribute('data-tikz-libraries', 'arrows.meta,arrows,calc,positioning,shapes,through,intersections,patterns,decorations.pathmorphing,backgrounds');
      scriptTag.textContent = rawTikz;
      target.appendChild(scriptTag);
    });

    // 3. Đảm bảo nạp script TikZJax và Font CSS
    const existingScript = document.querySelector('script[src*="tikzjax"]');
    if (!existingScript) {
      const fontLink = document.createElement('link');
      fontLink.rel = 'stylesheet';
      fontLink.href = 'https://unpkg.com/@rod2ik/tikzjax@1.6.0/dist/fonts.css';
      document.head.appendChild(fontLink);

      const script = document.createElement('script');
      script.src = 'https://unpkg.com/@rod2ik/tikzjax@1.6.0/dist/tikzjax.min.js';
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
