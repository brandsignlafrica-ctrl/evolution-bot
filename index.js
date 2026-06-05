require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// Use Railway variables exactly as named in your screenshot
const PORT = process.env.PORT || 3000;
const EVOLUTION_URL = process.env.EVOLUTION_URL;
const EVOLUTION_KEY = process.env.EVOLUTION_KEY;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE;
const WEBHOOK_TIMEOUT = parseInt(process.env.WEBHOOK_TIMEOUT) || 10000;

app.post('/webhook', async (req, res) => {
  try {
    const body = req.body;

    // Skip contacts/chats/presence updates
    if (body.event!== 'messages.upsert') {
      return res.status(200).send('ok');
    }

    const message = body.data?.message;
    const from = body.data?.key?.remoteJid?.replace('@s.whatsapp.net', '');
    const text = message?.conversation || message?.extendedTextMessage?.text || '';

    if (!from ||!text) {
      return res.status(200).send('ok');
    }

    console.log(`[Bot] Message from ${from} | text="${text}"`);

    // === YOUR REPLY LOGIC ===
    // Replace this line with OpenAI call if you want
    const replyText = `You said: ${text}`;
    // ========================

    // Send back to Evolution - this fixes the 400 error
    await axios.post(
      `${EVOLUTION_URL}/message/sendText/${EVOLUTION_INSTANCE}`,
      {
        number: from,
        text: String(replyText), // Force string to avoid 400
        options: { delay: 1000 }
      },
      {
        headers: { 'apikey': EVOLUTION_KEY },
        timeout: WEBHOOK_TIMEOUT
      }
    );

    console.log(`[Bot] Reply sent to ${from}`);
    res.status(200).send('ok');

  } catch (err) {
    console.error('[Bot] Error:', err.response?.data || err.message);
    res.status(200).send('ok');
  }
});

app.get('/', (req, res) => res.send('Bot alive'));
app.listen(PORT, () => console.log(`Bot running on ${PORT}`));
