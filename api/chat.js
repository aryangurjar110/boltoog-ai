const https = require('https');
const { supabase } = require('./lib/supabase');

function callGemini(apiKey, model, systemPrompt, history, userMessage) {
  return new Promise((resolve, reject) => {
    const contents = [
      ...history.map(h => ({
        role: h.role === 'model' ? 'model' : 'user',
        parts: Array.isArray(h.parts) ? h.parts : [{ text: String(h.parts) }]
      })),
      { role: 'user', parts: [{ text: userMessage }] }
    ];

    const body = JSON.stringify({
      contents,
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: { temperature: 0.8, maxOutputTokens: 1024 }
    });

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/${model}:generateContent?key=${apiKey}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) return reject(new Error(parsed.error.message));
          const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!text) return reject(new Error('Empty response from model'));
          resolve(text);
        } catch (e) {
          reject(new Error('Parse error: ' + data.slice(0, 100)));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(25000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(body);
    req.end();
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized: Missing Authorization header' });
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Unauthorized: Invalid or expired session' });

  const { message, history = [], chatId } = req.body;

  // Key with correct fallback
  const KEY = process.env.GEMINI_API_KEY || 'AIzaSyDZi3RUfoV8xm6uCT7u41wgiD0l_m0l-HU';

  if (!message) return res.status(400).json({ error: 'Message is required' });

  const systemPrompt = `You are Boltoog, a smart and friendly AI assistant created by Aryan.
Be helpful, concise, and warm. Give thoughtful answers.
Write in plain text only - absolutely no markdown, no asterisks, no bullet symbols, no hashtags, no formatting characters of any kind.`;

  // Try all versions and all models
  const models = [
    { v: 'v1beta', m: 'gemini-1.5-flash-latest' },
    { v: 'v1beta', m: 'gemini-2.0-flash-lite-preview-02-05' },
    { v: 'v1beta', m: 'gemini-2.0-flash-lite' },
    { v: 'v1', m: 'gemini-1.5-flash' },
    { v: 'v1beta', m: 'gemini-1.5-flash' },
    { v: 'v1beta', m: 'gemini-1.0-pro' }
  ];

  let responseText = '';
  let errorLog = [];

  for (const item of models) {
    try {
      const callWithVersion = (v, m) => {
        return new Promise((resolve, reject) => {
          const contents = [
            ...history.map(h => ({
              role: h.role === 'model' ? 'model' : 'user',
              parts: [{ text: String(h.parts[0]?.text || h.parts) }]
            })),
            { role: 'user', parts: [{ text: message }] }
          ];
          const body = JSON.stringify({
            contents,
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
            safetySettings: [
              { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
            ]
          });
          const options = {
            hostname: 'generativelanguage.googleapis.com',
            path: `/${v}/models/${m}:generateContent?key=${KEY}`,
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
          };
          const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
              try {
                const parsed = JSON.parse(data);
                if (parsed.error) return reject(new Error(`${m}(${v}): ${parsed.error.message}`));
                const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (!text) return reject(new Error(`${m}: Empty response`));
                resolve(text);
              } catch (e) { reject(new Error(`${m}: JSON Parse error`)); }
            });
          });
          req.on('error', (e) => reject(new Error(`${m}: Network ${e.message}`)));
          req.setTimeout(12000, () => { req.destroy(); reject(new Error(`${m}: Timeout`)); });
          req.write(body); req.end();
        });
      };

      responseText = await callWithVersion(item.v, item.m);
      if (responseText) break;
    } catch (e) {
      errorLog.push(e.message);
      console.error('AI Attempt Failed:', e.message);
    }
  }

  if (!responseText) {
    return res.status(500).json({ 
      error: 'All AI models failed', 
      details: errorLog.join(' | ') 
    });
  }

  const clean = responseText.replace(/\*\*/g, '').replace(/\*/g, '').replace(/#{1,6} /g, '').replace(/`/g, '').trim();

  // Save to DB (non-blocking)
  let activeChatId = chatId;
  try {
    if (!activeChatId) {
      const { data: newChat } = await supabase
        .from('chats')
        .insert([{ user_id: user.id, title: message.substring(0, 45) }])
        .select().single();
      if (newChat) activeChatId = newChat.id;
    }
    if (activeChatId) {
      await supabase.from('messages').insert([
        { chat_id: activeChatId, role: 'user', content: message },
        { chat_id: activeChatId, role: 'model', content: clean }
      ]);
    }
  } catch (dbErr) {
    console.error('DB error (non-fatal):', dbErr.message);
  }

  res.status(200).json({ response: clean, chatId: activeChatId });
};
