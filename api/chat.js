const { GoogleGenerativeAI } = require('@google/generative-ai');

module.exports = async (req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    // Handle OPTIONS request
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { message, history } = req.body;
    const KEY = process.env.GEMINI_API_KEY;

    if (!message) {
        return res.status(400).json({ error: "Message is required" });
    }

    if (!KEY || KEY.length < 10) {
        return res.status(500).json({ 
            error: "API Key missing or invalid", 
            details: "Please set GEMINI_API_KEY in Vercel environment variables" 
        });
    }

    try {
        const genAI = new GoogleGenerativeAI(KEY);
        
        const modelsToTry = [
            "gemini-2.0-flash", 
            "gemini-2.0-flash-lite",
            "gemini-flash-latest", 
            "gemini-pro-latest",
            "gemini-3.1-flash-lite"
        ];
        let responseText = "";
        let errorDetails = "";

        for (const modelName of modelsToTry) {
            try {
                const model = genAI.getGenerativeModel({ 
                    model: modelName, 
                    systemInstruction: "You are Boltoog, a helpful AI created by Aryan. Your responses must be in plain text only. No markdown. IMPORTANT: Do not introduce yourself or mention you were created by Aryan in every message. Only do so if it is the very first message. If there is history, assume you have already introduced yourself."
                });

                const chat = model.startChat({
                    history: history || [],
                });

                const result = await chat.sendMessage(message);
                const response = await result.response;
                responseText = response.text();
                
                if (responseText) break;
            } catch (e) {
                errorDetails += `${modelName}: ${e.message}; `;
            }
        }

        if (!responseText) {
            throw new Error("All models failed. Details: " + errorDetails);
        }

        const text = responseText.replace(/[*_`#]/g, '');

        res.status(200).json({ response: text, v: "2.0" });
    } catch (error) {
        console.error('Final Gemini API Error:', error);
        res.status(500).json({ 
            error: "AI Error", 
            details: error.message
        });
    }
};
