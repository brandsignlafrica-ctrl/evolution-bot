require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// === CONFIG - SET THESE IN RAILWAY VARIABLES ===
const PORT = process.env.PORT || 3000;
const EVOLUTION_URL = process.env.EVOLUTION_URL; // https://evolution-bot-production.up.railway.app
const EVOLUTION_KEY = process.env.EVOLUTION_KEY; // MASTER_API_KEY from Evolution
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE; // Brandsign1 Main V2
// ===============================================

app.post('/webhook', async (req, res) => {
  try {
    const body = req.body;

    // Ignore non-message events to avoid 400 errors
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

    // === YOUR BOT LOGIC HERE ===
    const replyText = `You said: ${text}`; // Replace this with your AI reply
    // ===========================

    // Send reply back to Evolution - FIX for 400 error
    await axios.post(
      `${EVOLUTION_URL}/message/sendText/${EVOLUTION_INSTANCE}`,
      {
        number: from, // must be 27833272007 format, no @s.whatsapp.net
        text: replyText, // must be string, never undefined
        options: { delay: 1000 }
      },
      {
        headers: {
          'apikey': EVOLUTION_KEY,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    console.log(`[Bot] Reply sent to ${from}`);
    res.status(200).send('ok');

  } catch (err) {
    console.error('[Bot] Error:', err.response?.data || err.message);
    res.status(200).send('ok'); // Return 200 so Evolution stops retrying
  }
});

app.get('/', (req, res) => res.send('Bot alive'));
app.listen(PORT, () => console.log(`Bot running on ${PORT}`));
