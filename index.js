fetch('https://evolution-api-production-53a9.up.railway.app/webhook/instance/Brandsignl%20Main%20V4', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': 'FDE3646665F6-4E47-A279-A6BECE1C3D5D'
  },
  body: JSON.stringify({
    url: 'https://evolution-bot-production.up.railway.app/webhook',
    enabled: true,
    webhookByEvents: true,
    events: [
      'MESSAGES_UPSERT',
      'CONNECTION_UPDATE'
    ]
  })
})
.then(response => response.json())
.then(data => {
  if (data.status === 400 || data.error) {
    console.error('❌ FORCE-BIND FAILED:', data);
  } else {
    console.log('✅ FORCE-BIND SUCCESS:', data);
  }
})
.catch(error => console.error('💥 FORCE-BIND NETWORK ERROR:', error));
