const { GoogleGenerativeAI } = require('@google/generative-ai');
const { supabase } = require('./lib/supabase');

module.exports = async (req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
    );

    // Handle OPTIONS request
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // Authenticate with Supabase
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: "Unauthorized: Missing Authorization header" });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
        console.error("Auth error:", authError);
        return res.status(401).json({ error: "Unauthorized: Invalid or expired session" });
    }

    const { message, history, chatId } = req.body;
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
            "gemini-pro-latest"
        ];
        let responseText = "";
        let errorDetails = "";

        const isFirstMessage = !history || history.length === 0;
        const baseInstruction = "You are Boltoog, a helpful AI created by Aryan. Your responses must be in plain text only. No markdown.";
        const currentInstruction = isFirstMessage 
            ? `${baseInstruction} Introduce yourself once.`
            : `${baseInstruction} DO NOT introduce yourself or mention Aryan. Answer directly.`;

        for (const modelName of modelsToTry) {
            try {
                const model = genAI.getGenerativeModel({ 
                    model: modelName, 
                    systemInstruction: currentInstruction
                });

                const safeHistory = (history || []).map(h => ({
                    role: h.role,
                    parts: Array.isArray(h.parts) ? h.parts : [{ text: h.parts }]
                }));

                const chat = model.startChat({ history: safeHistory });
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

        // === SAVE TO SUPABASE ===
        let activeChatId = chatId;
        try {
            if (!activeChatId) {
                // Create new chat
                const { data: newChat, error: chatError } = await supabase
                    .from('chats')
                    .insert([{ 
                        user_id: user.id, 
                        title: message.substring(0, 35) + (message.length > 35 ? '...' : '') 
                    }])
                    .select()
                    .single();
                
                if (chatError) throw chatError;
                activeChatId = newChat.id;
            }

            // Save messages
            await supabase.from('messages').insert([
                { chat_id: activeChatId, role: 'user', content: message },
                { chat_id: activeChatId, role: 'model', content: text }
            ]);
        } catch (dbError) {
            console.error("Database error (continuing anyway):", dbError);
        }

        res.status(200).json({ 
            response: text, 
            chatId: activeChatId,
            v: "2.1" 
        });
    } catch (error) {
        console.error('Final Gemini API Error:', error);
        res.status(500).json({ 
            error: "AI Error", 
            details: error.message
        });
    }
};
