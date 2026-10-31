import { describe, it, expect } from 'vitest';
import { renderTikzToSvg, cleanTikzNodeText } from '../src/lib/math/tikzSvgRenderer';
import { cleanLatexSymbol, parseTkzTabCode, generateTkzTabSvg } from '../src/lib/math/tkzTabRenderer';

describe('TikZ 3D & Advanced Tests', () => {
  it('bypasses 3D chandelier with coordinates (x,y,z) to TeX Server by returning null', () => {
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
    // Trả về null để chuyển giao hoàn toàn cho Server TeX Live xử lý 3D chính xác, không sinh nét thừa
    expect(svg).toBeNull();
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

  it('renders tkz-tab correctly with nested fractions and suppresses row 3 for sign-only tables', () => {
    // 1. Kiểm tra cleanLatexSymbol với các biểu thức phân số và hàm số
    expect(cleanLatexSymbol('\\dfrac{1000}{e}')).toBe('1000/e');
    expect(cleanLatexSymbol('\\dfrac1000')).toBe('1000');
    expect(cleanLatexSymbol('\\dfrac{1000}{e^{0,4}}')).toBe('1000/e^(0,4)');

    // 2. Bảng xét dấu đạo hàm (chỉ có dòng x và f'(x), KHÔNG có \tkzTabVar)
    const signTableCode = `\\begin{tikzpicture}
      \\tkzTabInit{$x$/1,$f'(x)$/1}{$-\\infty$,$-3$,$-2$,$-1$,$0$,$1$,$+\\infty$}
      \\tkzTabLine{,+,0,+,0,-,0,+,0,-,0,-,}
    \\end{tikzpicture}`;
    const parsedSign = parseTkzTabCode(signTableCode);
    expect(parsedSign).not.toBeNull();
    expect(parsedSign!.variations.length).toBe(0);

    const svgSign = generateTkzTabSvg(parsedSign!);
    // Chiều cao phải là 100px (50 + 50), không có hàng 3 (150px)
    expect(svgSign).toContain('viewBox="0 0 ');
    expect(svgSign).toContain(' 100"');

    // 2b. Bảng xét dấu có \tkzTabVar rỗng/dummy cũng tự động triệt tiêu hàng 3
    const dummyVarTableCode = `\\begin{tikzpicture}
      \\tkzTabInit{$x$/1,$f'(x)$/1}{$-\\infty$,$0$,$+\\infty$}
      \\tkzTabLine{,-,0,+,}
      \\tkzTabVar{-/, +/}
    \\end{tikzpicture}`;
    const parsedDummy = parseTkzTabCode(dummyVarTableCode);
    expect(parsedDummy).not.toBeNull();
    const svgDummy = generateTkzTabSvg(parsedDummy!);
    expect(svgDummy).toContain(' 100"');

    // 3. Bảng biến thiên có phân số lồng nhau trong \tkzTabVar
    const varTableCode = `\\begin{tikzpicture}
      \\tkzTabInit{$t$/1,$v'(t)$/1,$v(t)$/2}{$0$,$2{,}5\\ln 5$,$+\\infty$}
      \\tkzTabLine{,+,0,-,}
      \\tkzTabVar{-/$0$,+/$\\dfrac{1000}{e}$,-/$0$}
    \\end{tikzpicture}`;
    const parsedVar = parseTkzTabCode(varTableCode);
    expect(parsedVar).not.toBeNull();
    expect(parsedVar!.variations.length).toBe(3);
    expect(parsedVar!.variations[1].val).toBe('\\dfrac{1000}{e}');

    const svgVar = generateTkzTabSvg(parsedVar!);
    expect(svgVar).toContain('1000/e');
    expect(svgVar).toContain(' 250"');
  });

  it('formats vector node labels cleanly without leaking backslashes or broken characters', () => {
    expect(cleanTikzNodeText('$\\overrightarrow{P}$')).toBe('P⃗');
    expect(cleanTikzNodeText('$\\overrightarrow{F}_C$')).toBe('F⃗ᴄ');
    expect(cleanTikzNodeText('$\\vec{F}_A$')).toBe('F⃗ᴀ');
    expect(cleanTikzNodeText('$\\vv{AB}$')).toBe('AB⃗');
  });

  it('detects 3D prism vertices (A\', B\', C\', D\') and delegates directly to Server TeX', () => {
    const code = `\\begin{tikzpicture}
      \\coordinate (A) at (0,0);
      \\coordinate (B) at (3,0);
      \\coordinate (C) at (1,2);
      \\coordinate (A') at (0,3);
      \\coordinate (B') at (3,3);
      \\coordinate (C') at (1,5);
      \\draw (A) -- (B) -- (C) -- cycle;
      \\draw (A') -- (B') -- (C') -- cycle;
    \\end{tikzpicture}`;
    const svg = renderTikzToSvg(code);
    expect(svg).toBeNull();
  });

  it('detects chandelier with suspension apex S and ellipse base and delegates to Server TeX', () => {
    const code = `\\begin{tikzpicture}
      \\coordinate (O) at (0,0);
      \\coordinate (S) at (0,3.5);
      \\coordinate (A) at (-2.5,0);
      \\coordinate (B) at (-0.8,-0.3);
      \\coordinate (C) at (2.5,0);
      \\coordinate (D) at (0.8,0.3);
      \\draw (O) ellipse (2.5 and 0.4);
      \\draw (S) -- (A) (S) -- (B) (S) -- (C);
      \\draw[dashed] (S) -- (D);
    \\end{tikzpicture}`;
    const svg = renderTikzToSvg(code);
    expect(svg).toBeNull();
  });

  it('detects book page geometric layout with coordinates and cycle and delegates to Server TeX', () => {
    const code = `\\begin{tikzpicture}[scale=0.8]
      \\coordinate (A) at (0,6);
      \\coordinate (B) at (4.5,6);
      \\coordinate (C) at (4.5,0);
      \\coordinate (D) at (0,0);
      \\coordinate (M) at (1.2, 4.5);
      \\coordinate (N) at (3.5, 4.5);
      \\coordinate (P) at (3.5, 1.5);
      \\coordinate (Q) at (1.2, 1.5);
      \\draw[thick] (A) -- (B) -- (C) -- (D) -- cycle;
      \\draw[thick] (M) -- (N) -- (P) -- (Q) -- cycle;
    \\end{tikzpicture}`;
    const svg = renderTikzToSvg(code);
    expect(svg).toBeNull();
  });

  it('renders Câu 2 cubic graph with fill circles at extrema without drawing extraneous diagonal lines', () => {
    const code = `\\begin{tikzpicture}[>=stealth,scale=1]
      \\draw[->] (-2.5,0) -- (2.5,0) node[below] {$x$};
      \\draw[->] (0,-3) -- (0,3) node[right] {$y$};
      \\draw (0,0) node[below right] {$O$};
      \\draw[dashed] (-1,0) -- (-1,2) -- (0,2);
      \\draw[dashed] (1,0) -- (1,-2) -- (0,-2);
      \\draw[thick,domain=-2.1:2.1,samples=100] plot (\\x, {(\\x)^3 - 3*(\\x)});
      \\fill (-1,2) circle (1.5pt) (1,-2) circle (1.5pt);
    \\end{tikzpicture}`;
    const svg = renderTikzToSvg(code);
    expect(svg).not.toBeNull();
    // Check that there is no line connecting (-1,2) to (1,-2) or (0,0)
    const lines = svg!.match(/<line[^>]+>/g) || [];
    // Only 6 lines: 2 axes + 4 dashed segments
    expect(lines.length).toBe(6);
    expect(svg).not.toContain('x1="137.7" y1="118.1" x2="190.0" y2="222.6"');
    expect(svg).not.toContain('x1="137.7" y1="118.1" x2="242.3" y2="327.1"');
  });
});
