const fs = require('fs');
const { execSync } = require('child_process');

// Re-import renderTikzToSvg logic
const scriptCode = fs.readFileSync('scripts/testTikzSvgRenderer.js', 'utf8');
eval(scriptCode);

const rawTex = fs.readFileSync('Hue-HSG12-26-27.tex', 'utf8');
const allBlocks = rawTex.match(/\\begin\{tikzpicture\}([\s\S]*?)\\end\{tikzpicture\}/g);

console.log('Testing all', allBlocks.length, 'blocks:');
allBlocks.forEach((b, i) => {
  if (b.includes('tkzTabInit')) {
    console.log(`Block ${i + 1}: tkzTab (handled by tkzTabRenderer)`);
  } else {
    const svg = renderTikzToSvg(b);
    console.log(`Block ${i + 1}: SVG generated?`, svg ? `YES (${svg.length} bytes)` : 'NO');
  }
});
