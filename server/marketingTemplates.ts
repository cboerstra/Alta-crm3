/**
 * Built-in landing page templates.
 *
 * These are the reusable, branded starting points a campaign picks from. They
 * are seeded on startup and upgraded in place: editable copy (headline, body,
 * CTA) is only written on first insert, so an operator's wording survives a
 * deploy, while structural fields (the step flow, the conversion event) are kept
 * current with the code that renders them.
 */

import { createTemplate, getTemplateByKey, updateTemplate } from "./marketingDb";
import type { InsertLandingPageTemplate } from "../drizzle/schema";

/** One screen in a multi-step capture flow. */
export type TemplateStep = {
  key: string;
  title: string;
  subtitle?: string;
  /** Field keys collected on this step. */
  fields: string[];
  ctaText?: string;
};

export type SystemTemplate = Omit<InsertLandingPageTemplate, "steps"> & {
  steps?: TemplateStep[];
};

export const SYSTEM_TEMPLATES: SystemTemplate[] = [
  {
    key: "home-value",
    name: "What's My Home Worth?",
    category: "home_value",
    description:
      "The Facebook-ad workhorse: address first, value second, contact details last. Asking for the address before the phone number is what makes this convert — the visitor is answering a question about their house, not filling out a lead form.",
    headline: "What's Your Home Worth Today?",
    subheadline: "Get an instant estimate for your {{city}} home — no obligation, no agent calls unless you ask.",
    bodyText:
      "Home values across Utah have moved sharply over the last two years. Enter your address to see a current estimate, what you likely owe versus what you could net, and whether refinancing makes sense at today's rates.",
    ctaText: "See My Home Value",
    steps: [
      { key: "address", title: "What's your address?", subtitle: "We'll pull current comparable sales for your street.", fields: ["street", "city", "state", "zip"], ctaText: "Continue" },
      { key: "details", title: "A few details", subtitle: "This sharpens the estimate.", fields: ["beds", "baths", "squareFeet", "condition"], ctaText: "Continue" },
      { key: "contact", title: "Where should we send it?", subtitle: "Your report is ready.", fields: ["firstName", "lastName", "email", "phone"], ctaText: "Get My Report" },
    ],
    enabledFields: ["firstName", "lastName", "email", "phone"],
    conversionEventName: "Lead",
    confirmationEmailSubject: "Your home value report is on the way",
    confirmationEmailBody:
      "<p>Hi {{firstName}},</p><p>Thanks for requesting a home value estimate. We're pulling current comparable sales for your address and will follow up shortly with your report.</p><p>— Alta Mortgage Group</p>",
    isSystem: true,
  },
  {
    key: "down-payment-grant",
    name: "Down Payment Grant",
    category: "grant",
    description:
      "For county and state assistance programs (Weber County, Utah Housing, employer grants). Leads with the dollar amount and the eligibility question, because that is what stops the scroll.",
    headline: "Up to {{grantAmount}} in Down Payment Help",
    subheadline: "{{countyName}} buyers may qualify for assistance that never has to be repaid.",
    bodyText:
      "Grant funds are limited and awarded first-come, first-served. Answer four questions to find out whether you qualify and how much you could receive toward your down payment and closing costs.",
    ctaText: "Check My Eligibility",
    steps: [
      { key: "eligibility", title: "Are you buying in {{countyName}}?", fields: ["county", "purchaseTimeline"], ctaText: "Continue" },
      { key: "qualify", title: "A few quick questions", subtitle: "Grant programs have income and first-time-buyer rules.", fields: ["householdSize", "annualIncome", "firstTimeBuyer"], ctaText: "Continue" },
      { key: "contact", title: "See if you qualify", fields: ["firstName", "lastName", "email", "phone"], ctaText: "Check Eligibility" },
    ],
    enabledFields: ["firstName", "lastName", "email", "phone"],
    conversionEventName: "Lead",
    confirmationEmailSubject: "Your down payment assistance eligibility",
    confirmationEmailBody:
      "<p>Hi {{firstName}},</p><p>Thanks for checking your eligibility. A loan officer will review your answers against the current program guidelines and reach out with next steps.</p><p>— Alta Mortgage Group</p>",
    isSystem: true,
  },
  {
    key: "rate-quote",
    name: "Purchase Rate Quote",
    category: "purchase",
    description: "Straightforward quote request for purchase-intent traffic. Short form, fast follow-up.",
    headline: "Get Your Real Rate in Minutes",
    subheadline: "No credit pull to see options. No spam.",
    bodyText:
      "Advertised rates are averages. Yours depends on your credit, down payment and the property. Tell us a little and we'll send back real numbers you can plan around.",
    ctaText: "Get My Quote",
    steps: [
      { key: "loan", title: "What are you looking to do?", fields: ["loanPurpose", "purchasePrice", "downPayment"], ctaText: "Continue" },
      { key: "contact", title: "Where should we send your quote?", fields: ["firstName", "lastName", "email", "phone"], ctaText: "Send My Quote" },
    ],
    enabledFields: ["firstName", "lastName", "email", "phone"],
    conversionEventName: "Lead",
    confirmationEmailSubject: "Your rate quote request",
    confirmationEmailBody:
      "<p>Hi {{firstName}},</p><p>We received your quote request and will send real numbers shortly.</p><p>— Alta Mortgage Group</p>",
    isSystem: true,
  },
  {
    key: "refi-savings",
    name: "Refinance Savings Check",
    category: "refinance",
    description: "Retargeting workhorse for existing homeowners. Frames the offer as a monthly number, not a rate.",
    headline: "Could You Cut Your Payment?",
    subheadline: "See what a refinance would do to your monthly payment at today's rates.",
    bodyText:
      "If you bought or refinanced in the last three years, a rate change of even half a point can be worth hundreds a month. Run the numbers on your actual loan — it takes about a minute.",
    ctaText: "Check My Savings",
    steps: [
      { key: "loan", title: "Your current loan", fields: ["currentBalance", "currentRate", "currentPayment"], ctaText: "Continue" },
      { key: "contact", title: "Where should we send your comparison?", fields: ["firstName", "lastName", "email", "phone"], ctaText: "Show My Savings" },
    ],
    enabledFields: ["firstName", "lastName", "email", "phone"],
    conversionEventName: "Lead",
    confirmationEmailSubject: "Your refinance comparison",
    confirmationEmailBody:
      "<p>Hi {{firstName}},</p><p>Thanks for requesting a refinance comparison. We'll follow up with a side-by-side of your current loan against today's options.</p><p>— Alta Mortgage Group</p>",
    isSystem: true,
  },
  {
    key: "webinar-registration",
    name: "Webinar Registration",
    category: "webinar",
    description: "Registration page for a live or recorded webinar. Pairs with the CRM's existing webinar reminders.",
    headline: "Free Home Buying Workshop",
    subheadline: "Live with a local loan officer — bring your questions.",
    bodyText:
      "A plain-English walkthrough of what it actually takes to buy in this market: credit, down payment, grant programs and what lenders look at. Register free and we'll send the replay whether or not you can make it live.",
    ctaText: "Save My Seat",
    enabledFields: ["firstName", "lastName", "email", "phone", "sessionSelect"],
    conversionEventName: "CompleteRegistration",
    confirmationEmailSubject: "You're registered!",
    confirmationEmailBody:
      "<p>Hi {{firstName}},</p><p>You're registered. We'll send a reminder before we go live.</p><p>— Alta Mortgage Group</p>",
    isSystem: true,
  },
  {
    key: "simple-lead-capture",
    name: "Simple Lead Capture",
    category: "general",
    description: "A clean, single-screen form. The fallback when a campaign needs a page and nothing fancier.",
    headline: "Let's Talk About Your Loan",
    subheadline: "A local loan officer will reach out — usually the same day.",
    bodyText: "Tell us how to reach you and what you're working on. No credit pull, no obligation.",
    ctaText: "Request a Call",
    enabledFields: ["firstName", "lastName", "email", "phone"],
    conversionEventName: "Lead",
    confirmationEmailSubject: "Thanks for reaching out",
    confirmationEmailBody:
      "<p>Hi {{firstName}},</p><p>Thanks for getting in touch. A loan officer will contact you shortly.</p><p>— Alta Mortgage Group</p>",
    isSystem: true,
  },
];

/**
 * Seeds the system templates, and keeps structural fields current on upgrade.
 *
 * Copy fields are intentionally not overwritten: once someone has tuned the
 * headline on the home-value page, a deploy must not silently revert it.
 */
export async function seedSystemTemplates(): Promise<void> {
  for (const template of SYSTEM_TEMPLATES) {
    try {
      const existing = await getTemplateByKey(template.key);
      if (!existing) {
        await createTemplate({ ...template, steps: template.steps ?? null } as InsertLandingPageTemplate);
        console.log(`[Templates] Seeded system template: ${template.key}`);
        continue;
      }
      // Structural refresh only.
      await updateTemplate(existing.id, {
        steps: (template.steps ?? null) as any,
        category: template.category,
        description: template.description,
        conversionEventName: template.conversionEventName,
        isSystem: true,
      });
    } catch (err) {
      console.error(`[Templates] Failed to seed ${template.key}:`, err instanceof Error ? err.message : err);
    }
  }
}
