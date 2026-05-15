const https = require('https');
const KEY = 'AIzaSyDZi3RUfoV8xm6uCT7u41wgiD0l_m0l-HU';

function test(version, model) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Hi' }] }] });
    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: `/${version}/models/${model}:generateContent?key=${KEY}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try {
          const p = JSON.parse(data);
          if (p.error) resolve(`${version}/${model}: ERROR - ${p.error.message}`);
          else resolve(`${version}/${model}: ✅ WORKS - "${p.candidates?.[0]?.content?.parts?.[0]?.text?.slice(0,30)}"`);
        } catch(e) { resolve(`${version}/${model}: PARSE ERROR`); }
      });
    });
    req.on('error', e => resolve(`${version}/${model}: NETWORK ERROR - ${e.message}`));
    req.write(body); req.end();
  });
}

async function main() {
  const tests = [
    ['v1', 'gemini-pro'], ['v1', 'gemini-1.5-flash'], ['v1', 'gemini-1.5-pro'],
    ['v1beta', 'gemini-pro'], ['v1beta', 'gemini-1.5-flash'],
    ['v1beta', 'gemini-2.0-flash'], ['v1beta', 'gemini-2.0-flash-exp'],
    ['v1beta', 'gemini-2.5-flash-preview-05-20'],
  ];
  for (const [v, m] of tests) {
    const r = await test(v, m);
    console.log(r);
  }
}
main();
