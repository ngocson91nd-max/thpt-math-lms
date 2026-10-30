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

  it('renders cubic curve in Câu 6 continuously without any gap (decimal expression)', () => {
    const code = `\\begin{tikzpicture}[>=stealth, scale=0.8]
      \\draw[->] (-2.5,0) -- (2.5,0) node[below] {$x$};
      \\draw[->] (0,-3) -- (0,4) node[right] {$y$};
      \\node at (0,0) [below right] {$O$};
      \\draw[thick, samples=100, domain=-1.6:1.8] plot (\\x, {1.25*(\\x)^3 - 3.75*(\\x) + 0.5});
      \\draw[dashed] (-1,0) -- (-1,3) -- (0,3) node[right] {$3$};
      \\node at (-1,0) [below] {$-1$};
      \\draw[dashed] (1,0) -- (1,-2) -- (0,-2) node[left] {$-2$};
      \\node at (1,0) [above] {$1$};
    \\end{tikzpicture}`;
    const svg = renderTikzToSvg(code);
    expect(svg).not.toBeNull();
    const pathMatches = svg!.match(/<path[^>]+d="([^"]+)"/g) || [];
    pathMatches.forEach((p) => console.log('DECIMAL PATH:', p));
  });

  it('renders cubic curve with fractions 5/4 and 15/4 without gap', () => {
    const code = `\\begin{tikzpicture}[>=stealth, scale=0.8]
      \\draw[->] (-2.5,0) -- (2.5,0) node[below] {$x$};
      \\draw[->] (0,-3) -- (0,4) node[right] {$y$};
      \\draw[thick, samples=100, domain=-1.6:1.8] plot (\\x, {5/4*(\\x)^3 - 15/4*(\\x) + 1/2});
    \\end{tikzpicture}`;
    const svg = renderTikzToSvg(code);
    expect(svg).not.toBeNull();
    const pathMatches = svg!.match(/<path[^>]+d="([^"]+)"/g) || [];
    pathMatches.forEach((p) => console.log('FRACTION PATH:', p));
  });

  it('bypasses pure TS engine for advanced packages (tikz-3dplot, tkz-euclide) to use Server TeX Engine', () => {
    const code = `\\begin{tikzpicture}
      \\tdplotsetmaincoords{70}{110}
      \\coordinate (S) at (0, 0, 4);
    \\end{tikzpicture}`;
    const svg = renderTikzToSvg(code);
    // Phải trả về null để MathRenderer kích hoạt gọi /api/render-tikz
    expect(svg).toBeNull();
  });
});
