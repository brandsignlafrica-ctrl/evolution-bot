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

console.log('ENTRY FILE EXECUTING — NEW STEP ENGINE ACTIVE');

// ─── Health endpoints ─────────────────────────────────────────────────────────
app.get('/', (req, res) => res.status(200).send('BrandSignl Micro-Funnel — OK'));
app.get('/health', (req, res) => res.status(200).send('OK'));

// ─── Send WhatsApp message via Evolution API ──────────────────────────────────
async function sendWhatsApp(number, text, imageUrl = null) {
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

    console.log([Micro-Funnel] Incoming test message from ${from}: "${text}");

    // Fetch or start their step tracking history
    let stateData = await syncLeadState(from);
    let currentStep = stateData && stateData.lead ? stateData.lead.step : 'new';
    
    // Reset trigger to easily re-test the sequence anytime
    if (text.toLowerCase() === 'reset' || text.toLowerCase() === 'nails' || text.toLowerCase() === 'unhas') {
      currentStep = 'new';
    }

    // ─── STEP FLOW MACHINE ───────────────────────────────────────────────────
    
    if (currentStep === 'new') {
      await syncLeadState(from, { step: 'qualify_pending' });
      await sendWhatsApp(from, "Are you a beauty professional looking for more clients?\n\n1. Yes, looking for clients\n2. Just browsing");
    }
    
    else if (currentStep === 'qualify_pending') {
      if (text === '2') {
        await sendWhatsApp(from, "No problem! Let us know if you change your mind later.");
        await syncLeadState(from, { step: 'new' });
      } else {
        await syncLeadState(from, { step: 'niche_pending' });
        await sendWhatsApp(from, "Great! What is your niche?\n\n1. Nails\n2. Hair\n3. Lashes");
      }
    }
    
    else if (currentStep === 'niche_pending') {
      let selectedNiche = 'nails';
      if (text === '2') selectedNiche = 'hair';
      if (text === '3') selectedNiche = 'lashes';

      // Save niche and bump state to collect brand names
      await syncLeadState(from, { niche: selectedNiche, step: 'branding_pending' });
      await sendWhatsApp(from, "To generate your custom sample, what is your Business Name and Contact Number?\n\nReply in this format: Salon Name, Phone Number");
    }
    
    else if (currentStep === 'branding_pending') {
      // Split the text comma to capture name vs phone
      const parts = text.split(',');
      const bizName = parts[0] ? parts[0].trim() : "My Salon";
      const bizPhone = parts[1] ? parts[1].trim() : from;

      await sendWhatsApp(from, "Generating your custom branded preview post now... ⚡");

      // Pull current niche tag stored in DB
      const storedNiche = stateData && stateData.lead ? stateData.lead.niche : 'nails';
      
      // Request custom branded preview image block from backend
      const previewAsset = await getLivePreview(storedNiche, bizName, bizPhone);
      
      let replyMessage = "Here is your branded sample post layout!";
      let targetImageUrl = null;

      if (previewAsset) {
        const hook = previewAsset.hook ? *${previewAsset.hook}*\n\n : '';
        const caption = previewAsset.caption || '';
        replyMessage = ${hook}${caption};
        targetImageUrl = previewAsset.imageUrl || null;
      }

      // Send image with short caption
      await sendWhatsApp(from, replyMessage, targetImageUrl);
      
      // Follow up with option gate
      await sendWhatsApp(from, "Are you happy with this post?\n\n1. Yes\n2. No");
      await syncLeadState(from, { step: 'satisfaction_pending' });
    }
    
    else if (currentStep === 'satisfaction_pending') {
      await syncLeadState(from, { step: 'package_pending' });
      await sendWhatsApp(from, "Awesome! Do you want a 6-Post Pack or a 20-Post Pack?\n\n1. 6 Posts (R99)\n2. 20 Posts (R249)");
    }
    
    else if (currentStep === 'package_pending') {
      let checkoutLink = "https://brandsignl.com/nails/confirm"; // Default 6 pack link
      let selectedPack = "6 Posts";
      
      if (text === '2') {
        checkoutLink = "https://brandsignl.com/nails/premium-bundle"; // 20 pack link
        selectedPack = "20 Posts";
      }

      let paymentMessage = Perfect! Your layout package for ${selectedPack} is reserved.\n\n👉 Complete your secure PayFast checkout here:\n${checkoutLink};
      
      await sendWhatsApp(from, paymentMessage);
      await syncLeadState(from, { step: 'awaiting_payment' });
    }
    
    else if (currentStep === 'awaiting_payment') {
      await sendWhatsApp(from, "Your order is securely reserved. Once payment is completed, your final package download page link drops right here.");
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
