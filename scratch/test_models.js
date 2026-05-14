const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function list() {
  const result = await genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" }).listModels();
  // Wait, the SDK has a different way to list models.
  // Actually, let's just try to fetch a simple response with gemini-pro.
  console.log("Testing gemini-1.5-flash...");
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const res = await model.generateContent("hi");
    console.log("Success with 1.5-flash:", res.response.text());
  } catch (e) {
    console.error("Error with 1.5-flash:", e.message);
  }
}
list();
