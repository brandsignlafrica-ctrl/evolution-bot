require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const EVOLUTION_URL = process.env.EVOLUTION_URL;
const EVOLUTION_KEY = process.env.EVOLUTION_KEY;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE;

app.post('/webhook', async (req, res) => {
  res.status(200).send('ok');
  
  try {
    const body = req.body;
    if (body.event!== 'messages.upsert') return;

    const from = body.data?.key?.remoteJid?.split('@')[0];
    const text = body.data?.message?.conversation || body.data?.message?.extendedTextMessage?.text || '';
    
    if (!from ||!text) return;

    console.log(`[Bot] From ${from}: ${text}`);
    const reply = `Echo: ${text}`;

    // FIXED: Added missing } on headers
    await axios.post(
      `${EVOLUTION_URL}/message/sendText/${EVOLUTION_INSTANCE}`,
      { number: from, text: String(reply) },
      { headers: { apikey: EVOLUTION_KEY } // <- FIXED bracket here
    );
    
    console.log(`[Bot] Sent: ${reply}`);
  } catch (e) {
    console.error('[Bot] Fail:', e.response?.data || e.message);
  }
});

app.get('/', (req, res) => res.status(200).send('ok'));
app.listen(PORT, () => console.log('Bot up on', PORT));
