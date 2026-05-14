const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

// Access the key directly from the environment
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function testConnection() {
  console.log("--- Starting AI Connection Test ---");
  
  try {
    // 1. Correct syntax to list models
    const listResult = await genAI.listModels();
    console.log("Available models found:", listResult.models.map(m => m.name));

    // 2. Use the stable 'gemini-1.5-flash' ID
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    console.log("Sending test message to gemini-1.5-flash...");
    const res = await model.generateContent("Respond with the word SUCCESS.");
    
    console.log("Test Result:", res.response.text());
  } catch (e) {
    console.error("Test Failed!");
    console.error("Error Message:", e.message);
    
    if (e.message.includes("API key")) {
        console.error("FIX: Check your GEMINI_API_KEY in Vercel settings.");
    }
  }
}

testConnection();
