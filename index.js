const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// Environment variables (set in Railway)
const EVOLUTION_URL = process.env.EVOLUTION_URL;
const API_KEY = process.env.API_KEY;

// Webhook endpoint
app.post('/webhook', async (req, res) => {
    // Always respond fast
    res.sendStatus(200);

    try {
        const event = req.body;

        if (
            event &&
            event.event === "messages.upsert" &&
            !event.data?.key?.fromMe
        ) {
            const remoteJid = event.data.key.remoteJid;

            const textMessage =
                event.data.message?.conversation ||
                event.data.message?.extendedTextMessage?.text;

            if (textMessage) {
                console.log(Received: ${textMessage});

                const url = ${EVOLUTION_URL}/message/sendText/${event.instance};

                await axios.post(
                    url,
                    {
                        number: remoteJid,
                        options: {
                            delay: 1000,
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
            }
        }
    } catch (err) {
        console.error("Webhook error:", err.message);
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(Bot running on port ${PORT});
});
