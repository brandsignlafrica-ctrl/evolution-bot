import express from 'express';

const app = express();
app.use(express.json());

// A tracking light to see incoming webhook requests instantly
app.use((req, res, next) => {
  console.log('📡 [RADAR] Incoming ' + req.method + ' request to ' + req.path);
  next();
});

// CRITICAL: Railway requires listening strictly to process.env.PORT
const PORT = process.env.PORT || 8080;

// Mapping strictly to your exact Railway Environment Variables screenshot
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'https://evolution-api-production-53a9.up.railway.app';
const API_KEY = process.env.EVOLUTION_API_KEY || 'FDE3646665F6-4E47-A279-A6BECE1C3D5D';
const INSTANCE_NAME = process.env.EVOLUTION_INSTANCE || 'Brandsignl Main V4';

app.post('/webhook', async (req, res) => {
  // Always respond immediately with a 200 to keep the Evolution API happy
  res.status(200).send({ status: 'received' });

  try {
    console.log('📦 Webhook payload raw data:', JSON.stringify(req.body));

    const event = req.body.event;
    const data = req.body.data;

    // Safely handle both single object payloads and array structures
    const messageData = Array.isArray(data) ? data[0] : data;

    if (!messageData || !messageData.key || messageData.key.fromMe === true) {
      console.log('🛑 Ignored: Message is empty or sent from the bot itself.');
      return;
    }

    // Extract the raw sender phone number string
    const remoteJid = messageData.key.remoteJid;
    // Clean it up to get just the numbers for reply matching if needed
    const fromNumber = remoteJid.replace('@s.whatsapp.net', '').replace('@lid', '');

    const incomingText = messageData.message?.conversation || 
                         messageData.message?.extendedTextMessage?.text || 
                         "";

    console.log('📩 Processing text from ' + fromNumber + ': ' + incomingText);

    // Default response message
    let replyText = 'Oi! Vi sua msg sobre posts pra salão 🌟 Quer ver amostra?';

    // If they ask for a link, switch to the Hotmart offer
    if (incomingText.toLowerCase().includes('link')) {
      replyText = 'R$29 via PIX único: https://pay.hotmart.com/W105949535S?bid=1780424594098\nPaga e manda comprovante que envio 6 posts editados já 👇✨';
    }

    // Dispatching response using native fetch to avoid dependency version bugs
    const encodedInstance = encodeURIComponent(INSTANCE_NAME);
    const sendUrl = EVOLUTION_API_URL + '/message/sendText/' + encodedInstance;

    console.log('📤 Dispatching outbound reply to: ' + remoteJid);

    const apiResponse = await fetch(sendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': API_KEY
      },
      body: JSON.stringify({
        number: remoteJid,
        options: {
          delay: 1200,
          presence: 'composing'
        },
        textMessage: {
          text: replyText
        }
      })
    });

    const result = await apiResponse.json();
    console.log('✅ Outbound delivery response status:', result.status || 'Dispatched');

  } catch (err) {
    console.error('💥 Webhook processing loop exception:', err);
  }
});

// Health check endpoint for Railway platform stability
app.get('/health', (req, res) => res.status(200).send('OK'));
app.get('/', (req, res) => res.status(200).send('Bot Operational Engine'));

app.listen(PORT, '0.0.0.0', () => {
  console.log('Bot running cleanly on port ' + PORT);
});
