require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Dynamic API Routing (Mocking Vercel behavior locally)
app.all('/api/:route', async (req, res) => {
    const { route } = req.params;
    try {
        const filePath = path.join(__dirname, 'api', `${route}.js`);
        // Clear cache for development
        if (require.cache[require.resolve(filePath)]) {
            delete require.cache[require.resolve(filePath)];
        }
        const handler = require(filePath);
        await handler(req, res);
    } catch (error) {
        console.error(`Error loading API route ${route}:`, error);
        res.status(404).json({ error: `API Route /api/${route} Not Found` });
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
