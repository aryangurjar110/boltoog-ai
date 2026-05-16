const { supabase } = require('./lib/supabase');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
  const token = authHeader.replace('Bearer ', '');
  
  let user = null;
  const isGuest = (token === 'guest');

  if (!isGuest) {
    const { data: { user: sbUser }, error: authErr } = await supabase.auth.getUser(token);
    if (!authErr && sbUser) user = sbUser;
  }

  const KEY = (process.env.GEMINI_API_KEY || '').trim();
  const { message, history = [], chatId } = req.body;

  if (!message) return res.status(400).json({ error: 'Message required' });
  if (!KEY) return res.status(500).json({ error: 'API_KEY_MISSING' });

  // 1. DB Save (Chat)
  let activeId = chatId;
  if (!isGuest && user && !activeId) {
    try {
      const { data } = await supabase.from('chats').insert([{ user_id: user.id, title: message.substring(0, 40) }]).select();
      if (data && data[0]) activeId = data[0].id;
    } catch (e) {}
  }

  // 2. AI Request (Ultra Safe Mode)
  const models = ['gemini-1.5-flash-latest', 'gemini-1.5-pro-latest', 'gemini-pro'];
  let aiText = '';
  let allErrors = [];

  for (const m of models) {
    try {
      let contents = [];
      if (Array.isArray(history)) {
        contents = history.map(h => ({
          role: h.role === 'ai' ? 'model' : h.role, // normalize roles
          parts: h.parts
        }));
      }
      contents.push({ role: 'user', parts: [{ text: `You are Boltoog, a friendly AI. Answer in plain text.\n\nUser: ${message}` }] });

      const payload = {
        contents,
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
      };

      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const d = await r.json();
      if (d.candidates?.[0]?.content?.parts?.[0]?.text) {
        aiText = d.candidates[0].content.parts[0].text;
        break; // Success
      } else {
        allErrors.push(`${m}: ` + (d.error?.message || 'Empty response'));
      }
    } catch (e) { 
      allErrors.push(`${m}: ` + e.message); 
    }
  }

  if (!aiText) return res.status(500).json({ error: 'AI_FAILED', details: allErrors.join(' | ') });

  const clean = aiText.replace(/\*/g, '').replace(/#/g, '').trim();

  // 3. DB Save (Messages)
  if (!isGuest && activeId) {
    try {
      await supabase.from('messages').insert([
        { chat_id: activeId, role: 'user', content: message },
        { chat_id: activeId, role: 'model', content: clean }
      ]);
    } catch (e) {}
  }

  res.status(200).json({ response: clean, chatId: activeId });
};
