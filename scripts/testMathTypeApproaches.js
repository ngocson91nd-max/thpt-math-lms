const fs = require('fs');
const JSZip = require('jszip');

async function inspectOleBinary() {
  const buf = fs.readFileSync('E:/Nam2627/GK1-12/GK1-12-Giao Thủy B.docx');
  const zip = await JSZip.loadAsync(buf);
  const docXml = await zip.file('word/document.xml').async('text');
  const idx = docXml.indexOf('rId49');
  console.log('rId49 in document.xml:\n', docXml.substring(idx - 400, idx + 600));
}
inspectOleBinary();
