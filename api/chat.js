const { supabase } = require('./lib/supabase');
const { GoogleGenerativeAI } = require('@google/generative-ai');

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

  // 2. AI Request using Official SDK
  const genAI = new GoogleGenerativeAI(KEY);
  let aiText = '';
  let allErrors = [];

  // Try the most stable models in order
  const models = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro'];

  for (const modelName of models) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });

      // Format history for SDK
      const formattedHistory = [];
      if (Array.isArray(history)) {
        history.forEach(h => {
          formattedHistory.push({
            role: h.role === 'ai' || h.role === 'model' ? 'model' : 'user',
            parts: h.parts.map(p => ({ text: p.text }))
          });
        });
      }

      let finalMessage = `You are Boltoog, a friendly AI. Answer in plain text.\n\nUser: ${message}`;

      const chat = model.startChat({
        history: formattedHistory,
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
      });

      const result = await chat.sendMessage([{ text: finalMessage }]);
      const response = await result.response;
      aiText = response.text();
      
      if (aiText) break; // Success
    } catch (e) {
      allErrors.push(`${modelName}: ${e.message}`);
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
