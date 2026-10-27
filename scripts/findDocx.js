const fs = require('fs');
const code = fs.readFileSync('node_modules/wmf-emf-renderer/index.js', 'utf8');
const start = code.indexOf('class WmfParser');
console.log(code.substring(start, start + 1200));
