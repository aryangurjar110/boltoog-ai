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
        
        // Use gemini-1.5-flash for better performance
        const model = genAI.getGenerativeModel({ 
            model: "gemini-1.5-flash-latest", 
            systemInstruction: "You are Boltoog, a helpful AI created by Aryan. Your responses must be in plain text only. No markdown, no bolding, no bullet points."
        });

        const result = await model.generateContent(message);
        const response = await result.response;
        
        if (!response.text()) {
            throw new Error("Empty response from AI");
        }
        const text = response.text().replace(/[*_`#]/g, '');

        res.json({ response: text });
    } catch (error) {
        console.error('Gemini API Error Detail:', error);
        res.status(500).json({ 
            error: "AI Error", 
            details: error.message,
            suggestion: "Check if the API key has access to gemini-1.5-flash-latest"
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
