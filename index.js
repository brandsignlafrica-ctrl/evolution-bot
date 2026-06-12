import express from 'express';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;
const EVOLUTION_API_URL = (process.env.EVOLUTION_API_URL || 'https://evolution-api-production-53a9.up.railway.app').replace(/\/$/, '');
const API_KEY = (process.env.EVOLUTION_API_KEY || 'FDE3646665F6-4E47-A279-A6BECE1C3D5D').trim();
const INSTANCE_NAME = (process.env.EVOLUTION_INSTANCE || 'Brandsignl Main V4').trim();

const ALLOWED_PROFILES = ['27833272007', '27638151814', '267207145730240'];

const processedMessages = new Set();
const activeSessions = new Map(); 

app.post('/webhook', async (req, res) => {
  res.status(200).send({ status: 'received' });

  try {
    const { event, data } = req.body;
    if ((event || '').toUpperCase().replace('.', '_') !== 'MESSAGES_UPSERT') return;

    const messageData = Array.isArray(data) ? data[0] : data;
    if (!messageData || !messageData.key || messageData.key.fromMe) return;

    const messageId = messageData.key.id;
    if (processedMessages.has(messageId)) return;
    processedMessages.add(messageId);

    const remoteJid = messageData.key.remoteJid || '';
    const phone = remoteJid.split('@')[0];
    const isBrazil = phone.startsWith('55');

    const incomingText = (messageData.message?.conversation || messageData.message?.extendedTextMessage?.text || "").trim();
    if (!incomingText) return;

    const text = incomingText.toLowerCase();
    let session = activeSessions.get(phone) || { state: 'new' };

    if (['novo', 'start', 'reset'].includes(text)) {
      activeSessions.set(phone, { state: 'new' });
      await sendWhatsAppText(remoteJid, '🔄 Funnel reset.');
      return;
    }

    if (session.state === 'new') {
      if (text.includes('unhas') || text.includes('hair') || text.includes('lashes') || text === '1' || text === 'sim') {
        session.state = 'data_pending';
        activeSessions.set(phone, session);
        await sendWhatsAppText(remoteJid, isBrazil ? 'Ótimo! Qual o nome do seu negócio?' : 'Great! What is your business name?');
      } else {
        await sendWhatsAppText(remoteJid, isBrazil ? 'Oi! Beleza (1) ou só olhando (2)?' : 'Hi! Professional (1) or just browsing (2)?');
      }
    } else if (session.state === 'data_pending') {
      session.businessName = incomingText;
      session.state = 'sample_delivered';
      activeSessions.set(phone, session);

      // Safe concatenation to avoid syntax errors
      const sampleMsg = (isBrazil ? 'Aqui está sua amostra, ' : 'Here is your sample, ') + session.businessName + '!';
      await sendWhatsAppText(remoteJid, sampleMsg);

      setTimeout(async () => {
        const conviction = isBrazil ? '1. Postar só selfies confunde o algoritmo. 2. Estes 6 posts consertam isso. 3. Veja o resultado.' : '1. Posting selfies confuses the algorithm. 2. These 6 posts fix that. 3. See the results.';
        await sendWhatsAppText(remoteJid, conviction);
        setTimeout(async () => {
          const payMsg = isBrazil ? 'R$29 via PIX: https://pay.hotmart.com/W105949535S' : 'Get 6 templates for R99: https://payment.payfast.io/eng/process/payment/515b7db1-fb19-4084-94fb-8e01f94758e4';
          await sendWhatsAppText(remoteJid, payMsg);
        }, 2000);
      }, 2000);
    }
  } catch (err) {
    console.error('💥 Error:', err);
  }
});

async function sendWhatsAppText(toJid, textContent) {
  try {
    await fetch(EVOLUTION_API_URL + '/message/sendText/' + encodeURIComponent(INSTANCE_NAME), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': API_KEY },
      body: JSON.stringify({ number: toJid, text: textContent, options: { delay: 500 } })
    });
  } catch (error) { console.error(error); }
}

app.get('/health', (req, res) => res.status(200).send('OK'));
app.listen(PORT, '0.0.0.0', () => console.log('Bot Active'));
