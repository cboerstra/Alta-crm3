// What a landing page is for, and the wording that follows from it: the
// button, the consent line, and the confirmation email a lead receives.
// Only a webinar page talks about registering; everything else is a request.

export type PageGoal = "webinar" | "property" | "consultation" | "info";

export type GoalPreset = {
  label: string;
  hint: string;
  ctaText: string;
  optInLabel: string;
  confirmationEmailSubject: string;
  confirmationEmailBody: string;
};

const SIGNOFF = `Scott Boerstra
Alta Mortgage Group · NMLS 565137 · Scott Boerstra NMLS 258624
(801) 628-9400
Equal Housing Opportunity`;

export const WEBINAR_EMAIL_SUBJECT = "You're Registered — {{webinarTitle}}";

export const WEBINAR_EMAIL_BODY = `Dear {{firstName}} {{lastName}},

Thank you for registering for {{webinarTitle}}! We are thrilled to have you join us and look forward to sharing valuable insights with you.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOUR EVENT DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Event:      {{webinarTitle}}
  Date/Time:  {{date}}
  Join Link:  {{joinUrl}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

To join the webinar, simply click your personal join link above at the scheduled date and time. We recommend joining 5 minutes early to ensure your audio and video are working properly.

WHAT TO EXPECT:
• Expert guidance on navigating today's real estate market
• Answers to your most important homebuying questions
• Exclusive resources available only to registered attendees

If you have any questions prior to the event, please do not hesitate to reply to this email — our team is happy to assist.

We look forward to seeing you there!

Warm regards,

The Clarke & Associates Team
Clarke & Associates CRM

P.S. Add this event to your calendar now so you don't miss it. Your join link is: {{joinUrl}}`;

export const GOAL_PRESETS: Record<PageGoal, GoalPreset> = {
  webinar: {
    label: "Webinar registration",
    hint: "Sign-ups for a live or recorded webinar. Sends the join link and reminders.",
    ctaText: "Register Now",
    optInLabel: "I agree to receive communications about this event and future opportunities",
    confirmationEmailSubject: WEBINAR_EMAIL_SUBJECT,
    confirmationEmailBody: WEBINAR_EMAIL_BODY,
  },
  property: {
    label: "Home / property inquiry",
    hint: "A listing or special-financing offer on a specific home.",
    ctaText: "Get the Details",
    optInLabel: "I agree to be contacted about this home and future opportunities",
    confirmationEmailSubject: "The details you asked for",
    confirmationEmailBody: `Hi {{firstName}},

Thanks for asking about this home. I'll send you the full details and the special financing options shortly, usually the same day.

If you'd like to see the home or talk through the numbers sooner, just reply to this email or call me at (801) 628-9400.

${SIGNOFF}`,
  },
  consultation: {
    label: "Consultation / quote request",
    hint: "Pre-approval, rate quote, refinance check or a call with a loan officer.",
    ctaText: "Get Started",
    optInLabel: "I agree to be contacted about my request and future opportunities",
    confirmationEmailSubject: "We received your request",
    confirmationEmailBody: `Hi {{firstName}},

Thanks for reaching out. I'm reviewing your request now and will contact you shortly with next steps, usually the same day.

Questions in the meantime? Reply to this email or call me at (801) 628-9400.

${SIGNOFF}`,
  },
  info: {
    label: "General information",
    hint: "A guide, checklist, grant program or any other lead form.",
    ctaText: "Send Me the Info",
    optInLabel: "I agree to receive communications about this and future opportunities",
    confirmationEmailSubject: "Thanks for your interest",
    confirmationEmailBody: `Hi {{firstName}},

Thanks for your interest. I'll follow up shortly with the information you asked for.

If you have questions, reply to this email or call me at (801) 628-9400.

${SIGNOFF}`,
  },
};

const isWebinarWording = (subject: string, body: string) =>
  /\{\{webinarTitle\}\}|\{\{joinUrl\}\}/.test(subject + body);

/** The goal a saved page's wording matches, so the editor opens on the right option. */
export function detectGoal(page: { webinarId?: number | null; confirmationEmailSubject?: string | null }): PageGoal {
  if (page.webinarId) return "webinar";
  const subject = page.confirmationEmailSubject ?? "";
  const match = (Object.keys(GOAL_PRESETS) as PageGoal[]).find(
    (g) => g !== "webinar" && GOAL_PRESETS[g].confirmationEmailSubject === subject,
  );
  return match ?? "info";
}

/** True when a page that is not linked to a webinar would email webinar wording to its leads. */
export function hasWebinarMismatch(page: { webinarId?: number | null; confirmationEmailSubject?: string; confirmationEmailBody?: string }): boolean {
  return !page.webinarId && isWebinarWording(page.confirmationEmailSubject ?? "", page.confirmationEmailBody ?? "");
}
