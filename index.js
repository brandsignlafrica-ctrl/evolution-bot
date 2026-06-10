import makeWASocket from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import axios from 'axios';
import express from 'express';

const app = express();
app.use(express.json());

const WEBHOOK_URL = process.env.WEBHOOK_URL;
const API_KEY = process.env.API_KEY;
const PORT = process.env.PORT || 3000; // Railway gives PORT automatically

// 1 HERO IMAGE FOR WHOLE NICHE - BOT RULE
const HERO_IMAGE = '27283658664651159'; // Replace with your nails image ID

// Health check for Railway
app.get('/', (req, res) => res.send('Bot Online'));

// Webhook from evolution-api
app.post('/webhook', async (req, res) => {
    try {
        const data = req.body.data;
        if (!data?.message) return res.sendStatus(200);
        
        const sender = data.key.remoteJid;
        const text = (data.message.conversation || '').toLowerCase().trim();
        const pushName = data.pushName || 'Cliente';
        
        console.log(`Msg from ${pushName}: ${text}`);
        
        // DUMB BOT - NO AI, NO THINKING
        if (text === '1' || text.includes('mostra') || text.includes('agenda')) {
            await sendImage(sender, HERO_IMAGE, `Oi ${pushName}! 👇\n\nUnhas gel + decoração GRÁTIS\nSó 8 vagas esta semana!\n\n1. Quero agendar $35\n2. Ver outro modelo\n3. Passar`);
        }
        else if (text === '2') {
            await sendText(sender, 'Outro modelo 👇\nManda "1" pra voltar');
        }
        else if (text === '3' || text.includes('passar')) {
            await sendText(sender, 'Ok! Me chama quando quiser 😊');
        }
        else {
            await sendText(sender, `Oi ${pushName}! 👋\n\n1. Ver promo unhas\n2. Outro modelo\n3. Passar`);
        }
        
        res.sendStatus(200);
    } catch (e) {
        console.log('Error:', e.message);
        res.sendStatus(200);
    }
});

async function sendText(jid, text) {
    const number = jid.replace('@s.whatsapp.net', '');
    await axios.post(`${WEBHOOK_URL}/message/sendText`, {
        number,
        textMessage: { text }
    }, { headers: { apikey: API_KEY } });
}

async function sendImage(jid, imageId, caption) {
    const number = jid.replace('@s.whatsapp.net', '');
    await axios.post(`${WEBHOOK_URL}/message/sendMedia`, {
        number,
        mediaMessage: {
            media: { id: imageId },
            caption
        }
    }, { headers: { apikey: API_KEY } });
}

app.listen(PORT, () => console.log(`Bot Online na porta ${PORT}`));
