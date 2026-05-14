require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(cors());
app.use(express.json());

app.post('/chat', async (req, res) => {
    const { message } = req.body;
    const KEY = process.env.GEMINI_API_KEY;

    // 1. Debugging logs (Check Vercel Logs to see these)
    console.log("Request received. Key Length:", KEY ? KEY.length : 0);

    if (!message) return res.status(400).json({ error: "Message is required" });
    if (!KEY || KEY.length < 10) {
        return res.status(500).json({ error: "API Key missing or invalid in Vercel Settings" });
    }

    try {
        const genAI = new GoogleGenerativeAI(KEY);
        
        // Use gemini-pro if gemini-1.5-flash gives a 404
        const model = genAI.getGenerativeModel({ 
            model: "gemini-pro", 
            systemInstruction: "You are Boltoog, a helpful AI created by Aryan. Plain text only."
        });

        const result = await model.generateContent(message);
        const response = await result.response;
        const text = response.text().replace(/[*_`#]/g, '');

        res.json({ response: text });
    } catch (error) {
        console.error('Gemini API Error:', error.message);
        res.status(500).json({ 
            error: "AI Error", 
            details: error.message 
        });
    }
});

// Serve static files
app.use(express.static(path.join(__dirname)));
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Export for Vercel
module.exports = app;
