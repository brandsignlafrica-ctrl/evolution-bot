const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// ENV VARIABLES (set these in Railway)
const EVOLUTION_URL = process.env.EVOLUTION_URL;
const API_KEY = process.env.API_KEY;

// WEBHOOK
app.post('/webhook', async (req, res) => {
    // Always respond fast
    res.sendStatus(200);

    const event = req.body;

    // Only process incoming messages (not your own bot replies)
    if (event.event === "messages.upsert" && !event.data.key.fromMe) {

        const remoteJid = event.data.key.remoteJid;

        const textMessage =
            event.data.message?.conversation ||
            event.data.message?.extendedTextMessage?.text;

        if (textMessage) {

            console.log(Received: ${textMessage});

            try {
                await axios.post(
                    ${EVOLUTION_URL}/message/sendText/${event.instance},
                    {
                        number: remoteJid,
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
            } catch (error) {
                console.error("Send error:", error.message);
            }
        }
    }
});

// START SERVER
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(Bot running on port ${PORT});
});
