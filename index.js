'use strict';

const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const EVOLUTION_URL = (process.env.EVOLUTION_URL || '').replace(/\/$/, '');
const EVOLUTION_KEY = process.env.EVOLUTION_KEY || '';
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || '';
const BRANDSIGNL_URL = (process.env.BRANDSIGNL_URL || 'https://brandsignl.com').replace(/\/$/, '');

console.log('ENTRY FILE IS EXECUTING');
console.log('EVOLUTION_URL:', EVOLUTION_URL);
console.log('EVOLUTION_INSTANCE:', EVOLUTION_INSTANCE);
console.log('BRANDSIGNL_URL:', BRANDSIGNL_URL);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  console.log('ROOT HIT');
  res.status(200).send('BrandSignl Bot — OK');
});

app.get('/health', (req, res) => {
  console.log('HEALTH HIT');
  res.status(200).send('OK');
});

// ─── Detect language from message text ────────────────────────────────────────
function detectLang(text) {
  const pt = /\b(oi|olá|ola|bom dia|boa tarde|boa noite|obrigad|quero|preciso|meu|minha|como|você|voce|por favor|ajuda|cabelo|unhas|cílios|sobrancelha)\b/i;
  const es = /\b(hola|buenos días|buenas|gracias|quiero|necesito|mi|como|usted|por favor|ayuda|cabello|uñas|pestañas)\b/i;
  if (pt.test(text)) return 'pt';
  if (es.test(text)) return 'es';
  return 'en';
}

// ─── Send a WhatsApp text message via Evolution API ───────────────────────────
async function sendWhatsApp(number, text) {
  // FIX: Add @s.whatsapp.net if missing - Evolution v2 needs full JID
  const jid = number.includes('@')? number : `${number}@s.whatsapp.net`;
  const url = `${EVOLUTION_URL}/message/sendText/${EVOLUTION_INSTANCE}`;

  console.log('[Bot] Sending to:', jid, 'Text length:', String(text).length);

  await axios.post(
    url,
    { number: jid, text: String(text || "Hi!") },
    { headers: { apikey: EVOLUTION_KEY } }
  );
}

// ─── Call BrandSignl generator ────────────────────────────────────────────────
async function generatePost(businessInput, lang) {
  const response = await axios.post(
    `${BRANDSIGNL_URL}/api/wa-generate`,
    { businessInput: businessInput, lang: lang },
    { timeout: 30000 }
  );
  return response.data;
}

// ─── Format post for WhatsApp ─────────────────────────────────────────────────
function formatPost(signal, lang) {
  const hook = signal.hook || '';
  const caption = signal.caption || '';
  const hashtags = Array.isArray(signal.hashtags)? signal.hashtags.join(' ') : (signal.hashtags || '');

  if (lang === 'pt') {
    return `*${hook}*\n\n${caption}\n\n${hashtags}\n\n---\n_Quer mais posts como esse? Acesse brandsignl.com/pilot_`;
  }
  if (lang === 'es') {
    return `*${hook}*\n\n${caption}\n\n${hashtags}\n\n---\n_¿Quieres más posts? Visita brandsignl.com/pilot_`;
  }
  return `*${hook}*\n\n${caption}\n\n${hashtags}\n\n---\n_Want more posts like this? Visit brandsignl.com/pilot_`;
}

// ─── Webhook handler ──────────────────────────────────────────────────────────
app.post('/webhook', async (req, res) => {
  // Reply 200 IMMEDIATELY — prevents Evolution API retry storms
  res.status(200).send('ok');

  try {
    const body = req.body;

    // Only handle incoming messages
    if (body.event!== 'messages.upsert') return;

    const key = body.data && body.data.key;
    const message = body.data && body.data.message;

    if (!key ||!message) return;

    // Skip messages sent BY the bot (fromMe = true)
    if (key.fromMe === true) return;

    const remoteJid = key.remoteJid || '';
    // Strip @s.whatsapp.net or @g.us suffix to get digits
    const from = remoteJid.split('@')[0];

    // Extract text from all common message types
    const text = (
      (message.conversation) ||
      (message.extendedTextMessage && message.extendedTextMessage.text) ||
      (message.imageMessage && message.imageMessage.caption) ||
      ''
    ).trim();

    if (!from ||!text) return;

    console.log('[Bot] From ' + from + ': ' + text);

    const lang = detectLang(text);

    // Generate post using BrandSignl /api/wa-generate
    let reply;
    try {
      const signal = await generatePost(text, lang);
      reply = formatPost(signal, lang);
    } catch (genErr) {
      console.error('[Bot] Generator error:', genErr.response? genErr.response.data : genErr.message);
      // Fallback reply so the user always gets a response
      if (lang === 'pt') {
        reply = 'Oi! Tive um probleminha aqui. Me diz qual é o seu nicho (ex: manicure, cabelereiro, cílios) e eu te mando um post!';
      } else if (lang === 'es') {
        reply = '¡Hola! Tuve un problema. Dime tu nicho (ej: manicura, peluquería, pestañas) y te envío un post.';
      } else {
        reply = "Hey! Something went wrong on my end. Tell me your niche (e.g. nail tech, hair stylist, lashes) and I'll send you a post!";
      }
    }

    await sendWhatsApp(from, reply);
    console.log('[Bot] Sent reply to ' + from);

  } catch (err) {
    console.error('[Bot] Webhook error:', err.response? err.response.data : err.message);
  }
});

// ─── Start server ─────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log('SERVER STARTED ON PORT ' + PORT);
});
