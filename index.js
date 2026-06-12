import express from 'express';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'https://evolution-api-production-53a9.up.railway.app';
const API_KEY = process.env.EVOLUTION_API_KEY || 'FDE3646665F6-4E47-A279-A6BECE1C3D5D';
const INSTANCE_NAME = encodeURIComponent(process.env.EVOLUTION_INSTANCE || 'Brandsignl Main V4');

// In-Memory Database (Since we aren't using Drizzle ORM in index.js)
const activeSessions = new Map();

// Pilot Opening Lines
const NICHE_CAPTIONS = {
  nails: { pt: "Você tentou dar um 'jeitinho' na unha, mas agora ela está pior do que antes, não está?", en: "You thought you were getting a deal. Now your natural nails are gone." },
  hair: { pt: "Você economizou no cabelo. E agora, o que você faz com esse arrependimento?", en: "The 'bargain' that cost you your hair quality." },
  lashes: { pt: "Aquele 'jeitinho' no cílio que só te deu mais dor de cabeça.", en: "You thought you were getting a deal. Now your natural lashes are gone." }
};

app.post('/webhook', async (req, res) => {
  res.status(200).send({ status: 'received' });

  try {
    const { event, data } = req.body;
    if (event !== 'messages.upsert') return;

    const messageData = Array.isArray(data) ? data[0] : data;
    if (!messageData || !messageData.key || messageData.key.fromMe) return;

    const remoteJid = messageData.key.remoteJid;
    const phone = remoteJid.split('@')[0];
    const incomingText = (messageData.message?.conversation || messageData.message?.extendedTextMessage?.text || '').toLowerCase().trim();
    
    const isBrazil = phone.startsWith('55');
    const isSA = phone.startsWith('27');

    let session = activeSessions.get(phone) || { state: 'new' };

    // Handle Reset
    if (['novo', 'start', 'reset'].includes(incomingText)) {
      activeSessions.set(phone, { state: 'new' });
      const resetMsg = isBrazil ? 'Funil reiniciado. Como posso ajudar?' : 'Funnel reset. How can I help?';
      return await sendText(remoteJid, resetMsg);
    }

    switch (session.state) {
      case 'new': {
        // STEP 1: AD KEYWORD AUTO-LOCK
        if (incomingText.includes('nail') || incomingText.includes('unha') || incomingText.includes('hair') || incomingText.includes('cabelo') || incomingText.includes('lash') || incomingText.includes('cílio')) {
          
          let niche = 'nails';
          if (incomingText.includes('hair') || incomingText.includes('cabelo')) niche = 'hair';
          if (incomingText.includes('lash') || incomingText.includes('cílio')) niche = 'lashes';

          session.state = 'data_pending';
          session.niche = niche;
          activeSessions.set(phone, session);

          const msg = isBrazil ? 'Ótimo! Vou criar sua amostra AGORA. Qual o Nome do seu Negócio?' : 'Great! I will create your sample NOW. What is your Business Name?';
          await sendText(remoteJid, msg);
        } else {
          const qualMenu = isBrazil ? 'Oi! 👋 Você é 1. Profissional de beleza ou 2. Apenas olhando?' : 'Hi! 👋 Are you 1. A beauty professional or 2. Just browsing?';
          await sendText(remoteJid, qualMenu);
        }
        break;
      }

      case 'data_pending': {
        // STEP 2 & 3: BRANDED SAMPLE GENERATION
        session.businessName = incomingText;
        session.state = 'sample_delivered';
        activeSessions.set(phone, session);

        // Since Sharp buffer isn't in index.js, we send a static sample URL for testing
        const sampleImageUrl = 'https://images.unsplash.com/photo-1560066984-138dadb4c078?q=80&w=500';
        const caption = isBrazil ? NICHE_CAPTIONS[session.niche].pt : NICHE_CAPTIONS[session.niche].en;

        await sendMedia(remoteJid, sampleImageUrl, caption);

        // STEP 4: THE ALGORITHM FIX (CONVICTION LAYER)
        setTimeout(async () => {
          const convictionText = isBrazil
            ? '1. Postar selfies confunde o algoritmo; ele te mostra para amigos, não compradoras.\n2. Esses 6 posts corrigem isso. Eles são "buyer-intent" e ensinam a Meta: "esta página = agendamentos".\n3. Resultado: Uma cliente já paga este investimento 5x.'
            : '1. Posting selfies confuses the algorithm; it shows you to friends, not buyers.\n2. These 6 posts fix that. They are "buyer-intent" and teach Meta: "this page = appointments".\n3. Result: One client already pays for this 5x over.';
          
          await sendText(remoteJid, convictionText);

          // STEP 5: PAYMENT ROUTING
          setTimeout(async () => {
            if (isBrazil) {
              await sendText(remoteJid, 'R$29 via PIX único: https://pay.hotmart.com/W105949535S?bid=1780424594098\nPaga e manda o comprovante aqui 👇');
            } else if (isSA) {
              await sendText(remoteJid, 'Get all 6 templates for R99.\n\nOption 1: Instant (PayFast)\nhttps://payment.payfast.io/eng/process/payment/515b7db1-fb19-4084-94fb-8e01f94758e4\n\nOption 2: Cash/EFT\nReply "STOP" for manual banking details.');
            }
          }, 1500);
        }, 2000);
        break;
      }
      
      case 'sample_delivered': {
         if (incomingText === 'stop' && isSA) {
             session.state = 'manual_handoff';
             activeSessions.set(phone, session);
             await sendText(remoteJid, 'A team member will be with you shortly to assist with your manual payment. 🤝');
         }
         break;
      }
    }
  } catch (error) {
    console.error('💥 Webhook Router Error:', error);
  }
});

// BULLETPROOF FETCH FUNCTIONS
async function sendMedia(toJid, url, captionText) {
  const endpoint = EVOLUTION_API_URL + '/message/sendMedia/' + INSTANCE_NAME;
  await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': API_KEY },
    body: JSON.stringify({
      number: toJid,
      mediatype: 'image',
      mimetype: 'image/jpeg',
      media: url,
      caption: captionText
    })
  });
}

async function sendText(toJid, textContent) {
  const endpoint = EVOLUTION_API_URL + '/message/sendText/' + INSTANCE_NAME;
  await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': API_KEY },
    body: JSON.stringify({ number: toJid, text: textContent })
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log('Bot Active on port ' + PORT);
});
