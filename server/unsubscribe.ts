// Unsubscribing from a campaign email, shared by the /unsubscribe page, the
// one-click List-Unsubscribe POST that Gmail and Yahoo send, and the tRPC
// mutation.

import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { agentContacts, campaignRecipients, mortgageClients } from "../drizzle/schema";

/**
 * Mark the recipient unsubscribed and, for agents and past clients, opt the
 * contact out of every future campaign. Leads are excluded by their
 * recipient rows instead (see leadNotUnsubscribed in routers/campaigns.ts).
 * Returns false when the tracking id matches nothing.
 */
export async function unsubscribeByTrackingId(trackingId: string): Promise<boolean> {
  if (!/^[a-zA-Z0-9]{8,64}$/.test(trackingId)) return false;
  const db = await getDb();
  const [recipient] = await db.select().from(campaignRecipients)
    .where(eq(campaignRecipients.trackingId, trackingId)).limit(1);
  if (!recipient) return false;

  await db.update(campaignRecipients).set({ status: "unsubscribed" })
    .where(eq(campaignRecipients.id, recipient.id));
  if (recipient.agentContactId) {
    await db.update(agentContacts).set({ optedOut: true, optOutDate: new Date() })
      .where(eq(agentContacts.id, recipient.agentContactId));
  } else if (recipient.mortgageClientId) {
    await db.update(mortgageClients).set({ optedOut: true, optOutDate: new Date() })
      .where(eq(mortgageClients.id, recipient.mortgageClientId));
  }
  return true;
}
