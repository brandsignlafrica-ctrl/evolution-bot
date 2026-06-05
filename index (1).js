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

// ─── Send WhatsApp message via Evolution API ──────────────────────────────────
async function sendWhatsApp(number, text) {
  const url = `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`;
  const response = await axios.post(
    url,
    { number: number, text: String(text) },
    {
      headers: { apikey: EVOLUTION_API_KEY },
      timeout: 15000
    }
  );
  return response.data;
}

// ─── Call BrandSignl post generator ──────────────────────────────────────────
async function generatePost(businessInput, lang) {
  const response = await axios.post(
    `${BRANDSIGNL_URL}/api/wa-generate`,
    { businessInput: businessInput, lang: lang },
    { timeout: 30000 }
  );
  return response.data;
}

// ─── Format generated post for WhatsApp ──────────────────────────────────────
function formatPost(signal, lang) {
  const hook = signal.hook || '';
  const caption = signal.caption || '';
  const hashtags = Array.isArray(signal.hashtags)
    ? signal.hashtags.join(' ')
    : (signal.hashtags || '');

  const cta = {
    pt: '_Quer mais posts? Acesse brandsignl.com/pilot_',
    es: '_¿Quieres más posts? Visita brandsignl.com/pilot_',
    en: '_Want more posts? Visit brandsignl.com/pilot_'
  };

  return `*${hook}*\n\n${caption}\n\n${hashtags}\n\n---\n${cta[lang] || cta.en}`;
}

// ─── Fallback reply when generator fails ─────────────────────────────────────
function fallbackReply(lang) {
  if (lang === 'pt') return 'Oi! Me diz qual é o seu nicho (ex: manicure, cabelereiro, cílios) e eu te mando um post!';
  if (lang === 'es') return '¡Hola! Dime tu nicho (ej: manicura, peluquería, pestañas) y te envío un post.';
  return "Hey! Tell me your niche (e.g. nail tech, hair stylist, lashes) and I'll send you a post!";
}

// ─── Main webhook endpoint ────────────────────────────────────────────────────
app.post('/webhook', async (req, res) => {
  // CRITICAL: Return 200 IMMEDIATELY — Evolution retries on anything else
  res.status(200).send('ok');

  try {
    const body = req.body;

    // Log raw event type for debugging
    console.log('[Webhook] Event:', body && body.event);

    // Only process incoming messages
    if (!body || body.event !== 'messages.upsert') return;

    const data = body.data;
    if (!data) return;

    const key = data.key;
    const message = data.message;

    if (!key || !message) return;

    // Skip messages sent BY the bot to prevent echo loops
    if (key.fromMe === true) return;

    // Skip group messages
    const remoteJid = key.remoteJid || '';
    if (remoteJid.endsWith('@g.us')) return;

    // Extract sender number (strip @s.whatsapp.net)
    const from = remoteJid.split('@')[0];

    // Extract text from all common message types
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

    console.log('[Bot] From ' + from + ': ' + text);

    const lang = detectLang(text);
    console.log('[Bot] Detected language:', lang);

    let reply;
    try {
      const signal = await generatePost(text, lang);
      reply = formatPost(signal, lang);
      console.log('[Bot] Post generated successfully');
    } catch (genErr) {
      const errMsg = genErr.response ? JSON.stringify(genErr.response.data) : genErr.message;
      console.error('[Bot] Generator error:', errMsg);
      reply = fallbackReply(lang);
    }

    await sendWhatsApp(from, reply);
    console.log('[Bot] Reply sent to ' + from);

  } catch (err) {
    const errMsg = err.response ? JSON.stringify(err.response.data) : err.message;
    console.error('[Bot] Webhook processing error:', errMsg);
    // Do NOT re-throw — server must stay alive
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
