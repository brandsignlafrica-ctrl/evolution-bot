import { db } from '../../db';
import { whatsappLeads } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { sendWhatsAppText, sendWhatsAppImage } from '../services/evolutionApi';
import { generateHookCard } from '../services/imageGeneration';

const NICHE_CAPTIONS: any = {
  nails: { pt: "Você tentou dar um 'jeitinho' na unha, mas agora ela está pior do que antes, não está?", en: "You thought you were getting a deal. Now your natural nails are gone." },
  hair: { pt: "Você economizou no cabelo. E agora, o que você faz com esse arrependimento?", en: "The 'bargain' that cost you your hair quality." },
  lashes: { pt: "Aquele 'jeitinho' no cílio que só te deu mais dor de cabeça.", en: "You thought you were getting a deal. Now your natural lashes are gone." }
};

export async function handleWhatsAppWebhook(req: any, res: any) {
  res.status(200).send({ status: 'received' });

  try {
    const { event, data } = req.body;
    if (event !== 'messages.upsert') return;

    const messageData: any = Array.isArray(data) ? data[0] : data;
    
    if (!messageData || !messageData.key || messageData.key.fromMe) return;

    const remoteJid: string = messageData.key.remoteJid || '';
    const incomingText: string = (messageData.message?.conversation || messageData.message?.extendedTextMessage?.text || '').toLowerCase().trim();
    
    const phoneNumber: string = remoteJid.split('@')[0];
    const isBrazil: boolean = phoneNumber.startsWith('55');
    const isSA: boolean = phoneNumber.startsWith('27');

    let lead: any = await db.select().from(whatsappLeads).where(eq(whatsappLeads.phone, phoneNumber)).limit(1).then((res: any) => res[0]);

    if (['novo', 'start', 'reset'].includes(incomingText)) {
      await db.update(whatsappLeads).set({ state: 'new', niche: null }).where(eq(whatsappLeads.phone, phoneNumber));
      await sendWhatsAppText(remoteJid, isBrazil ? 'Funil reiniciado. Como posso ajudar?' : 'Funnel reset. How can I help?', {});
      return;
    }

    if (!lead) {
      const [newLead]: any = await db.insert(whatsappLeads).values({ phone: phoneNumber, country_code: isBrazil ? '+55' : '+27', state: 'new' }).returning();
      lead = newLead;
    }

    switch (lead.state) {
      case 'new': {
        const nicheKeywords: any = { nails: ['unha', 'nail'], hair: ['cabelo', 'hair'], lashes: ['cílio', 'lash'] };
        let detectedNiche: string | undefined = Object.keys(nicheKeywords).find((key: string) => 
          nicheKeywords[key].some((k: string) => incomingText.includes(k))
        );

        if (detectedNiche) {
          await db.update(whatsappLeads).set({ niche: detectedNiche, state: 'data_pending' }).where(eq(whatsappLeads.phone, phoneNumber));
          const msg = isBrazil ? 'Ótimo! Vou criar sua amostra AGORA. Qual o Nome do seu Negócio?' : 'Great! I will create your sample NOW. What is your Business Name?';
          await sendWhatsAppText(remoteJid, msg, {});
        } else {
          const qualMenu = isBrazil ? 'Oi! 👋 Você é 1. Profissional de beleza ou 2. Apenas olhando?' : 'Hi! 👋 Are you 1. A beauty professional or 2. Just browsing?';
          await sendWhatsAppText(remoteJid, qualMenu, {});
        }
        break;
      }

      case 'data_pending': {
        const businessName = incomingText;
        await db.update(whatsappLeads).set({ business_name: businessName, state: 'sample_delivered' }).where(eq(whatsappLeads.phone, phoneNumber));

        const imageBuffer: any = await generateHookCard({ niche: lead.niche, businessName, phone: phoneNumber });
        
        const nicheKey: string = lead.niche || 'nails';
        const caption: string = isBrazil ? NICHE_CAPTIONS[nicheKey].pt : NICHE_CAPTIONS[nicheKey].en;

        await sendWhatsAppImage(remoteJid, imageBuffer.toString('base64'), caption, {});

        setTimeout(async () => {
          const convictionText = isBrazil
            ? '1. Postar selfies confunde o algoritmo; ele te mostra para amigos, não compradoras.\n2. Esses 6 posts corrigem isso. Eles são "buyer-intent" e ensinam a Meta: "esta página = agendamentos".\n3. Resultado: Uma cliente já paga este investimento 5x.'
            : '1. Posting selfies confuses the algorithm; it shows you to friends, not buyers.\n2. These 6 posts fix that. They are "buyer-intent" and teach Meta: "this page = appointments".\n3. Result: One client already pays for this 5x over.';
          
          await sendWhatsAppText(remoteJid, convictionText, {});

          setTimeout(async () => {
            if (isBrazil) {
              await sendWhatsAppText(remoteJid, 'R$29 via PIX único: https://pay.hotmart.com/W105949535S?bid=1780424594098\nPaga e manda o comprovante aqui 👇', {});
            } else if (isSA) {
              await sendWhatsAppText(remoteJid, 'Get all 6 templates for R99.\n\nOption 1: Instant (PayFast)\nhttps://payment.payfast.io/eng/process/payment/515b7db1-fb19-4084-94fb-8e01f94758e4\n\nOption 2: Cash/EFT\nReply "STOP" for manual banking details.', {});
            }
          }, 1500);
        }, 2000);
        break;
      }
      
      case 'sample_delivered': {
         if (incomingText === 'stop' && isSA) {
             await db.update(whatsappLeads).set({ state: 'manual_handoff' }).where(eq(whatsappLeads.phone, phoneNumber));
             await sendWhatsAppText(remoteJid, 'A team member will be with you shortly to assist with your manual payment. 🤝', {});
         }
         break;
      }
    }
  } catch (error) {
    console.error('💥 Webhook Router Error:', error);
  }
}
