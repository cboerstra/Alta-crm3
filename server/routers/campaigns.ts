import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { unsubscribeByTrackingId } from "../unsubscribe";
import { emailCampaigns, campaignRecipients, agentContacts, mortgageClients, leads, integrations } from "../../drizzle/schema";
import { eq, and, like, or, sql, desc, inArray } from "drizzle-orm";
import { sendEmail as sendGmailEmail } from "../email";
import { randomUUID } from "crypto";

async function getGmailCredentials() {
  const db = await getDb();
  const rows = await db.select().from(integrations).where(eq(integrations.provider, "gmail")).limit(1);
  const row = rows[0];
  if (!row?.accessToken || !row.accountEmail) return null;
  const enabled = (row.metadata as { enabled?: boolean } | null)?.enabled !== false;
  if (!enabled) return null;
  return { gmailAddress: row.accountEmail, appPassword: row.accessToken };
}

let activeSendJob: { campaignId: number; abort: boolean } | null = null;

/**
 * Leads have no opted-out flag of their own; their unsubscribes live on the
 * campaign_recipients rows. Without this, a lead who unsubscribed from one
 * campaign was picked again for the next.
 */
/**
 * The sender named in each campaign's footer, by which business is writing:
 * Equity Real Estate to agents and real-estate prospects, Alta Mortgage
 * Group to mortgage clients and prospects. Override either in .env.
 */
function mailingAddress(audience: string): string {
  const realEstate = audience === "re_agent" || audience === "prospective_re_client";
  return realEstate
    ? process.env.MAILING_ADDRESS_REAL_ESTATE?.trim() || "Equity Real Estate · 4824 S 6150 W, Hooper, UT 84315"
    : process.env.MAILING_ADDRESS_MORTGAGE?.trim() || "Clarke and Associates dba Alta Mortgage Group · 4824 S 6150 W, Hooper, UT 84315";
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const leadNotUnsubscribed = sql`NOT EXISTS (SELECT 1 FROM campaign_recipients cr WHERE cr.leadId = ${leads.id} AND cr.status = 'unsubscribed')`;

export const campaignsRouter = router({
  list: protectedProcedure
    .input(z.object({
      status: z.string().optional(),
      limit: z.number().default(25),
      offset: z.number().default(0),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      const where = input.status ? eq(emailCampaigns.status, input.status as any) : undefined;
      const [rows, countResult] = await Promise.all([
        db.select().from(emailCampaigns).where(where)
          .orderBy(desc(emailCampaigns.createdAt))
          .limit(input.limit).offset(input.offset),
        db.select({ count: sql<number>`count(*)` }).from(emailCampaigns).where(where),
      ]);
      return { campaigns: rows, total: countResult[0]?.count ?? 0 };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      const rows = await db.select().from(emailCampaigns).where(eq(emailCampaigns.id, input.id)).limit(1);
      if (!rows[0]) return null;

      const recipients = await db.select().from(campaignRecipients)
        .where(eq(campaignRecipients.campaignId, input.id));

      const stats = {
        pending: 0, sent: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0,
      };
      for (const r of recipients) {
        stats[r.status as keyof typeof stats]++;
      }

      return { ...rows[0], recipientStats: stats };
    }),

  create: protectedProcedure
    .input(z.object({
      audience: z.enum(["re_agent", "past_mortgage", "prospective_mortgage", "prospective_re_client"]).default("re_agent"),
      name: z.string().min(1),
      subject: z.string().min(1),
      bodyHtml: z.string().min(1),
      fromName: z.string().default("Scott Boerstra"),
      landingPageId: z.number().optional(),
      filterTags: z.array(z.string()).optional(),
      filterBrokerage: z.string().optional(),
      filterCity: z.string().optional(),
      filterState: z.string().max(2).optional(),
      filterLoanType: z.string().optional(),
      filterSource: z.string().optional(),
      filterStage: z.string().optional(),
      batchSize: z.number().min(1).max(200).default(50),
      batchDelayMinutes: z.number().min(1).max(120).default(15),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      const { filterLoanType, filterSource, filterStage, ...rest } = input;
      const result = await db.insert(emailCampaigns).values({
        ...rest,
        createdBy: ctx.user.id,
        filterTags: input.filterTags ?? null,
      });
      return { id: result[0].insertId };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      subject: z.string().optional(),
      bodyHtml: z.string().optional(),
      fromName: z.string().optional(),
      landingPageId: z.number().nullable().optional(),
      filterTags: z.array(z.string()).optional(),
      filterBrokerage: z.string().nullable().optional(),
      filterCity: z.string().nullable().optional(),
      filterState: z.string().max(2).nullable().optional(),
      batchSize: z.number().min(1).max(200).optional(),
      batchDelayMinutes: z.number().min(1).max(120).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const { id, ...data } = input;
      await db.update(emailCampaigns).set(data).where(eq(emailCampaigns.id, id));
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      await db.delete(campaignRecipients).where(eq(campaignRecipients.campaignId, input.id));
      await db.delete(emailCampaigns).where(eq(emailCampaigns.id, input.id));
      return { success: true };
    }),

  previewRecipients: protectedProcedure
    .input(z.object({
      audience: z.enum(["re_agent", "past_mortgage", "prospective_mortgage", "prospective_re_client"]).default("re_agent"),
      filterTags: z.array(z.string()).optional(),
      filterBrokerage: z.string().optional(),
      filterCity: z.string().optional(),
      filterState: z.string().max(2).optional(),
      filterLoanType: z.string().optional(),
      filterSource: z.string().optional(),
      filterStage: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();

      if (input.audience === "re_agent") {
        const conditions = [eq(agentContacts.optedOut, false)];
        if (input.filterBrokerage) conditions.push(eq(agentContacts.brokerage, input.filterBrokerage));
        if (input.filterCity) conditions.push(eq(agentContacts.city, input.filterCity));
        if (input.filterState) conditions.push(eq(agentContacts.state, input.filterState));
        if (input.filterTags?.length) {
          for (const tag of input.filterTags) {
            conditions.push(sql`JSON_CONTAINS(${agentContacts.tags}, ${JSON.stringify(tag)}, '$')`);
          }
        }
        const [countResult] = await db.select({ count: sql<number>`count(*)` })
          .from(agentContacts).where(and(...conditions));
        return { count: countResult?.count ?? 0 };
      }

      if (input.audience === "past_mortgage") {
        const conditions = [eq(mortgageClients.optedOut, false)];
        if (input.filterCity) conditions.push(eq(mortgageClients.city, input.filterCity));
        if (input.filterState) conditions.push(eq(mortgageClients.state, input.filterState));
        if (input.filterLoanType) conditions.push(eq(mortgageClients.loanType, input.filterLoanType));
        if (input.filterTags?.length) {
          for (const tag of input.filterTags) {
            conditions.push(sql`JSON_CONTAINS(${mortgageClients.tags}, ${JSON.stringify(tag)}, '$')`);
          }
        }
        const [countResult] = await db.select({ count: sql<number>`count(*)` })
          .from(mortgageClients).where(and(...conditions));
        return { count: countResult?.count ?? 0 };
      }

      // prospective_mortgage or prospective_re_client — both target leads
      const conditions: any[] = [leadNotUnsubscribed];
      if (input.filterCity) conditions.push(sql`1=1`); // leads don't have city yet
      if (input.filterSource) conditions.push(eq(leads.source, input.filterSource));
      if (input.filterStage) conditions.push(eq(leads.stage, input.filterStage as any));
      if (input.filterState) conditions.push(sql`1=1`); // leads don't have state column

      const [countResult] = await db.select({ count: sql<number>`count(*)` })
        .from(leads).where(conditions.length ? and(...conditions) : undefined);
      return { count: countResult?.count ?? 0 };
    }),

  send: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const [campaign] = await db.select().from(emailCampaigns)
        .where(eq(emailCampaigns.id, input.id)).limit(1);

      if (!campaign) throw new Error("Campaign not found");
      if (campaign.status !== "draft" && campaign.status !== "paused") {
        throw new Error(`Campaign cannot be sent from status: ${campaign.status}`);
      }

      const creds = await getGmailCredentials();
      if (!creds) throw new Error("Gmail not configured. Set up Gmail integration first.");

      // Resuming a paused campaign carries on with the recipients it still owes.
      // Rebuilding the list here re-sent the email to everyone already reached
      // and erased who had unsubscribed from it.
      if (campaign.status === "paused") {
        await db.update(emailCampaigns).set({ status: "sending" }).where(eq(emailCampaigns.id, campaign.id));
        sendBatches(campaign.id, campaign.batchSize, campaign.batchDelayMinutes).catch(err => {
          console.error(`[Campaign ${campaign.id}] Batch send error:`, err);
        });
        return { recipientCount: campaign.totalRecipients ?? 0, status: "sending" };
      }

      let recipients: { id: number; email: string; firstName: string; lastName: string }[];

      if (campaign.audience === "re_agent") {
        const conditions = [eq(agentContacts.optedOut, false)];
        if (campaign.filterBrokerage) conditions.push(eq(agentContacts.brokerage, campaign.filterBrokerage));
        if (campaign.filterCity) conditions.push(eq(agentContacts.city, campaign.filterCity));
        if (campaign.filterState) conditions.push(eq(agentContacts.state, campaign.filterState));
        if (campaign.filterTags && Array.isArray(campaign.filterTags) && (campaign.filterTags as string[]).length > 0) {
          for (const tag of campaign.filterTags as string[]) {
            conditions.push(sql`JSON_CONTAINS(${agentContacts.tags}, ${JSON.stringify(tag)}, '$')`);
          }
        }
        recipients = await db.select({
          id: agentContacts.id, email: agentContacts.email,
          firstName: agentContacts.firstName, lastName: agentContacts.lastName,
        }).from(agentContacts).where(and(...conditions));
      } else if (campaign.audience === "past_mortgage") {
        const conditions = [eq(mortgageClients.optedOut, false)];
        if (campaign.filterCity) conditions.push(eq(mortgageClients.city, campaign.filterCity));
        if (campaign.filterState) conditions.push(eq(mortgageClients.state, campaign.filterState));
        if (campaign.filterTags && Array.isArray(campaign.filterTags) && (campaign.filterTags as string[]).length > 0) {
          for (const tag of campaign.filterTags as string[]) {
            conditions.push(sql`JSON_CONTAINS(${mortgageClients.tags}, ${JSON.stringify(tag)}, '$')`);
          }
        }
        recipients = await db.select({
          id: mortgageClients.id, email: mortgageClients.email,
          firstName: mortgageClients.firstName, lastName: mortgageClients.lastName,
        }).from(mortgageClients).where(and(...conditions));
      } else {
        // prospective_mortgage or prospective_re_client — both target leads
        const conditions: any[] = [leadNotUnsubscribed];
        if (campaign.filterTags && Array.isArray(campaign.filterTags) && (campaign.filterTags as string[]).length > 0) {
          for (const tag of campaign.filterTags as string[]) {
            conditions.push(sql`JSON_CONTAINS(${leads.quickNote}, ${JSON.stringify(tag)}, '$')`);
          }
        }
        recipients = await db.select({
          id: leads.id, email: leads.email,
          firstName: leads.firstName, lastName: leads.lastName,
        }).from(leads).where(conditions.length ? and(...conditions) : undefined);
      }

      if (recipients.length === 0) throw new Error("No matching recipients found");

      await db.delete(campaignRecipients).where(eq(campaignRecipients.campaignId, campaign.id));

      const recipientRows = recipients.map(r => ({
        campaignId: campaign.id,
        agentContactId: campaign.audience === "re_agent" ? r.id : null,
        mortgageClientId: campaign.audience === "past_mortgage" ? r.id : null,
        leadId: (campaign.audience === "prospective_mortgage" || campaign.audience === "prospective_re_client") ? r.id : null,
        trackingId: randomUUID().replace(/-/g, "").slice(0, 32),
      }));

      for (let i = 0; i < recipientRows.length; i += 100) {
        await db.insert(campaignRecipients).values(recipientRows.slice(i, i + 100));
      }

      await db.update(emailCampaigns).set({
        status: "sending",
        startedAt: new Date(),
        totalRecipients: recipients.length,
        totalSent: 0,
      }).where(eq(emailCampaigns.id, campaign.id));

      sendBatches(campaign.id, campaign.batchSize, campaign.batchDelayMinutes).catch(err => {
        console.error(`[Campaign ${campaign.id}] Batch send error:`, err);
      });

      return { recipientCount: recipients.length, status: "sending" };
    }),

  pause: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (activeSendJob?.campaignId === input.id) {
        activeSendJob.abort = true;
      }
      await db.update(emailCampaigns).set({ status: "paused" })
        .where(eq(emailCampaigns.id, input.id));
      return { success: true };
    }),

  trackOpen: publicProcedure
    .input(z.object({ trackingId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      const [recipient] = await db.select().from(campaignRecipients)
        .where(eq(campaignRecipients.trackingId, input.trackingId)).limit(1);

      if (recipient && !recipient.openedAt) {
        await db.update(campaignRecipients).set({
          status: "opened",
          openedAt: new Date(),
        }).where(eq(campaignRecipients.id, recipient.id));

        await db.update(emailCampaigns).set({
          totalOpened: sql`totalOpened + 1`,
        }).where(eq(emailCampaigns.id, recipient.campaignId));
      }

      // Return 1x1 transparent GIF
      return null;
    }),

  trackClick: publicProcedure
    .input(z.object({ trackingId: z.string(), url: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      const [recipient] = await db.select().from(campaignRecipients)
        .where(eq(campaignRecipients.trackingId, input.trackingId)).limit(1);

      if (recipient && !recipient.clickedAt) {
        await db.update(campaignRecipients).set({
          status: "clicked",
          clickedAt: new Date(),
        }).where(eq(campaignRecipients.id, recipient.id));

        await db.update(emailCampaigns).set({
          totalClicked: sql`totalClicked + 1`,
        }).where(eq(emailCampaigns.id, recipient.campaignId));
      }

      return { redirect: input.url };
    }),

  unsubscribe: publicProcedure
    .input(z.object({ trackingId: z.string() }))
    .mutation(async ({ input }) => {
      await unsubscribeByTrackingId(input.trackingId);
      return { success: true };
    }),
});

async function sendBatches(campaignId: number, batchSize: number, delayMinutes: number) {
  const db = await getDb();
  activeSendJob = { campaignId, abort: false };

  try {
    const creds = await getGmailCredentials();
    if (!creds) throw new Error("Gmail credentials unavailable");

    const [campaign] = await db.select().from(emailCampaigns)
      .where(eq(emailCampaigns.id, campaignId)).limit(1);
    if (!campaign) throw new Error("Campaign not found");

    const baseUrl = process.env.PUBLIC_URL || "https://altamortgagecrm.net";

    while (true) {
      if (activeSendJob?.abort) {
        console.log(`[Campaign ${campaignId}] Paused by user`);
        break;
      }

      const [statusCheck] = await db.select({ status: emailCampaigns.status })
        .from(emailCampaigns).where(eq(emailCampaigns.id, campaignId)).limit(1);
      if (statusCheck?.status !== "sending") break;

      let batch: { id: number; trackingId: string | null; email: string; firstName: string; lastName: string }[];
      const pendingWhere = and(
        eq(campaignRecipients.campaignId, campaignId),
        eq(campaignRecipients.status, "pending"),
      );

      if (campaign.audience === "re_agent") {
        batch = await db.select({
          id: campaignRecipients.id, trackingId: campaignRecipients.trackingId,
          email: agentContacts.email, firstName: agentContacts.firstName, lastName: agentContacts.lastName,
        }).from(campaignRecipients)
          .innerJoin(agentContacts, eq(campaignRecipients.agentContactId, agentContacts.id))
          // Re-checked every batch: someone who opts out mid-campaign gets nothing more.
          .where(and(pendingWhere, eq(agentContacts.optedOut, false))).limit(batchSize);
      } else if (campaign.audience === "past_mortgage") {
        batch = await db.select({
          id: campaignRecipients.id, trackingId: campaignRecipients.trackingId,
          email: mortgageClients.email, firstName: mortgageClients.firstName, lastName: mortgageClients.lastName,
        }).from(campaignRecipients)
          .innerJoin(mortgageClients, eq(campaignRecipients.mortgageClientId, mortgageClients.id))
          .where(and(pendingWhere, eq(mortgageClients.optedOut, false))).limit(batchSize);
      } else {
        batch = await db.select({
          id: campaignRecipients.id, trackingId: campaignRecipients.trackingId,
          email: leads.email, firstName: leads.firstName, lastName: leads.lastName,
        }).from(campaignRecipients)
          .innerJoin(leads, eq(campaignRecipients.leadId, leads.id))
          .where(and(pendingWhere, leadNotUnsubscribed)).limit(batchSize);
      }

      if (batch.length === 0) {
        await db.update(emailCampaigns).set({
          status: "completed",
          completedAt: new Date(),
        }).where(eq(emailCampaigns.id, campaignId));
        console.log(`[Campaign ${campaignId}] Completed`);
        break;
      }

      console.log(`[Campaign ${campaignId}] Sending batch of ${batch.length}`);

      for (const recipient of batch) {
        if (activeSendJob?.abort) break;

        try {
          let html = campaign.bodyHtml;
          html = html.replace(/\{\{first_name\}\}/g, recipient.firstName || "");
          html = html.replace(/\{\{last_name\}\}/g, recipient.lastName || "");
          html = html.replace(/\{\{full_name\}\}/g,
            [recipient.firstName, recipient.lastName].filter(Boolean).join(" ") || "");

          const trackPixel = `<img src="${baseUrl}/api/track/open?tid=${recipient.trackingId}" width="1" height="1" style="display:none" alt="" />`;
          html += trackPixel;

          const unsubLink = `${baseUrl}/unsubscribe?tid=${recipient.trackingId}`;
          // CAN-SPAM: every commercial email needs a working opt-out and the
          // sender's postal address.
          html += `<p style="font-size:11px;color:#999;margin-top:30px;">If you no longer wish to receive these emails, <a href="${unsubLink}">unsubscribe here</a>.<br>${escapeHtml(mailingAddress(campaign.audience))}</p>`;

          await sendGmailEmail(creds.gmailAddress, creds.appPassword, {
            from: `${campaign.fromName || "Scott Boerstra"} <${creds.gmailAddress}>`,
            to: recipient.email,
            subject: campaign.subject,
            html,
            // RFC 8058 one-click unsubscribe: Gmail and Yahoo show their own
            // "Unsubscribe" button and POST here. Required of bulk senders.
            headers: {
              "List-Unsubscribe": `<${unsubLink}>`,
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            },
          });

          await db.update(campaignRecipients).set({
            status: "sent",
            sentAt: new Date(),
          }).where(eq(campaignRecipients.id, recipient.id));

          await db.update(emailCampaigns).set({
            totalSent: sql`totalSent + 1`,
          }).where(eq(emailCampaigns.id, campaignId));

        } catch (err) {
          console.error(`[Campaign ${campaignId}] Failed to send to ${recipient.email}:`, err);
          await db.update(campaignRecipients).set({ status: "bounced" })
            .where(eq(campaignRecipients.id, recipient.id));
          await db.update(emailCampaigns).set({
            totalBounced: sql`totalBounced + 1`,
          }).where(eq(emailCampaigns.id, campaignId));
        }
      }

      // Delay between batches
      if (!activeSendJob?.abort) {
        console.log(`[Campaign ${campaignId}] Waiting ${delayMinutes} minutes before next batch`);
        await new Promise(resolve => setTimeout(resolve, delayMinutes * 60 * 1000));
      }
    }
  } finally {
    activeSendJob = null;
  }
}
