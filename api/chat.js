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
  
  let user = null;
  let isGuest = (token === 'guest');

  if (!isGuest) {
    const { data: { user: supabaseUser }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !supabaseUser) return res.status(401).json({ error: 'Unauthorized: Invalid session' });
    user = supabaseUser;
  }

  // IMPORTANT: Key must be set in Vercel Environment Variables as GEMINI_API_KEY
  const KEY = process.env.GEMINI_API_KEY;

  const { message, history = [], chatId } = req.body;

  if (!message) return res.status(400).json({ error: 'Message is required' });

  // 1. FAST SAVING: Create chat entry (Skip if Guest)
  let activeChatId = chatId;
  if (!isGuest) {
    try {
      if (!activeChatId) {
        const { data: newChat, error: chatErr } = await supabase
          .from('chats')
          .insert([{ user_id: user.id, title: message.substring(0, 40) }])
          .select();
        if (chatErr) throw chatErr;
        if (newChat && newChat[0]) activeChatId = newChat[0].id;
      }
    } catch (dbErr) { console.error('DB Chat Create Error:', dbErr.message); }
  }

  const systemPrompt = `You are Boltoog, a smart and friendly AI assistant created by Aryan.
Be helpful, concise, and warm. Give thoughtful answers.
Write in plain text only - absolutely no markdown.`;

  if (!KEY) {
    return res.status(500).json({ error: 'API Configuration Missing', details: 'GEMINI_API_KEY is not set in Vercel environment variables.' });
  }

  const models = [
    { v: 'v1beta', m: 'gemini-1.5-flash' },
    { v: 'v1', m: 'gemini-1.5-flash' },
    { v: 'v1beta', m: 'gemini-1.5-pro' },
    { v: 'v1beta', m: 'gemini-1.0-pro' }
  ];

  let responseText = '';
  let errorLog = [];

  for (const item of models) {
    try {
      const callWithVersion = (v, m) => {
        return new Promise((resolve, reject) => {
          // Robust history parsing
          const contents = history.map(h => {
            let txt = '';
            if (Array.isArray(h.parts)) txt = h.parts[0]?.text || '';
            else if (typeof h.parts === 'string') txt = h.parts;
            else if (h.content) txt = h.content;
            return { role: h.role === 'model' || h.role === 'assistant' ? 'model' : 'user', parts: [{ text: String(txt) }] };
          }).filter(h => h.parts[0].text);
          
          contents.push({ role: 'user', parts: [{ text: message }] });

          const body = JSON.stringify({
            contents,
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
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
            headers: { 'Content-Type': 'application/json' }
          };
          const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
              try {
                const parsed = JSON.parse(data);
                if (parsed.error) return reject(new Error(`${m}: ${parsed.error.message}`));
                const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (!text) return reject(new Error(`${m}: No text in response`));
                resolve(text);
              } catch (e) { reject(new Error(`${m}: Invalid JSON`)); }
            });
          });
          req.on('error', (e) => reject(new Error(`${m}: ${e.message}`)));
          req.setTimeout(25000, () => { req.destroy(); reject(new Error(`${m}: Timeout`)); });
          req.write(body); req.end();
        });
      };

      responseText = await callWithVersion(item.v, item.m);
      if (responseText) break;
    } catch (e) {
      errorLog.push(e.message);
    }
  }

  if (!responseText) {
    return res.status(500).json({ 
      error: 'AI Engine Unavailable', 
      details: errorLog.join(' | ') 
    });
  }

  const clean = responseText.replace(/\*\*/g, '').replace(/\*/g, '').replace(/#{1,6} /g, '').replace(/`/g, '').trim();

  // 2. SAVE RESPONSE: Store messages (Skip if Guest)
  if (!isGuest && activeChatId && responseText) {
    try {
      await supabase.from('messages').insert([
        { chat_id: activeChatId, role: 'user', content: message },
        { chat_id: activeChatId, role: 'model', content: clean }
      ]);
    } catch (dbErr) { console.error('Message Save Error:', dbErr.message); }
  }

  res.status(200).json({ response: clean, chatId: activeChatId });
};
