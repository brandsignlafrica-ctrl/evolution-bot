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
  if (!msg || !msg.key || msg.key.fromMe) return;

  const remoteJid = msg.key.remoteJid;
  const phone = remoteJid.split('@')[0];
  const incomingText = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').toLowerCase().trim();

  // 🌍 BILINGUAL DETECTION: Brazil (55) gets PT, everyone else gets EN
  const isPT = phone.startsWith('55');

  let session = activeSessions.get(phone) || { state: 'new' };

  if (['novo', 'start', 'reset'].includes(incomingText)) {
    activeSessions.set(phone, { state: 'new' });
    const msg = isPT ? 'Funil reiniciado. Você faz unhas, cabelo ou cílios?' : 'Funnel reset. Do you do nails, hair, or lashes?';
    return await sendText(remoteJid, msg);
  }

  switch (session.state) {
    case 'new':
      if (incomingText.includes('unha') || incomingText.includes('nail') || 
          incomingText.includes('cabelo') || incomingText.includes('hair') || 
          incomingText.includes('cílio') || incomingText.includes('lash')) {
        
        session.state = 'waiting_for_name';
        session.niche = incomingText;
        activeSessions.set(phone, session);
        const msg = isPT ? 'Ótimo! Qual o nome do seu negócio?' : 'Great! What is your business name?';
        await sendText(remoteJid, msg);
      } else {
        const msg = isPT ? 'Oi! Você trabalha com unhas, cabelo ou cílios?' : 'Hi! Do you work with nails, hair, or lashes?';
        await sendText(remoteJid, msg);
      }
      break;

    case 'waiting_for_name':
      session.businessName = incomingText;
      session.state = 'done';
      activeSessions.set(phone, session);

      const sampleUrl = 'https://images.unsplash.com/photo-1560066984-138dadb4c078?q=80&w=500';
      const caption = isPT ? 'Amostra para ' + session.businessName : 'Sample for ' + session.businessName;
      
      await sendMedia(remoteJid, sampleUrl, caption);
      
      setTimeout(async () => {
        const conv = isPT 
          ? '1. Selfies confundem o algoritmo.\n2. Estes 6 posts corrigem isso.\n3. Veja o resultado.' 
          : '1. Selfies confuse the algorithm.\n2. These 6 posts fix that.\n3. See the results.';
        await sendText(remoteJid, conv);
        
        setTimeout(async () => {
          const pay = isPT 
            ? 'R$29 via PIX: https://pay.hotmart.com/W105949535S' 
            : 'Get 6 templates for R99: https://payment.payfast.io/eng/process/payment/515b7db1-fb19-4084-94fb-8e01f94758e4';
          await sendText(remoteJid, pay);
        }, 1500);
      }, 2000);
      break;
  }
});

async function sendMedia(toJid, url, caption) {
  const endpoint = EVOLUTION_API_URL + '/message/sendMedia/' + INSTANCE_NAME;
  await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': API_KEY },
    body: JSON.stringify({ number: toJid, mediatype: 'image', mimetype: 'image/jpeg', media: url, caption: caption })
  });
}

async function sendText(toJid, text) {
  const endpoint = EVOLUTION_API_URL + '/message/sendText/' + INSTANCE_NAME;
  await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': API_KEY },
    body: JSON.stringify({ number: toJid, text: text })
  });
}

app.get('/', (req, res) => res.send('Bot Active'));
app.listen(PORT, '0.0.0.0');
