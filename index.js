import express from 'express';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

// Configuration Constants
const EVOLUTION_API_URL = 'https://evolution-api-production-53a9.up.railway.app';
const API_KEY = 'FDE3646665F6-4E47-A279-A6BECE1C3D5D';
const INSTANCE_NAME = 'Brandsignl Main V4';
const ALLOWED_TESTER = '27833272007@s.whatsapp.net';

/**
 * 1. FORCE-BIND WEBHOOK ON STARTUP
 * Evolution API v2.2+ strict NestJS payload structure requires the 'webhook' object wrapper
 */
const encodedInstance = encodeURIComponent(INSTANCE_NAME);
const bindUrl = EVOLUTION_API_URL + '/webhook/set/' + encodedInstance;

fetch(bindUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': API_KEY
  },
  body: JSON.stringify({
    webhook: {
      enabled: true,
      url: 'https://evolution-bot-production.up.railway.app/webhook',
      byEvents: false,
      base64: false,
      events: [
        'MESSAGES_UPSERT',
        'CONNECTION_UPDATE'
      ]
    }
  })
})
.then(response => response.json())
.then(data => {
  if (data.status === 400 || data.status === 404 || data.error) {
    console.error('❌ FORCE-BIND FAILED:', data);
  } else {
    console.log('✅ FORCE-BIND SUCCESS:', data);
  }
})
.catch(error => console.error('💥 FORCE-BIND NETWORK ERROR:', error));


/**
 * 2. INBOUND WEBHOOK ROUTE
 */
app.post('/webhook', async (req, res) => {
  try {
    const { event, data } = req.body;

    res.status(200).send({ status: 'received' });

    const normalizedEvent = (event || '').toUpperCase();

    if (normalizedEvent !== 'MESSAGES_UPSERT') {
      return; 
    }

    console.log('INBOUND WEBHOOK -> Event: ' + event + ' | Instance: ' + INSTANCE_NAME);

    if (!data || !data.key) return;
    if (data.key.fromMe === true) return; 

    const remoteJid = data.key.remoteJid;

    if (remoteJid !== ALLOWED_TESTER) {
      console.log('❌ BLOCK: Sender (' + remoteJid + ') did not match ALLOWED_TESTER. Dropping message.');
      return;
    }

    const incomingText = data.message?.conversation || 
                         data.message?.extendedTextMessage?.text || 
                         "";

    console.log('📩 Processing message from tester [' + remoteJid + ']: ' + incomingText);

    // --- YOUR BOT RESPONDING LOGIC GOES HERE ---
    if (incomingText.toLowerCase().trim() === 'ping') {
      await sendWhatsAppText(remoteJid, 'Pong! 🚀 Bot engine is fully operational.');
    } else {
      await sendWhatsAppText(remoteJid, 'Received your message: ' + incomingText);
    }

  } catch (err) {
    console.error('💥 Webhook runtime processor crashed:', err);
  }
});


/**
 * 3. OUTBOUND API HELPER
 */
async function sendWhatsAppText(toJid, textContent) {
  try {
    const sendUrl = EVOLUTION_API_URL + '/message/sendText/' + encodedInstance;
    
    const response = await fetch(sendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': API_KEY
      },
      body: JSON.stringify({
        number: toJid,
        options: {
          delay: 1200,
          presence: 'composing'
        },
        textMessage: {
          text: textContent
        }
      })
    });

    const result = await response.json();
    console.log('📤 Reply dispatched status:', result.status || 'Sent');
  } catch (error) {
    console.error('❌ Failed to push outbound reply:', error);
  }
}

app.listen(PORT, () => {
  console.log('STARTUP: Live Production Engine Online (With Tracking Lights)');
  console.log('SERVER READY ON PORT ' + PORT);
});
