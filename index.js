const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

// Environment variables
const EVOLUTION_URL = process.env.EVOLUTION_URL;
const API_KEY = process.env.API_KEY;

// Confirm server boot
console.log("🟡 Server starting...");

// Webhook endpoint
app.post('/webhook', async (req, res) => {
    console.log("🔥 WEBHOOK HIT");
    console.log("BODY:", JSON.stringify(req.body, null, 2));

    // Always respond immediately
    res.sendStatus(200);

    try {
        const event = req.body;

        if (event && event.event === "messages.upsert" && !event.data?.key?.fromMe) {
            const remoteJid = event.data.key.remoteJid;

            const textMessage =
                event.data.message?.conversation ||
                event.data.message?.extendedTextMessage?.text;

            if (textMessage) {
                console.log(📩 Message received: ${textMessage});

                const targetUrl = ${EVOLUTION_URL}/message/sendText/${event.instance};

                await axios.post(
                    targetUrl,
                    {
                        number: remoteJid,
                        options: {
                            delay: 1200,
                            presence: "composing"
                        },
                        textMessage: {
                            text: Bot received: ${textMessage}
                        }
                    },
                    {
                        headers: {
                            apikey: API_KEY
                        }
                    }
                );

                console.log("✅ Reply sent");
            }
        }
    } catch (err) {
        console.error("❌ Error:", err.message);
    }
});

// Start server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log("🚀 SERVER STARTED");
    console.log(Listening on port ${PORT});
});
