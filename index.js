require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;
const EVOLUTION_URL = process.env.EVOLUTION_URL;
const EVOLUTION_KEY = process.env.EVOLUTION_KEY;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE;
const OPENAI_KEY = process.env.OPENAI_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Simple greetings - no template strings, no errors
const GREETINGS = {
  en: "Hi! I'm the BrandSignl assistant.\n\nI'll create a custom social media post for your business - free.\n\nWhat type of business do you have? (e.g. nail tech, hair stylist, lash tech, waxing, makeup artist)",
  pt: "Oi! Sou o assistente BrandSignl.\n\nVou criar um post de redes sociais personalizado para o seu negocio - gratis.\n\nQual e o seu tipo de negocio? (ex: manicure, cabelereiro, cilios, depilacao, maquiagem)",
  es: "Hola! Soy el asistente BrandSignl.\n\nVoy a crear un post de redes sociales personalizado para tu negocio - gratis.\n\nQue tipo de negocio tienes? (ej: nail tech, estilista, pestanas, depilacion, maquillaje)"
};

async function sendMessage(to, text) {
  try {
    await axios.post(`${EVOLUTION_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
      number: to,
      textMessage: { text }
    }, {
      headers: { 'apikey': EVOLUTION_KEY }
    });
  } catch (e) {
    console.log('Send error:', e.response?.data || e.message);
  }
}

async function generatePost(businessType, lang) {
  const prompts = {
    en: `Create 1 engaging Instagram caption for a ${businessType} business in Brazil. Keep it under 150 chars, add 3 hashtags, use friendly tone.`,
    pt: `Crie 1 legenda engajadora para Instagram de um negocio de ${businessType} no Brasil. Max 150 caracteres, 3 hashtags, tom amigavel.`,
    es: `Crea 1 caption atractivo para Instagram de un negocio de ${businessType} en Brasil. Max 150 caracteres, 3 hashtags, tono amigable.`
  };

  try {
    const res = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompts[lang] }],
      max_tokens: 200
    }, {
      headers: { 'Authorization': `Bearer ${OPENAI_KEY}` }
    });
    return res.data.choices[0].message.content;
  } catch (e) {
    return lang === 'pt'? 'Ops! Erro ao gerar post. Tente novamente.' : 'Error generating post. Try again.';
  }
}

function detectLang(text) {
  text = text.toLowerCase();
  if (text.includes('oi') || text.includes('ola') || text.includes('negocio')) return 'pt';
  if (text.includes('hola') || text.includes('negocio')) return 'es';
  return 'en';
}

app.post('/webhook', async (req, res) => {
  try {
    const data = req.body;
    if (!data?.data?.key?.remoteJid) return res.sendStatus(200);

    const from = data.data.key.remoteJid.replace('@s.whatsapp.net', '');
    const message = data.data.message?.conversation || data.data.message?.extendedTextMessage?.text || '';
    if (!message) return res.sendStatus(200);

    console.log(`Msg from ${from}: ${message}`);

    // Check if user exists
    const { data: user } = await supabase
     .from('users')
     .select('*')
     .eq('phone', from)
     .single();

    const lang = detectLang(message);

    if (!user) {
      // New user - save and send greeting
      await supabase.from('users').insert([{ phone: from, stage: 'greeting' }]);
      await sendMessage(from, GREETINGS[lang]);
    } else if (user.stage === 'greeting') {
      // User replied with business type - generate post
      await supabase.from('users').update({ stage: 'generated', business_type: message }).eq('phone', from);

      const waitingMsg = lang === 'pt'? 'Gerando seu post personalizado... aguarde 5s' : 'Generating your custom post... wait 5s';
      await sendMessage(from, waitingMsg);

      const post = await generatePost(message, lang);
      await sendMessage(from, post);

      const upsell = lang === 'pt'
       ? '\n\nQuer 6 posts como esse por R$29? Responda SIM pra receber via Pix'
        : '\n\nWant 6 posts like this for R$29? Reply YES for Pix payment';
      await sendMessage(from, upsell);
    }

    res.sendStatus(200);
  } catch (e) {
    console.log('Webhook error:', e);
    res.sendStatus(200);
  }
});

app.get('/', (req, res) => res.send('Bot running'));
app.listen(PORT, () => console.log(`SERVER STARTED ON PORT ${PORT}`));
