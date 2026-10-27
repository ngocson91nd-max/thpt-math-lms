function parseNodes(rawTikz) {
  const nodes = [];
  
  // Dạng 1: \node ... at (x,y) ... {text};
  // Bắt cả \node[pos] at (x,y) {text}; VÀ \node at (x,y) [pos] {text};
  const nodeStmtRegex = /\\node\s*(?:\[([^\]]*)\])?\s*at\s*(\([^)]+\))\s*(?:\[([^\]]*)\])?\s*\{([^}]*)\};/g;
  let m;
  while ((m = nodeStmtRegex.exec(rawTikz)) !== null) {
    const pos = (m[1] || m[3] || '').trim();
    const ptStr = m[2];
    const text = m[4].replace(/\$/g, '').trim();
    nodes.push({ ptStr, pos, text });
  }

  // Dạng 2: node[pos] {text} nằm trong câu lệnh \draw
  const inlineNodeRegex = /\\draw[^(;]*\([^;]+node\s*(?:\[([^\]]*)\])?\s*\{([^}]*)\}\s*;/g;
  while ((m = inlineNodeRegex.exec(rawTikz)) !== null) {
    const pos = (m[1] || '').trim();
    const text = m[2].replace(/\$/g, '').trim();
    // Lấy tọa độ cuối cùng trước chữ node
    const stmt = m[0];
    const pts = stmt.match(/\([^)]+\)/g);
    if (pts && pts.length > 0) {
      const lastPt = pts[pts.length - 1];
      nodes.push({ ptStr: lastPt, pos, text, inline: true });
    }
  }

  return nodes;
}

const testCode = `\\begin{tikzpicture}[line cap=round,line join=round,>=stealth,x=1.0cm,y=1.0cm,scale=0.8]
\\draw[->] (-4.0,0.) -- (4.0,0.) node[below right] {$x$};
\\draw[->] (0.,-3.0) -- (0.,5.0) node[above left] {$y$};
\\node at (0,0) [below left] {$O$};
\\node at (-1,0) [below left] {$-1$};
\\node at (0,2) [above right] {$2$};
\\end{tikzpicture}`;

console.log(parseNodes(testCode));
