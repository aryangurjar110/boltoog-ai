const https = require('https');

const KEY = 'AIzaSyDZi3RUfoV8xm6uCT7u41wgiD0l_m0l-HU';

const body = JSON.stringify({
  contents: [{ role: 'user', parts: [{ text: 'Say hello in one sentence.' }] }]
});

const options = {
  hostname: 'generativelanguage.googleapis.com',
  path: `/v1beta/models/gemini-1.5-flash:generateContent?key=${KEY}`,
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', d => data += d);
  res.on('end', () => {
    const parsed = JSON.parse(data);
    if (parsed.error) {
      console.error('KEY ERROR:', parsed.error.message);
    } else {
      console.log('KEY WORKS! Response:', parsed.candidates[0].content.parts[0].text);
    }
  });
});
req.on('error', e => console.error('Network error:', e.message));
req.write(body);
req.end();
