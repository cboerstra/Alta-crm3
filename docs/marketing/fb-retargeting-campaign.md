# Facebook Retargeting Campaign: Alta Mortgage Group

Goal: turn people who already showed interest (landing page visitors, CRM leads) into booked consultations, at a lower cost per lead than cold ads.

Fill in the items in **[brackets]** before publishing: grant amount, county, NMLS numbers.

---

## 1. Strategy (marketing-strategy)

**Who:** people who clicked an ad or opened a landing page but didn't apply, and leads who haven't booked a call.

**Why it works:** they already know the offer. The ad's job is a reminder plus one new reason to act now.

**Rules that apply (Meta housing category, required for mortgage ads):**
- No targeting by age, gender or ZIP code. Use county or city with at least a 15-mile radius.
- No lookalike audiences. Custom audiences (what we built) are allowed.
- Every ad states the company name, NMLS ID, and "Equal Housing Opportunity" (on the landing page and in the ad's description or image).
- Avoid "guaranteed", "everyone qualifies", "no credit check" and similar claims.

**Size reality:** a local retargeting pool is small. Meta needs ~100 matched people per audience. Keep a prospecting campaign running to keep the pool filled.

---

## 2. Audiences (built on the CRM Audiences page)

Create these from the presets:

| Audience | Preset | Use |
|---|---|---|
| A. Landing page visitors – no application (30 days) | "Visited a landing page, didn't apply" | Show to in Campaign 1 |
| B. Leads – not yet booked | "Leads who haven't booked yet" | Show to in Campaign 2 |
| C. Converted – leave out | "Already converted" | **Leave out in every campaign** |
| D. Past clients | "Past clients" | Show to in Campaign 3 (optional) |

Click **Sync now** on each and confirm "In sync" before publishing.

---

## 3. Campaign structure (paid-advertising-meta)

The CRM creates one ad set per campaign, so this is three campaigns.

| Campaign | Show to | Leave out | Landing page | Daily budget | Length |
|---|---|---|---|---|---|
| 1. Grant reminder: visitors | A | C | Down Payment Grant page (e.g. Plain City special financing) | $15 | 30 days |
| 2. Book your call: leads | B | C | Simple Lead Capture or booking page | $10 | 30 days |
| 3. Referral and refi: past clients | D | C | Refinance Savings Check | $5 | Ongoing |

- **Objective:** Leads. **Geography:** your counties (e.g. Weber, Davis), no ZIPs.
- **Placements:** Advantage+ (automatic).
- **Total:** about $30/day ($900/month). Start campaigns 1 and 2; add 3 when the past-client list has 100+ matched people.

---

## 4. Ad copy (conversion-copywriting-ads)

Run two or three variations per campaign; Meta favors the winner.

### Campaign 1: Grant reminder (landing page visitors)

**Variation 1: Deadline**
- Primary text: Still thinking about that down payment help? Grant funds in [County] are first-come, first-served, and they don't have to be repaid. It takes about two minutes to see if you qualify.
- Headline: Check Your Grant Eligibility
- Description: Alta Mortgage Group · NMLS [#] · Equal Housing Opportunity
- Button: Learn More

**Variation 2: Objection ("I can't afford the down payment")**
- Primary text: The down payment is the #1 reason people wait to buy. Up to [grant amount] in assistance could cover a big part of it. Answer four quick questions and a local loan officer will tell you exactly what you could get.
- Headline: Up to [grant amount] Toward Your Down Payment
- Button: Learn More

**Variation 3: Local and human**
- Primary text: You looked at our [City] financing program. Want a straight answer on whether it fits you? I'm [Loan officer name], a local loan officer. No pressure, just real numbers.
- Headline: Get a Straight Answer
- Button: Contact Us

### Campaign 2: Book your call (leads)

**Variation 1**
- Primary text: You started the process. Let's finish it. A 15-minute call is all it takes to see your buying power, your monthly payment, and which assistance programs fit.
- Headline: Book Your 15-Minute Call
- Button: Book Now

**Variation 2**
- Primary text: Rates and programs change. If it's been a few weeks since you checked, your numbers may look different now. Grab a time that works for you.
- Headline: See Your Updated Numbers
- Button: Book Now

### Campaign 3: Referrals and refinance (past clients)

**Variation 1: Refinance**
- Primary text: Thank you for trusting us with your home loan. If rates have dropped since you closed, a refinance could lower your monthly payment. Run a free check on your actual loan.
- Headline: Could You Cut Your Payment?
- Button: Learn More

**Variation 2: Referral**
- Primary text: Know someone thinking about buying? We'd be honored to help them the way we helped you, with down payment programs, clear numbers and a local team.
- Headline: Send a Friend Our Way
- Button: Learn More

**Images:** a real photo of you or a local home beats stock. Square 1080×1080 plus a vertical 1080×1920 for Stories/Reels. Keep text on the image short (e.g. "Down Payment Help: [County]").

---

## 5. Follow-up after someone submits (conversion-copywriting-email / SMS)

Set this as the campaign's follow-up sequence in the CRM.

| When | Channel | Message |
|---|---|---|
| Right away | SMS | Hi {{firstName}}, this is [Name] with Alta Mortgage Group. I got your request and will review it today. Reply STOP to opt out. |
| Right away | Email | Subject: Your next step. Thanks for checking your eligibility. Here's my calendar link to grab 15 minutes: [link]. |
| Day 1 | Call | Personal call from the loan officer (most important step). |
| Day 2 | SMS | Quick question, {{firstName}}: are you hoping to buy in the next 3 months or later this year? |
| Day 4 | Email | Subject: What it really takes to buy in [County]. A short guide covering credit, down payment and grants, plus a booking link. |
| Day 7 | Email | Subject: Still have questions? Reply to this email with any question and I'll answer it personally. |

Leads who book a call move to "Consultation booked" and drop out of Audience B and into C automatically at the next daily sync.

---

## 6. Measurement (paid-media-reporting)

**Targets (first 30 days):**
- Cost per lead: under $25 for retargeting. Retargeting should run 30–50% below cold ads.
- Lead to booked call: 30% or more.
- Frequency: under 4 per week. If it goes higher, swap in new images or copy.

**Check-ins:**
- **Day 3:** ads approved, spending, no housing-category rejections.
- **Day 7:** pause variations with a click-through rate below 0.8%.
- **Day 14:** compare cost per lead between Campaigns 1 and 2. Move budget to the winner.
- **Day 30:** review on the CRM's Marketing analytics page: spend, leads, booked calls and loans that came from each campaign.

---

## 7. Setup checklist in the CRM

1. Settings → Meta Ads: ad account, Page, Pixel ID and access token are filled in; publishing is enabled.
2. Audiences: create A–D from the presets and click Sync now.
3. Ad Campaigns → New campaign (once for each of Campaigns 1–3):
   - Basics: name, objective Leads, daily budget, end date (30 days).
   - Leave ZIP codes empty (housing rule).
   - Audiences: tick Show to / Leave out per the table in section 3.
   - Landing page: pick the page from section 3. Add NMLS and Equal Housing text to it if missing.
   - Ad creative: paste a variation from section 4 and add the image.
   - Follow-up: attach the sequence from section 5.
4. Publish → check the ad in Meta Ads Manager → turn it on.
