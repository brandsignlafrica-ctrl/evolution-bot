'use strict';
const express = require('express');
const axios = require('axios');
const app = express();

// Use raw body parsing to catch the payload before it gets mangled
app.use(express.json({ limit: '10mb' }));

app.post('/webhook', async (req, res) => {
  // 1. Force instant 200 to keep the connection alive
  res.status(200).send('ok');

  // 2. Log exactly what we received to the terminal
  console.log('📦 RAW PAYLOAD RECEIVED:', JSON.stringify(req.body, null, 2));

  try {
    const body = req.body;
    
    // 3. Fallback check: If the body is empty, it means the API is sending 
    // the data in a way that needs raw access.
    if (!body || Object.keys(body).length === 0) {
      console.log('❌ ERROR: Body is empty. Evolution API might be sending an empty payload.');
      return;
    }

    // Standard processing
    if (body.event === 'messages.upsert') {
      const { instance, data } = body;
      const remoteJid = data?.key?.remoteJid || '';
      const text = data?.message?.conversation || data?.message?.extendedTextMessage?.text || '';
      
      console.log('✅ PROCESSED: ' + remoteJid + ' | ' + text);
      
      // If we got here, the parsing worked.
    }
  } catch (err) {
    console.error('CRITICAL PARSE ERROR:', err.message);
  }
});

app.listen(8080, () => console.log('SERVER ONLINE'));
