import { db } from '../../db';
import { whatsappLeads } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { sendWhatsAppText, sendWhatsAppImage } from '../services/evolutionApi';
import { generateHookCard } from '../services/imageGeneration'; // Sharp/SVG logic
import { deliverPostPack } from '../services/fulfillment';

export async function handleWhatsAppWebhook(req: any, res: any) {
  // 1. Instantly acknowledge the webhook to prevent Evolution API ghost queues
  res.status(200).send({ status: 'received' });

  try {
    const { event, data } = req.body;
    if (event !== 'messages.upsert') return;

    const messageData = Array.isArray(data) ? data[0] : data;
    if (!messageData?.key || messageData.key.fromMe) return;

    const remoteJid = messageData.key.remoteJid;
    const incomingText = (messageData.message?.conversation || messageData.message?.extendedTextMessage?.text || '').toLowerCase().trim();
    
    // Extract phone number to determine country code
    const phoneNumber = remoteJid.split('@')[0];
    const isBrazil = phoneNumber.startsWith('55');
    const isSA = phoneNumber.startsWith('27');

    // Fetch or create lead state via Drizzle ORM
    let lead = await db.select().from(whatsappLeads).where(eq(whatsappLeads.phone, phoneNumber)).limit(1).then(res => res[0]);

    // Handle 'Reset' Commands
    if (['novo', 'start', 'reset'].includes(incomingText)) {
      if (lead) {
        await db.update(whatsappLeads).set({ state: 'new', niche: null }).where(eq(whatsappLeads.phone, phoneNumber));
        lead.state = 'new';
      }
    }

    if (!lead) {
      const [newLead] = await db.insert(whatsappLeads).values({
        phone: phoneNumber,
        country_code: isBrazil ? '+55' : isSA ? '+27' : 'other',
        state: 'new'
      }).returning();
      lead = newLead;
    }

    // ==========================================
    // THE MASTER FUNNEL STATE MACHINE
    // ==========================================

    switch (lead.state) {
      case 'new': {
        // Step 1: Entry & Niche Lock-In
        const isNicheKeyword = ['unhas', 'hair', 'lashes', 'nails', 'cabelo'].some(n => incomingText.includes(n));
        
        if (isNicheKeyword) {
          // Lock in the niche and progress state
          const niche = incomingText.includes('unhas') || incomingText.includes('nails') ? 'nails' : 
                        incomingText.includes('hair') || incomingText.includes('cabelo') ? 'hair' : 'lashes';
          
          await db.update(whatsappLeads)
            .set({ niche, state: 'data_pending' })
            .where(eq(whatsappLeads.phone, phoneNumber));

          // Step 2: Data Collection
          const reply = isBrazil 
            ? 'Ótimo! Para personalizar sua amostra, qual é o nome do seu negócio?' 
            : 'Great! To personalize your sample, what is your business name?';
          await sendWhatsAppText(remoteJid, reply);
        } else {
          // Send Professional vs Browsing qualification menu
          const menu = isBrazil 
            ? 'Oi! Você trabalha na área da beleza (1) ou está só dando uma olhadinha (2)? Responda com 1 ou 2.' 
            : 'Hi! Are you a beauty professional (1) or just browsing (2)? Reply 1 or 2.';
          await sendWhatsAppText(remoteJid, menu);
        }
        break;
      }

      case 'data_pending': {
        // Step 2 & 3: Save Business Name & Send Branded Sample
        const businessName = incomingText; // The user's reply is assumed to be the business name
        
        await db.update(whatsappLeads)
          .set({ business_name: businessName, state: 'sample_delivered' })
          .where(eq(whatsappLeads.phone, phoneNumber));

        // Generate the Sharp/SVG Hero Asset
        const sampleImageUrl = await generateHookCard(lead.niche, businessName, phoneNumber);
        
        const option1Line = isBrazil 
          ? Aqui está sua amostra, ${businessName}! 🌟 
          : Here is your custom sample, ${businessName}! 🌟;

        await sendWhatsAppImage(remoteJid, sampleImageUrl, option1Line);

        // Step 4: The Algorithm Fix (Conviction)
        // Give the image 2 seconds to land before sending the text block
        setTimeout(async () => {
          const convictionText = isBrazil
            ? '1. Postar só selfies e unhas confunde o algoritmo; ele te mostra para amigos, não compradores.\n*2.* Estes 6 posts consertam isso. Eles têm "intenção de compra" e ensinam a Meta: "esta página = agendamentos".\n*3.* Resultado: A mulher que pesquisa "unhas perto de mim" vê seu post e clica no WhatsApp. Uma cliente já pagou isso 5x mais.'
            : '1. Posting selfies + nail pics confuses the algorithm; it shows you to friends, not buyers.\n*2.* These 6 posts fix that. They are "buyer-intent" and teach Meta: "this page = appointments".\n*3.* Result: Woman searching "nails near me" sees your post and taps WhatsApp. One client already pays for this 5x over.';
          
          await sendWhatsAppText(remoteJid, convictionText);

          // Step 5: Payment Routing
          setTimeout(async () => {
            if (isBrazil) {
              const pixMsg = 'R$29 via PIX único: https://pay.hotmart.com/W105949535S?bid=1780424594098\nPaga e manda o comprovante aqui 👇✨';
              await sendWhatsAppText(remoteJid, pixMsg);
            } else if (isSA) {
              const saMsg = 'Get all 6 templates for R99.\n\n*Option 1: Instant Access (PayFast)\nhttps://payment.payfast.io/eng/process/payment/515b7db1-fb19-4084-94fb-8e01f94758e4\n\n*Option 2: Cash / EFT (Manual)\nReply "STOP" to speak to a human to arrange manual payment.';
              await sendWhatsAppText(remoteJid, saMsg);
            }
          }, 1500); // 1.5s delay after conviction text

        }, 2000); // 2s delay after image
        break;
      }

      case 'sample_delivered': {
        // Listen for manual handoff command from SA clients
        if (incomingText === 'stop') {
           await db.update(whatsappLeads).set({ state: 'manual_handoff' }).where(eq(whatsappLeads.phone, phoneNumber));
           await sendWhatsAppText(remoteJid, 'A team member will be with you shortly to assist with your manual payment. 🤝');
        }
        // If they send an image (Pix receipt), it falls here. You can add logic to alert you to verify the receipt.
        break;
      }

      case 'paid': {
        // Handled by Step 6/7 fulfillment logic
        await sendWhatsAppText(remoteJid, 'Your files are already processing! Please wait a moment.');
        break;
      }
    }

  } catch (error) {
    console.error('💥 Webhook Router Error:', error);
  }
}
