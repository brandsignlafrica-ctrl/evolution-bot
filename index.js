'use strict';

/**
 * BrandSignl WhatsApp Bot — Stage 1
 * Fixed: sendMessage now uses 'text' field for Evolution API v2
 */

const express = require('express');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

console.log("ENTRY FILE IS EXECUTING");

// ─── Config ──────────────────────────────────

const EVOLUTION_URL = process.env.EVOLUTION_API_URL || '';
const EVOLUTION_KEY = process.env.EVOLUTION_API_KEY || '';
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || 'brandsignl';
const BRANDSIGNL_URL = process.env.BRANDSIGNL_URL || 'https://brandsignl.com';
const OWNER_NUMBER = process.env.BOT_OWNER_NUMBER || '';

// ─── In-memory session store ──────────────────────────────────────────────────
const sessions = new Map();

// ─── Niche keyword detection ──────────────────────────────────────────────────
function detectNiche(text) {
  const t = text.toLowerCase();
  if (/nail|unha|acr[iy]l|gel|manicur/.test(t)) return 'nails';
  if (/lash|c[ií]li|ext.*lash|lash.*ext/.test(t)) return 'lashes';
  if (/hair|cabelo|salon|sal[oã]o|color|colour|braid|trança/.test(t)) return 'hair';
  if (/wax|depil|sugar/.test(t)) return 'waxing';
  if (/makeup|maquiagem|makeover|maquilla/.test(t)) return 'makeup';
  return null;
}

// ─── Language detection ───────────────────────────────────────────────────────
function detectLang(text) {
  const t = text.toLowerCase();
  if (/\b(oi|olá|ola|obrigad|quero|meu|minha|não|sim|agenda|clientes)\b/.test(t)) return 'pt';
  if (/\b(hola|quiero|mi |gracias|clientes|agenda|no |sí)\b/.test(t)) return 'es';
  return 'en';
}

// ─── Evolution API helpers ────────────────────────────────────────────────────
async function sendMessage(to, text) {
  if (!EVOLUTION_URL ||!EVOLUTION_KEY) {
    console.warn('[Bot] EVOLUTION_API_URL or EVOLUTION_API_KEY not set — skipping send');
    return;
  }
  const url = `${EVOLUTION_URL}/message/sendText/${EVOLUTION_INSTANCE}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_KEY },
      body: JSON.stringify({
        number: to,
        text: text,
        options: { delay: 1000 }
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error('[Bot] sendMessage failed:', res.status, body);
    } else {
      console.log('[Bot] Message sent successfully to', to);
    }
  } catch (err) {
    console.error('[Bot] sendMessage error:', err.message);
  }
}

// ─── BrandSignl generator API call ───────────────────────────────────────────
async function generatePost(businessInput, lang = 'en') {
  const url = `${BRANDSIGNL_URL}/api/wa-generate`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessInput, lang }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error('[Bot] generatePost failed:', res.status, body);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error('[Bot] generatePost error:', err.message);
    return null;
  }
}

// ─── Conversation flow ────────────────────────────────────────────────────────
const GREETINGS = {
  en: (name) => `Hi${name? ' ' + name : ''}! 👋 I'm the BrandSignl assistant.\n\nI'll create a custom social media post for your business — *free*.\n\nWhat type of business do you have? (e.g. nail tech, hair stylist, lash tech, waxing, makeup artist)`,
  pt: (name) => `Oi${name? ' + name : ''}! 👋 Sou o assistente BrandSignl.\n\nVou criar um post de redes sociais personalizado para o seu negócio — *grátis*.\n\nQual é o seu tipo de negócio? (ex: manicure, cabelereiro, cílios, depilação, maquiagem)`,
  es: (name) => `¡Hola${name? ' + name : ''}! 👋 Soy el asistente BrandSignl.\n\nVoy a crear un post de redes sociales personalizado para tu negocio — *gratis*.\n\nQué tipo de negocio tienes? (ej: nail tech, estilista, pestañas, depilación, maquillaje)`,
};

const GENERATING = {
  en: '⏳ Generating your custom post... (takes ~10 seconds)',
  pt: '⏳ Gerando seu post personalizado... (leva ~10 segundos)',
  es: '⏳ Generando tu post personalizado... (toma ~10 segundos)',
};

const ERROR_MSG = {
  en: '😕 Sorry, something went wrong generating your post. Please try again in a moment.',
  pt: '😕 Desculpe, algo deu errado ao gerar seu post. Por favor, tente novamente em instantes.',
  es: '😕 Lo siento, algo salió mal al generar tu post. Por favor, inténtalo de nuevo en un momento.',
};

const RESULT_HEADER = {
  en: (biz) => `✅ Here's your custom post${biz? ' for *' + biz + '*' : ''}:\n\n`,
  pt: (biz) => `✅ Aqui está seu post personalizado${biz? ' para *' + biz + '*' : ''}:\n\n`,
  es: (biz) => `✅ Aquí está tu post personalizado${biz? ' para *' + biz + '*' : ''}:\n\n`,
};

const RESULT_FOOTER = {
  en: '\n\n📲 Want 6 posts like this? Reply *YES* or visit: ' + BRANDSIGNL_URL + '/pilot',
  pt: '\n\n📲 Quer 6 posts assim? Responda *SIM* ou acesse: ' + BRANDSIGNL_URL + '/pilot',
  es: '\n\n📲 ¿Quieres 6 posts así? Responde *SÍ* o visita: ' + BRANDSIGNL_URL + '/pilot',
};

// ─── Manual override: if owner sends "PAUSA <number>", pause that session ─────
function checkOwnerCommand(from, text) {
  if (from!== OWNER_NUMBER && from!== OWNER_NUMBER + '@s.whatsapp.net') return false;
  const match = text.match(/^PAUSA\s+(\d+)/i);
  if (match) {
    const target = match[1];
    const session = sessions.get(target) || {};
    sessions.set(target, {...session, paused: true });
    console.log('[Bot] Owner paused session for:', target);
    return true;
  }
  const resumeMatch = text.match(/^RESUME\s+(\d+)/i);
  if (resumeMatch) {
    const target = resumeMatch[1];
    const session = sessions.get(target) || {};
    sessions.set(target, {...session, paused: false });
    console.log('[Bot] Owner resumed session for:', target);
    return true;
  }
  return false;
}

// ─── Main message handler ─────────────────────────────────────────────────────
async function handleMessage(from, text, pushName) {
  const phone = from.replace('@s.whatsapp.net', '').replace(/\D/g, '');

  if (checkOwnerCommand(phone, text)) return;

  const session = sessions.get(phone) || { step: 'welcome', lang: 'en' };

  if (session.paused) {
    console.log('[Bot] Session paused for:', phone, '— skipping auto-reply');
    return;
  }

  const lang = session.lang || detectLang(text) || 'en';
  session.lang = lang;
  session.lastSeen = Date.now();

  console.log(`[Bot] Message from ${phone} | step=${session.step} | lang=${lang} | text="${text.slice(0, 60)}"`);

  if (session.step === 'welcome') {
    session.step = 'awaiting_niche';
    sessions.set(phone, session);
    await sendMessage(from, GREETINGS[lang](pushName));
    return;
  }

  if (session.step === 'awaiting_niche') {
    const niche = detectNiche(text);
    if (!niche) {
      const retry = {
        en: "I didn't catch that. Please tell me your business type (e.g. nail tech, hair stylist, lash tech, waxing, makeup artist).",
        pt: "Não entendi. Por favor, diga o tipo do seu negócio (ex: manicure, cabelereiro, cílios, depilação, maquiagem).",
        es: "No entendí. Por favor dime tu tipo de negocio (ej: nail tech, estilista, pestañas, depilación, maquillaje).",
      };
      await sendMessage(from, retry[lang]);
      return;
    }

    session.niche = niche;
    session.businessName = pushName || '';
    session.businessInput = text.trim();
    session.step = 'generating';
    sessions.set(phone, session);

    await sendMessage(from, GENERATING[lang]);

    const post = await generatePost(session.businessInput, lang);

    if (!post ||!post.caption) {
      session.step = 'awaiting_niche';
      sessions.set(phone, session);
      await sendMessage(from, ERROR_MSG[lang]);
      if (OWNER_NUMBER) {
        await sendMessage(OWNER_NUMBER, `⚠️ Post generation failed for ${phone} (${session.businessInput})`);
      }
      return;
    }

    const header = RESULT_HEADER[lang](session.businessName);
    const footer = RESULT_FOOTER[lang];
    const hooks = post.hooks? post.hooks.slice(0, 2).join('\n') : (post.hook || '');
    const caption = post.caption || '';
    const hashtags = Array.isArray(post.hashtags)? post.hashtags.join(' ') : '';

    const reply = `${header}*Hook:*\n${hooks}\n\n*Caption:*\n${caption}\n\n*Hashtags:*\n${hashtags}${footer}`;

    session.step = 'delivered';
    sessions.set(phone, session);

    await sendMessage(from, reply);

    if (OWNER_NUMBER) {
      await sendMessage(OWNER_NUMBER, `✅ Post sent to ${phone} (${session.businessInput}) [${lang}]`);
    }
    return;
  }

  if (session.step === 'delivered') {
    const t = text.toLowerCase().trim();
    if (/^(yes|sim|sí|si|yeah|yep|oui|ja)$/.test(t)) {
      const upsell = {
        en: `🎉 Great! Get your 6 custom posts here:\n${BRANDSIGNL_URL}/pilot\n\nAny questions? Just reply here.`,
        pt: `🎉 Ótimo! Pegue seus 6 posts personalizados aqui:\n${BRANDSIGNL_URL}/pilot\nDúvidas? É só responder aqui.`,
        es: `🎉 ¡Genial! Obtén tus 6 posts personalizados aquí:\n${BRANDSIGNL_URL}/pilot\nPreguntas? Solo responde aquí.`,
      };
      await sendMessage(from, upsell[lang]);
    } else {
      session.step = 'awaiting_niche';
      sessions.set(phone, session);
      const restart = {
        en: 'Want another post for a different business? Just tell me your business type again.',
        pt: 'Quer outro post para um negócio diferente? É só me dizer o tipo do seu negócio novamente.',
        es: '¿Quieres otro post para un negocio diferente? Solo dime tu tipo de negocio nuevamente.',
      };
      await sendMessage(from, restart[lang]);
    }
    return;
  }

  session.step = 'awaiting_niche';
  sessions.set(phone, session);
  await sendMessage(from, GREETINGS[lang](pushName));
}

// ─── Routes ───────────────────────────────────
app.get('/', (req, res) => {
  console.log("ROOT HIT");
  res.status(200).send("BrandSignl WhatsApp Bot — running");
});

app.get('/health', (req, res) => {
  console.log("HEALTH HIT");
  res.status(200).json({ status: 'ok', sessions: sessions.size });
});

app.post('/webhook', async (req, res) => {
  res.status(200).json({ received: true });

  try {
    const body = req.body;
    console.log('[Webhook] Received event:', body?.event, '| instance:', body?.instance);

    if (body?.event!== 'messages.upsert') return;

    const messages = body?.data?.messages || (body?.data? [body.data] : []);

    for (const msg of messages) {
      if (msg?.key?.fromMe) continue;
      const from = msg?.key?.remoteJid || '';
      if (from.includes('@g.us')) continue;

      const text =
        msg?.message?.conversation ||
        msg?.message?.extendedTextMessage?.text ||
        msg?.message?.buttonsResponseMessage?.selectedDisplayText ||
        '';

      if (!text.trim()) continue;

      const pushName = msg?.pushName || '';

      console.log(`[Webhook] Processing: from=${from} pushName="${pushName}" text="${text.slice(0, 80)}"`);

      handleMessage(from, text, pushName).catch(err => {
        console.error('[Bot] handleMessage error:', err.message);
      });
    }
  } catch (err) {
    console.error('[Webhook] Parse error:', err.message);
  }
});

app.get('/sessions', (req, res) => {
  const data = {};
  for (const [phone, session] of sessions.entries()) {
    data[phone] = {...session, lastSeen: new Date(session.lastSeen || 0).toISOString() };
  }
  res.json(data);
});

app.post('/reset/:phone', (req, res) => {
  const phone = req.params.phone;
  sessions.delete(phone);
  res.json({ reset: phone });
});

// ─── Start ────────────────────────────────────
const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`SERVER STARTED ON PORT ${PORT}`);
  console.log(`Evolution instance: ${EVOLUTION_INSTANCE}`);
  console.log(`BrandSignl URL: ${BRANDSIGNL_URL}`);
  console.log(`Owner number: ${OWNER_NUMBER || '(not set)'}`);
});
