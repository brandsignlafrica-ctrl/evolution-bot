import makeWASocket, { DisconnectReason } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import axios from 'axios';
import express from 'express';
import fs from 'fs';

const app = express();
app.use(express.json());

const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://evolution-api-production-53a9.up.railway.app/webhook';
const API_KEY = process.env.API_KEY || 'FDE3646665F6-4E47-A279-A6BECE1C3D5D';
const PORT = process.env.PORT || 3000;

// 1 HERO IMAGE PER NICHE - BOT RULE
const HERO_IMAGE = '27283658664651159'; // Nails image

// Webhook from evolution-api
app.post('/webhook', async (req, res) => {
    try {
        const data = req.body.data;
        if (!data?.message) return res.sendStatus(200);
        
        const sender = data.key.remoteJid;
        const text = data.message.conversation?.toLowerCase() || '';
        const pushName = data.pushName || 'Cliente';
        
        console.log(`Msg from ${pushName}: ${text}`);
        
        // DUMB BOT LOGIC - NO AI
        if (text === '1' || text.includes('mostra')) {
            await sendImage(sender, HERO_IMAGE, `Oi ${pushName}! 👇\n\nUnhas gel + decoração GRÁTIS\nSó 8 vagas esta semana!\n\n1. Quero agendar $35\n2. Ver outro modelo\n3. Passar`);
        }
        else if (text === '2') {
            await sendText(sender, 'Outro modelo 👇\n1. Voltar\n3. Passar');
        }
        else if (text === '3' || text.includes('pass')) {
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
    await axios.post(`${WEBHOOK_URL}/message/sendText`, {
        number: jid.replace('@s.whatsapp.net', ''),
        textMessage: { text }
    }, { headers: { apikey: API_KEY } });
}

async function sendImage(jid, imageId, caption) {
    await axios.post(`${WEBHOOK_URL}/message/sendMedia`, {
        number: jid.replace('@s.whatsapp.net', ''),
        mediaMessage: {
            media: { id: imageId },
            caption
        }
    }, { headers: { apikey: API_KEY } });
}

app.listen(PORT, () => console.log(`Bot Online na porta ${PORT}`));
