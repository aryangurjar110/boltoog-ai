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
        
        const modelsToTry = ["gemini-1.5-flash-latest", "gemini-1.5-flash", "gemini-pro"];
        let responseText = "";
        let errorDetails = "";

        for (const modelName of modelsToTry) {
            try {
                console.log(`Trying model: ${modelName}`);
                const model = genAI.getGenerativeModel({ 
                    model: modelName, 
                    systemInstruction: "You are Boltoog, a helpful AI created by Aryan. Your responses must be in plain text only. No markdown."
                });

                const result = await model.generateContent(message);
                const response = await result.response;
                responseText = response.text();
                
                if (responseText) {
                    console.log(`Success with model: ${modelName}`);
                    break;
                }
            } catch (e) {
                console.error(`Error with ${modelName}:`, e.message);
                errorDetails += `${modelName}: ${e.message}; `;
            }
        }

        if (!responseText) {
            throw new Error("All models failed. Details: " + errorDetails);
        }

        const text = responseText.replace(/[*_`#]/g, '');

        res.json({ response: text, v: "1.2" });
    } catch (error) {
        console.error('Final Gemini API Error:', error);
        res.status(500).json({ 
            error: "AI Error", 
            details: error.message
        });
    }
});

// Serve static files
app.use(express.static(path.join(__dirname)));

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Listen if running locally
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

// Export for Vercel
module.exports = app;
