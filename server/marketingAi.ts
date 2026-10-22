/**
 * AI campaign drafting.
 *
 * "Create a Facebook campaign for the Weber County grant" becomes a complete
 * proposal: ad copy, targeting, budget, a landing page recommendation and a
 * nurture sequence. The model drafts; a person reviews and saves. Nothing here
 * writes to the database and nothing reaches Meta — drafting a campaign and
 * spending money on one are deliberately separate actions.
 */

import { invokeLLM } from "./_core/llm";
import { getTemplates } from "./marketingDb";
import { getSequences } from "./marketingDb";

export type CampaignDraft = {
  name: string;
  description: string;
  objective: "OUTCOME_LEADS" | "OUTCOME_TRAFFIC" | "OUTCOME_AWARENESS" | "OUTCOME_ENGAGEMENT" | "OUTCOME_SALES";
  dailyBudget: number | null;
  lifetimeBudget: number | null;
  durationDays: number | null;
  targeting: {
    countries: string[];
    zips: string[];
    ageMin: number;
    ageMax: number;
    rationale: string;
  };
  creative: {
    primaryText: string;
    headline: string;
    description: string;
    callToAction: string;
  };
  landingPage: {
    templateKey: string | null;
    title: string;
    headline: string;
    subheadline: string;
    bodyText: string;
    ctaText: string;
  };
  sequence: {
    name: string;
    steps: Array<{
      type: "email" | "sms" | "call_task" | "wait";
      delayMinutes: number;
      subject?: string;
      body?: string;
      taskTitle?: string;
    }>;
  };
  notes: string[];
};

const DRAFT_SCHEMA = {
  name: "campaign_draft",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["name", "description", "objective", "dailyBudget", "lifetimeBudget", "durationDays", "targeting", "creative", "landingPage", "sequence", "notes"],
    properties: {
      name: { type: "string", description: "Short campaign name, e.g. 'Weber County Grant — Spring'" },
      description: { type: "string" },
      objective: {
        type: "string",
        enum: ["OUTCOME_LEADS", "OUTCOME_TRAFFIC", "OUTCOME_AWARENESS", "OUTCOME_ENGAGEMENT", "OUTCOME_SALES"],
      },
      dailyBudget: { type: ["number", "null"], description: "USD per day" },
      lifetimeBudget: { type: ["number", "null"], description: "Total USD" },
      durationDays: { type: ["number", "null"] },
      targeting: {
        type: "object",
        additionalProperties: false,
        required: ["countries", "zips", "ageMin", "ageMax", "rationale"],
        properties: {
          countries: { type: "array", items: { type: "string" }, description: "ISO country codes, e.g. ['US']" },
          zips: { type: "array", items: { type: "string" }, description: "Meta zip keys, e.g. ['US:84401']" },
          ageMin: { type: "number" },
          ageMax: { type: "number" },
          rationale: { type: "string" },
        },
      },
      creative: {
        type: "object",
        additionalProperties: false,
        required: ["primaryText", "headline", "description", "callToAction"],
        properties: {
          primaryText: { type: "string", description: "Main ad body copy, 2-4 short sentences" },
          headline: { type: "string", description: "Under 40 characters" },
          description: { type: "string", description: "Under 30 characters" },
          callToAction: {
            type: "string",
            enum: ["LEARN_MORE", "SIGN_UP", "GET_QUOTE", "APPLY_NOW", "CONTACT_US", "GET_OFFER", "SUBSCRIBE"],
          },
        },
      },
      landingPage: {
        type: "object",
        additionalProperties: false,
        required: ["templateKey", "title", "headline", "subheadline", "bodyText", "ctaText"],
        properties: {
          templateKey: { type: ["string", "null"] },
          title: { type: "string" },
          headline: { type: "string" },
          subheadline: { type: "string" },
          bodyText: { type: "string" },
          ctaText: { type: "string" },
        },
      },
      sequence: {
        type: "object",
        additionalProperties: false,
        required: ["name", "steps"],
        properties: {
          name: { type: "string" },
          steps: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["type", "delayMinutes", "subject", "body", "taskTitle"],
              properties: {
                type: { type: "string", enum: ["email", "sms", "call_task", "wait"] },
                delayMinutes: { type: "number" },
                subject: { type: ["string", "null"] },
                body: { type: ["string", "null"] },
                taskTitle: { type: ["string", "null"] },
              },
            },
          },
        },
      },
      notes: {
        type: "array",
        items: { type: "string" },
        description: "Compliance or setup caveats the operator must review",
      },
    },
  },
} as const;

/**
 * Mortgage advertising is regulated. These constraints are non-negotiable and go
 * into every draft — a generated ad that promises a rate or targets by age or
 * neighbourhood is not a draft worth reviewing, it is a fair-lending problem.
 */
const COMPLIANCE_RULES = `
Hard rules for every draft:
- This is MORTGAGE/HOUSING advertising. On Meta it runs under the HOUSING special ad category,
  which BANS targeting by age, gender, ZIP-level radius under 15 miles, and most detailed interests.
  Draft targeting that stays legal: broad geography (city/region/state), age 18-65 only.
- Never state a specific interest rate, APR, payment amount, or approval guarantee.
- Never imply guaranteed approval, "no credit check", or government endorsement.
- Grant and assistance programs: say "may qualify", never "you qualify". Note that funds are limited
  and subject to program guidelines.
- No claims about competitors. No urgency language that misrepresents a real deadline.
- SMS steps must read as if the lead opted in, and must be short (under 320 characters).
`.trim();

export type DraftInput = {
  prompt: string;
  landingPage?: { id: number; title: string; slug: string; headline?: string | null } | null;
};

export type DraftOutput = {
  draft: CampaignDraft;
  /** Templates the draft can be built from, so the UI can preselect one. */
  availableTemplates: Array<{ id: number; key: string; name: string; category: string }>;
  availableSequences: Array<{ id: number; name: string }>;
  matchedTemplateId: number | null;
};

export async function draftCampaignWithAI(input: DraftInput): Promise<DraftOutput> {
  const [templates, sequences] = await Promise.all([getTemplates(), getSequences()]);

  const templateCatalog = templates
    .map((t) => `- ${t.key} (${t.category}): ${t.name} — ${t.description ?? ""}`)
    .join("\n");

  const systemPrompt = `You draft Facebook and Instagram ad campaigns for Alta Mortgage Group, a mortgage lender in Utah.
You produce a complete, reviewable campaign proposal: ad copy, targeting, budget, landing page copy, and a follow-up sequence.

${COMPLIANCE_RULES}

Landing page templates available (pick the best fit and return its key, or null if none fits):
${templateCatalog || "- (none configured yet)"}

Budget guidance: a local lead-generation campaign in a Utah county typically starts at $20-$50/day.
Do not propose a lifetime budget unless the request implies a fixed end date.

Follow-up sequence guidance: open with an email within minutes, a text a few hours later, a call task the
next business day, then a value email a few days on. Keep it to 4-6 steps.

Return copy that is specific to the request. Generic filler ("Contact us today for all your mortgage needs")
is a failed draft.`;

  const userPrompt = [
    `Campaign request: ${input.prompt}`,
    input.landingPage
      ? `An existing landing page is already selected: "${input.landingPage.title}" (/lp/${input.landingPage.slug}). Write copy consistent with it and set landingPage.templateKey to null.`
      : `No landing page is selected yet — recommend a template and draft the page copy.`,
    `Today's date: ${new Date().toISOString().slice(0, 10)}.`,
  ].join("\n\n");

  const result = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    responseFormat: { type: "json_schema", json_schema: DRAFT_SCHEMA as any },
    maxTokens: 4000,
  });

  const content = result.choices?.[0]?.message?.content;
  const text = typeof content === "string"
    ? content
    : Array.isArray(content)
      ? content.map((c) => ("text" in c ? c.text : "")).join("")
      : "";

  if (!text) throw new Error("The AI returned an empty draft. Try rephrasing the request.");

  let draft: CampaignDraft;
  try {
    draft = JSON.parse(text) as CampaignDraft;
  } catch {
    throw new Error("The AI returned a draft that could not be read. Try again.");
  }

  // Guard rails the model does not get to override.
  if (draft.targeting) {
    draft.targeting.ageMin = 18;
    draft.targeting.ageMax = 65;
    if (!draft.targeting.countries?.length) draft.targeting.countries = ["US"];
  }
  draft.notes = [
    ...(draft.notes ?? []),
    "Housing special ad category is applied automatically — Meta restricts age, gender and detailed targeting on this campaign.",
    "Review all copy for compliance before publishing. Nothing has been sent to Meta.",
  ];

  const matched = draft.landingPage?.templateKey
    ? templates.find((t) => t.key === draft.landingPage.templateKey)
    : undefined;

  return {
    draft,
    availableTemplates: templates.map((t) => ({ id: t.id, key: t.key, name: t.name, category: t.category })),
    availableSequences: sequences.map((s) => ({ id: s.id, name: s.name })),
    matchedTemplateId: matched?.id ?? null,
  };
}
