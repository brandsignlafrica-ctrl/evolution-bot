async function sendText(to, text) {
  console.log(`SENDING TEXT to ${to}: ${text}`);
  await axios.post(
    `${EVOLUTION_URL}/message/sendText/${INSTANCE}`,
    { number: to, textMessage: { text } },
    { headers: { apikey: EVOLUTION_KEY }  // <- added }
  ); // <- added )
}

async function sendImage(to, imageId, caption) {
  console.log(`SENDING IMAGE to ${to}`);
  await axios.post(
    `${EVOLUTION_URL}/message/sendMedia/${INSTANCE}`,
    { number: to, mediaMessage: { mediaType: "image", media: imageId, caption } },
    { headers: { apikey: EVOLUTION_KEY }  // <- added }
  ); // <- added )
}
