/**
 * websiteLeads.ts
 * ──────────────────────────────────────────────────────────────────────────────
 * Public REST endpoint: POST /api/website-lead
 *
 * Accepts lead submissions from altamortgagegroup.net and creates them in the
 * CRM database. Protected by a shared API key stored in the WEBSITE_API_KEY
 * environment variable on the CRM server.
 *
 * Request body (JSON):
 * {
 *   apiKey:      string   — must match WEBSITE_API_KEY env var
 *   firstName:   string
 *   lastName:    string
 *   email:       string
 *   phone?:      string
 *   source?:     string   — e.g. "contact_form", "quote_form", "apply_form"
 *   message?:    string   — the question/note from the form
 *   smsConsent?: boolean
 *   loanType?:   string   — e.g. "DSCR", "FHA", "Conventional"
 * }
 *
 * Response:
 * { success: true, leadId: number }   on success
 * { success: false, error: string }   on failure
 */

import { Router } from "express";
import { createLead, logActivity, notifyAdminsBySms } from "./db";
import { notifyOwner } from "./_core/notification";
import { sendSmsOptInConfirmation } from "./smsReminderService";

export function registerWebsiteLeadRoute(app: Router) {
  // Allow preflight OPTIONS requests from altamortgagegroup.net
  app.options("/api/website-lead", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.status(204).end();
  });

  app.post("/api/website-lead", async (req, res) => {
    // CORS headers — allow requests from the mortgage website
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    try {
      const {
        apiKey,
        firstName,
        lastName,
        email,
        phone,
        source = "website_form",
        message,
        smsConsent = false,
        loanType,
      } = req.body ?? {};

      // ── API Key validation ──────────────────────────────────────────────────
      const expectedKey = process.env.WEBSITE_API_KEY;
      if (!expectedKey) {
        console.error("[WebsiteLead] WEBSITE_API_KEY is not set in environment variables.");
        res.status(500).json({ success: false, error: "Server configuration error." });
        return;
      }
      if (!apiKey || apiKey !== expectedKey) {
        res.status(401).json({ success: false, error: "Unauthorized: invalid API key." });
        return;
      }

      // ── Input validation ────────────────────────────────────────────────────
      if (!firstName || typeof firstName !== "string" || firstName.trim().length === 0) {
        res.status(400).json({ success: false, error: "firstName is required." });
        return;
      }
      if (!lastName || typeof lastName !== "string" || lastName.trim().length === 0) {
        res.status(400).json({ success: false, error: "lastName is required." });
        return;
      }
      if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        res.status(400).json({ success: false, error: "A valid email address is required." });
        return;
      }

      // ── Build campaign tag ──────────────────────────────────────────────────
      const campaignParts: string[] = ["altamortgagegroup.net"];
      if (loanType) campaignParts.push(loanType);
      const campaign = campaignParts.join(" — ");

      // ── Create lead in CRM ──────────────────────────────────────────────────
      const leadId = await createLead({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone?.trim() || undefined,
        source,
        campaign,
        smsConsent: Boolean(smsConsent),
        contactOptIn: Boolean(smsConsent),
        stage: "new_lead",
      });

      // ── Log initial activity ────────────────────────────────────────────────
      const noteLines: string[] = [
        `Lead submitted via altamortgagegroup.net`,
        `Form: ${source.replace(/_/g, " ")}`,
      ];
      if (loanType) noteLines.push(`Loan type of interest: ${loanType}`);
      if (message?.trim()) noteLines.push(`Message: ${message.trim()}`);

      await logActivity({
        leadId,
        type: "system",
        title: "Lead captured from website",
        content: noteLines.join("\n"),
      });

      // ── 10DLC: send opt-in confirmation SMS if consent given ────────────────
      if (smsConsent && phone?.trim()) {
        sendSmsOptInConfirmation(leadId, phone.trim()).catch(() => {});
      }

      // ── Notify owner (non-blocking) ─────────────────────────────────────────
      notifyOwner({
        title: "New Lead from altamortgagegroup.net",
        content: `${firstName.trim()} ${lastName.trim()} (${email.trim()}) submitted the ${source.replace(/_/g, " ")} on altamortgagegroup.net${loanType ? ` — Interested in: ${loanType}` : ""}`,
      }).catch(() => {/* non-critical */});

      // ── Notify admins via SMS (non-blocking) ────────────────────────────────
      const smsBody = [
        `New website lead: ${firstName.trim()} ${lastName.trim()}`,
        phone ? `Phone: ${phone.trim()}` : null,
        `Email: ${email.trim()}`,
        loanType ? `Loan: ${loanType}` : null,
        `Source: altamortgagegroup.net`,
      ].filter(Boolean).join(" | ");
      notifyAdminsBySms(smsBody).catch(() => {/* non-critical */});

      res.status(200).json({ success: true, leadId });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[WebsiteLead] Error creating lead:", msg);
      res.status(500).json({ success: false, error: "Failed to create lead. Please try again." });
    }
  });
}
