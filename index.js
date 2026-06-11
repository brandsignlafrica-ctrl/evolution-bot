import express from 'express';

const app = express();
app.use(express.json());

// 🚨 THE RADAR: Track incoming webhooks visually in the console
app.use((req, res, next) => {
  console.log('📡 [RADAR] Incoming ' + req.method + ' request to ' + req.path);
  next();
});

// CRITICAL: Railway requires listening strictly to process.env.PORT
const PORT = process.env.PORT || 8080;

// Mapping strictly to your exact Railway Environment Variables
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'https://evolution-api-production-53a9.up.railway.app';
const API_KEY = process.env.EVOLUTION_API_KEY || 'FDE3646665F6-4E47-A279-A6BECE1C3D5D';
const INSTANCE_NAME = process.env.EVOLUTION_INSTANCE || 'Brandsignl Main V4';
const STRICLY_ALLOWED_TESTER = '27833272007'; // Only Tyronne can trigger the bot

const encodedInstance = encodeURIComponent(INSTANCE_NAME);

/**
 * 1. INBOUND WEBHOOK ROUTE
 */
app.post('/webhook', async (req, res) => {
  // Always respond immediately with a 200 to keep the Evolution API happy
  res.status(200).send({ status: 'received' });

  try {
    const { event, data } = req.body;

    if ((event || '').toUpperCase() !== 'MESSAGES_UPSERT') {
      return; 
    }

    // Safely handle both single object payloads and array structures
    const messageData = Array.isArray(data) ? data[0] : data;

    if (!messageData || !messageData.key) return;
    if (messageData.key.fromMe === true) return;

    const remoteJid = messageData.key.remoteJid || '';
    const participant = messageData.key.participant || '';
    
    // Check if your testing number exists ANYWHERE in the sender fields
    const isFromTester = remoteJid.includes(STRICLY_ALLOWED_TESTER) || 
                         participant.includes(STRICLY_ALLOWED_TESTER);

    if (!isFromTester) {
      console.log('🔒 SECURITY SHIELD: Ignored message from customer/stranger to protect production environment.');
      return;
    }

    const incomingText = messageData.message?.conversation || 
                         messageData.message?.extendedTextMessage?.text || 
                         "";

    console.log('📩 verified Tester [' + STRICLY_ALLOWED_TESTER + '] sent text: "' + incomingText + '"');

    // Default response message
    let replyText = 'Oi! Vi sua msg sobre posts pra salão 🌟 Quer ver amostra?';

    // Flexible keyword trigger handling
    if (incomingText.toLowerCase().includes('link') || incomingText.toLowerCase().includes('ping')) {
      replyText = 'R$29 via PIX único: https://pay.hotmart.com/W105949535S?bid=1780424594098\nPaga e manda comprovante que envio 6 posts editados já 👇✨';
    }

    // Call outbound delivery helper
    await sendWhatsAppText(remoteJid, replyText);

  } catch (err) {
    console.error('💥 Webhook processing loop exception:', err);
  }
});

/**
 * 2. OUTBOUND API HELPER
 */
async function sendWhatsAppText(toJid, textContent) {
  try {
    const sendUrl = EVOLUTION_API_URL + '/message/sendText/' + encodedInstance;
    
    console.log('📤 Attempting dispatch to target JID: ' + toJid);

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
    console.log('✅ API Return Code: ' + response.status + ' | Payload Response:', JSON.stringify(result));
  } catch (error) {
    console.error('❌ Network crash trying to reach Evolution API endpoint:', error);
  }
}

// Health check endpoints for Railway platform monitoring
app.get('/health', (req, res) => res.status(200).send('OK'));
app.get('/', (req, res) => res.status(200).send('Bot Operational Engine'));

app.listen(PORT, '0.0.0.0', () => {
  console.log('Bot running cleanly on port ' + PORT);
});
