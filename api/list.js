const axios = require('axios');

module.exports = async (req, res) => {
    const KEY = process.env.GEMINI_API_KEY;
    try {
        const response = await axios.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${KEY}`);
        res.status(200).json({ models: response.data.models.map(m => m.name) });
    } catch (e) {
        res.status(500).json({ error: e.message, data: e.response ? e.response.data : null });
    }
};
