[15:35, 6/8/2026] Tyronne: 'use strict';

const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json({ limit: '5mb' }));

const PORT = process.env.PORT || 8080;
const EVOLUTION_API_URL = (process.env.EVOLUTION_API_URL || '').replace(/\/$/, '');
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '';
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || '';
const BRANDSIGNL_URL = (process.env.BRANDSIGNL_URL || 'https://brandsignl.com').replace(/\/$/, '');

console.log('ENTRY FILE EXECUTING — STATE ENGINE READY');
console.log('PORT:', PORT);
console.log('EVOLUTION_API_URL:', EVOLUTION_API_URL);
console.log('EVOLUTION_INSTANCE:', EVOLUTION_INSTANCE);
console.log('BRANDSIGNL_URL:', BRANDSIGNL_URL);

// ─── Health endpoints ─────────────────────────────────────────────────────────
app.get('/', (req, res) => res.status(200).send('BrandSignl State Engine — OK'));
app.get('/health', (req, res) => res.status(200).send('OK'));

// ─── Language detection ───────────────────────────────────────────────────────
function detectLang(text) {
  const pt = /\b(oi|olá|ola|bom dia|boa tarde|boa noite|obrigad|quero|preciso|meu|minha|como|você|voce|por favor|ajuda|cabelo|unhas|cílios|sobrancelha|manicure|manicura)\b/i;
  const es = /\b(hola|buenos días|buenas|gracias|quiero|necesito|mi|como|usted|por favor|ayuda|cabello|uñas|pestañas)\b/i;
  if (pt.test(text)) return 'pt';
  if (es.test(text)) return 'es';
  return 'en';
}

// ─── Send WhatsApp message via Evolution API (Handles Text or Images) ────────
async function sendWhatsApp(number, text, imageUrl = null) {
  let validImageUrl = (imageUrl && String(imageUrl).trim() !== '') ? String(imageUrl).trim() : null;
  const endpoint = validImageUrl ? 'message/sendMedia' : 'message/sendText';
  const url = ${EVOLUTION_API_URL}/${endpoint}/${EVOLUTION_INSTANCE};
  
  const payload = validImageUrl ? {
    number: number,
    mediaMessage: {
      mediatype: 'image',
      caption: String(text),
      media: validImageUrl
    }
  } : {
    number: number,
    text: String(text)
  };

  console.log([Bot] Dispatching to ${endpoint}. Valid image: ${!!validImageUrl});
  const response = await axios.post(url, payload, {
    headers: { apikey: EVOLUTION_API_KEY },
    timeout: 15000
  });
  return response.data;
}

// ─── Backend Pipeline Integration Helpers (Manus REST Endpoints) ─────────────

// 1. Fetch or update lead step status from Supabase
async function syncLeadState(phone, updates = {}) {
  try {
    const res = await axios.post(${BRANDSIGNL_URL}/api/wa-lead, { phone, ...updates }, { timeout: 10000 });
    return res.data; // Returns { success: true, lead: { step: '...' } }
  } catch (err) {
    console.error('[Backend API] Lead Sync Error:', err.message);
    return null;
  }
}

// 2. Fetch live image sample previews + texts from Pilot library
async function getLivePreview(niche, lang) {
  try {
    const res = await axios.get(${BRANDSIGNL_URL}/api/wa-preview, {
      params: { niche, lang },
      timeout: 15000
    });
    return res.data; // Returns { hook, caption, hashtags, imageUrl }
  } catch (err) {
    console.error('[Backend API] Preview Fetch Error:', err.message);
    return null;
  }
}

// ─── Sales Funnel Copy Templates ─────────────────────────────────────────────
function buildEducationalLesson(lang) {
  if (lang === 'pt') {
    return \n\n---\n💡 *Lição de Redes Sociais:* Postar fotos normais do salão traz visualizações, mas NÃO traz clientes. O algoritmo fica confuso. Nosso Pacote de 6 Posts usa layouts de "intenção de compra" para forçar a Meta a entender que sua página significa agendamentos!\n\n +
           👉 *Garanta seus 6 posts por apenas R$30 no Pix:* https://pay.hotmart.com/W105949535S;
  }
  return \n\n---\n💡 *The Social Media Lesson:* Posting standard salon pictures gets views, but NO calls. Meta gets confused and thinks you want to be an influencer. Our 6-Post Pack uses strict "buyer-intent" layouts to force the algorithm to realize your page means appointments!\n\n +
         👉 *Secure your 6-post package via PayFast for R99 once-off:* https://brandsignl.com/nails/confirm;
}

// ─── Main Webhook Endpoint ────────────────────────────────────────────────────
app.post('/webhook', async (req, res) => {
  res.status(200).send('ok'); // Always clear instantly

  try {
    const body = req.body;
    if (!body || body.event !== 'messages.upsert') return;

    const data = body.data;
    if (!data || !data.key || !data.message) return;
    if (data.key.fromMe === true) return;

    const remoteJid = data.key.remoteJid || '';
    if (remoteJid.endsWith('@g.us')) return;

    const from = remoteJid.split('@')[0];
    const text = (
      (data.message.conversation) ||
      (data.message.extendedTextMessage && data.message.extendedTextMessage.text) ||
      (data.message.imageMessage && data.message.imageMessage.caption) ||
      (data.message.videoMessage && data.message.videoMessage.caption) ||
      ''
    ).trim();

    if (!from || !text) return;

    // 🔒 TESTING LOCKDOWN GUARD (Keeps live customers safe on Meta AI)
    const ALLOWED_TESTER = '27833272007'; 
    if (from !== ALLOWED_TESTER) {
      console.log([Webhook] Production user (${from}) ignored to let Meta AI run.);
      return;
    }

    console.log([State Engine] Test interaction from ${from}: "${text}");
    const lang = detectLang(text);

    // Step 1: Sync with database to fetch the customer's current conversational state
    let stateData = await syncLeadState(from);
    let currentStep = stateData && stateData.lead ? stateData.lead.step : 'new';
    
    console.log([State Engine] User current database step is: [${currentStep}]);

    // Step 2: Run Conversational State Machine Flow
    if (currentStep === 'new') {
      // User just sent a baseline message (e.g., "unhas" or "nails")
      // Save the input as their selected niche and progress their step status
      await syncLeadState(from, { niche: text, step: 'niche_pending' });
      
      // Pull the verified, live sample post visual directly from Pilot library
      const previewAsset = await getLivePreview(text, lang);
      
      let replyMessage = '';
      let targetImageUrl = null;

      if (previewAsset) {
        const hook = previewAsset.hook ? *${previewAsset.hook}*\n\n : '';
        const caption = previewAsset.caption || '';
        const tags = previewAsset.hashtags ? \n\n${previewAsset.hashtags} : '';
        
        replyMessage = ${hook}${caption}${tags}${buildEducationalLesson(lang)};
        targetImageUrl = previewAsset.imageUrl || null;
      } else {
        // Fallback message if niche template doesn't exist yet
        replyMessage = lang === 'pt' 
          ? Montando seus exemplos para o nicho "${text}"... ✨ + buildEducationalLesson(lang)
          : Creating sample layouts for the "${text}" niche... ✨ + buildEducationalLesson(lang);
      }

      await sendWhatsApp(from, replyMessage, targetImageUrl);
      
      // Advance step state to awaiting payment hook
      await syncLeadState(from, { step: 'awaiting_payment' });
      console.log([State Engine] Flow completed. Updated state to: [awaiting_payment]);
    } 
    else if (currentStep === 'awaiting_payment') {
      // User is interacting after seeing the lesson/link
      let ongoingReply = lang === 'pt'
        ? Seu pacote de layouts de alta conversão está reservado!\n\nAssim que o Pix for confirmado, nosso sistema envia seu link de acesso exclusivo instantaneamente aqui no chat.
        : Your buyer-intent pack layouts are reserved!\n\nAs soon as payment completes via PayFast, our delivery system drops your personal access link directly into this chat thread.;
        
      await sendWhatsApp(from, ongoingReply);
      console.log([State Engine] Retained user inside payment loop.);
    }

  } catch (err) {
    console.error('[State Engine Error]:', err.message);
  }
});

// ─── Catch-all routes ────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).send('Not found'));

process.on('uncaughtException', (err) => console.error('[Bot Global] Uncaught:', err.message));
process.on('unhandledRejection', (reason) => console.error('[Bot Global] Rejection:', reason));

app.listen(PORT, '0.0.0.0', () => console.log('SERVER ONLINE ON PORT ' + PORT));
[15:43, 6/8/2026] Tyronne: 'use strict';

const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json({ limit: '5mb' }));

const PORT = process.env.PORT || 8080;
const EVOLUTION_API_URL = (process.env.EVOLUTION_API_URL || '').replace(/\/$/, '');
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '';
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || '';
const BRANDSIGNL_URL = (process.env.BRANDSIGNL_URL || 'https://brandsignl.com').replace(/\/$/, '');

console.log('ENTRY FILE EXECUTING — STATE ENGINE READY');
console.log('PORT:', PORT);
console.log('EVOLUTION_API_URL:', EVOLUTION_API_URL);
console.log('EVOLUTION_INSTANCE:', EVOLUTION_INSTANCE);
console.log('BRANDSIGNL_URL:', BRANDSIGNL_URL);

// ─── Health endpoints ─────────────────────────────────────────────────────────
app.get('/', (req, res) => res.status(200).send('BrandSignl State Engine — OK'));
app.get('/health', (req, res) => res.status(200).send('OK'));

// ─── Language detection ───────────────────────────────────────────────────────
function detectLang(text) {
  const pt = /\b(oi|olá|ola|bom dia|boa tarde|boa noite|obrigad|quero|preciso|meu|minha|como|você|voce|por favor|ajuda|cabelo|unhas|cílios|sobrancelha|manicure|manicura)\b/i;
  const es = /\b(hola|buenos días|buenas|gracias|quiero|necesito|mi|como|usted|por favor|ayuda|cabello|uñas|pestañas)\b/i;
  if (pt.test(text)) return 'pt';
  if (es.test(text)) return 'es';
  return 'en';
}

// ─── Send WhatsApp message via Evolution API (Handles Text or Images) ────────
async function sendWhatsApp(number, text, imageUrl = null) {
  let validImageUrl = (imageUrl && String(imageUrl).trim() !== '') ? String(imageUrl).trim() : null;
  const endpoint = validImageUrl ? 'message/sendMedia' : 'message/sendText';
  const url = ${EVOLUTION_API_URL}/${endpoint}/${EVOLUTION_INSTANCE};
  
  const payload = validImageUrl ? {
    number: number,
    mediaMessage: {
      mediatype: 'image',
      caption: String(text),
      media: validImageUrl
    }
  } : {
    number: number,
    text: String(text)
  };

  console.log([Bot] Dispatching to ${endpoint}. Valid image: ${!!validImageUrl});
  const response = await axios.post(url, payload, {
    headers: { apikey: EVOLUTION_API_KEY },
    timeout: 15000
  });
  return response.data;
}

// ─── Backend Pipeline Integration Helpers (Manus REST Endpoints) ─────────────
async function syncLeadState(phone, updates = {}) {
  try {
    const res = await axios.post(${BRANDSIGNL_URL}/api/wa-lead, { phone, ...updates }, { timeout: 10000 });
    return res.data;
  } catch (err) {
    console.error('[Backend API] Lead Sync Error:', err.message);
    return null;
  }
}

async function getLivePreview(niche, lang) {
  try {
    const res = await axios.get(${BRANDSIGNL_URL}/api/wa-preview, {
      params: { niche, lang },
      timeout: 15000
    });
    return res.data;
  } catch (err) {
    console.error('[Backend API] Preview Fetch Error:', err.message);
    return null;
  }
}

// ─── Sales Funnel Copy Templates ─────────────────────────────────────────────
function buildEducationalLesson(lang) {
  if (lang === 'pt') {
    return \n\n---\n💡 *Lição de Redes Sociais:* Postar fotos normais do salão traz visualizações, mas NÃO traz clientes. O algoritmo fica confuso. Nosso Pacote de 6 Posts usa layouts de "intenção de compra" para forçar a Meta a entender que sua página significa agendamentos!\n\n +
           👉 *Garanta seus 6 posts por apenas R$30 no Pix:* https://pay.hotmart.com/W105949535S;
  }
  return \n\n---\n💡 *The Social Media Lesson:* Posting standard salon pictures gets views, but NO calls. Meta gets confused and thinks you want to be an influencer. Our 6-Post Pack uses strict "buyer-intent" layouts to force the algorithm to realize your page means appointments!\n\n +
         👉 *Secure your 6-post package via PayFast for R99 once-off:* https://brandsignl.com/nails/confirm;
}

// ─── Main Webhook Endpoint ────────────────────────────────────────────────────
app.post('/webhook', async (req, res) => {
  res.status(200).send('ok');

  try {
    const body = req.body;
    if (!body || body.event !== 'messages.upsert') return;

    const data = body.data;
    if (!data || !data.key || !data.message) return;
    if (data.key.fromMe === true) return;

    const remoteJid = data.key.remoteJid || '';
    if (remoteJid.endsWith('@g.us')) return;

    // 🧼 FORCE STRIP EVERYTHING EXCEPT RAW NUMERIC DIGITS
    const from = remoteJid.split('@')[0].replace(/\D/g, '').trim();

    const text = (
      (data.message.conversation) ||
      (data.message.extendedTextMessage && data.message.extendedTextMessage.text) ||
      (data.message.imageMessage && data.message.imageMessage.caption) ||
      (data.message.videoMessage && data.message.videoMessage.caption) ||
      ''
    ).trim();

    if (!from || !text) return;

    // 🔒 BULLETPROOF TESTING LOCKDOWN GUARD
    const ALLOWED_TESTER = '27833272007'; 
    
    if (from !== ALLOWED_TESTER) {
      console.log([Webhook] Shield Active: Ignored real customer (${from}) to let Meta AI run safely.);
      return;
    }

    console.log([State Engine] Test interaction allowed for ${from}: "${text}");
    const lang = detectLang(text);

    // Sync with database to fetch the customer's current conversational state
    let stateData = await syncLeadState(from);
    let currentStep = stateData && stateData.lead ? stateData.lead.step : 'new';
    
    console.log([State Engine] User current database step is: [${currentStep}]);

    // Run Conversational State Machine Flow
    if (currentStep === 'new') {
      await syncLeadState(from, { niche: text, step: 'niche_pending' });
      
      const previewAsset = await getLivePreview(text, lang);
      
      let replyMessage = '';
      let targetImageUrl = null;

      if (previewAsset) {
        const hook = previewAsset.hook ? *${previewAsset.hook}*\n\n : '';
        const caption = previewAsset.caption || '';
        const tags = previewAsset.hashtags ? \n\n${previewAsset.hashtags} : '';
        
        replyMessage = ${hook}${caption}${tags}${buildEducationalLesson(lang)};
        targetImageUrl = previewAsset.imageUrl || null;
      } else {
        replyMessage = lang === 'pt' 
          ? Montando seus exemplos para o nicho "${text}"... ✨ + buildEducationalLesson(lang)
          : Creating sample layouts for the "${text}" niche... ✨ + buildEducationalLesson(lang);
      }

      await sendWhatsApp(from, replyMessage, targetImageUrl);
      await syncLeadState(from, { step: 'awaiting_payment' });
      console.log([State Engine] Flow completed. Updated state to: [awaiting_payment]);
    } 
    else if (currentStep === 'awaiting_payment') {
      let ongoingReply = lang === 'pt'
        ? Seu pacote de layouts de alta conversão está reservado!\n\nAssim que o Pix for confirmado, nosso sistema envia seu link de acesso exclusivo instantaneamente aqui no chat.
        : Your buyer-intent pack layouts are reserved!\n\nAs soon as payment completes via PayFast, our delivery system drops your personal access link directly into this chat thread.;
        
      await sendWhatsApp(from, ongoingReply);
      console.log([State Engine] Retained user inside payment loop.);
    }

  } catch (err) {
    console.error('[State Engine Error]:', err.message);
  }
});

// ─── Catch-all routes ────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).send('Not found'));

process.on('uncaughtException', (err) => console.error('[Bot Global] Uncaught:', err.message));
process.on('unhandledRejection', (reason) => console.error('[Bot Global] Rejection:', reason));

app.listen(PORT, '0.0.0.0', () => console.log('SERVER ONLINE ON PORT ' + PORT));
