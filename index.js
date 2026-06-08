[17:11, 6/8/2026] Tyronne: 'use strict';

const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json({ limit: '5mb' }));

const PORT = process.env.PORT || 8080;
const EVOLUTION_API_URL = (process.env.EVOLUTION_API_URL || '').replace(/\/$/, '');
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '';
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || '';
const BRANDSIGNL_URL = (process.env.BRANDSIGNL_URL || 'https://brandsignl.com').replace(/\/$/, '');

console.log('ENTRY FILE EXECUTING — BLANK SLATE CLEAN RUN');

// ─── Health endpoints ─────────────────────────────────────────────────────────
app.get('/', (req, res) => res.status(200).send('BrandSignl Funnel — OK'));
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

    console.log([Bot] Dispatching ${endpoint} to ${number});
    const response = await axios.post(url, payload, {
      headers: { apikey: EVOLUTION_API_KEY },
      timeout: 15000
    });
    return response.data;
  } catch (err) {
    console.error('[Bot WhatsApp Dispatch Error]:', err.message);
    return null;
  }
}

// ─── Backend Pipeline Integration Helpers ─────────────────────────────────────
async function syncLeadState(phone, updates = {}) {
  try {
    const res = await axios.post(${BRANDSIGNL_URL}/api/wa-lead, { phone, ...updates }, { timeout: 10000 });
    return res.data;
  } catch (err) {
    console.error('[Backend API] State Sync Error:', err.message);
    return null;
  }
}

async function getLivePreview(niche, brandName, brandPhone) {
  try {
    const res = await axios.get(${BRANDSIGNL_URL}/api/wa-preview, {
      params: { 
        niche: niche,
        businessName: brandName,
        businessPhone: brandPhone
      },
      timeout: 15000
    });
    return res.data;
  } catch (err) {
    console.error('[Backend API] Preview Fetch Error:', err.message);
    return null;
  }
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

    const from = remoteJid.split('@')[0].replace(/\D/g, '').trim();
    const text = (
      (data.message.conversation) ||
      (data.message.extendedTextMessage && data.message.extendedTextMessage.text) ||
      (data.message.imageMessage && data.message.imageMessage.caption) ||
      (data.message.videoMessage && data.message.videoMessage.caption) ||
      ''
    ).trim();

    if (!from || !text) return;

    // 🔒 TESTING LOCKDOWN GUARD
    const ALLOWED_TESTER = '27833272007'; 
    if (from !== ALLOWED_TESTER) return;

    console.log([Micro-Funnel] Message from tester: "${text}");

    // Sync state map
    let stateData = await syncLeadState(from);
    let currentStep = stateData && stateData.lead ? stateData.lead.step : 'new';
    
    const lowerText = text.toLowerCase();
    if (lowerText === 'reset' || lowerText === 'restart' || lowerText === 'nails') {
      currentStep = 'new';
    }

    // ─── STEPS ENGINE RUNNER ─────────────────────────────────────────────────
    
    // Step 1: Qualification Gate
    if (currentStep === 'new') {
      await syncLeadState(from, { step: 'qualify_pending' });
      await sendWhatsApp(from, "Are you a beauty professional looking for more clients?\n\n1. Yes\n2. Just browsing");
    }
    
    // Step 2: Niche Selector
    else if (currentStep === 'qualify_pending') {
      if (text === '2') {
        await sendWhatsApp(from, "No problem! Let us know if things change.");
        await syncLeadState(from, { step: 'new' });
      } else {
        await syncLeadState(from, { step: 'niche_pending' });
        await sendWhatsApp(from, "What's your niche?\n\n1. Nails\n2. Hair\n3. Lashes");
      }
    }
    
    // Step 3: Brand Details Intake
    else if (currentStep === 'niche_pending') {
      let mappedNiche = 'nails';
      if (text === '2') mappedNiche = 'hair';
      if (text === '3') mappedNiche = 'lashes';

      await syncLeadState(from, { niche: mappedNiche, step: 'branding_pending' });
      await sendWhatsApp(from, "To give you a sample please give us business name and contact no.");
    }
    
    // Step 4: Live Branded Preview Generation & Delivery
    else if (currentStep === 'branding_pending') {
      const parts = text.includes(',') ? text.split(',') : [text, ''];
      const bizName = parts[0] ? parts[0].trim() : "My Salon";
      const bizPhone = parts[1] ? parts[1].trim() : from;

      await sendWhatsApp(from, "Generating your custom branded sample post now... ⚡");

      const activeNiche = stateData && stateData.lead ? stateData.lead.niche : 'nails';
      const previewAsset = await getLivePreview(activeNiche, bizName, bizPhone);
      
      let captionText = "Here is your branded sample post layout!";
      let targetImageUrl = null;

      if (previewAsset) {
        const hook = previewAsset.hook ? *${previewAsset.hook}*\n\n : '';
        const bodyContent = previewAsset.caption || '';
        captionText = ${hook}${bodyContent};
        targetImageUrl = previewAsset.imageUrl || null;
      }

      await sendWhatsApp(from, captionText, targetImageUrl);
      await sendWhatsApp(from, "Are you happy with this post?\n\n1. Yes\n2. No");
      await syncLeadState(from, { step: 'satisfaction_pending' });
    }
    
    // Step 5: Package Choice & Call-To-Action Close
    else if (currentStep === 'satisfaction_pending') {
      await syncLeadState(from, { step: 'package_pending' });
      await sendWhatsApp(from, "Do you want 6 posts or 20 posts?\n\n1. 6 Posts\n2. 20 Posts");
    }
    
    else if (currentStep === 'package_pending') {
      let checkoutLink = "https://brandsignl.com/nails/confirm";
      let packageSelection = "6 Posts";
      
      if (text === '2') {
        checkoutLink = "https://brandsignl.com/nails/premium-bundle";
        packageSelection = "20 Posts";
      }

      await sendWhatsApp(from, Perfect! Your package for ${packageSelection} is reserved.\n\n👉 Complete checkout here:\n${checkoutLink});
      await syncLeadState(from, { step: 'awaiting_payment' });
    }
    
    else if (currentStep === 'awaiting_payment') {
      await sendWhatsApp(from, "Your order is securely reserved. Once checkout completes, your layout link drops here.");
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
[18:06, 6/8/2026] Tyronne: // ─── Main Webhook Endpoint ────────────────────────────────────────────────────
app.post('/webhook', async (req, res) => {
  // Always answer the webhook immediately to keep Evolution API happy
  res.status(200).send('ok');

  try {
    const body = req.body;
    if (!body || body.event !== 'messages.upsert') return;

    const data = body.data;
    if (!data || !data.key || !data.message) return;
    if (data.key.fromMe === true) return;

    const remoteJid = data.key.remoteJid || '';
    if (remoteJid.endsWith('@g.us')) return;

    // Extract numbers, strip any non-numeric characters completely
    const from = remoteJid.split('@')[0].replace(/\D/g, '').trim();
    const text = (
      (data.message.conversation) ||
      (data.message.extendedTextMessage && data.message.extendedTextMessage.text) ||
      (data.message.imageMessage && data.message.imageMessage.caption) ||
      (data.message.videoMessage && data.message.videoMessage.caption) ||
      ''
    ).trim();

    if (!from || !text) return;

    // 🔒 REVERSED POSITIVE MATCH GUARD
    const ALLOWED_TESTER = '27833272007'; 
    
    // Explicit condition: If it doesn't match your exact number, KILL the process.
    if (from !== ALLOWED_TESTER) {
      // Log it so you can see exactly how the client numbers look in the console
      console.log([SHIELD BLOCKED] Prevented leak to production user: "${from}");
      return;
    }

    // From this point forward, ONLY your testing device can execute code
    console.log([Micro-Funnel] Match confirmed. Processing tester ${from}: "${text}");
    const lang = detectLang(text);

    // Sync state map
    let stateData = await syncLeadState(from);
    let currentStep = stateData && stateData.lead ? stateData.lead.step : 'new';
    
    const lowerText = text.toLowerCase();
    if (lowerText === 'reset' || lowerText === 'restart' || lowerText === 'nails') {
      currentStep = 'new';
    }

    // ─── STEPS ENGINE RUNNER ─────────────────────────────────────────────────
    
    // Step 1: Qualification Gate
    if (currentStep === 'new') {
      await syncLeadState(from, { step: 'qualify_pending' });
      await sendWhatsApp(from, "Are you a beauty professional looking for more clients?\n\n1. Yes\n2. Just browsing");
    }
    
    // Step 2: Niche Selector
    else if (currentStep === 'qualify_pending') {
      if (text === '2') {
        await sendWhatsApp(from, "No problem! Let us know if things change.");
        await syncLeadState(from, { step: 'new' });
      } else {
        await syncLeadState(from, { step: 'niche_pending' });
        await sendWhatsApp(from, "What's your niche?\n\n1. Nails\n2. Hair\n3. Lashes");
      }
    }
    
    // Step 3: Brand Details Intake
    else if (currentStep === 'niche_pending') {
      let mappedNiche = 'nails';
      if (text === '2') mappedNiche = 'hair';
      if (text === '3') mappedNiche = 'lashes';

      await syncLeadState(from, { niche: mappedNiche, step: 'branding_pending' });
      await sendWhatsApp(from, "To give you a sample please give us business name and contact no.");
    }
    
    // Step 4: Live Branded Preview Generation & Delivery
    else if (currentStep === 'branding_pending') {
      const parts = text.includes(',') ? text.split(',') : [text, ''];
      const bizName = parts[0] ? parts[0].trim() : "My Salon";
      const bizPhone = parts[1] ? parts[1].trim() : from;

      await sendWhatsApp(from, "Generating your custom branded sample post now... ⚡");

      const activeNiche = stateData && stateData.lead ? stateData.lead.niche : 'nails';
      const previewAsset = await getLivePreview(activeNiche, bizName, bizPhone);
      
      let captionText = "Here is your branded sample post layout!";
      let targetImageUrl = null;

      if (previewAsset) {
        const hook = previewAsset.hook ? *${previewAsset.hook}*\n\n : '';
        const bodyContent = previewAsset.caption || '';
        captionText = ${hook}${bodyContent};
        targetImageUrl = previewAsset.imageUrl || null;
      }

      await sendWhatsApp(from, captionText, targetImageUrl);
      await sendWhatsApp(from, "Are you happy with this post?\n\n1. Yes\n2. No");
      await syncLeadState(from, { step: 'satisfaction_pending' });
    }
    
    // Step 5: Package Choice & Call-To-Action Close
    else if (currentStep === 'satisfaction_pending') {
      await syncLeadState(from, { step: 'package_pending' });
      await sendWhatsApp(from, "Do you want 6 posts or 20 posts?\n\n1. 6 Posts\n2. 20 Posts");
    }
    
    else if (currentStep === 'package_pending') {
      let checkoutLink = "https://brandsignl.com/nails/confirm";
      let packageSelection = "6 Posts";
      
      if (text === '2') {
        checkoutLink = "https://brandsignl.com/nails/premium-bundle";
        packageSelection = "20 Posts";
      }

      await sendWhatsApp(from, Perfect! Your package for ${packageSelection} is reserved.\n\n👉 Complete checkout here:\n${checkoutLink});
      await syncLeadState(from, { step: 'awaiting_payment' });
    }
    
    else if (currentStep === 'awaiting_payment') {
      await sendWhatsApp(from, "Your order is securely reserved. Once checkout completes, your layout link drops here.");
    }

  } catch (err) {
    console.error('[State Engine Error]:', err.message);
  }
});
