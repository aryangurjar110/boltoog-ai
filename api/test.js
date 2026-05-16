module.exports = async (req, res) => {
  const KEY = process.env.GEMINI_API_KEY || '';
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${KEY}`);
    const d = await r.json();
    res.status(200).json(d);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
};
