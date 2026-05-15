const { supabase } = require('./lib/supabase');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method Not Allowed' });

    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Unauthorized" });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) return res.status(401).json({ error: "Invalid session" });

    const { id } = req.query;
    if (!id) return res.status(400).json({ error: "Chat ID is required" });

    // Verify ownership before delete
    const { data: chat } = await supabase.from('chats').select('user_id').eq('id', id).single();
    if (!chat || chat.user_id !== user.id) {
        return res.status(403).json({ error: "Forbidden" });
    }

    const { error } = await supabase.from('chats').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });

    res.status(200).json({ success: true });
};
