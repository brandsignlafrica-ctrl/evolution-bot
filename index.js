import express from 'express';

const app = express();
app.use(express.json());

// 🚨 THE RADAR: Catches all traffic
app.use((req, res, next) => {
  console.log('📡 [RADAR] Incoming ' + req.method + ' request to ' + req.path);
  next();
});

const PORT = process.env.PORT || 8080;

const EVOLUTION_API_URL = 'https://evolution-api-production-53a9.up.railway.app';
const API_KEY = 'FDE3646665F6-4E47-A279-A6BECE1C3D5D';
const INSTANCE_NAME = 'Brandsignl Main V4';
const ALLOWED_TESTER = '27833272007@s.whatsapp.net';

/**
 * 1. FORCE-BIND WEBHOOK
 */
const encodedInstance = encodeURIComponent(INSTANCE_NAME);
const bindUrl = EVOLUTION_API_URL + '/webhook/set/' + encodedInstance;

fetch(bindUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'apikey': API_KEY },
  body: JSON.stringify({
    webhook: {
      enabled: true,
      url: 'https://evolution-bot-production.up.railway.app/webhook',
      byEvents: false,
      base64: false,
      events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE']
    }
  })
})
.then(res => res.json())
.then(data => console.log('✅ FORCE-BIND SUCCESS:', data))
.catch(err => console.error('💥 FORCE-BIND ERROR:', err));

/**
 * 2. INBOUND WEBHOOK ROUTE (VERBOSE DEBUGGING)
 */
app.post('/webhook', async (req, res) => {
  console.log('📡 [RADAR] Received POST request to /webhook');
  
  try {
    const { event, data } = req.body;
    console.log('📦 Payload received. Event:', event);

    res.status(200).send({ status: 'received' });

    if ((event || '').toUpperCase() !== 'MESSAGES_UPSERT') {
      console.log('⚠️ Skipping non-message event:', event);
      return; 
    }

    console.log('🔍 Data structure:', typeof data, Array.isArray(data) ? 'Array' : 'Object');

    if (!data) {
      console.log('🛑 DROPPED: Data payload is undefined!');
      return;
    }

    const messageData = Array.isArray(data) ? data[0] : data;

    if (!messageData.key) {
      console.log('🛑 DROPPED: No key found in message data:', JSON.stringify(messageData));
      return;
    }

    const remoteJid = messageData.key.remoteJid;
    console.log('👤 Sender JID:', remoteJid);

    if (remoteJid !== ALLOWED_TESTER) {
      console.log('❌ BLOCK: Sender did not match allowed tester. Got:', remoteJid);
      return;
    }

    const incomingText = messageData.message?.conversation || 
                         messageData.message?.extendedTextMessage?.text || 
                         "";

    console.log('📩 Final text to process:', incomingText);

    if (incomingText.toLowerCase().trim() === 'ping') {
      await sendWhatsAppText(remoteJid, 'Pong! 🚀 Bot engine is fully operational.');
    } else {
      await sendWhatsAppText(remoteJid, 'Received your message: ' + incomingText);
    }

  } catch (err) {
    console.error('💥 CRITICAL Webhook error:', err);
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
      headers: { 'Content-Type': 'application/json', 'apikey': API_KEY },
      body: JSON.stringify({
        number: toJid,
        options: { delay: 1200, presence: 'composing' },
        textMessage: { text: textContent }
      })
    });
    console.log('📤 Reply dispatched!');
  } catch (error) {
    console.error('❌ Failed to push outbound reply:', error);
  }
}

app.listen(PORT, () => {
  console.log('STARTUP: Live Production Engine Online (With Tracking Lights)');
  console.log('SERVER READY ON PORT ' + PORT);
});
