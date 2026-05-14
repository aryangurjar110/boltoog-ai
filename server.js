require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5030;
const API_KEY = process.env.GEMINI_API_KEY;

// Initialize Google Generative AI
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash",
    systemInstruction: "You are Boltoog, a helpful AI created by Aryan. Always be polite and concise. Provide all responses in strictly plain text only. Do NOT use any Markdown formatting whatsoever — no bold (**), no italics (*), no headers (#), no bullet points (-), no numbered lists, no code blocks, no links, and no special formatting of any kind. Just plain text sentences and paragraphs.",
    generationConfig: {
        responseMimeType: "text/plain"
    }
});

// ---- API Routes ----

app.post('/chat', async (req, res) => {
    const { message } = req.body;
    
    if (!message) {
        return res.status(400).json({ error: "Message is required" });
    }

    try {
        // Use the SDK to generate content
        const result = await model.generateContent(message);
        const response = await result.response;
        let text = response.text();
        
        // Strip out any markdown formatting symbols that might leak through
        text = text.replace(/[*_`#]/g, '');

        res.json({ response: text });
    } catch (error) {
        console.error('Gemini API Error:', error);
        
        // Provide more specific error details if available
        let errorMessage = "AI Error";
        if (error.message && error.message.includes("API key")) {
            errorMessage = "Invalid API Key";
        } else if (error.message && error.message.includes("rate limit")) {
            errorMessage = "Rate limit exceeded. Please try again later.";
        }

        res.status(500).json({ 
            error: errorMessage, 
            details: error.message 
        });
    }
});

// ---- Static files & catch-all ----

app.use(express.static(path.join(__dirname)));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server if not running as a serverless function
if (require.main === module) {
    app.listen(PORT, () => console.log(`🚀 Server is LIVE on http://localhost:${PORT}`));
}

// Export for Vercel serverless
module.exports = app;