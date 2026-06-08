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

console.log('ENTRY FILE IS EXECUTING');
console.log('PORT:', PORT);
console.log('EVOLUTION_API_URL:', EVOLUTION_API_URL);
console.log('EVOLUTION_INSTANCE:', EVOLUTION_INSTANCE);
console.log('BRANDSIGNL_URL:', BRANDSIGNL_URL);

// ─── Health endpoints ─────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  console.log('ROOT HIT');
  res.status(200).send('BrandSignl Bot — OK');
});

app.get('/health', (req, res) => {
  console.log('HEALTH HIT');
  res.status(200).send('OK');
});

// ─── Language detection ───────────────────────────────────────────────────────
function detectLang(text) {
  const pt = /\b(oi|olá|ola|bom dia|boa tarde|boa noite|obrigad|quero|preciso|meu|minha|como|você|voce|por favor|ajuda|cabelo|unhas|cílios|sobrancelha|manicure|manicura)\b/i;
  const es = /\b(hola|buenos días|buenas|gracias|quiero|necesito|mi|como|usted|por favor|ayuda|cabello|uñas|pestañas)\b/i;
  if (pt.test(text)) return 'pt';
  if (es.test(text)) return 'es';
  return 'en';
}

// ─── Send WhatsApp message via Evolution API (With Bulletproof Fallback) ──────
async function sendWhatsApp(number, text, imageUrl = null) {
  // Clean & validate imageUrl. If it's empty, null, or a blank string, force it to null
  let validImageUrl = (imageUrl && String(imageUrl).trim() !== '') ? String(imageUrl).trim() : null;

  // Set endpoint based on whether we have a real, usable image URL string
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

  console.log([Bot] Dispatching payload to ${endpoint}. Valid image present: ${!!validImageUrl});
  console.log([Bot] Payload data:, JSON.stringify(payload));

  const response = await axios.post(url, payload, {
    headers: { apikey: EVOLUTION_API_KEY },
    timeout: 15000
  });
  return response.data;
}

// ─── Call BrandSignl post generator ──────────────────────────────────────────
async function generatePost(businessInput, lang) {
  const response = await axios.post(
    ${BRANDSIGNL_URL}/api/wa-generate,
    { businessInput: businessInput, lang: lang },
    { timeout: 30000 }
  );
  return response.data;
}

// ─── Format generated post with Educational Sales Lesson ────────────────────
function formatPost(signal, lang) {
  let captionText = '';
  
  if (typeof signal === 'string') {
    captionText = signal;
  } else if (signal) {
    captionText = signal.caption || signal.text || signal.content || signal.output || '';
    if (signal.hook) {
      captionText = *${signal.hook}*\n\n${captionText};
    }
    if (signal.hashtags) {
      const tags = Array.isArray(signal.hashtags) ? signal.hashtags.join(' ') : signal.hashtags;
      captionText = ${captionText}\n\n${tags};
    }
  }

  if (lang === 'pt') {
    return ${captionText}\n\n---\n +
           💡 *Lição de Redes Sociais:* Postar fotos normais do salão traz visualizações, mas NÃO traz clientes. O algoritmo da Meta fica confuso e acha que você quer ser influenciadora. Nosso Pacote de 6 Posts usa layouts de "intenção de compra" para treinar a Meta e trazer agendamentos!\n\n +
           👉 *Garanta seus 6 posts por apenas R$30 no Pix:* https://pay.hotmart.com/W105949535S;
  }

  return ${captionText}\n\n---\n +
         💡 *The Social Media Lesson:* Posting standard salon pictures gets views, but NO calls. Meta gets confused and thinks you want to be an influencer. Our 6-Post Pack uses strict "buyer-intent" layouts to force the algorithm to realize your page means appointments!\n\n +
         👉 *Secure your 6-post package via PayFast for R99 once-off:* https://brandsignl.com/nails/confirm;
}

// ─── Fallback reply when generator fails ─────────────────────────────────────
function fallbackReply(lang) {
  if (lang === 'pt') {
    return Oi! Me diz qual é o seu nicho (ex: manicure, cílios) para eu gerar seu post!\n\n +
           💡 Fotos comuns trazem curtidas, mas não trazem clientes. Quer pular os testes e pegar os 6 layouts de alta conversão direto no Pix?\n +
           👉 Acesse: https://pay.hotmart.com/W105949535S;
  }
  return Hey! Tell me your niche (e.g. nail tech, lashes) so I can generate your post!\n\n +
         💡 Quick Tip: Casual images get likes, but no calls. Want to skip the testing phase and get the 6 specific layouts that bring direct bookings?\n +
         👉 Get them here for R99: https://brandsignl.com/nails/confirm;
}

// ─── Main webhook endpoint ────────────────────────────────────────────────────
app.post('/webhook', async (req, res) => {
  res.status(200).send('ok');

  try {
    const body = req.body;
    console.log('[Webhook] Event:', body && body.event);

    if (!body || body.event !== 'messages.upsert') return;

    const data = body.data;
    if (!data) return;

    const key = data.key;
    const message = data.message;

    if (!key || !message) return;
    if (key.fromMe === true) return;

    const remoteJid = key.remoteJid || '';
    if (remoteJid.endsWith('@g.us')) return;

    const from = remoteJid.split('@')[0];
    const text = (
      (message.conversation) ||
      (message.extendedTextMessage && message.extendedTextMessage.text) ||
      (message.imageMessage && message.imageMessage.caption) ||
      (message.videoMessage && message.videoMessage.caption) ||
      ''
    ).trim();

    if (!from || !text) {
      console.log('[Webhook] Skipped — no from or no text');
      return;
    }

    // 🔒 TESTING LOCKDOWN GUARD
    const ALLOWED_TESTER = '27833272007'; 
    if (from !== ALLOWED_TESTER) {
      console.log([Webhook] Ignored message from production user (${from}) to avoid disrupting Meta AI.);
      return;
    }

    console.log('[Bot] PROCESSED TEST RUN from ' + from + ': ' + text);
    const lang = detectLang(text);
    console.log('[Bot] Detected language:', lang);

    let reply;
    let targetImageUrl = null;
    
    try {
      const signal = await generatePost(text, lang);
      reply = formatPost(signal, lang);
      
      // Look inside the signal object for an image URL link under common keys
      if (signal) {
        targetImageUrl = signal.imageUrl || signal.image || signal.mediaUrl || signal.url || null;
      }
      
      console.log('[Bot] Post generated successfully');
    } catch (genErr) {
      const errMsg = genErr.response ? JSON.stringify(genErr.response.data) : genErr.message;
      console.error('[Bot] Generator error:', errMsg);
      reply = fallbackReply(lang);
    }

    await sendWhatsApp(from, reply, targetImageUrl);
    console.log('[Bot] Reply sent to ' + from);

  } catch (err) {
    const errMsg = err.response ? JSON.stringify(err.response.data) : err.message;
    console.error('[Bot] Webhook processing error:', errMsg);
  }
});

// ─── Catch-all for unknown routes ─────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).send('Not found');
});

// ─── Global uncaught exception guard ─────────────────────────────────────────
process.on('uncaughtException', (err) => {
  console.error('[Bot] Uncaught exception (server stays up):', err.message);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Bot] Unhandled rejection (server stays up):', reason);
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log('SERVER STARTED ON PORT ' + PORT);
});
