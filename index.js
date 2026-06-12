import express from 'express';
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'https://evolution-api-production-53a9.up.railway.app';
const API_KEY = process.env.EVOLUTION_API_KEY || 'FDE3646665F6-4E47-A279-A6BECE1C3D5D';
const INSTANCE_NAME = encodeURIComponent(process.env.EVOLUTION_INSTANCE || 'Brandsignl Main V4');

const activeSessions = new Map(); 

app.post('/webhook', async (req, res) => {
  res.status(200).send({ status: 'received' });

  const { event, data } = req.body;
  if (event !== 'messages.upsert') return;

  const msg = Array.isArray(data) ? data[0] : data;
  const remoteJid = msg.key.remoteJid;
  const phone = remoteJid.split('@')[0];
  const text = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').toLowerCase();

  let session = activeSessions.get(phone) || { state: 'new' };

  // 1. STEP: RESET
  if (text.includes('novo')) {
    activeSessions.set(phone, { state: 'new' });
    return await sendText(remoteJid, 'Funnel Reset.');
  }

  // 2. STEP: START -> ASK NAME
  if (session.state === 'new') {
    session.state = 'ask_name';
    activeSessions.set(phone, session);
    await sendText(remoteJid, 'Hi! What is your business name?');
  } 
  // 3. STEP: NAME RECEIVED -> SEND IMAGE
  else if (session.state === 'ask_name') {
    session.businessName = text;
    session.state = 'delivered';
    activeSessions.set(phone, session);

    // EXACT EVOLUTION API PAYLOAD FOR MEDIA
    await sendMedia(remoteJid, 'https://images.unsplash.com/photo-1560066984-138dadb4c078?q=80&w=500', 'Here is your custom sample for ' + session.businessName);
  }
});

async function sendMedia(toJid, url, caption) {
  const endpoint = ${EVOLUTION_API_URL}/message/sendMedia/${INSTANCE_NAME};
  await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': API_KEY },
    body: JSON.stringify({
      number: toJid,
      mediatype: 'image',
      mimetype: 'image/jpeg',
      media: url, // This MUST be a direct URL to an image
      caption: caption
    })
  });
}

async function sendText(toJid, text) {
  const endpoint = ${EVOLUTION_API_URL}/message/sendText/${INSTANCE_NAME};
  await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': API_KEY },
    body: JSON.stringify({ number: toJid, text: text })
  });
}

app.listen(PORT, '0.0.0.0');
