require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;
const EVOLUTION_URL = process.env.EVOLUTION_URL;
const EVOLUTION_KEY = process.env.EVOLUTION_KEY;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE;
const OPENAI_KEY = process.env.OPENAI_KEY;

const userStates = {};

const GREETINGS = {
  en: "Hi! 👋 I'm the BrandSignl AI Bot.\n\nWhat type of business do you have? Ex: nail salon, restaurant, gym",
  pt: "Olá! 👋 Eu sou o Bot IA da BrandSignl.\n\nQue tipo de negócio você tem? Ex: salão, restaurante, academia"
};

// BULLETPROOF sendMessage for Evolution API
async function sendMessage(to, text) {
  // Force to string, never undefined/null
  text = String(text || "Sorry, type 'hi' again");
  
  console.log('[Bot] Sending to WhatsApp:', text.substring(0, 50));
  
  try {
    const payload = {
      number: to,
      textMessage: { 
        text: text // Evolution API requires textMessage.text
      }
    };

    await axios.post(
      `${EVOLUTION_URL}/message/sendText/${EVOLUTION_INSTANCE}`,
      payload,
      { 
        headers: { 
          apikey: EVOLUTION_KEY,
          'Content-Type': 'application/json' 
        }
      }
    );
    console.log('[Bot] Message sent OK');
  } catch (error) {
    console.error('[Bot] sendMessage failed:', error.response?.data || error.message);
  }
}

async function generatePost(niche) {
  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [{
          role: 'user',
          content: `Create an engaging Instagram post caption for a ${niche} business in South Africa. Include emojis, call to action, and 5-7 hashtags. Keep under 200 words.`
        }],
        max_tokens: 300
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('OpenAI error:', error.response?.data || error.message);
    return `🔥 Post idea for ${niche}!\n\nBoost your ${niche} business today!\n\nDM us to get started 🚀\n\n#${niche.replace(/\s/g, '')} #business #marketing #viral #ZA`;
  }
}

// Webhook endpoint for Evolution API
app.post('/webhook', async (req, res) => {
  try {
    const data = req.body;
    console.log('[Webhook] Received event:', data.event);
    
    if (data.event!== 'messages.upsert') return res.sendStatus(200);
    if (data.data.key.fromMe) return res.sendStatus(200);
    
    const message = data.data;
    const phone = message.key.remoteJid.split('@')[0];
    const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const pushName = message.pushName || 'User';
    
    console.log(`[Webhook] Processing: from=${phone} pushName="${pushName}" text="${text}"`);
    
    if (!text) return res.sendStatus(200);
    
    if (!userStates[phone]) {
      userStates[phone] = { step: 'welcome', niche: null, lang: 'en' };
    }
    
    const state = userStates[phone];
    console.log(`[Bot] Message from ${phone} | step=${state.step} | text="${text}"`);
    
    if (text.toLowerCase() === 'hi' || text.toLowerCase() === 'hello' || text.toLowerCase() === 'oi') {
      state.step = 'awaiting_niche';
      await sendMessage(phone, `Hi ${pushName}! 👋 Welcome to AI Content Bot!\n\nWhat type of business do you have? Ex: nail salon, restaurant, gym, boutique`);
    }
    else if (state.step === 'awaiting_niche') {
      state.niche = text;
      state.step = 'generating';
      await sendMessage(phone, `Perfect! Generating Instagram post for your ${text} business... ⏳`);
      
      const post = await generatePost(text);
      await sendMessage(phone, post);
      
      await sendMessage(phone, `Want another post? Just type your business type again!`);
      state.step = 'awaiting_niche';
    }
    else {
      await sendMessage(phone, `Type 'hi' to start! I can create Instagram posts for any business type.`);
    }
    
    res.sendStatus(200);
  } catch (error) {
    console.error('Webhook error:', error);
    res.sendStatus(200);
  }
});

app.get('/', (req, res) => {
  res.send('BrandSignl AI Bot is running! ✅');
});

app.listen(PORT, () => {
  console.log(`SERVER STARTED ON PORT ${PORT}`);
});
