const fetch = require('node-fetch');

async function testLiveApi() {
    console.log("Testing Live API...");
    try {
        const res = await fetch('https://boltoog-ai.vercel.app/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'ping' })
        });
        console.log("Status:", res.status);
        const data = await res.json();
        console.log("Response:", data);
    } catch (e) {
        console.error("Fetch failed:", e.message);
    }
}

testLiveApi();
