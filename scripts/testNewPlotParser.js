function parseTikzPlots(rawTikz, defs = {}) {
  const plots = [];
  
  // Tìm tất cả các câu lệnh có chứa "plot"
  // Có thể là: \draw[...] plot(...); hoặc \draw plot(...);
  const regex = /\\draw(?:\[([^\]]*)\])?\s*plot\s*(\([^{]+|\(\{[^}]+\})\s*,\s*(\{[\s\S]*?\}|\([^)]+\))\s*\);/g;
  
  // Hoặc quét chính xác hơn bằng cách tìm từ khóa "plot"
  let idx = rawTikz.indexOf('plot');
  while (idx !== -1) {
    // Tìm \draw đứng trước plot
    const drawIdx = rawTikz.lastIndexOf('\\draw', idx);
    let opts = '';
    if (drawIdx !== -1) {
      const between = rawTikz.substring(drawIdx + 5, idx).trim();
      const optMatch = between.match(/^\[([^\]]*)\]/);
      if (optMatch) {
        opts = optMatch[1];
      }
    }
    
    // Tìm điểm mở ngoặc của plot(...)
    const openParen = rawTikz.indexOf('(', idx);
    if (openParen !== -1 && openParen - idx < 10) {
      // Tìm dấu phẩy phân cách x và y
      // Chú ý: x có thể là \x hoặc {\x}
      let commaIdx = -1;
      let depth = 0;
      for (let i = openParen + 1; i < rawTikz.length; i++) {
        if (rawTikz[i] === '(' || rawTikz[i] === '{') depth++;
        else if (rawTikz[i] === ')' || rawTikz[i] === '}') depth--;
        else if (rawTikz[i] === ',' && depth === 0) {
          commaIdx = i;
          break;
        }
      }
      
      if (commaIdx !== -1) {
        // Tìm điểm kết thúc của plot(...)
        let endParen = -1;
        depth = 0;
        for (let i = commaIdx + 1; i < rawTikz.length; i++) {
          if (rawTikz[i] === '(' || rawTikz[i] === '{') depth++;
          else if (rawTikz[i] === ')' || rawTikz[i] === '}') {
            if (depth === 0) {
              endParen = i;
              break;
            }
            depth--;
          }
        }
        
        if (endParen !== -1) {
          let expr = rawTikz.substring(commaIdx + 1, endParen).trim();
          if (expr.startsWith('{') && expr.endsWith('}')) {
            expr = expr.slice(1, -1).trim();
          }
          
          let startX = -4, endX = 4;
          const domainMatch = opts.match(/domain=([^:]+):([^,\]]+)/);
          if (domainMatch) {
            startX = parseFloat(domainMatch[1]);
            endX = parseFloat(domainMatch[2]);
          }
          
          const isDashed = opts.includes('dashed');
          const color = opts.includes('blue') ? '#2563eb' : opts.includes('red') ? '#ef4444' : '#1e293b';
          
          plots.push({
            expr,
            startX,
            endX,
            isDashed,
            color,
            fullMatch: rawTikz.substring(drawIdx, endParen + 2) // cả dấu );
          });
        }
      }
    }
    
    idx = rawTikz.indexOf('plot', idx + 4);
  }
  
  return plots;
}

const testCode = `\\begin{tikzpicture}[line cap=round,line join=round,>=stealth,x=1.0cm,y=1.0cm,scale=0.8]
\\draw[->] (-4.0,0.) -- (4.0,0.) node[below right] {$x$};
\\draw[->] (0.,-3.0) -- (0.,5.0) node[above left] {$y$};
\\draw[dashed] (-1.,-3.0) -- (-1.,5.0);
\\draw[dashed] (-4.0,2.) -- (4.0,2.);
\\draw[color=blue,smooth,samples=100,domain=-4.0:-1.2] plot({\\x},{(2*(\\x)-1)/((\\x)+1)});
\\draw[color=blue,smooth,samples=100,domain=-0.8:4.0] plot({\\x},{(2*(\\x)-1)/((\\x)+1)});
\\node at (0,0) [below left] {$O$};
\\node at (-1,0) [below left] {$-1$};
\\node at (0,2) [above right] {$2$};
\\end{tikzpicture}`;

const res = parseTikzPlots(testCode);
console.log('Parsed plots count:', res.length);
console.log(res);
