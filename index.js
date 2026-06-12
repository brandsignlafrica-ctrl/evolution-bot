import express from 'express';

const app = express();
app.use(express.json());

// 🚨 THE RADAR: Permanent logging visualizer for inbound web traffic
app.use((req, res, next) => {
  console.log('📡 [RADAR] Incoming ' + req.method + ' request to ' + req.path);
  next();
});

const PORT = process.env.PORT || 8080;
const EVOLUTION_API_URL = (process.env.EVOLUTION_API_URL || 'https://evolution-api-production-53a9.up.railway.app').replace(/\/$/, '');
const API_KEY = (process.env.EVOLUTION_API_KEY || 'FDE3646665F6-4E47-A279-A6BECE1C3D5D').trim();
const INSTANCE_NAME = (process.env.EVOLUTION_INSTANCE || 'Brandsignl Main V4').trim();

const ALLOWED_PROFILES = [
  '27833272007', 
  '27638151814', 
  '267207145730240' 
];

// 🛡️ DEDUPLICATION CACHE
const processedMessages = new Set();

// 🧠 IN-MEMORY DATABASE: Tracks where each phone number is in the funnel
const activeSessions = new Map(); 

/**
 * 1. INBOUND WEBHOOK ROUTE
 */
app.post('/webhook', async (req, res) => {
  res.status(200).send({ status: 'received' });

  try {
    const { event, data } = req.body;
    if ((event || '').toUpperCase().replace('.', '_') !== 'MESSAGES_UPSERT') return;

    const messageData = Array.isArray(data) ? data[0] : data;
    if (!messageData || !messageData.key || messageData.key.fromMe) return;

    const messageId = messageData.key.id;
    if (processedMessages.has(messageId)) return;
    processedMessages.add(messageId);
    if (processedMessages.size > 500) processedMessages.clear();

    const remoteJid = messageData.key.remoteJid || '';
    const isFromTester = ALLOWED_PROFILES.some(profileToken => remoteJid.includes(profileToken));
    if (!isFromTester) return;

    const incomingText = (messageData.message?.conversation || messageData.message?.extendedTextMessage?.text || "").trim();
    if (!incomingText) return; // Ignore pure images/blank messages

    const text = incomingText.toLowerCase();
    
    // Determine Country Code for language routing
    const phone = remoteJid.split('@')[0];
    const isBrazil = phone.startsWith('55');

    // ==========================================
    // THE MASTER FUNNEL STATE MACHINE
    // ==========================================
    
    // 1. Fetch the user's current place in the funnel (Default: 'new')
    let session = activeSessions.get(phone) || { state: 'new' };

    // 2. Secret "Reset" Command for Testing
    if (['novo', 'start', 'reset'].includes(text)) {
      activeSessions.set(phone, { state: 'new' });
      await sendWhatsAppText(remoteJid, '🔄 Funnel reset. Send "oi" or "unhas" to test again from the start.');
      return;
    }

    // 3. Funnel Logic
    if (session.state === 'new') {
      
      // Step 1: Entry & Niche Lock-In
      if (text.includes('unhas') || text.includes('hair') || text.includes('lashes') || text === '1' || text === 'sim') {
        session.state = 'data_pending'; // Move them to the next step
        activeSessions.set(phone, session);
        
        const reply = isBrazil 
          ? 'Ótimo! Para personalizar sua amostra, qual é o nome do seu negócio?' 
          : 'Great! To personalize your sample, what is your business name?';
        await sendWhatsAppText(remoteJid, reply);
      } else {
        const menu = isBrazil 
          ? 'Oi! Você trabalha na área da beleza (1) ou está só dando uma olhadinha (2)? Responda com 1 ou 2.' 
          : 'Hi! Are you a beauty professional (1) or just browsing (2)? Reply 1 or 2.';
        await sendWhatsAppText(remoteJid, menu);
      }
      
    } 
    else if (session.state === 'data_pending') {
      
      // Step 2: Save Business Name
      session.businessName = incomingText; 
      session.state = 'sample_delivered'; // Move them to the payment phase
      activeSessions.set(phone, session);

      // Step 3: Send Branded Sample
      // (Since we don't have Sharp/SVG connected to this Railway file, we simulate it with text)
      const sampleText = isBrazil 
        ? Aqui está sua amostra, ${session.businessName}! 🌟\n\n*(Imagine your custom image overlay rendering here)* 
        : Here is your custom sample, ${session.businessName}! 🌟\n\n*(Imagine your custom image overlay rendering here)*;
      
      await sendWhatsAppText(remoteJid, sampleText);

      // Step 4: The Algorithm Fix (Conviction)
      // We use a timeout to create a natural 2-second typing delay
      setTimeout(async () => {
        const conviction = isBrazil
          ? '1. Postar só selfies e unhas confunde o algoritmo; ele te mostra para amigos, não compradores.\n*2.* Estes 6 posts consertam isso. Eles têm "intenção de compra".\n*3.* Resultado: A mulher que pesquisa "unhas perto de mim" vê seu post e clica no WhatsApp.'
          : '1. Posting selfies + nail pics confuses the algorithm; it shows you to friends, not buyers.\n*2.* These 6 posts fix that. They are "buyer-intent".\n*3.* Result: Woman searching "nails near me" sees your post and taps WhatsApp.';
        
        await sendWhatsAppText(remoteJid, conviction);

        // Step 5: Payment Routing
        setTimeout(async () => {
          if (isBrazil) {
            await sendWhatsAppText(remoteJid, 'R$29 via PIX único: https://pay.hotmart.com/W105949535S?bid=1780424594098\nPaga e manda o comprovante aqui 👇✨');
          } else {
            await sendWhatsAppText(remoteJid, 'Get all 6 templates for R99.\n\n*Option 1: Instant Access (PayFast)\nhttps://payment.payfast.io/eng/process/payment/515b7db1-fb19-4084-94fb-8e01f94758e4\n\n*Option 2: Cash / EFT\nReply "STOP" to speak to a human to arrange manual payment.');
          }
        }, 2000); // Wait 2s after conviction

      }, 2000); // Wait 2s after sample
    }
    
    // Step 6: SA Manual Handoff
    else if (session.state === 'sample_delivered' && text === 'stop') {
      session.state = 'manual_handoff';
      activeSessions.set(phone, session);
      await sendWhatsAppText(remoteJid, 'A team member will be with you shortly to assist with your manual payment. 🤝');
    }

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

    console.log('✅ API Transmission Status: ' + response.status);
  } catch (error) {
    console.error('❌ Inability to map pathway through to active API container:', error);
  }
}

app.get('/health', (req, res) => res.status(200).send('OK'));
app.get('/', (req, res) => res.status(200).send('Active Application Engine'));

app.listen(PORT, '0.0.0.0', () => {
  console.log('Bot running cleanly on port ' + PORT);
  console.log('Target Instance Bound To: [' + INSTANCE_NAME + ']');
});
