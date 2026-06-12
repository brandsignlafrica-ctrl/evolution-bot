import express from 'express';

const app = express();
app.use(express.json());

// 🚨 THE RADAR: Permanent logging visualizer for inbound web traffic
app.use((req, res, next) => {
  console.log('📡 [RADAR] Incoming ' + req.method + ' request to ' + req.path);
  next();
});

// CRITICAL: Dynamic platform port binding configuration 
const PORT = process.env.PORT || 8080;

// ✨ THE SANITIZERS: Stripping invisible spaces and trailing slashes 
const EVOLUTION_API_URL = (process.env.EVOLUTION_API_URL || 'https://evolution-api-production-53a9.up.railway.app').replace(/\/$/, '');
const API_KEY = (process.env.EVOLUTION_API_KEY || 'FDE3646665F6-4E47-A279-A6BECE1C3D5D').trim();
const INSTANCE_NAME = (process.env.EVOLUTION_INSTANCE || 'Brandsignl Main V4').trim();

// Secure White-list definitions mapped exclusively to your testing sessions
const ALLOWED_PROFILES = [
  '27833272007', 
  '27638151814', 
  '267207145730240' 
];

// 🛡️ THE CACHE: Memory vault for recent message IDs to prevent loops
const processedMessages = new Set();

/**
 * 1. INBOUND WEBHOOK ROUTE
 */
app.post('/webhook', async (req, res) => {
  res.status(200).send({ status: 'received' });

  try {
    const { event, data } = req.body;
    const eventName = (event || '').toUpperCase().replace('.', '_');

    if (eventName !== 'MESSAGES_UPSERT') {
      return; 
    }

    const messageData = Array.isArray(data) ? data[0] : data;

    if (!messageData || !messageData.key) return;

    // 🛡️ THE GATEKEEPER: Deduplication Check
    const messageId = messageData.key.id;
    if (processedMessages.has(messageId)) return;
    
    processedMessages.add(messageId);
    if (processedMessages.size > 500) processedMessages.clear();

    if (messageData.key.fromMe) return;

    const remoteJid = messageData.key.remoteJid || '';
    const participant = messageData.key.participant || '';
    
    const isFromTester = ALLOWED_PROFILES.some(profileToken => 
      remoteJid.includes(profileToken) || participant.includes(profileToken)
    );

    if (!isFromTester) return;

    const incomingText = messageData.message?.conversation || 
                         messageData.message?.extendedTextMessage?.text || 
                         "";

    // ✨ NEW FIX: Ignore empty messages (like images/screenshots without text)
    if (!incomingText.trim()) {
      console.log('⚠️ Ignored media/empty message to prevent spam.');
      return;
    }

    console.log('📩 Security pass. Processing verified tester content: "' + incomingText + '"');

    // Default template reply strategy
    let replyText = 'Oi! Vi sua msg sobre posts pra salão 🌟 Quer ver amostra?';
    
    // Convert to lowercase for easy matching
    const text = incomingText.toLowerCase();

    // ✨ NEW FIX: Check for 'sim', 'unhas', 'quero', etc.
    if (text.includes('link') || text.includes('ping') || text.includes('sim') || text.includes('quero') || text.includes('unhas') || text.includes('amostra')) {
      replyText = 'R$29 via PIX único: https://pay.hotmart.com/W105949535S?bid=1780424594098\nPaga e manda comprovante que envio 6 posts editados já 👇✨';
    }

    // Execute outbound API dispatch
    await sendWhatsAppText(remoteJid, replyText);

  } catch (err) {
    console.error('💥 Webhook processing logic fault:', err);
  }
});

/**
 * 2. OUTBOUND DISPATCH MODULE
 */
async function sendWhatsAppText(toJid, textContent) {
  try {
    const encodedInstance = encodeURIComponent(INSTANCE_NAME);
    const sendUrl = EVOLUTION_API_URL + '/message/sendText/' + encodedInstance;
    
    const response = await fetch(sendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': API_KEY
      },
      body: JSON.stringify({
        number: toJid,
        text: textContent,
        options: { delay: 500, presence: 'composing' }
      })
    });

    const result = await response.json();
    console.log('✅ API Transmission Status: ' + response.status);
  } catch (error) {
    console.error('❌ Inability to map pathway through to active API container:', error);
  }
}

// Global service infrastructure entry point endpoints
app.get('/health', (req, res) => res.status(200).send('OK'));
app.get('/', (req, res) => res.status(200).send('Active Application Engine'));

app.listen(PORT, '0.0.0.0', () => {
  console.log('Bot running cleanly on port ' + PORT);
  console.log('Target Instance Bound To: [' + INSTANCE_NAME + ']');
});
