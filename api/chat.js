const { supabase } = require('./lib/supabase');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

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

  const KEY = process.env.GEMINI_API_KEY;
  const { message, history = [], chatId } = req.body;

  if (!message) return res.status(400).json({ error: 'Message is required' });
  if (!KEY) return res.status(500).json({ error: 'API KEY MISSING', details: 'Please add GEMINI_API_KEY to Vercel Environment Variables.' });

  // 1. FAST SAVING
  let activeChatId = chatId;
  if (!isGuest) {
    try {
      if (!activeChatId) {
        const { data: newChat, error: chatErr } = await supabase
          .from('chats')
          .insert([{ user_id: user.id, title: message.substring(0, 40) }])
          .select();
        if (newChat && newChat[0]) activeChatId = newChat[0].id;
      }
    } catch (dbErr) { console.error('DB Error:', dbErr.message); }
  }

  const systemPrompt = `You are Boltoog, a smart and friendly AI assistant created by Aryan. 
Give thoughtful, helpful answers in plain text only. Absolutely no markdown or asterisks.`;

  const models = [
    { v: 'v1beta', m: 'gemini-1.5-flash' },
    { v: 'v1', m: 'gemini-1.5-flash' },
    { v: 'v1beta', m: 'gemini-1.5-pro' },
    { v: 'v1beta', m: 'gemini-1.0-pro' }
  ];

  let responseText = '';
  let lastError = '';

  for (const item of models) {
    try {
      const { v, m } = item;
      const contents = history.map(h => {
        let txt = '';
        if (Array.isArray(h.parts)) txt = h.parts[0]?.text || '';
        else if (typeof h.parts === 'string') txt = h.parts;
        else if (h.content) txt = h.content;
        return { role: h.role === 'model' || h.role === 'assistant' ? 'model' : 'user', parts: [{ text: String(txt) }] };
      }).filter(h => h.parts[0].text);
      
      contents.push({ role: 'user', parts: [{ text: message }] });

      const payload = {
        contents,
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
        safetySettings: [{ category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },{ category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },{ category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },{ category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }]
      };

      // Only add systemInstruction if model is not 1.0
      if (!m.includes('1.0')) {
        payload.systemInstruction = { parts: [{ text: systemPrompt }] };
      } else {
        // For 1.0, inject system prompt into first message
        if (contents.length > 0 && contents[0].role === 'user') {
          contents[0].parts[0].text = systemPrompt + "\n\n" + contents[0].parts[0].text;
        }
      }

      const resp = await fetch(`https://generativelanguage.googleapis.com/${v}/models/${m}:generateContent?key=${KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await resp.json();
      if (data.error) {
        lastError = data.error.message;
        console.error(`Model ${m} failed:`, lastError);
        continue;
      }

      responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (responseText) break;
    } catch (e) {
      lastError = e.message;
      console.error(`Fetch Error for ${m}:`, lastError);
    }
  }

  if (!responseText) {
    return res.status(500).json({ error: 'AI_FAILED', details: lastError || 'All models failed to respond.' });
  }

  const clean = responseText.replace(/\*\*/g, '').replace(/\*/g, '').replace(/#{1,6} /g, '').trim();

  // 2. SAVE RESPONSE
  if (!isGuest && activeChatId) {
    try {
      await supabase.from('messages').insert([
        { chat_id: activeChatId, role: 'user', content: message },
        { chat_id: activeChatId, role: 'model', content: clean }
      ]);
    } catch (dbErr) { console.error('Save Msg Error:', dbErr.message); }
  }

  res.status(200).json({ response: clean, chatId: activeChatId });
};
