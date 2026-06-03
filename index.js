const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const EVOLUTION_URL = process.env.EVOLUTION_URL;
const API_KEY = process.env.API_KEY;

app.post('/webhook', async (req, res) => {
    res.sendStatus(200);

    const event = req.body;

    if (event.event === "messages.upsert" && !event.data.key.fromMe) {
        const remoteJid = event.data.key.remoteJid;
        const textMessage =
            event.data.message?.conversation ||
            event.data.message?.extendedTextMessage?.text;

        if (textMessage) {
            console.log(Received: ${textMessage});

            await axios.post(${EVOLUTION_URL}/message/sendText/${event.instance}, {
                number: remoteJid,
                textMessage: { text: Bot received: ${textMessage} }
            }, {
                headers: { apikey: API_KEY }
            });
        }
    }
});

app.listen(3000, () => console.log("Bot running"));
