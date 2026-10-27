const https = require('https');

https.get('https://cdn.jsdelivr.net/npm/@rod2ik/tikzjax@1.6.0/dist/tikzjax.min.js', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Tikzjax length:', data.length);
    // Find window assignments
    const matches = data.match(/window\.[a-zA-Z0-9_$]+/g) || [];
    console.log('Window properties:', Array.from(new Set(matches)));
    // Check if MutationObserver is used
    console.log('Has MutationObserver:', data.includes('MutationObserver'));
    // Check text/tikz search
    const textTikzMatches = data.match(/.{0,50}text\/tikz.{0,50}/g) || [];
    console.log('text/tikz occurrences:', textTikzMatches.slice(0, 5));
  });
});
