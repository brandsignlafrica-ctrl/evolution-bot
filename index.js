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

console.log('STARTUP: Qualification State Engine Online');

// ─── Health check routes ──────────────────────────────────────────────────────
app.get('/', (req, res) => res.status(200).send('BrandSignl Staging Bot — OK'));
app.get('/health', (req, res) => res.status(200).send('OK'));

// ─── Send WhatsApp message via Evolution API ──────────────────────────────────
async function sendWhatsApp(number, text, imageUrl = null) {
  try {
    let validImageUrl = (imageUrl && String(imageUrl).trim() !== '') ? String(imageUrl).trim() : null;
    
    if (validImageUrl && validImageUrl.includes('.comnull/')) {
      validImageUrl = validImageUrl.replace('.comnull/', '.com/');
    }

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

    const response = await axios.post(url, payload, {
      headers: { apikey: EVOLUTION_API_KEY },
      timeout: 15000
    });
    return response.data;
  } catch (err) {
    console.error('[Bot Dispatch Error]:', err.message);
    return null;
  }
}

// ─── Backend API Connectors ───────────────────────────────────────────────────
async function syncLeadState(phone, updates = {}) {
  try {
    const res = await axios.post(${BRANDSIGNL_URL}/api/wa-lead, { phone, ...updates }, { timeout: 10000 });
    return res.data;
  } catch (err) {
    console.error('[Backend API Sync Error]:', err.message);
    return null;
  }
}

async function getLivePreview(niche, brandName, brandPhone) {
  try {
    const res = await axios.get(${BRANDSIGNL_URL}/api/wa-preview, {
      params: { niche, businessName: brandName, businessPhone: brandPhone },
      timeout: 15000
    });
    return res.data;
  } catch (err) {
    console.error('[Backend API Preview Error]:', err.message);
    return null;
  }
}

// ─── Webhook Router ───────────────────────────────────────────────────────────
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

    const from = remoteJid.split('@')[0].replace(/\D/g, '').trim();
    const text = (
      (data.message.conversation) ||
      (data.message.extendedTextMessage && data.message.extendedTextMessage.text) ||
      (data.message.imageMessage && data.message.imageMessage.caption) ||
      (data.message.videoMessage && data.message.videoMessage.caption) ||
      ''
    ).trim();

    if (!from || !text) return;

    // 🔒 STRICT INBOUND LOCKDOWN GUARD
    const ALLOWED_TESTER = '27833272007'; 
    if (from !== ALLOWED_TESTER) {
      return; // Drops execution instantly for production users
    }

    console.log([Engine Test Execution] Running sequence for ${from}: "${text}");

    let stateData = await syncLeadState(from);
    let currentStep = stateData && stateData.lead ? stateData.lead.step : 'new';
    
    const inputLower = text.toLowerCase();
    if (inputLower === 'reset' || inputLower === 'restart' || inputLower === 'nails') {
      currentStep = 'new';
    }

    // ─── 5-STEP FUNNEL LOGIC MAP ─────────────────────────────────────────────
    
    // Step 1: Qualification Gate
    if (currentStep === 'new') {
      await syncLeadState(from, { step: 'qualify_pending' });
      await sendWhatsApp(from, "Are you a beauty professional looking for more clients?\n\n1. Yes\n2. Just browsing");
    }
    
    // Step 2: Niche Picker
    else if (currentStep === 'qualify_pending') {
      if (text === '2') {
        await sendWhatsApp(from, "No problem! Let us know if you change your mind.");
        await syncLeadState(from, { step: 'new' });
      } else {
        await syncLeadState(from, { step: 'niche_pending' });
        await sendWhatsApp(from, "What's your niche?\n\n1. Nails\n2. Hair\n3. Lashes");
      }
    }
    
    // Step 3: Brand Metadata Capture
    else if (currentStep === 'niche_pending') {
      let activeNiche = 'nails';
      if (text === '2') activeNiche = 'hair';
      if (text === '3') activeNiche = 'lashes';

      await syncLeadState(from, { niche: activeNiche, step: 'branding_pending' });
      await sendWhatsApp(from, "To give you a sample please give us business name and contact no.");
    }
    
    // Step 4: Overlaid Image Delivery & Feedback Request
    else if (currentStep === 'branding_pending') {
      const segments = text.includes(',') ? text.split(',') : [text, ''];
      const salonName = segments[0] ? segments[0].trim() : "My Salon";
      const salonPhone = segments[1] ? segments[1].trim() : from;

      await sendWhatsApp(from, "Generating your custom branded sample post now... ⚡");

      const currentNiche = stateData && stateData.lead ? stateData.lead.niche : 'nails';
      const previewAsset = await getLivePreview(currentNiche, salonName, salonPhone);
      
      let imageCaption = "Here is your custom sample layout!";
      let remoteImgUrl = null;

      if (previewAsset) {
        const titleHook = previewAsset.hook ? *${previewAsset.hook}*\n\n : '';
        const bodyMsg = previewAsset.caption || '';
        imageCaption = ${titleHook}${bodyMsg};
        remoteImgUrl = previewAsset.imageUrl || null;
      }

      await sendWhatsApp(from, imageCaption, remoteImgUrl);
      await sendWhatsApp(from, "Are you happy with this post?\n\n1. Yes\n2. No");
      await syncLeadState(from, { step: 'satisfaction_pending' });
    }
    
    // Step 5: Packaging Selection & Checkout Link Close
    else if (currentStep === 'satisfaction_pending') {
      await syncLeadState(from, { step: 'package_pending' });
      await sendWhatsApp(from, "Do you want 6 posts or 20 posts?\n\n1. 6 Posts\n2. 20 Posts");
    }
    
    else if (currentStep === 'package_pending') {
      let linkTarget = "https://brandsignl.com/nails/confirm";
      let chosenLabel = "6 Posts";
      
      if (text === '2') {
        linkTarget = "https://brandsignl.com/nails/premium-bundle";
        chosenLabel = "20 Posts";
      }

      await sendWhatsApp(from, Perfect! Your package for ${chosenLabel} is reserved.\n\n👉 Complete checkout here:\n${linkTarget});
      await syncLeadState(from, { step: 'awaiting_payment' });
    }
    
    else if (currentStep === 'awaiting_payment') {
      await sendWhatsApp(from, "Your order is securely reserved. Once checkout completes, your layout link drops here.");
    }

  } catch (err) {
    console.error('[Webhook Loop Error]:', err.message);
  }
});

app.use((req, res) => res.status(404).send('Not found'));

process.on('uncaughtException', (err) => console.error('[Bot Global Exception]:', err.message));
process.on('unhandledRejection', (reason) => console.error('[Bot Global Rejection]:', reason));

app.listen(PORT, '0.0.0.0', () => console.log('SERVER READY ON PORT ' + PORT));
