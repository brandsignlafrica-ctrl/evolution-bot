const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const EVOLUTION_API = "https://evolution-api-production-53a9.up.railway.app";
const API_KEY = "brandsignl123";

// 🔥 TEST ROUTE
app.get('/', (req, res) => {
    console.log("SERVER HIT");
    res.send("Server is running");
});

// 🔥 CREATE INSTANCE
app.get('/create', async (req, res) => {
    try {
        const response = await axios.post(
            ${EVOLUTION_API}/instance/create,
            {
                instanceName: "test1"
            },
            {
                headers: {
                    apikey: API_KEY
                }
            }
        );

        console.log("INSTANCE CREATED:", response.data);
        res.json(response.data);

    } catch (err) {
        console.error("CREATE ERROR:", err.response?.data || err.message);
        res.send("Create failed");
    }
});

// 🔥 CONNECT (GET QR)
app.get('/connect', async (req, res) => {
    try {
        const response = await axios.get(
            ${EVOLUTION_API}/instance/connect/test1,
            {
                headers: {
                    apikey: API_KEY
                }
            }
        );

        console.log("QR RESPONSE:", response.data);
        res.json(response.data);

    } catch (err) {
        console.error("CONNECT ERROR:", err.response?.data || err.message);
        res.send("Connect failed");
    }
});

app.listen(process.env.PORT || 3000, () => {
    console.log("🚀 SERVER STARTED");
});
