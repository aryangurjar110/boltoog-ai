module.exports = async (req, res) => {
    const status = {
        gemini_api_key: process.env.GEMINI_API_KEY ? "SET (Length: " + process.env.GEMINI_API_KEY.length + ")" : "MISSING",
        supabase_url: process.env.SUPABASE_URL ? "SET" : "MISSING",
        supabase_anon_key: process.env.SUPABASE_ANON_KEY ? "SET" : "MISSING",
        node_version: process.version,
        env: process.env.NODE_ENV
    };
    
    res.status(200).json(status);
};
