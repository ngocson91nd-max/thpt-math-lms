import { describe, it, expect } from 'vitest';
import { renderTikzToSvg } from '@/lib/math/tikzSvgRenderer';

describe('Test Rational Graph Variations', () => {
  const samples = [
    // Biến thể 1
    `\\begin{tikzpicture}[scale=0.65, font=\\footnotesize, line join=round, line cap=round]
\\def\\xmin{-3.5} \\def\\xmax{3.2}
\\def\\ymin{-0.8} \\def\\ymax{4.5}
\\draw[->] (\\xmin,0) -- (\\xmax,0) node[below left] {$x$};
\\draw[->] (0,\\ymin) -- (0,\\ymax) node[below right] {$y$};
\\node[below left] at (0,0) {$O$};
\\draw[thick, domain=-0.4:\\xmax, smooth] plot (\\x, {2.5/((\\x)+1)^2});
\\draw[dashed] (-1,\\ymin) -- (-1,\\ymax);
\\node[below] at (-1,0) {$-1$};
\\end{tikzpicture}`,

    // Biến thể 2
    `\\begin{tikzpicture}[>=stealth,scale=0.7]
\\draw[->] (-3,0) -- (4,0) node[below] {$x$};
\\draw[->] (0,-3) -- (0,4) node[below left] {$y$};
\\draw (0,0) node[below left] {$O$};
\\draw[dashed] (1,-3) -- (1,4);
\\draw[dashed] (-3,2) -- (4,2);
\\draw[thick,domain=-3:0.7,samples=100] plot (\\x,{(2*\\x-1)/(\\x-1)});
\\draw[thick,domain=1.3:4,samples=100] plot (\\x,{(2*\\x-1)/(\\x-1)});
\\end{tikzpicture}`,

    // Biến thể 3: Có ngoặc nhọn quanh {\\x} và node đặt sau at
    `\\begin{tikzpicture}[line cap=round,line join=round,>=stealth,x=1.0cm,y=1.0cm,scale=0.8]
\\draw[->] (-4.0,0.) -- (4.0,0.) node[below right] {$x$};
\\draw[->] (0.,-3.0) -- (0.,5.0) node[above left] {$y$};
\\draw[dashed] (-1.,-3.0) -- (-1.,5.0);
\\draw[dashed] (-4.0,2.) -- (4.0,2.);
\\draw[color=blue,smooth,samples=100,domain=-4.0:-1.2] plot({\\x},{(2*(\\x)-1)/((\\x)+1)});
\\draw[color=blue,smooth,samples=100,domain=-0.8:4.0] plot({\\x},{(2*(\\x)-1)/((\\x)+1)});
\\node at (0,0) [below left] {$O$};
\\node at (-1,0) [below left] {$-1$};
\\node at (0,2) [above right] {$2$};
\\end{tikzpicture}`
  ];

  samples.forEach((code, idx) => {
    it(`renders sample variation ${idx + 1}`, () => {
      const svg = renderTikzToSvg(code);
      console.log(`Variation ${idx + 1}:`, svg ? `PASSED (${svg.length} chars)` : 'FAILED (null)');
      expect(svg).not.toBeNull();
    });
  });
});
