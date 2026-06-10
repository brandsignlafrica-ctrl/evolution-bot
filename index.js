import express from 'express';
import axios from 'axios';
import fs from 'fs';

const app = express();
app.use(express.json());

const EVOLUTION_URL = 'https://evolution-api-production-53a9.up.railway.app';
const EVOLUTION_KEY = 'brandsignl123';
const INSTANCE = 'Brandsignl Main V4';
const HERO_IMAGE = '27283658664651159@id';

console.log('STARTING BOT...');
console.log('EVOLUTION_URL:', EVOLUTION_URL);

const STATE_FILE = '/tmp/states.json';
function loadStates() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE)); }
  catch { return {}; }
}
function saveStates(s) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(s));
}
let userStates = loadStates();

async function sendText(to, text) {
  console.log(`SENDING TEXT to ${to}: ${text}`);
  try {
    await axios.post(
      `${EVOLUTION_URL}/message/sendText/${INSTANCE}`,
      { number: to, textMessage: { text } },
      { headers: { apikey: EVOLUTION_KEY }, timeout: 10000 }
    );
  } catch(e) {
    console.error('SEND TEXT ERROR:', e.response?.data || e.message);
  }
}

app.post('/webhook', async (req, res) => {
  console.log('WEBHOOK HIT', new Date().toISOString());
  try {
    const data = req.body.data;
    if (!data?.message?.conversation) return res.sendStatus(200);

    const sender = data.key.remoteJid;
    const text = data.message.conversation.toLowerCase().trim();
    const pushName = data.pushName || 'Cliente';

    if (!userStates[sender] || userStates[sender].step === 'new') {
      userStates[sender] = { name: pushName, step: 'asked_name' };
      saveStates(userStates);
      await sendText(sender, `Oi ${pushName}! Qual é o seu nome? 😊`);
      return res.sendStatus(200);
    }

    if (userStates[sender].step === 'asked_name') {
      userStates[sender].name = text;
      userStates[sender].step = 'sent_offer';
      saveStates(userStates);
      return res.sendStatus(200);
    }

    res.sendStatus(200);
  } catch(e) {
    console.error('WEBHOOK ERROR:', e);
    res.sendStatus(200);
  }
});

process.on('uncaughtException', err => console.error('CRASH:', err));
process.on('unhandledRejection', err => console.error('PROMISE CRASH:', err));

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Bot running on ${PORT}`));
