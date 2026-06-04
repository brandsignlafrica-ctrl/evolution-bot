const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const EVOLUTION_API = "https://evolution-api-production-53a9.up.railway.app";
const API_KEY = "brandsignl123";

app.get('/', (req, res) => {
    console.log("SERVER HIT");
    res.send("Server is running");
});

app.get('/create', async (req, res) => {
    try {
        const response = await axios.post(
            `${EVOLUTION_API}/instance/create`,
            {
                instanceName: "test1"
            },
            {
                headers: {
                    apikey: API_KEY
                }
            }
        );

        console.log("CREATED:", response.data);
        res.json(response.data);

    } catch (err) {
        console.error("ERROR:", err.response?.data || err.message);
        res.send("failed");
    }
});

app.listen(process.env.PORT || 3000, () => {
    console.log("🚀 SERVER STARTED");
});
