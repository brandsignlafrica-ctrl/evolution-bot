import { db } from '../../db'; 
import { whatsappLeads } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { sendWhatsAppText, sendWhatsAppImage } from '../services/evolutionApi';
import { generateHookCard } from '../services/imageGeneration';

export async function handleWhatsAppWebhook(req: any, res: any) {
  // 1. Acknowledge immediately to prevent retry loops
  res.status(200).send({ status: 'received' });

  try {
    const { event, data } = req.body;
    if (event !== 'messages.upsert') return;

    const messageData = Array.isArray(data) ? data[0] : data;
    if (messageData.key.fromMe) return;

    const remoteJid = messageData.key.remoteJid;
    const phone = remoteJid.split('@')[0];
    const incomingText = (messageData.message?.conversation || messageData.message?.extendedTextMessage?.text || '').toLowerCase().trim();

    // 2. Fetch Lead State from DB
    let lead = await db.select().from(whatsappLeads).where(eq(whatsappLeads.phone, phone)).limit(1).then(r => r[0]);

    if (!lead) {
      [lead] = await db.insert(whatsappLeads).values({ phone, state: 'new' }).returning();
    }

    // 3. Reset Logic
    if (['novo', 'start', 'reset'].includes(incomingText)) {
      await db.update(whatsappLeads).set({ state: 'new' }).where(eq(whatsappLeads.phone, phone));
      return await sendWhatsAppText(remoteJid, 'Funnel reset. Send "nails" or "hair" to start.');
    }

    // 4. State Machine Funnel
    switch (lead.state) {
      case 'new': {
        if (incomingText.includes('nail') || incomingText.includes('hair') || incomingText.includes('lash')) {
          const niche = incomingText.includes('nail') ? 'nails' : incomingText.includes('hair') ? 'hair' : 'lashes';
          await db.update(whatsappLeads).set({ state: 'data_pending', niche }).where(eq(whatsappLeads.phone, phone));
          await sendWhatsAppText(remoteJid, 'Great! What is your business name?');
        } else {
          await sendWhatsAppText(remoteJid, 'Hi! Are you a professional (1) or just browsing (2)?');
        }
        break;
      }

      case 'data_pending': {
        await db.update(whatsappLeads).set({ state: 'sample_delivered', business_name: incomingText }).where(eq(whatsappLeads.phone, phone));
        
        // Use Sharp/SVG engine to generate the image
        const buffer = await generateHookCard({ niche: lead.niche, businessName: incomingText, phone });
        
        // Evolution API requires Base64 for the 'media' field
        await sendWhatsAppImage(remoteJid, buffer.toString('base64'), 'Here is your custom sample!');
        
        // Conviction timing
        setTimeout(async () => {
          await sendWhatsAppText(remoteJid, '1. Posting selfies confuses the algorithm.\n2. These 6 posts teach Meta: "this page = appointments".\n3. One client already pays for this 5x over.');
        }, 2000);
        break;
      }
    }
  } catch (err) {
    console.error('💥 Webhook Error:', err);
  }
}
