require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// Use Railway's PORT - this fixes EADDRINUSE crash
const PORT = process.env.PORT || 3000;
const EVOLUTION_URL = process.env.EVOLUTION_URL;
const EVOLUTION_KEY = process.env.EVOLUTION_KEY;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE;

app.post('/webhook', async (req, res) => {
  res.status(200).send('ok'); // Reply 200 fast so Evolution stops retrying
  
  try {
    const body = req.body;
    
    // Skip non-message events
    if (body.event!== 'messages.upsert') return;

    const from = body.data?.key?.remoteJid?.split('@')[0];
    const text = body.data?.message?.conversation || body.data?.message?.extendedTextMessage?.text || '';
    
    if (!from ||!text) return;

    console.log(`[Bot] From ${from}: ${text}`);

    // === YOUR REPLY LOGIC HERE ===
    const reply = `Echo: ${text}`; // Replace with OpenAI later
    // ============================

    // Send reply - forces text to string to avoid 400 error
    await axios.post(
      `${EVOLUTION_URL}/message/sendText/${EVOLUTION_INSTANCE}`,
      { 
        number: from, 
        text: String(reply) 
      },
      { headers: { apikey: EVOLUTION_KEY }
    );
    
    console.log(`[Bot] Sent: ${reply}`);
  } catch (e) {
    console.error('[Bot] Fail:', e.response?.data || e.message);
  }
});

// Healthcheck for Railway
app.get('/', (req, res) => res.status(200).send('ok'));

// CRITICAL: Use PORT from Railway, no '0.0.0.0' - this fixes the crash
app.listen(PORT, () => console.log('Bot up on', PORT));
