const fs = require('fs');

function extractTikzBlocks(content) {
  const matches = [];
  const regex = /\\begin\{tikzpicture\}([\s\S]*?)\\end\{tikzpicture\}/g;
  let m;
  while ((m = regex.exec(content)) !== null) {
    matches.push(m[1]);
  }
  return matches;
}

const raw = fs.readFileSync('Hue-HSG12-26-27.tex', 'utf8');
const blocks = extractTikzBlocks(raw);
console.log('Total TikZ blocks found in Hue-HSG12-26-27.tex:', blocks.length);

blocks.forEach((b, idx) => {
  console.log(`\n=== Block ${idx + 1} (${b.trim().split('\n').length} lines) ===`);
  console.log(b.trim().split('\n').slice(0, 5).join('\n'));
});
