/**
 * Prototype Pure JS TikZ to SVG Renderer
 */

function parseNumber(str, defs = {}) {
  let s = str.trim();
  for (const [k, v] of Object.entries(defs)) {
    s = s.replace(new RegExp(`\\\\${k}\\b`, 'g'), String(v));
  }
  // Remove pt, cm, etc.
  s = s.replace(/pt|cm|mm/g, '');
  try {
    const val = Function(`"use strict"; return (${s});`)();
    return typeof val === 'number' && !isNaN(val) ? val : 0;
  } catch {
    return 0;
  }
}

function parsePoint(coordStr, coords = {}, defs = {}) {
  let s = coordStr.trim();
  // Remove enclosing parentheses
  if (s.startsWith('(') && s.endsWith(')')) {
    s = s.slice(1, -1).trim();
  }

  // Check if it's a named coordinate e.g. "A" or "S"
  if (coords[s]) {
    return { ...coords[s] };
  }

  // Check if it's calc syntax e.g. "$(B)+(D)-(A)$" or "$(A)!0.5!(B)$"
  if (s.startsWith('$') && s.endsWith('$')) {
    s = s.slice(1, -1).trim();
    // Pattern: $(A)!ratio!(B)$
    const interpMatch = s.match(/^\(([^)]+)\)\s*!\s*([0-9.]+)\s*!\s*\(([^)]+)\)$/);
    if (interpMatch) {
      const p1 = coords[interpMatch[1]] || { x: 0, y: 0 };
      const ratio = parseFloat(interpMatch[2]);
      const p2 = coords[interpMatch[3]] || { x: 0, y: 0 };
      return {
        x: p1.x + ratio * (p2.x - p1.x),
        y: p1.y + ratio * (p2.y - p1.y)
      };
    }

    // Pattern: $(B)+(D)-(A)$
    // Vector addition / subtraction
    const parts = s.match(/([+-]?)\s*\(([^)]+)\)/g);
    if (parts) {
      let x = 0, y = 0;
      for (const part of parts) {
        const sign = part.trim().startsWith('-') ? -1 : 1;
        const name = part.replace(/[+-]/g, '').trim().slice(1, -1);
        const pt = coords[name] || { x: 0, y: 0 };
        x += sign * pt.x;
        y += sign * pt.y;
      }
      return { x, y };
    }
  }

  // Simple (x, y)
  const commaIdx = s.indexOf(',');
  if (commaIdx !== -1) {
    const xPart = s.substring(0, commaIdx);
    const yPart = s.substring(commaIdx + 1);
    return {
      x: parseNumber(xPart, defs),
      y: parseNumber(yPart, defs)
    };
  }

  return { x: 0, y: 0 };
}

function evalPlotExpr(expr, xVal, defs = {}) {
  let clean = expr;
  for (const [k, v] of Object.entries(defs)) {
    clean = clean.replace(new RegExp(`\\\\${k}\\b`, 'g'), String(v));
  }
  clean = clean
    .replace(/\\x/g, `(${xVal})`)
    .replace(/x/g, `(${xVal})`)
    .replace(/\^/g, '**')
    .replace(/exp\(/g, 'Math.exp(')
    .replace(/ln\(/g, 'Math.log(')
    .replace(/sin\(([^)]+) r\)/g, 'Math.sin($1)')
    .replace(/sin\(/g, 'Math.sin(')
    .replace(/cos\(([^)]+) r\)/g, 'Math.cos($1)')
    .replace(/cos\(/g, 'Math.cos(')
    .replace(/sqrt\(/g, 'Math.sqrt(')
    .replace(/abs\(/g, 'Math.abs(');

  try {
    const val = Function(`"use strict"; return (${clean});`)();
    return typeof val === 'number' && !isNaN(val) && isFinite(val) ? val : null;
  } catch {
    return null;
  }
}

function renderTikzToSvg(rawTikz) {
  const defs = {};
  const coords = {};
  const drawItems = [];

  // 1. Parse defs like \def\xmin{-4.2}
  const defRegex = /\\def\\([a-zA-Z]+)\{([^}]+)\}/g;
  let m;
  while ((m = defRegex.exec(rawTikz)) !== null) {
    defs[m[1]] = parseFloat(m[2]) || m[2];
  }

  let minX = typeof defs.xmin === 'number' ? defs.xmin : Infinity;
  let maxX = typeof defs.xmax === 'number' ? defs.xmax : -Infinity;
  let minY = typeof defs.ymin === 'number' ? defs.ymin : Infinity;
  let maxY = typeof defs.ymax === 'number' ? defs.ymax : -Infinity;

  const updateBounds = (x, y) => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  };

  // 2. Parse coordinates: \coordinate (A) at (x, y);
  const coordRegex = /\\coordinate\s*\(([^)]+)\)\s*at\s*(\([^;]+\));/g;
  while ((m = coordRegex.exec(rawTikz)) !== null) {
    const name = m[1].trim();
    const pt = parsePoint(m[2], coords, defs);
    coords[name] = pt;
    updateBounds(pt.x, pt.y);
  }

  // 3. Parse grid: \draw[thick] (0,0) grid (5,5);
  const gridRegex = /\\draw(?:\[[^\]]*\])?\s*\(([^)]+)\)\s*grid\s*\(([^)]+)\);/g;
  while ((m = gridRegex.exec(rawTikz)) !== null) {
    const p1 = parsePoint(m[1], coords, defs);
    const p2 = parsePoint(m[2], coords, defs);
    drawItems.push({ type: 'grid', p1, p2 });
    updateBounds(p1.x, p1.y);
    updateBounds(p2.x, p2.y);
  }

  // 4. Parse plots: \draw[..., domain=a:b] plot (\x, {expr});
  const plotRegex = /\\draw\[([^\]]*)\]\s*plot\s*\(\\x,\s*\{([^}]+)\}\);/g;
  while ((m = plotRegex.exec(rawTikz)) !== null) {
    const opts = m[1];
    const expr = m[2];
    const domainMatch = opts.match(/domain=([^:]+):([^,\]]+)/);
    let startX = -3, endX = 3;
    if (domainMatch) {
      startX = parseNumber(domainMatch[1], defs);
      endX = parseNumber(domainMatch[2], defs);
    }
    const isDashed = opts.includes('dashed');
    const color = opts.includes('red') ? '#ef4444' : opts.includes('blue') ? '#2563eb' : '#1e293b';
    drawItems.push({ type: 'plot', expr, startX, endX, isDashed, color });
    updateBounds(startX, 0);
    updateBounds(endX, 0);
  }

  // 5. Parse lines / arrows: \draw[options] (A) -- (B) ... ;
  // Remove plot statements to avoid collision
  const cleanLines = rawTikz.replace(plotRegex, '').replace(gridRegex, '').replace(coordRegex, '');
  const lineStmtRegex = /\\draw(\[[^\]]*\])?\s*([^(;]*\([^;]+);/g;
  while ((m = lineStmtRegex.exec(cleanLines)) !== null) {
    const opts = m[1] || '';
    const body = m[2];
    const isArrow = opts.includes('->') || opts.includes('>=stealth');
    const isDashed = opts.includes('dashed');
    const isThick = opts.includes('thick');

    // Extract segments: (p1) -- (p2)
    // There can be multiple chains: (A)--(B) (C)--(D)
    const chains = body.split(/\s+/).filter(Boolean);
    const ptMatches = body.match(/\([^)]+\)/g) || [];
    for (let i = 0; i < ptMatches.length - 1; i++) {
      const p1 = parsePoint(ptMatches[i], coords, defs);
      const p2 = parsePoint(ptMatches[i + 1], coords, defs);
      // Check if there was a '--' between them
      drawItems.push({
        type: 'line',
        p1,
        p2,
        isArrow: isArrow && (i === ptMatches.length - 2),
        isDashed,
        isThick,
      });
      updateBounds(p1.x, p1.y);
      updateBounds(p2.x, p2.y);
    }
  }

  // 6. Parse nodes: \node[pos] at (x, y) {$text$};
  const nodeRegex = /\\node(?:\[([^\]]*)\])?\s*at\s*(\([^)]+\))\s*\{([^}]*)\};/g;
  while ((m = nodeRegex.exec(rawTikz)) !== null) {
    const pos = m[1] || '';
    const pt = parsePoint(m[2], coords, defs);
    const text = m[3].replace(/\$/g, '').trim();
    drawItems.push({ type: 'node', pt, text, pos });
    updateBounds(pt.x, pt.y);
  }

  // 7. Parse points: \fill (x,y) circle (r);
  const fillRegex = /\\fill(?:\[([^\]]*)\])?\s*(\([^)]+\))\s*circle\s*\(([^)]+)\);/g;
  while ((m = fillRegex.exec(rawTikz)) !== null) {
    const pt = parsePoint(m[2], coords, defs);
    drawItems.push({ type: 'point', pt, radius: 2.5 });
    updateBounds(pt.x, pt.y);
  }

  if (minX === Infinity || maxX === -Infinity) return null;

  // Add margin around bounds
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const marginX = spanX * 0.12;
  const marginY = spanY * 0.12;
  const boundMinX = minX - marginX;
  const boundMaxX = maxX + marginX;
  const boundMinY = minY - marginY;
  const boundMaxY = maxY + marginY;

  const width = 280;
  const height = Math.min(320, Math.max(180, Math.round(width * (spanY / spanX))));
  const pad = 24;

  const toSvgX = (x) => pad + ((x - boundMinX) / (boundMaxX - boundMinX)) * (width - 2 * pad);
  const toSvgY = (y) => height - (pad + ((y - boundMinY) / (boundMaxY - boundMinY)) * (height - 2 * pad));

  let svgElements = [];

  // Marker for arrows
  svgElements.push(`
    <defs>
      <marker id="tikz-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#334155" />
      </marker>
    </defs>
  `);

  // Render items
  for (const item of drawItems) {
    if (item.type === 'line') {
      const x1 = toSvgX(item.p1.x).toFixed(1);
      const y1 = toSvgY(item.p1.y).toFixed(1);
      const x2 = toSvgX(item.p2.x).toFixed(1);
      const y2 = toSvgY(item.p2.y).toFixed(1);
      const stroke = item.isArrow ? '#334155' : item.isDashed ? '#64748b' : '#1e293b';
      const strokeWidth = item.isThick ? '1.8' : '1.2';
      const dash = item.isDashed ? 'stroke-dasharray="4,4"' : '';
      const marker = item.isArrow ? 'marker-end="url(#tikz-arrow)"' : '';
      svgElements.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${strokeWidth}" ${dash} ${marker} stroke-linecap="round" />`);
    } else if (item.type === 'grid') {
      const x1 = Math.min(item.p1.x, item.p2.x);
      const x2 = Math.max(item.p1.x, item.p2.x);
      const y1 = Math.min(item.p1.y, item.p2.y);
      const y2 = Math.max(item.p1.y, item.p2.y);
      for (let x = x1; x <= x2; x++) {
        svgElements.push(`<line x1="${toSvgX(x)}" y1="${toSvgY(y1)}" x2="${toSvgX(x)}" y2="${toSvgY(y2)}" stroke="#cbd5e1" stroke-width="1" />`);
      }
      for (let y = y1; y <= y2; y++) {
        svgElements.push(`<line x1="${toSvgX(x1)}" y1="${toSvgY(y)}" x2="${toSvgX(x2)}" y2="${toSvgY(y)}" stroke="#cbd5e1" stroke-width="1" />`);
      }
    } else if (item.type === 'plot') {
      const steps = 60;
      const dx = (item.endX - item.startX) / steps;
      let pathD = '';
      let isDrawing = false;

      for (let i = 0; i <= steps; i++) {
        const x = item.startX + i * dx;
        const y = evalPlotExpr(item.expr, x, defs);
        if (y !== null && isFinite(y) && y >= boundMinY - spanY && y <= boundMaxY + spanY) {
          const sx = toSvgX(x).toFixed(1);
          const sy = toSvgY(y).toFixed(1);
          if (!isDrawing) {
            pathD += ` M ${sx} ${sy}`;
            isDrawing = true;
          } else {
            pathD += ` L ${sx} ${sy}`;
          }
        } else {
          isDrawing = false;
        }
      }

      if (pathD) {
        svgElements.push(`<path d="${pathD}" fill="none" stroke="${item.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />`);
      }
    } else if (item.type === 'point') {
      const cx = toSvgX(item.pt.x).toFixed(1);
      const cy = toSvgY(item.pt.y).toFixed(1);
      svgElements.push(`<circle cx="${cx}" cy="${cy}" r="${item.radius}" fill="#0f172a" />`);
    } else if (item.type === 'node') {
      const cx = toSvgX(item.pt.x);
      const cy = toSvgY(item.pt.y);
      let dx = 0, dy = 0;
      let anchor = 'middle';
      if (item.pos.includes('below')) dy = 14;
      if (item.pos.includes('above')) dy = -8;
      if (item.pos.includes('left')) { dx = -10; anchor = 'end'; }
      if (item.pos.includes('right')) { dx = 10; anchor = 'start'; }
      svgElements.push(`<text x="${(cx + dx).toFixed(1)}" y="${(cy + dy).toFixed(1)}" font-family="sans-serif" font-size="12" font-style="italic" font-weight="600" fill="#1e293b" text-anchor="${anchor}">${item.text}</text>`);
    }
  }

  return `<svg viewBox="0 0 ${width} ${height}" class="tikz-svg-pure mx-auto block max-w-full h-auto select-none my-1" style="max-height: 280px;">${svgElements.join('\n')}</svg>`;
}

// Test with Block 1
const fs = require('fs');
const raw = fs.readFileSync('Hue-HSG12-26-27.tex', 'utf8');
const blocks = raw.match(/\\begin\{tikzpicture\}([\s\S]*?)\\end\{tikzpicture\}/g);
console.log('Testing Block 1 (Function Graph):');
const svg1 = renderTikzToSvg(blocks[0]);
console.log('SVG1 generated length:', svg1 ? svg1.length : 'NULL');
console.log(svg1.slice(0, 300));
