const https = require('https');

https.get('https://cdn.jsdelivr.net/npm/@rod2ik/tikzjax@1.6.0/dist/tikzjax.min.js', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    // Find TikzJax definition
    const idx = data.indexOf('TikzJax');
    let pos = 0;
    while (pos < data.length) {
      const i = data.indexOf('TikzJax', pos);
      if (i === -1) break;
      console.log('--- Match at', i, '---');
      console.log(data.substring(Math.max(0, i - 100), Math.min(data.length, i + 200)));
      pos = i + 10;
    }
  });
});
