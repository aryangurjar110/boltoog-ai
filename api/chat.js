const { GoogleGenerativeAI } = require('@google/generative-ai');
const { supabase } = require('./lib/supabase');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

    if (req.method === 'OPTIONS') { res.status(200).end(); return; }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    // Auth
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Unauthorized: Missing Authorization header" });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: "Unauthorized: Invalid or expired session" });

    const { message, history, chatId } = req.body;
    const KEY = process.env.GEMINI_API_KEY;

    if (!message) return res.status(400).json({ error: "Message is required" });
    if (!KEY || KEY.length < 10) return res.status(500).json({ error: "GEMINI_API_KEY is missing. Set it in Vercel Environment Variables." });

    try {
        const genAI = new GoogleGenerativeAI(KEY);
        const modelsToTry = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-lite"];
        
        let responseText = "";
        let errorDetails = "";
        const instruction = "You are Boltoog, a helpful AI created by Aryan. Respond in plain text only. No markdown, no asterisks, no bullet symbols, no formatting characters.";

        for (const modelName of modelsToTry) {
            try {
                const model = genAI.getGenerativeModel({ model: modelName, systemInstruction: instruction });
                const safeHistory = (history || []).map(h => ({
                    role: h.role,
                    parts: Array.isArray(h.parts) ? h.parts : [{ text: String(h.parts) }]
                }));
                const chat = model.startChat({ history: safeHistory });
                const result = await chat.sendMessage(message);
                responseText = result.response.text();
                if (responseText) break;
            } catch (e) {
                errorDetails += `${modelName}: ${e.message}; `;
                console.error(`Model ${modelName} failed:`, e.message);
            }
        }

        if (!responseText) throw new Error("All models failed: " + errorDetails);

        const cleanText = responseText.replace(/[*_`#]/g, '').trim();

        // Save to DB (non-blocking - won't fail the response if DB is down)
        let activeChatId = chatId;
        try {
            if (!activeChatId) {
                const { data: newChat, error: chatErr } = await supabase
                    .from('chats')
                    .insert([{ user_id: user.id, title: message.substring(0, 40) }])
                    .select().single();
                if (!chatErr) activeChatId = newChat.id;
            }
            if (activeChatId) {
                await supabase.from('messages').insert([
                    { chat_id: activeChatId, role: 'user', content: message },
                    { chat_id: activeChatId, role: 'model', content: cleanText }
                ]);
            }
        } catch (dbErr) {
            console.error("DB save error (non-fatal):", dbErr.message);
        }

        res.status(200).json({ response: cleanText, chatId: activeChatId });

    } catch (error) {
        console.error('Gemini Error:', error.message);
        res.status(500).json({ error: "AI Error: " + error.message });
    }
};
