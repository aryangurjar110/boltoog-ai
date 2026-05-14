const axios = require('axios');

async function testLocal() {
    try {
        const response = await axios.post('http://localhost:5030/chat', {
            message: "Hello Boltoog"
        });
        console.log("Response:", response.data);
    } catch (error) {
        console.error("Error:", error.response ? error.response.data : error.message);
    }
}
testLocal();
