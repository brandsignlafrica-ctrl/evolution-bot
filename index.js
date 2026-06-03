const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

// Load Environment Variables from Railway
const EVOLUTION_URL = process.env.EVOLUTION_URL;
const API_KEY = process.env.API_KEY;

app.post('/webhook', async (req, res) => {
    // 1. Immediately acknowledge the webhook to prevent Evolution API from retrying
    res.sendStatus(200);

    try {
        const event = req.body;

        // 2. Validate event type and ensure the message didn't originate from the bot itself
        if (event && event.event === "messages.upsert" && !event.data?.key?.fromMe) {
            const remoteJid = event.data.key.remoteJid;
            
            // Safely extract text message across varying message types (conversation vs extended text)
            const textMessage = event.data.message?.conversation || event.data.message?.extendedTextMessage?.text;

            if (textMessage) {
                console.log(Received message: "${textMessage}" from ${remoteJid});

                // 3. Construct the exact endpoint matching Evolution API specification
                const targetUrl = ${EVOLUTION_URL}/message/sendText/${event.instance};

                // 4. Dispatch the payload back via Axios
                await axios.post(targetUrl, {
                    number: remoteJid,
                    options: { 
                        delay: 1200, 
                        presence: "composing" 
                    },
                    textMessage: { 
                        text: Bot received: ${textMessage} 
                    }
                }, { 
                    headers: { 
                        'apikey': API_KEY 
                    } 
                });

                console.log(Successfully echoed message back to ${remoteJid});
            }
        }
    } catch (err) {
        console.error("Error executing webhook processing logic:", err.message);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(Bot engine listening securely on port ${PORT}));
