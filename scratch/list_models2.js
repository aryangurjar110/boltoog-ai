const https = require('https');
const KEY = 'AIzaSyDZi3RUfoV8xm6uCT7u41wgiD0l_m0l-HU';

const options = {
  hostname: 'generativelanguage.googleapis.com',
  path: `/v1beta/models?key=${KEY}`,
  method: 'GET'
};

https.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${KEY}`, (res) => {
  let data = '';
  res.on('data', d => data += d);
  res.on('end', () => {
    const p = JSON.parse(data);
    if (p.error) { console.error('Error:', p.error.message); return; }
    const models = p.models.filter(m => m.supportedGenerationMethods?.includes('generateContent'));
    console.log('Available models that support generateContent:');
    models.forEach(m => console.log(' -', m.name));
  });
}).on('error', e => console.error(e.message));
