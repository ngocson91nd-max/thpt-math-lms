import { describe, it, expect } from 'vitest';
import { renderTikzToSvg } from '../src/lib/math/tikzSvgRenderer';

describe('TikZ 3D & Advanced Tests', () => {
  it('renders 3D chandelier with coordinates (x,y,z) without returning null', () => {
    const code = `\\begin{tikzpicture}
      \\coordinate (A) at (2, -2, 0);
      \\coordinate (B) at (2, 2, 0);
      \\coordinate (C) at (-2, 2, 0);
      \\coordinate (D) at (-2, -2, 0);
      \\coordinate (S) at (0, 0, 4);
      \\coordinate (O) at (0, 0, 0);
      \\draw[dashed] (S) -- (D);
      \\draw[dashed] (S) -- (O);
      \\draw (S) -- (A);
      \\draw (S) -- (B);
      \\draw (S) -- (C);
      \\draw (A) -- (B) -- (C) -- (D) -- cycle;
    \\end{tikzpicture}`;
    const svg = renderTikzToSvg(code);
    expect(svg).not.toBeNull();
    const lineCount = (svg!.match(/<line/g) || []).length;
    console.log('3D lines drawn:', lineCount);
    expect(lineCount).toBeGreaterThanOrEqual(9);
  });
});
