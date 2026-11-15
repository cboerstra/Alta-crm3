# Facebook Retargeting Campaign: Alta Mortgage Group

Goal: turn people who already showed interest (landing page visitors, CRM leads) into booked consultations, at a lower cost per lead than cold ads.

Details below come from altamortgagegroup.net and the live Plain City landing page:
- **Company:** Clarke and Associates dba Alta Mortgage Group, NMLS 565137, Utah DRE 5452345-NMLM
- **Loan officer:** Scott Boerstra, Broker/Manager, NMLS 258624
- **Phone:** (801) 628-9400
- **Service area:** Weber, Davis, Box Elder and Morgan counties
- **Assistance:** Utah Housing Corporation, up to 6% down payment / closing cost help (FirstHome, HomeAgain)
- **Live page:** Plain City Special Financing, 3380 W 3275 N, $519,900, 3 bed / 2.5 bath, 1,949 sq ft, built 2022, MLS #2188074

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
| A. Plain City page visitors – no request (30 days) | "Visited a landing page, didn't apply", then set **Page** to *Plain City Special Financing* | Show to in Campaign 1 |
| B. Leads – not yet booked | "Leads who haven't booked yet" | Show to in Campaign 2 |
| C. Converted – leave out | "Already converted" | **Leave out in every campaign** |
| D. Past clients | "Past clients" | Show to in Campaign 3 (optional) |

Click **Sync now** on each and confirm "In sync" before publishing.

---

## 3. Campaign structure (paid-advertising-meta)

The CRM creates one ad set per campaign, so this is three campaigns.

| Campaign | Show to | Leave out | Landing page | Daily budget | Length |
|---|---|---|---|---|---|
| 1. Plain City home: visitors | A | C | Plain City Special Financing | $15 | Until the home sells |
| 2. Book your call: leads | B | C | Simple Lead Capture or booking page | $10 | 30 days |
| 3. Referral and refi: past clients | D | C | Refinance Savings Check | $5 | Ongoing |

- **Objective:** Leads. **Geography:** Weber, Davis, Box Elder and Morgan counties. No ZIPs.
- **Placements:** Advantage+ (automatic).
- **Total:** about $30/day ($900/month). Start campaigns 1 and 2; add 3 when the past-client list has 100+ matched people.

---

## 4. Ad copy (conversion-copywriting-ads)

Run two or three variations per campaign; Meta favors the winner.

Every ad's description line: **Alta Mortgage Group · NMLS 565137 · Equal Housing Opportunity**

### Campaign 1: Plain City home (page visitors)

**Variation 1: Still available**
- Primary text: Still thinking about the Plain City home? 3380 W 3275 N is still available: 3 bed, 2.5 bath, 1,949 sq ft, built in 2022. Special financing is available on this home. Get the details before someone else does.
- Headline: Special Financing on This Plain City Home
- Button: Learn More

**Variation 2: One point of contact**
- Primary text: Buying a home usually means juggling an agent and a lender. On this Plain City home you get one person for both: I'm Scott Boerstra, the listing agent and a loan officer with Alta Mortgage Group (NMLS 258624). Ask me about the special financing.
- Headline: One Call for the Home and the Loan
- Button: Contact Us

**Variation 3: Payment, not price**
- Primary text: $519,900 sounds like a lot. The monthly payment is what matters. With special financing and Utah Housing assistance of up to 6% for those who qualify, this 2022-built Plain City home may be closer than you think. See your numbers.
- Headline: See Your Payment on This Home
- Button: Learn More

### Campaign 2: Book your call (leads)

**Variation 1**
- Primary text: You started the process. Let's finish it. A 15-minute call is all it takes to see your buying power, your monthly payment, and whether Utah Housing assistance (up to 6% toward down payment and closing costs) fits you.
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

**Images:** a real photo of you or a local home beats stock. Square 1080×1080 plus a vertical 1080×1920 for Stories/Reels. For Campaign 1, use the listing photos with a short line such as "Special Financing Available".

---

## 5. Follow-up after someone submits (conversion-copywriting-email / SMS)

Set this as the campaign's follow-up sequence in the CRM.

| When | Channel | Message |
|---|---|---|
| Right away | SMS | Hi {{firstName}}, this is Scott with Alta Mortgage Group. I got your request and will review it today. Reply STOP to opt out. |
| Right away | Email | Subject: Your next step. Thanks for your interest. Here's my calendar link to grab 15 minutes: [booking link]. |
| Day 1 | Call | Personal call from the loan officer (most important step). |
| Day 2 | SMS | Quick question, {{firstName}}: are you hoping to buy in the next 3 months or later this year? |
| Day 4 | Email | Subject: What it really takes to buy in northern Utah. Credit, down payment, Utah Housing assistance, plus a booking link. |
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

0. **Fix first:** the Plain City page's confirmation email is a webinar template ("You're Registered — {{webinarTitle}}"). Change it on the landing page's edit screen to something like: Subject "Your Plain City home details", Body "Hi {{firstName}}, thanks for asking about 3380 W 3275 N. I'll send the special financing details shortly. — Scott Boerstra, Alta Mortgage Group, NMLS 258624". Also change the opt-in line from "this event" to "this home".
1. Settings → Meta Ads: ad account, Page, Pixel ID and access token are filled in; publishing is enabled.
2. Audiences: create A–D from the presets and click Sync now.
3. Ad Campaigns → New campaign (once for each of Campaigns 1–3):
   - Basics: name, objective Leads, daily budget, end date (30 days).
   - Leave ZIP codes empty (housing rule).
   - Audiences: tick Show to / Leave out per the table in section 3.
   - Landing page: pick the page from section 3. The Plain City page already names Scott's NMLS 258624. Add company NMLS 565137 and "Equal Housing Opportunity" if missing.
   - Ad creative: paste a variation from section 4 and add the image.
   - Follow-up: attach the sequence from section 5.
4. Publish → check the ad in Meta Ads Manager → turn it on.
