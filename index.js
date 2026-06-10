import express from 'express';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

// Configuration Constants
const EVOLUTION_API_URL = 'https://evolution-api-production-53a9.up.railway.app';
const API_KEY = 'FDE3646665F6-4E47-A279-A6BECE1C3D5D';
const INSTANCE_NAME = 'Brandsignl Main V4';
const ALLOWED_TESTER = '27833272007@s.whatsapp.net'; // Your personal testing WhatsApp JID

/**
 * 1. FORCE-BIND WEBHOOK ON STARTUP
 * Tells Evolution API exactly where to route inbound messages
 */
const encodedInstance = encodeURIComponent(INSTANCE_NAME);
fetch(${EVOLUTION_API_URL}/webhook/instance/${encodedInstance}, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': API_KEY
  },
  body: JSON.stringify({
    url: 'https://evolution-bot-production.up.railway.app/webhook',
    enabled: true,
    webhookByEvents: true,
    events: [
      'MESSAGES_UPSERT',
      'CONNECTION_UPDATE'
    ]
  })
})
.then(response => response.json())
.then(data => {
  if (data.status === 400 || data.error) {
    console.error('❌ FORCE-BIND FAILED:', data);
  } else {
    console.log('✅ FORCE-BIND SUCCESS:', data);
  }
})
.catch(error => console.error('💥 FORCE-BIND NETWORK ERROR:', error));


/**
 * 2. INBOUND WEBHOOK ROUTE
 * Handles all background events routed from Evolution API
 */
app.post('/webhook', async (req, res) => {
  try {
    const { event, data } = req.body;

    // Acknowledge receipt immediately back to Evolution API to prevent retries
    res.status(200).send({ status: 'received' });

    // Filter out background noise (like contact or presence syncs)
    if (event !== 'MESSAGES_UPSERT') {
      return; 
    }

    console.log(INBOUND WEBHOOK -> Event: ${event} | Instance: ${INSTANCE_NAME});

    // Structure safeguard: Ensure data object exists and isn't from the bot itself
    if (!data || !data.key) return;
    if (data.key.fromMe === true) return; 

    // Extract who sent the message
    const remoteJid = data.key.remoteJid;

    // Security gate: Ensure only your specific test number can execute processing
    if (remoteJid !== ALLOWED_TESTER) {
      console.log(❌ BLOCK: Sender (${remoteJid}) did not match ALLOWED_TESTER. Dropping message.);
      return;
    }

    // Safely extract the inbound message text string from Evolution API v2 payload structure
    const incomingText = data.message?.conversation || 
                         data.message?.extendedTextMessage?.text || 
                         "";

    console.log(📩 Processing message from tester [${remoteJid}]: "${incomingText}");

    // --- YOUR BOT RESPONDING LOGIC GOES HERE ---
    if (incomingText.toLowerCase().trim() === 'ping') {
      await sendWhatsAppText(remoteJid, 'Pong! 🚀 Bot engine is fully operational.');
    } else {
      await sendWhatsAppText(remoteJid, Received your message: "${incomingText}");
    }

  } catch (err) {
    console.error('💥 Webhook runtime processor crashed:', err);
  }
});


/**
 * 3. OUTBOUND API HELPER
 * Sends text payloads back to the user via Evolution API
 */
async function sendWhatsAppText(toJid, textContent) {
  try {
    const response = await fetch(${EVOLUTION_API_URL}/message/sendText/${encodedInstance}, {
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
    console.log(📤 Reply dispatched status:, result.status || 'Sent');
  } catch (error) {
    console.error('❌ Failed to push outbound reply:', error);
  }
}

// Start up engine listener
app.listen(PORT
