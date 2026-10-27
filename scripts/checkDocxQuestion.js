const fs = require('fs');
const mammoth = require('mammoth');

async function check() {
  const files = fs.readdirSync('.').filter(f => f.endsWith('.docx') || f.endsWith('.tex'));
  console.log('Files:', files);
  for (const f of files) {
    if (f.endsWith('.docx')) {
      try {
        const res = await mammoth.extractRawText({ path: f });
        const lines = res.value.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes('đường liền nét') || lines[i].includes('tiệm cận ngang')) {
            console.log(`Found in ${f}:`, lines.slice(Math.max(0, i-2), i+5).join(' | '));
          }
        }
      } catch (e) {
        console.error('Error reading docx:', e);
      }
    }
  }
}

check();
