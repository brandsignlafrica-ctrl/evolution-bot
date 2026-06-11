import express from 'express';

const app = express();
app.use(express.json());

// 🚨 THE RADAR: Clear visibility on incoming traffic routes
app.use((req, res, next) => {
  console.log('📡 [RADAR] Incoming ' + req.method + ' request to ' + req.path);
  next();
});

// CRITICAL: Railway dynamic platform port binding requirement
const PORT = process.env.PORT || 8080;

// Mapping strictly to your validated Railway Environment Variables
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'https://evolution-api-production-53a9.up.railway.app';
const API_KEY = process.env.EVOLUTION_API_KEY || 'FDE3646665F6-4E47-A279-A6BECE1C3D5D';
const INSTANCE_NAME = process.env.EVOLUTION_INSTANCE || 'Brandsignl Main V4';

// Secure white-list configuration strictly for Tyronne's testing access points
const ALLOWED_PHONE_NUMBER = '27833272007';
const ALLOWED_INTERNAL_LID = '267207145730240'; // From your Evolution API instance metadata payload

const encodedInstance = encodeURIComponent(INSTANCE_NAME);

/**
 * 1. INBOUND WEBHOOK ROUTE
 */
app.post('/webhook', async (req, res) => {
  // Acknowledge receipt instantly to satisfy Evolution API connection timeouts
  res.status(200).send({ status: 'received' });

  try {
    const { event, data } = req.body;

    if ((event || '').toUpperCase() !== 'MESSAGES_UPSERT') {
      return; 
    }

    // Unpack uniform payload whether API sends single object or data wrapper arrays
    const messageData = Array.isArray(data) ? data[0] : data;

    if (!messageData || !messageData.key) return;
    if (messageData.key.fromMe === true) return;

    const remoteJid = messageData.key.remoteJid || '';
    const participant = messageData.key.participant || '';
    
    // SECURITY FILTER: Confirm if it originates from either your number or your system LID token
    const isFromTester = remoteJid.includes(ALLOWED_PHONE_NUMBER) || 
                         participant.includes(ALLOWED_PHONE_NUMBER) ||
                         remoteJid.includes(ALLOWED_INTERNAL_LID) ||
                         participant.includes(ALLOWED_INTERNAL_LID);

    if (!isFromTester) {
      console.log('🔒 SECURITY SHIELD: Stopped potential interaction with a non-test account.');
      return;
    }

    const incomingText = messageData.message?.conversation || 
                         messageData.message?.extendedTextMessage?.text || 
                         "";

    console.log('📩 Verified testing terminal transmitted text payload: "' + incomingText + '"');

    // Default conversational routing rule
    let replyText = 'Oi! Vi sua msg sobre posts pra salão 🌟 Quer ver amostra?';

    // Hotmart link conditions
    if (incomingText.toLowerCase().includes('link') || incomingText.toLowerCase().includes('ping')) {
      replyText = 'R$29 via PIX único: https://pay.hotmart.com/W105949535S?bid=1780424594098\nPaga e manda comprovante que envio 6 posts editados já 👇✨';
    }

    // Execute outbound API dispatch
    await sendWhatsAppText(remoteJid, replyText);

  } catch (err) {
    console.error('💥 Internal execution processing error:', err);
  }
});

/**
 * 2. OUTBOUND DELIVERY API WRAPPER
 */
async function sendWhatsAppText(toJid, textContent) {
  try {
    const sendUrl = EVOLUTION_API_URL + '/message/sendText/' + encodedInstance;
    
    console.log('📤 Routing outbound response payload out to destination string: ' + toJid);

    const response = await fetch(sendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': API_KEY
      },
      body: JSON.stringify({
        number: toJid,
        text: textContent,
        options: {
          delay: 500,
          presence: 'composing'
        }
      })
    });

    const result = await response.json();
    console.log('✅ API Dispatch Status Code: ' + response.status + ' | Log Summary:', JSON.stringify(result));
  } catch (error) {
    console.error('❌ Failed to establish communication back to API instance port:', error);
  }
}

// Fixed endpoint configurations for infrastructure container visibility 
app.get('/health', (req, res) => res.status(200).send('OK'));
app.get('/', (req, res) => res.status(200).send('Bot Engine Online'));

app.listen(PORT, '0.0.0.0', () => {
  console.log('Bot running cleanly on port ' + PORT);
});
