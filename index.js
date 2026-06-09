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

console.log('STARTUP: Multi-Language Multi-Step Engine Live');

// ─── Health check routes ──────────────────────────────────────────────────────
app.get('/', (req, res) => res.status(200).send('BrandSignl Bot — OK'));
app.get('/health', (req, res) => res.status(200).send('OK'));

// ─── Language detection helper ────────────────────────────────────────────────
function detectLang(text) {
  const pt = /\b(oi|olá|ola|bom dia|boa tarde|boa noite|obrigad|quero|preciso|meu|minha|como|você|voce|por favor|ajuda|cabelo|unhas|cílios|sobrancelha|manicure|manicura|unhas)\b/i;
  if (pt.test(text)) return 'pt';
  return 'en';
}

// ─── Send WhatsApp message via Evolution API ──────────────────────────────────
async function sendWhatsApp(number, text, imageUrl = null) {
  try {
    let validImageUrl = (imageUrl && String(imageUrl).trim() !== '') ? String(imageUrl).trim() : null;
    
    if (validImageUrl && validImageUrl.includes('.comnull/')) {
      validImageUrl = validImageUrl.replace('.comnull/', '.com/');
    }

    const endpoint = validImageUrl ? 'message/sendMedia' : 'message/sendText';
    const url = EVOLUTION_API_URL + '/' + endpoint + '/' + EVOLUTION_INSTANCE;
    
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
    console.error('Bot Dispatch Error: ' + err.message);
    return null;
  }
}

// ─── Backend API Connectors ───────────────────────────────────────────────────
async function syncLeadState(phone, updates = {}) {
  try {
    const url = BRANDSIGNL_URL + '/api/wa-lead';
    const res = await axios.post(url, { phone, ...updates }, { timeout: 10000 });
    return res.data;
  } catch (err) {
    console.error('Backend API Sync Error: ' + err.message);
    return null;
  }
}

async function getLivePreview(niche, brandName, brandPhone) {
  try {
    const url = BRANDSIGNL_URL + '/api/wa-preview';
    const res = await axios.get(url, {
      params: { niche, businessName: brandName, businessPhone: brandPhone },
      timeout: 15000
    });
    return res.data;
  } catch (err) {
    console.error('Backend API Preview Error: ' + err.message);
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

    // 🔒 STRICT INBOUND LOCKDOWN GUARD (Only your number gets past)
    const ALLOWED_TESTER = '27833272007'; 
    if (from !== ALLOWED_TESTER) {
      return; 
    }

    console.log('Engine Test Execution: Processing text for sender ' + from + ' - Text: ' + text);

    let stateData = await syncLeadState(from);
    let currentStep = stateData && stateData.lead ? stateData.lead.step : 'new';
    
    // Maintain language choice across state loops inside the session pipeline
    let userLang = stateData && stateData.lead && stateData.lead.lang ? stateData.lead.lang : detectLang(text);
    
    const inputLower = text.toLowerCase();
    
    // Check if the user is triggering a fresh start keyword
    if (inputLower === 'reset' || inputLower === 'restart' || inputLower === 'nails' || inputLower === 'unhas' || inputLower === 'hair' || inputLower === 'cabelo' || inputLower === 'lashes') {
      currentStep = 'new';
      userLang = detectLang(text); // Re-detect language specifically based on the entry keyword used
    }

    // ─── 5-STEP FUNNEL LOGIC MAP ─────────────────────────────────────────────
    
    // Step 1: Qualification Gate
    if (currentStep === 'new') {
      // Force database to explicitly update state properties and track language locale
      await syncLeadState(from, { step: 'qualify_pending', lang: userLang });
      
      const msg = (userLang === 'pt') 
        ? "Você é um profissional da beleza buscando mais clientes?\n\n1. Sim\n2. Apenas navegando"
        : "Are you a beauty professional looking for more clients?\n\n1. Yes\n2. Just browsing";
        
      await sendWhatsApp(from, msg);
      return;
    }
    
    // Step 2: Niche Picker
    if (currentStep === 'qualify_pending') {
      if (text === '2') {
        const msg = (userLang === 'pt') 
          ? "Sem problemas! Nos avise se mudar de ideia mais tarde." 
          : "No problem! Let us know if things change.";
        await sendWhatsApp(from, msg);
        await syncLeadState(from, { step: 'new' });
      } else {
        await syncLeadState(from, { step: 'niche_pending' });
        const msg = (userLang === 'pt')
          ? "Excelente! Qual é o seu nicho?\n\n1. Unhas\n2. Cabelo\n3. Cílios"
          : "What's your niche?\n\n1. Nails\n2. Hair\n3. Lashes";
        await sendWhatsApp(from, msg);
      }
      return;
    }
    
    // Step 3: Brand Metadata Capture
    if (currentStep === 'niche_pending') {
      let activeNiche = 'nails';
      if (text === '2') activeNiche = 'hair';
      if (text === '3') activeNiche = 'lashes';

      await syncLeadState(from, { niche: activeNiche, step: 'branding_pending' });
      
      const msg = (userLang === 'pt')
        ? "Para criarmos sua amostra, por favor envie o Nome da sua Empresa e o Número de Contato."
        : "To give you a sample please give us business name and contact no.";
        
      await sendWhatsApp(from, msg);
      return;
    }
    
    // Step 4: Overlaid Image Delivery & Feedback Request
    if (currentStep === 'branding_pending') {
      const segments = text.includes(',') ? text.split(',') : [text, ''];
      const salonName = segments[0] ? segments[0].trim() : "My Salon";
      const salonPhone = segments[1] ? segments[1].trim() : from;

      const workingMsg = (userLang === 'pt')
        ? "Gerando o layout do seu post personalizado agora... ⚡"
        : "Generating your custom branded sample post now... ⚡";
      await sendWhatsApp(from, workingMsg);

      const currentNiche = stateData && stateData.lead ? stateData.lead.niche : 'nails';
      const previewAsset = await getLivePreview(currentNiche, salonName, salonPhone);
      
      let imageCaption = (userLang === 'pt') ? "Aqui está o layout do seu post personalizado!" : "Here is your custom sample layout!";
      let remoteImgUrl = null;

      if (previewAsset) {
        let titleHook = '';
        if (previewAsset.hook) {
          titleHook = '' + previewAsset.hook + ' \n\n';
        }
        const bodyMsg = previewAsset.caption || '';
        imageCaption = titleHook + bodyMsg;
        remoteImgUrl = previewAsset.imageUrl || null;
      }

      await sendWhatsApp(from, imageCaption, remoteImgUrl);
      
      const satisfactionMsg = (userLang === 'pt')
        ? "Você gostou desse post?\n\n1. Sim\n2. Não"
        : "Are you happy with this post?\n\n1. Yes\n2. No";
      await sendWhatsApp(from, satisfactionMsg);
      
      await syncLeadState(from, { step: 'satisfaction_pending' });
      return;
    }
    
    // Step 5: Packaging Selection & Checkout Link Close
    if (currentStep === 'satisfaction_pending') {
      await syncLeadState(from, { step: 'package_pending' });
      
      const msg = (userLang === 'pt')
        ? "Você prefere o Pacote de 6 posts ou o Pacote de 20 posts?\n\n1. 6 Posts\n2. 20 Posts"
        : "Do you want 6 posts or 20 posts?\n\n1. 6 Posts\n2. 20 Posts";
      await sendWhatsApp(from, msg);
      return;
    }
    
    if (currentStep === 'package_pending') {
      let linkTarget = "https://brandsignl.com/nails/confirm";
      let chosenLabel = "6 Posts";
      
      if (text === '2') {
        linkTarget = "https://brandsignl.com/nails/premium-bundle";
        chosenLabel = "20 Posts";
      }

      // If user is accessing via Portuguese paths, map to your Hotmart link structures
      if (userLang === 'pt') {
        linkTarget = (text === '2') ? "https://pay.hotmart.com/W105949535S?checkoutMode=10" : "https://pay.hotmart.com/W105949535S";
        chosenLabel = (text === '2') ? "20 Posts" : "6 Posts";
      }

      const closeMsg = (userLang === 'pt')
        ? "Perfeito! Seu pacote de " + chosenLabel + " está reservado.\n\n👉 Conclua seu pagamento seguro via Pix aqui:\n" + linkTarget
        : "Perfect! Your package for " + chosenLabel + " is reserved.\n\n👉 Complete checkout here:\n" + linkTarget;

      await sendWhatsApp(from, closeMsg);
      await syncLeadState(from, { step: 'awaiting_payment' });
      return;
    }
    
    // Fallback Loop Protection
    if (currentStep === 'awaiting_payment') {
      const lockMsg = (userLang === 'pt')
        ? "Seu pedido está reservado com segurança! Assim que o Pix for confirmado, seu link de acesso exclusivo será enviado direto aqui neste chat."
        : "Your order is securely reserved. Once checkout completes, your layout link drops here.";
      await sendWhatsApp(from, lockMsg);
      return;
    }

  } catch (err) {
    console.error('Webhook Loop Error: ' + err.message);
  }
});

app.use((req, res) => res.status(404).send('Not found'));

process.on('uncaughtException', (err) => console.error('Bot Global Exception: ' + err.message));
process.on('unhandledRejection', (reason) => console.error('Bot Global Rejection: ' + reason));

app.listen(PORT, '0.0.0.0', () => console.log('SERVER READY ON PORT ' + PORT));
