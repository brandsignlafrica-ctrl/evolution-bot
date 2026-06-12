// server/services/fulfillment.ts
import { db } from '../../db';
import { whatsappLeads } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { sendWhatsAppImage } from './evolutionApi';
import { generateHookCard } from './imageGeneration';

export async function deliverPostPack(phoneNumber: string, remoteJid: string) {
  // Update state to paid
  await db.update(whatsappLeads).set({ state: 'paid' }).where(eq(whatsappLeads.phone, phoneNumber));
  
  const lead = await db.select().from(whatsappLeads).where(eq(whatsappLeads.phone, phoneNumber)).limit(1).then(res => res[0]);
  
  // Step 7: Delivery Queue with 3-second delays
  const totalPosts = 6;
  
  for (let i = 1; i <= totalPosts; i++) {
    // Generate the personalized post overlay
    const imageUrl = await generateHookCard(lead.niche, lead.business_name, phoneNumber, post_${i});
    
    // Calculate 3-second staggered delay
    setTimeout(async () => {
      await sendWhatsAppImage(remoteJid, imageUrl, Post ${i}/6: Use this caption...);
    }, i * 3000); 
  }
}
