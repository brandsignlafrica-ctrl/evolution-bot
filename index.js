const express = require('express');
const axios = require('axios');
const fs = require('fs');
const app = express();
app.use(express.json());

const EVOLUTION_URL = 'https://api.whatsapp.com';
const EVOLUTION_KEY = 'YOUR_API_KEY_HERE';
const INSTANCE = 'YOUR_INSTANCE_NAME';
const HERO_IMAGE = '27283658664651159@id'; // replace with your media ID

// === PART 1: SAVE STATE TO FILE SO IT DOESN'T RESET ===
const STATE_FILE = '/tmp/states.json';
function loadStates() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE)); }
  catch { return {}; }
}
function saveStates(s) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(s));
}
let userStates = loadStates();

// === SEND FUNCTIONS ===
async function sendText(to, text) {
  console.log(`SENDING TEXT to ${to}: ${text}`);
  await axios.post(`${EVOLUTION_URL}/message/sendText/${INSTANCE}`,
    { number: to, textMessage: { text } },
    { headers: { apikey: EVOLUTION_KEY } }
  );
}

async function sendImage(to, imageId, caption) {
  console.log(`SENDING IMAGE to ${to}`);
  await axios.post(`${EVOLUTION_URL}/message/sendMedia/${INSTANCE}`,
    { number: to, mediaMessage: { mediaType: "image", media: imageId, caption } },
    { headers: { apikey: EVOLUTION_KEY } }
  );
}

// === WEBHOOK ===
app.post('/webhook', async (req, res) => {
  console.log('=== WEBHOOK HIT ===', new Date().toISOString());
  console.log('BODY:', JSON.stringify(req.body));

  try {
    const data = req.body.data;
    if (!data?.message?.conversation) return res.sendStatus(200);

    const sender = data.key.remoteJid;
    const text = data.message.conversation.toLowerCase().trim();
    const pushName = data.pushName || 'Cliente';

    console.log(`MSG from ${sender}: "${text}"`);
    console.log('CURRENT STATE:', userStates[sender]);

    // STEP 1: No state = ask name
    if (!userStates[sender] || userStates[sender].step === 'new') {
      userStates[sender] = { name: pushName, step: 'asked_name' };
      saveStates(userStates);
      await sendText(sender, `Oi ${pushName}! Qual é o seu nome? 😊`);
      return res.sendStatus(200);
    }

    // STEP 2: Got name = send offer
    if (userStates[sender].step === 'asked_name') {
      userStates[sender].name = text;
      userStates[sender].step = 'sent_offer';
      saveStates(userStates);

      await sendImage(sender, HERO_IMAGE,
        `Prazer ${text}! 👇\n\nUnhas gel + decoração GRÁTIS\nSó 8 vagas esta semana!\n\n1. Quero agendar $35\n2. Ver outro modelo\n3. Passar`
      );
      return res.sendStatus(200);
    }

    // STEP 3: Handle 1/2/3
    if (text === '1') {
      await sendText(sender, `Perfeito ${userStates[sender].name}! Me manda dia + horário que te encaixo 💅`);
    }
    else if (text === '2') {
      await sendText(sender, `Te mando mais 2 modelos agora...`);
    }
    else if (text === '3') {
      await sendText(sender, `Tranquilo ${userStates[sender].name}! Se mudar de ideia me chama.`);
    }
    else {
      await sendText(sender, `Digite 1, 2 ou 3 ${userStates[sender].name} 😊`);
    }

    res.sendStatus(200);
  } catch(e) {
    console.error('=== ERROR CAUGHT ===', e.message);
    res.sendStatus(200); // always 200 so evolution doesn't retry spam
  }
});

// === PART 2: STOP SILENT CRASHES ===
process.on('uncaughtException', err => console.log('CRASH:', err));
process.on('unhandledRejection', err => console.log('PROMISE CRASH:', err));

app.listen(3000, () => console.log('Bot running on 3000'));
