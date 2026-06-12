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

  // 🌍 LANGUAGE: Force PT for your test numbers, EN for everyone else
  const isPT = phone.startsWith('55') || phone === '27833272007' || phone === '27638151814';

  let session = activeSessions.get(phone) || { state: 'new' };
  
  // 🔍 LOGGING: See the state in Railway logs
  console.log('📡 [DEBUG] Phone:', phone, '| Current State:', session.state, '| Input:', incomingText);

  // RESET LOGIC
  if (['novo', 'start', 'reset'].includes(incomingText)) {
    activeSessions.set(phone, { state: 'new' });
    await sendText(remoteJid, isPT ? 'Funil reiniciado. Você faz unhas, cabelo ou cílios?' : 'Funnel reset. Do you do nails, hair, or lashes?');
    return;
  }

  // STATE MACHINE
  switch (session.state) {
    case 'new':
      if (incomingText.includes('unha') || incomingText.includes('nail') || 
          incomingText.includes('cabelo') || incomingText.includes('hair') || 
          incomingText.includes('cílio') || incomingText.includes('lash')) {
        
        session.state = 'waiting_for_name';
        activeSessions.set(phone, session);
        await sendText(remoteJid, isPT ? 'Ótimo! Qual o nome do seu negócio?' : 'Great! What is your business name?');
      } else {
        await sendText(remoteJid, isPT ? 'Oi! Você trabalha com unhas, cabelo ou cílios?' : 'Hi! Do you work with nails, hair, or lashes?');
      }
      break;

    case 'waiting_for_name':
      session.businessName = incomingText;
      session.state = 'done'; // Lock the state
      activeSessions.set(phone, session);

      // DELIVER
      const sampleUrl = 'https://images.unsplash.com/photo-1560066984-138dadb4c078?q=80&w=500';
      await sendMedia(remoteJid, sampleUrl, (isPT ? 'Amostra para ' : 'Sample for ') + session.businessName);
      
      setTimeout(async () => {
        await sendText(remoteJid, isPT ? '1. Selfies confundem o algoritmo.\n2. Estes 6 posts corrigem isso.\n3. Veja o resultado.' : '1. Selfies confuse the algorithm.\n2. These 6 posts fix that.\n3. See the results.');
        setTimeout(async () => {
          const pay = isPT ? 'R$29 via PIX: https://pay.hotmart.com/W105949535S' : 'Get 6 templates for R99: https://payment.payfast.io/eng/process/payment/515b7db1-fb19-4084-94fb-8e01f94758e4';
          await sendText(remoteJid, pay);
        }, 1000);
      }, 2000);
      break;
  }
});

async function sendMedia(toJid, url, caption) {
  await fetch(EVOLUTION_API_URL + '/message/sendMedia/' + INSTANCE_NAME, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': API_KEY },
    body: JSON.stringify({ number: toJid, mediatype: 'image', mimetype: 'image/jpeg', media: url, caption: caption })
  });
}

async function sendText(toJid, text) {
  await fetch(EVOLUTION_API_URL + '/message/sendText/' + INSTANCE_NAME, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': API_KEY },
    body: JSON.stringify({ number: toJid, text: text })
  });
}

app.listen(PORT, '0.0.0.0');
