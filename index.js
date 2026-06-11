import express from 'express';
import axios from 'axios';
const app = express();
app.use(express.json());

const EVOLUTION_URL = process.env.EVOLUTION_URL; // e.g. https://api.evolution.com
const EVOLUTION_KEY = process.env.EVOLUTION_KEY;
const INSTANCE = process.env.EVOLUTION_INSTANCE; // e.g. brandsignafrica

app.post('/webhook', async (req, res) => {
  console.log('Evolution sent:', JSON.stringify(req.body));

  const data = req.body.data;
  const msg = data?.message?.conversation || data?.message?.extendedTextMessage?.text;
  const from = data?.key?.remoteJid?.replace('@s.whatsapp.net', '');

  if (msg && from && !data.key.fromMe) {
    // Reply logic
    let reply = 'Oi! Vi sua msg sobre posts pra salão 💅 Quer ver amostra?';
    
    if (msg.toLowerCase().includes('link')) {
      reply = 'R$29 via PIX único: https://pay.hotmart.com/W105949535S?bid=1780424594098\nPaga e manda comprovante que envio 6 posts editados já 👇';
    }

    // Send back via Evolution API
    await axios.post(
      `${EVOLUTION_URL}/message/sendText/${INSTANCE}`,
      { number: from, textMessage: { text: reply } },
      { headers: { apikey: EVOLUTION_KEY } }
    );
  }

  res.sendStatus(200); // Evolution needs 200 fast
});

app.get('/', (req, res) => res.send('OK'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Bot running on ${PORT}`));
