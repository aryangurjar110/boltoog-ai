const axios = require('axios');
require('dotenv').config();

const API_KEY = process.env.GEMINI_API_KEY;

async function test() {
    const message = "Hello";
    try {
        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${API_KEY}`,
            {
                contents: [
                    {
                        role: "user",
                        parts: [{ text: "You are Boltoog, a helpful AI created by Aryan. Always be polite and concise." }]
                    },
                    {
                        role: "model",
                        parts: [{ text: "Understood! I am Boltoog, a helpful AI created by Aryan. I will be polite and concise. How can I help you?" }]
                    },
                    {
                        role: "user",
                        parts: [{ text: message }]
                    }
                ]
            }
        );

        console.log("Response:", JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('API Error:', error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
    }
}
test();
