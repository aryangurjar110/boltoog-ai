const https = require('https');
const { supabase } = require('./lib/supabase');

// Direct REST call to Gemini - no SDK, no version issues
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
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 1024,
      }
    });

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/${model}:generateContent?key=${apiKey}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) return reject(new Error(parsed.error.message || JSON.stringify(parsed.error)));
          const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!text) return reject(new Error('Empty response from model'));
          resolve(text);
        } catch (e) {
          reject(new Error('Failed to parse Gemini response: ' + data.slice(0, 200)));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(25000, () => { req.destroy(); reject(new Error('Request timed out')); });
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

  // Auth
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized: Missing Authorization header' });
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Unauthorized: Invalid or expired session' });

  const { message, history = [], chatId } = req.body;
  const KEY = process.env.GEMINI_API_KEY;

  if (!message) return res.status(400).json({ error: 'Message is required' });
  if (!KEY) return res.status(500).json({ error: 'GEMINI_API_KEY not set in Vercel environment variables' });

  const systemPrompt = `You are Boltoog, a smart and friendly AI assistant created by Aryan. 
Be helpful, concise, and conversational. 
Write in plain text only - no markdown formatting, no asterisks, no bullet symbols, no hashtags.
Give well-thought-out answers.`;

  const models = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash-8b'];
  let responseText = '';
  let lastError = '';

  for (const model of models) {
    try {
      responseText = await callGemini(KEY, model, systemPrompt, history, message);
      if (responseText) break;
    } catch (e) {
      lastError = e.message;
      console.error(`Model ${model} failed:`, e.message);
    }
  }

  if (!responseText) {
    return res.status(500).json({ error: 'All AI models failed', details: lastError });
  }

  // Clean any stray markdown
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
