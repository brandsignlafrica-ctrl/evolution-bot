import express from 'express';

const app = express();
app.use(express.json());

// 🚨 THE RADAR: Track incoming traffic routes
app.use((req, res, next) => {
  console.log('📡 [RADAR] Incoming ' + req.method + ' request to ' + req.path);
  next();
});

// CRITICAL: Dynamic platform port binding configuration 
const PORT = process.env.PORT || 8080;

// Mapping strictly to your validated Railway Environment Variables
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'https://evolution-api-production-53a9.up.railway.app';
const API_KEY = process.env.EVOLUTION_API_KEY || 'FDE3646665F6-4E47-A279-A6BECE1C3D5D';

// Secure White-list definitions mapped exclusively to your testing sessions
const ALLOWED_PROFILES = [
  '27833272007', 
  '27638151814', 
  '267207145730240' 
];

/**
 * 1. INBOUND WEBHOOK ROUTE
 */
app.post('/webhook', async (req, res) => {
  // Clear connection socket state instantly to maintain webhook performance targets
  res.status(200).send({ status: 'received' });

  try {
    const { event, data, instance } = req.body;

    if ((event || '').toUpperCase() !== 'MESSAGES_UPSERT') {
      return; 
    }

    // Standardize object payload mappings across arrays or single instances
    const messageData = Array.isArray(data) ? data[0] : data;

    if (!messageData || !messageData.key) return;
    if (messageData.key.fromMe === true) return;

    const remoteJid = messageData.key.remoteJid || '';
    const participant = messageData.key.participant || '';
    
    // SECURITY GATEKEEPER CHECK
    const isFromTester = ALLOWED_PROFILES.some(profileToken => 
      remoteJid.includes(profileToken) || participant.includes(profileToken)
    );

    if (!isFromTester) {
      console.log('🔒 SHIELD: Ignored incoming communication from customer string.');
      return;
    }

    const incomingText = messageData.message?.conversation || 
                         messageData.message?.extendedTextMessage?.text || 
                         "";

    console.log('📩 Security pass. Processing verified tester content: "' + incomingText + '"');

    // Default template reply strategy
    let replyText = 'Oi! Vi sua msg sobre posts pra salão 🌟 Quer ver amostra?';

    // Interactive link condition logic parsing
    if (incomingText.toLowerCase().includes('link') || incomingText.toLowerCase().includes('ping')) {
      replyText = 'R$29 via PIX único: https://pay.hotmart.com/W105949535S?bid=1780424594098\nPaga e manda comprovante que envio 6 posts editados já 👇✨';
    }

    // Pass the message onward using the EXACT instance name that sent the webhook
    await sendWhatsAppText(instance, remoteJid, replyText);

  } catch (err) {
    console.error('💥 Webhook processing logic fault:', err);
  }
});

/**
 * 2. OUTBOUND DISPATCH MODULE
 */
async function sendWhatsAppText(instanceName, toJid, textContent) {
  try {
    const encodedInstance = encodeURIComponent(instanceName);
    const sendUrl = EVOLUTION_API_URL + '/message/sendText/' + encodedInstance;
    
    console.log('📤 Executing response post to instance [' + instanceName + '] toward target: ' + toJid);

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
    console.log('✅ API Transmission Status: ' + response.status + ' | Log Summary:', JSON.stringify(result));
  } catch (error) {
    console.error('❌ Inability to map pathway through to active API container:', error);
  }
}

// Global service infrastructure entry point endpoints
app.get('/health', (req, res) => res.status(200).send('OK'));
app.get('/', (req, res) => res.status(200).send('Active Application Engine'));

app.listen(PORT, '0.0.0.0', () => {
  console.log('Bot running cleanly on port ' + PORT);
});
