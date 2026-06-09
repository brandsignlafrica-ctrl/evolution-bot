'use strict';
const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json({ limit: '10mb' }));

app.post('/webhook', async (req, res) => {
  res.status(200).send('ok');

  const body = req.body;
  console.log('📦 INBOUND EVENT:', body.event);

  try {
    // Check if it's a chat message
    if (body.event === 'messages.upsert') {
      const data = body.data;
      const remoteJid = data?.key?.remoteJid || '';
      const text = (data?.message?.conversation || data?.message?.extendedTextMessage?.text || '').trim();

      if (text) {
        console.log('✅ CHAT MESSAGE RECEIVED: ' + text);
        // Your logic goes here
      }
    } else {
      console.log('ℹ️ Non-chat event ignored: ' + body.event);
    }
  } catch (err) {
    console.error('Webhook Error:', err.message);
  }
});

app.listen(8080, () => console.log('SERVER ONLINE'));
