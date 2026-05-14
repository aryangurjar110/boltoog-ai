require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(cors());
app.use(express.json());

// Move AI logic INSIDE the route to prevent "Cold Start" errors
app.post('/chat', async (req, res) => {
    const { message } = req.body;
    const KEY = process.env.GEMINI_API_KEY;

    if (!message) return res.status(400).json({ error: "Message is required" });
    if (!KEY) return res.status(500).json({ error: "API Key missing in Vercel Settings" });

    try {
        const genAI = new GoogleGenerativeAI(KEY);
        const model = genAI.getGenerativeModel({ 
            model: "gemini-1.5-flash-latest",
            systemInstruction: "You are Boltoog, a helpful AI created by Aryan. Plain text only."
        });

        // Set a shorter timeout for the safety of the serverless function
        const result = await model.generateContent(message);
        const response = await result.response;
        const text = response.text().replace(/[*_`#]/g, '');

        res.json({ response: text });
    } catch (error) {
        console.error('Detailed Error:', error);
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

const PORT = process.env.PORT || 5030;
if (require.main === module) {
    app.listen(PORT, () => console.log(`🚀 Server on http://localhost:${PORT}`));
}

module.exports = app;
app.post('/chat', async (req, res) => {
    // DEBUG LOGS
    console.log("Checking Environment Variable...");
    const keyExists = !!process.env.GEMINI_API_KEY;
    const keyLength = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.length : 0;
    
    console.log(`Key Found: ${keyExists}`);
    console.log(`Key Length: ${keyLength}`);
    
    if (!keyExists || keyLength < 10) {
        return res.status(500).json({ error: "System Error: API Key is invalid or missing in Vercel." });
    }
    // ... rest of your code
