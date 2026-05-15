const axios = require('axios');

async function testLocalApi() {
    try {
        console.log("Testing /api/chat with guest token...");
        const response = await axios.post('http://localhost:3001/api/chat', {
            message: "Hello Boltoog, are you working?"
        }, {
            headers: {
                'Authorization': 'Bearer guest',
                'Content-Type': 'application/json'
            }
        });
        console.log("Response Data:", response.data);
    } catch (error) {
        console.error("Error:", error.response ? error.response.data : error.message);
    }
}
testLocalApi();
