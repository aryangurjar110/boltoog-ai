const axios = require('axios');
require('dotenv').config();

const API_KEY = process.env.GEMINI_API_KEY;

async function list() {
    try {
        const response = await axios.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`);
        console.log("Available models:", response.data.models.map(m => m.name));
    } catch (e) {
        console.error("Error listing models:", e.response ? e.response.data : e.message);
    }
}
list();
