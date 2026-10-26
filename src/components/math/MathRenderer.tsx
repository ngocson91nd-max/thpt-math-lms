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

  // Kích hoạt render TikZ WebAssembly khi có hình vẽ TikZ trong nội dung
  useEffect(() => {
    if (typeof window !== 'undefined' && html.includes('text/tikz')) {
      // Nếu TikZJax đã nạp sẵn, gửi sự kiện tải DOM để TikZJax quét và vẽ SVG
      try {
        if ((window as any).tikzjax) {
          (window as any).tikzjax.process();
        } else {
          // Nạp script TikZJax nếu chưa có trên trang
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
        }
      } catch (err) {
        console.warn('TikZ renderer info:', err);
      }
    }
  }, [html]);

  if (inline) {
    return (
      <span
        ref={containerRef as any}
        className={`math-content inline ${className}`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return (
    <div
      ref={containerRef as any}
      className={`math-content leading-relaxed text-slate-800 ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export default MathRenderer;
