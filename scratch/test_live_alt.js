const axios = require('axios');

async function testLive() {
    try {
        const response = await axios.post('https://boltoog-90o9li55g-boltoog.vercel.app/chat', {
            message: "Hello Boltoog"
        });
        console.log("Live Response:", response.data);
    } catch (error) {
        console.error("Live Error:", error.response ? error.response.data : error.message);
    }
}
testLive();
