'use client';

import React, { useMemo } from 'react';
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
  const html = useMemo(() => {
    return renderMathToHtml(content || '');
  }, [content]);

  if (inline) {
    return (
      <span
        className={`math-content inline ${className}`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return (
    <div
      className={`math-content leading-relaxed text-slate-800 ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export default MathRenderer;
