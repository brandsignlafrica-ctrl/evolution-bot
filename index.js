'use strict';

const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json({ limit: '5mb' }));

const PORT = process.env.PORT || 8080;
const EVOLUTION_API_URL = (process.env.EVOLUTION_API_URL || '').replace(/\/$/, '');
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '';
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || '';
const BRANDSIGNL_URL = (process.env.BRANDSIGNL_URL || 'https://brandsignl.com').replace(/\/$/, '');

const sessionSteps = new Map();
const sessionLangs = new Map();
const sessionNiches = new Map();

const processedMessages = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [msgId, timestamp] of processedMessages.entries()) {
    if (now - timestamp > 10000) processedMessages.delete(msgId);
  }
}, 60000);

console.log('STARTUP: Branded Visual Layout Funnel Engine Online');

app.get('/', (req, res) => res.status(200).send('BrandSignl Active — OK'));
app.get('/health', (req, res) => res.status(200).send('OK'));

function detectLang(text) {
  const pt = /\b(oi|olá|ola|bom dia|boa tarde|boa noite|obrigad|quero|preciso|meu|minha|como|você|voce|por favor|ajuda|cabelo|unhas|cílios|sobrancelha|manicure|manicura|sim|nao|não)\b/i;
  if (pt.test(text)) return 'pt';
  return 'en';
}

async function sendWhatsApp(number, text, imageUrl = null) {
  try {
    let validImageUrl = null;
    if (imageUrl && String(imageUrl).trim() !== '') {
      let tempUrl = String(imageUrl).trim();
      if (tempUrl.includes('.comnull/')) {
        tempUrl = tempUrl.replace('.comnull/', '.com/');
      }
      if (tempUrl.startsWith('http://') || tempUrl.startsWith('https://')) {
        validImageUrl = tempUrl;
      }
    }

    const endpoint = validImageUrl ? 'message/sendMedia' : 'message/sendText';
    const url = ${EVOLUTION_API_URL}/${endpoint}/${EVOLUTION_INSTANCE};
    
    const payload = validImageUrl ? {
      number: number,
      mediaMessage: { mediatype: 'image', caption: String(text), media: validImageUrl }
    } : {
      number: number, text: String(text)
    };

    const response = await axios.post(url, payload, {
      headers: { apikey: EVOLUTION_API_KEY },
      timeout: 15000
    });
    return response.data;
  } catch (err) {
    console.error(Bot WhatsApp Dispatch Error: ${err.message});
    // Fallback: If image dispatch fails with 400, automatically push as text so the user is never left hanging
    if (imageUrl) {
      try {
        const fallbackUrl = ${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE};
        await axios.post(fallbackUrl, { number, text: String(text) }, { headers: { apikey: EVOLUTION_API_KEY }, timeout: 10000 });
      } catch (fallbackErr) {
        console.error(Fallback Text Dispatch Failed: ${fallbackErr.message});
      }
    }
    return null;
  }
}

async function backgroundSyncDB(phone, updates = {}) {
  try {
    const url = ${BRANDSIGNL_URL}/api/wa-lead;
    await axios.post(url, { phone, ...updates }, { timeout: 5000 });
  } catch (err) {
    console.error(Non-Blocking DB Sync Notification: ${err.message});
  }
}

async function getLivePreview(niche, brandName, brandPhone) {
  try {
    const url = ${BRANDSIGNL_URL}/api/wa-preview;
    const res = await axios.get(url, {
      params: { niche, businessName: brandName, businessPhone: brandPhone },
      timeout: 15000
    });
    return res.data;
  } catch (err) {
    console.error(Backend API Preview Error: ${err.message});
    return null;
  }
}

app.post('/webhook', async (req, res) => {
  res.status(200).send('ok');

  try {
    const body = req.body;
    if (!body || body.event !== 'messages.upsert') return;

    const incomingInstance = body.instance || '';
    if (EVOLUTION_INSTANCE && incomingInstance && incomingInstance !== EVOLUTION_INSTANCE) return; 

    const data = body.data;
    if (!data || !data.key || !data.message) return;
    if (data.key.fromMe === true) return;
    if (body.data.status || body.data.update) return;

    const messageId = data.key.id || '';
    if (messageId) {
      if (processedMessages.has(messageId)) return; 
      processedMessages.set(messageId, Date.now());
    }

    const remoteJid = data.key.remoteJid || '';
    if (remoteJid.endsWith('@g.us')) return;

    const rawFrom = remoteJid.split('@')[0].trim();
    const cleanFrom = rawFrom.replace(/\D/g, '').trim();

    const text = (
      (data.message.conversation) ||
      (data.message.extendedTextMessage && data.message.extendedTextMessage.text) ||
      (data.message.imageMessage && data.message.imageMessage.caption) ||
      (data.message.videoMessage && data.message.videoMessage.caption) ||
      ''
    ).trim();

    if (!rawFrom || !text) return;

    // 🔒 PERSONAL STAGING ISOLATION LOCK
    const ALLOWED_TESTER = '27833272007'; 
    if (cleanFrom !== ALLOWED_TESTER) return;

    let localStep = sessionSteps.get(cleanFrom) || 'new';
    let userLang = sessionLangs.get(cleanFrom) || detectLang(text);
    const inputLower = text.toLowerCase();
    
    if (inputLower === 'reset' || inputLower === 'restart' || inputLower === 'nails' || inputLower === 'unhas' || inputLower === 'hair' || inputLower === 'cabelo' || inputLower === 'lashes') {
      localStep = 'new';
      userLang = detectLang(text);
      sessionSteps.set(cleanFrom, 'new');
      sessionLangs.set(cleanFrom, userLang);
    }

    if ((inputLower === '1' || inputLower === 'sim') && localStep === 'new') {
      userLang = 'pt';
      sessionLangs.set(cleanFrom, 'pt');
    }

    // ─── STEP 1: QUALIFICATION GATE ──────────────────────────────────────────
    if (localStep === 'new') {
      sessionSteps.set(cleanFrom, 'qualify_pending');
      sessionLangs.set(cleanFrom, userLang);
      backgroundSyncDB(cleanFrom, { step: 'qualify_pending', lang: userLang });
      
      const msg = (userLang === 'pt') 
        ? "Você é um profissional da beleza buscando mais clientes?\n\n1. Sim\n2. Apenas navegando"
        : "Are you a beauty professional looking for more clients?\n\n1. Yes\n2. Just browsing";
        
      await sendWhatsApp(cleanFrom, msg);
      return;
    }
    
    // ─── STEP 2: NICHE SELECTOR + ALGORITHMIC PITCH ──────────────────────────
    if (localStep === 'qualify_pending') {
      if (text === '2' || inputLower.includes('navegando') || inputLower.includes('browsing')) {
        const msg = (userLang === 'pt') ? "Sem problemas! Nos avise se mudar de ideia mais tarde." : "No problem! Let us know if things change.";
        await sendWhatsApp(cleanFrom, msg);
        sessionSteps.set(cleanFrom, 'new');
        backgroundSyncDB(cleanFrom, { step: 'new' });
      } else {
        sessionSteps.set(cleanFrom, 'niche_pending');
        backgroundSyncDB(cleanFrom, { step: 'niche_pending', lang: userLang });
        const msg = (userLang === 'pt') ? "Excelente! Qual é o seu nicho?\n\n1. Unhas\n2. Cabelo\n3. Cílios" : "What's your niche?\n\n1. Nails\n2. Hair\n3. Lashes";
        await sendWhatsApp(cleanFrom, msg);
      }
      return;
    }
    
    // ─── STEP 3: BRAND METADATA INTAKE ───────────────────────────────────────
    if (localStep === 'niche_pending') {
      let activeNiche = 'nails';
      if (text === '2' || inputLower.includes('cabelo') || inputLower.includes('hair')) activeNiche = 'hair';
      if (text === '3' || inputLower.includes('cílios') || inputLower.includes('lashes')) activeNiche = 'lashes';

      sessionNiches.set(cleanFrom, activeNiche);
      sessionSteps.set(cleanFrom, 'branding_pending');
      backgroundSyncDB(cleanFrom, { niche: activeNiche, step: 'branding_pending', lang: userLang });
      
      // ⚡ ENHANCED UX: Explaining the Meta algorithm trick immediately before taking information
      const explanationMsg = (userLang === 'pt')
        ? "💡 Como funciona:\nPostar apenas fotos de unhas confunde as redes sociais. O algoritmo mostra suas fotos para amigos, não para clientes. Nossos layouts focam na Intenção de Compra para treinar o algoritmo a atrair agendamentos reais.\n\nPara gerarmos sua amostra grátis agora, digite o Nome da sua Empresa, Número de Contato (Exemplo: Salão da Ana, 0821234567)."
        : "💡 Why this changes things:\nPosting standard selfies and plain work pics confuses Meta. The algorithm shows your posts to friends, not buyers—causing lots of views but no bookings. Our layouts focus on Buyer-Intent to teach the algorithm that your page = appointments.\n\nTo generate your custom branded sample post now, please send your Business Name and Contact Number (separated by a comma, e.g., My Salon, 0821234567).";
      
      await sendWhatsApp(cleanFrom, explanationMsg);
      return;
    }
    
    // ─── STEP 4: PREVIEW DELIVERY & FEEDBACK ─────────────────────────────────
    if (localStep === 'branding_pending') {
      const segments = text.includes(',') ? text.split(',') : [text, ''];
      const salonName = segments[0] ? segments[0].trim() : "My Salon";
      const salonPhone = segments[1] ? segments[1].trim() : cleanFrom;

      const workingMsg = (userLang === 'pt') ? "Gerando o layout do seu post personalizado agora... ⚡" : "Generating your custom branded sample post now... ⚡";
      await sendWhatsApp(cleanFrom, workingMsg);

      const currentNiche = sessionNiches.get(cleanFrom) || 'nails';
      const previewAsset = await getLivePreview(currentNiche, salonName, salonPhone);
      
      let imageCaption = (userLang === 'pt') ? "Aqui está o layout do seu post personalizado!" : "Here is your custom sample layout!";
      let remoteImgUrl = null;

      if (previewAsset) {
        remoteImgUrl = previewAsset.imageUrl || null;
        let shortHook = previewAsset.hook ? '' + previewAsset.hook + '\n\n' : '';
        let openingLine = '';
        if (previewAsset.caption) {
          const cleanCaption = previewAsset.caption.trim();
          const firstPeriodIndex = cleanCaption.indexOf('.');
          openingLine = (firstPeriodIndex !== -1) ? cleanCaption.substring(0, firstPeriodIndex + 1) : cleanCaption.split('\n')[0];
        }
        imageCaption = shortHook + openingLine;
      }

      await sendWhatsApp(cleanFrom, imageCaption, remoteImgUrl);
      
      const satisfactionMsg = (userLang === 'pt') ? "Você gostou desse post?\n\n1. Sim\n2. Não" : "Are you happy with this post?\n\n1. Yes\n2. No";
      await sendWhatsApp(cleanFrom, satisfactionMsg);
      
      sessionSteps.set(cleanFrom, 'satisfaction_pending');
      backgroundSyncDB(cleanFrom, { step: 'satisfaction_pending', lang: userLang });
      return;
    }
    
    // ─── STEP 5: PACKAGE OPTION CLOSE ────────────────────────────────────────
    if (localStep === 'satisfaction_pending') {
      sessionSteps.set(cleanFrom, 'package_pending');
      backgroundSyncDB(cleanFrom, { step: 'package_pending', lang: userLang });
      
      // ⚡ ENHANCED UX: Show price value comparison right at checkout selection
      const msg = (userLang === 'pt') 
        ? "Excelente! Você prefere o Pacote de 6 posts ou o Pacote de 20 posts?\n\n1. 6 Posts\n2. 20 Posts" 
        : "Awesome! Ready to fix your social media algorithm for good?\n\nOur 6-post pack trains Meta what you do for the next 6 months. Just 1 new client pays for the pack 2.5x over.\n\nWhich option works best for you?\n\n1. 6 Posts Pack (R99 once-off)\n2. 20 Premium Bundle";
      
      await sendWhatsApp(cleanFrom, msg);
      return;
    }
    
    if (localStep === 'package_pending') {
      let linkTarget = "https://brandsignl.com/nails/confirm";
      let chosenLabel = "6 Posts";
      if (text === '2') { linkTarget = "https://brandsignl.com/nails/premium-bundle"; chosenLabel = "20 Posts"; }
      if (userLang === 'pt') {
        linkTarget = (text === '2') ? "https://pay.hotmart.com/W105949535S?checkoutMode=10" : "https://pay.hotmart.com/W105949535S";
        chosenLabel = (text === '2') ? "20 Posts" : "6 Posts";
      }
      const closeMsg = (userLang === 'pt') ? "Perfeito! Seu pacote de " + chosenLabel + " está reservado.\n\n👉 Conclua seu pagamento seguro via Pix aqui:\n" + linkTarget : "Perfect! Your package for " + chosenLabel + " is securely reserved.\n\n👉 Complete checkout here:\n" + linkTarget;
      await sendWhatsApp(cleanFrom, closeMsg);
      sessionSteps.set(cleanFrom, 'awaiting_payment');
      backgroundSyncDB(cleanFrom, { step: 'awaiting_payment', lang: userLang });
      return;
    }
    
    if (localStep === 'awaiting_payment') {
      const lockMsg = (userLang === 'pt') ? "Seu pedido está reservado com segurança! Assim que o Pix for confirmado, seu link de acesso exclusivo será enviado direto aqui neste chat." : "Your order is securely reserved. Once checkout completes, your custom high-converting content pack download link drops right here in this chat.";
      await sendWhatsApp(cleanFrom, lockMsg);
      return;
    }

  } catch (err) {
    console.error('Webhook Loop Error: ' + err.message);
  }
});

app.use((req, res) => res.status(404).send('Not found'));
app.listen(PORT, '0.0.0.0', () => console.log('SERVER READY ON PORT ' + PORT));
