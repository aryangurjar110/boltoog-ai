const { supabase } = require('./lib/supabase');

const { supabase } = require('./lib/supabase');

module.exports = async (req, res) => {
  const KEY = (process.env.GEMINI_API_KEY || '').trim();
  if (!KEY) return res.status(500).json({ error: 'API_KEY_MISSING' });

  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${KEY}`);
    const d = await r.json();
    return res.status(200).json({ response: 'Models listed', data: d });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
};
