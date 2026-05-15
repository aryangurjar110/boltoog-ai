const https = require('https');

const data = JSON.stringify({ message: 'Hello, say hi!' });

const options = {
  hostname: 'boltoog-ai.vercel.app',
  path: '/api/chat',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
    // No auth - to see what error we get
  }
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', body);
  });
});
req.on('error', e => console.error('Error:', e.message));
req.write(data);
req.end();
