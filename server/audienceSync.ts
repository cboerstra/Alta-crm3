// Keeps the CRM's Meta Custom Audiences in step with Meta: creates them in the
// ad account, uploads CRM lists (hashed) and refreshes Meta's size estimates.
// CRM lists are re-uploaded daily, so a lead who moves stage moves audience too.

import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { getDb } from "./db";
import { getMetaSettings } from "./marketingDb";
import { agentContacts, leads, metaAudiences, mortgageClients, type MetaAudience } from "../drizzle/schema";
import {
  createCustomerListAudience,
  createWebsiteAudience,
  deleteAudience,
  getAudienceInfo,
  hashMembers,
  replaceAudienceMembers,
  type AudienceDefinition,
  type CrmListAudienceDefinition,
  type ListMember,
} from "./meta/audiences";
import type { MetaCredentials } from "./meta/marketingApi";

export class AudienceError extends Error {}

export async function metaCredentials(): Promise<{ creds: MetaCredentials; pixelId: string | null }> {
  const s = await getMetaSettings();
  if (!s?.adAccountId || !s.accessToken) {
    throw new AudienceError("Connect a Meta ad account in Settings → Meta Ads first.");
  }
  return {
    creds: {
      adAccountId: s.adAccountId,
      accessToken: s.accessToken,
      apiVersion: s.apiVersion ?? undefined,
      pageId: s.pageId,
      instagramActorId: s.instagramActorId,
    },
    pixelId: s.pixelId ?? null,
  };
}

const errText = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** The CRM contacts a list audience covers. Opted-out agents and clients are never included. */
export async function loadListMembers(def: CrmListAudienceDefinition): Promise<ListMember[]> {
  const db = await getDb();
  const tagMatch = (column: typeof agentContacts.tags | typeof mortgageClients.tags) =>
    def.tag ? sql`JSON_CONTAINS(${column}, ${JSON.stringify(def.tag)}, '$')` : undefined;

  if (def.source === "leads") {
    const where = def.stages?.length ? inArray(leads.stage, def.stages as any) : undefined;
    return db.select({ email: leads.email, phone: leads.phone, firstName: leads.firstName, lastName: leads.lastName })
      .from(leads).where(where);
  }
  if (def.source === "agents") {
    return db.select({
      email: agentContacts.email, phone: agentContacts.phone,
      firstName: agentContacts.firstName, lastName: agentContacts.lastName,
    }).from(agentContacts).where(and(eq(agentContacts.optedOut, false), tagMatch(agentContacts.tags)));
  }
  return db.select({
    email: mortgageClients.email, phone: mortgageClients.phone,
    firstName: mortgageClients.firstName, lastName: mortgageClients.lastName,
  }).from(mortgageClients).where(and(eq(mortgageClients.optedOut, false), tagMatch(mortgageClients.tags)));
}

async function save(id: number, data: Partial<MetaAudience>) {
  const db = await getDb();
  await db.update(metaAudiences).set(data).where(eq(metaAudiences.id, id));
}

/** Ask Meta for the audience's size. Meta needs time to build an audience, so this may be empty at first. */
async function refreshSize(row: MetaAudience, creds: MetaCredentials): Promise<void> {
  if (!row.metaAudienceId) return;
  const info = await getAudienceInfo(creds, row.metaAudienceId);
  const low = info.approximate_count_lower_bound;
  const high = info.approximate_count_upper_bound;
  await save(row.id, {
    sizeLow: typeof low === "number" && low >= 0 ? low : null,
    sizeHigh: typeof high === "number" && high >= 0 ? high : null,
  });
}

/**
 * Bring one audience up to date: create it in Meta if needed, upload a CRM
 * list's members, refresh the size. Failures are stored on the row, not thrown,
 * except "Meta isn't connected", which the caller should show.
 */
export async function syncAudience(id: number): Promise<MetaAudience> {
  const db = await getDb();
  const [row] = await db.select().from(metaAudiences).where(eq(metaAudiences.id, id)).limit(1);
  if (!row) throw new AudienceError("Audience not found.");
  const { creds, pixelId } = await metaCredentials();
  const def = row.definition as AudienceDefinition;

  await save(id, { status: "syncing", lastError: null });
  try {
    let metaAudienceId = row.metaAudienceId;
    if (!metaAudienceId) {
      if (def.kind === "website") {
        if (!pixelId) throw new AudienceError("Add your Meta Pixel ID in Settings → Meta Ads first.");
        metaAudienceId = (await createWebsiteAudience(creds, {
          name: row.name, pixelId, definition: def,
          description: "Created by the CRM from landing page visits.",
        })).id;
      } else {
        metaAudienceId = (await createCustomerListAudience(creds, {
          name: row.name, description: "Synced daily from the CRM.",
        })).id;
      }
      await save(id, { metaAudienceId });
    }

    let memberCount = row.memberCount;
    if (def.kind === "crm_list") {
      const rows = hashMembers(await loadListMembers(def));
      // Meta refuses an empty upload; an empty list simply isn't sent.
      memberCount = rows.length > 0 ? await replaceAudienceMembers(creds, metaAudienceId, rows) : 0;
    }
    await save(id, { status: "ready", memberCount, lastSyncedAt: new Date(), lastError: null });
    await refreshSize({ ...row, metaAudienceId }, creds).catch(() => {});
  } catch (err) {
    await save(id, { status: "error", lastError: errText(err) });
  }
  const [updated] = await db.select().from(metaAudiences).where(eq(metaAudiences.id, id)).limit(1);
  return updated;
}

/** Remove from Meta, then from the CRM. */
export async function removeAudience(id: number): Promise<void> {
  const db = await getDb();
  const [row] = await db.select().from(metaAudiences).where(eq(metaAudiences.id, id)).limit(1);
  if (!row) return;
  if (row.metaAudienceId) {
    const { creds } = await metaCredentials();
    try {
      await deleteAudience(creds, row.metaAudienceId);
    } catch (err) {
      // Already gone in Meta is fine; anything else stops the delete so nothing is orphaned.
      if (!/does not exist|cannot be loaded|Unsupported delete/i.test(errText(err))) throw err;
    }
  }
  await db.delete(metaAudiences).where(eq(metaAudiences.id, id));
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Daily job: re-upload CRM lists synced over ~a day ago, and refresh website audience sizes. */
export async function syncDueAudiences(): Promise<number> {
  const s = await getMetaSettings();
  if (!s?.adAccountId || !s.accessToken) return 0;
  const db = await getDb();
  const rows = await db.select().from(metaAudiences).where(isNotNull(metaAudiences.metaAudienceId));
  let synced = 0;
  for (const row of rows) {
    const stale = !row.lastSyncedAt || Date.now() - new Date(row.lastSyncedAt).getTime() > DAY_MS - 60 * 60 * 1000;
    if (!stale || row.status === "syncing") continue;
    await syncAudience(row.id);
    synced++;
  }
  return synced;
}

/**
 * Meta audience ids for an ad set, from the CRM audience ids a campaign stores.
 * Throws with the names of any audience not yet created in Meta.
 */
export async function resolveMetaAudienceIds(ids: number[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const db = await getDb();
  const rows = await db.select().from(metaAudiences).where(inArray(metaAudiences.id, ids));
  const missing = ids.filter((id) => !rows.some((r) => r.id === id));
  if (missing.length) throw new AudienceError("An audience on this campaign was deleted. Remove it from the campaign's audiences.");
  const notReady = rows.filter((r) => !r.metaAudienceId);
  if (notReady.length) {
    throw new AudienceError(`Sync these audiences to Meta first: ${notReady.map((r) => r.name).join(", ")}.`);
  }
  return rows.map((r) => r.metaAudienceId!);
}
