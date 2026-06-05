require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const EVOLUTION_URL = process.env.EVOLUTION_URL;
const EVOLUTION_KEY = process.env.EVOLUTION_KEY;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE;
const OPENAI_KEY = process.env.OPENAI_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Simple memory for conversation state
const userStates = {};

// Evolution API send message - FIXED FORMAT
async function sendMessage(phone, text) {
  // Safety check: never send empty text
  if (!text || text.trim() === '') {
    text = "Sorry, something went wrong. Please type 'hi' again.";
  }
  
  console.log('Sending to WhatsApp:', text);
  
  try {
    await axios.post(
      `${EVOLUTION_URL}/message/sendText/${EVOLUTION_INSTANCE}`,
      {
        number: phone,
        textMessage: { text: text } // ← Evolution needs this exact format
      },
      {
        headers: { 
          apikey: EVOLUTION_KEY,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('[Bot] Message sent successfully');
  } catch (error) {
    console.error('[Bot] sendMessage failed:', error.response?.data || error.message);
  }
}

// Generate Instagram post with OpenAI
async function generatePost(niche) {
  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [{
          role: 'user',
          content: `Create an engaging Instagram post for a ${niche} business. Include caption with emojis, 5-7 hashtags, and call to action.`
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
    return `🔥 New post idea for ${niche}!\n\nBoost your ${niche} business with amazing content!\n\nDM us to get started 🚀\n\n#${niche} #business #marketing #growth #viral`;
  }
}

// Webhook from Evolution API
app.post('/webhook', async (req, res) => {
  try {
    const data = req.body;
    console.log('[Webhook] Received event:', data.event);
    
    if (data.event!== 'messages.upsert') return res.sendStatus(200);
    
    const message = data.data;
    const phone = message.key.remoteJid.split('@')[0];
    const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const pushName = message.pushName || 'User';
    
    console.log(`[Webhook] Processing: from=${phone} pushName="${pushName}" text="${text}"`);
    
    // Initialize user state
    if (!userStates[phone]) {
      userStates[phone] = { step: 'welcome', niche: null };
    }
    
    const state = userStates[phone];
    console.log(`[Bot] Message from ${phone} | step=${state.step} | text="${text}"`);
    
    // Bot logic
    if (text.toLowerCase() === 'hi' || text.toLowerCase() === 'hello') {
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
    res.sendStatus(500);
  }
});

app.get('/', (req, res) => {
  res.send('Bot is running! ✅');
});

app.listen(PORT, () => {
  console.log(`SERVER STARTED ON PORT ${PORT}`);
});
