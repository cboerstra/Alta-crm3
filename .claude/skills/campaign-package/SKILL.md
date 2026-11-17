---
name: campaign-package
description: Build an upload-ready folder for a new altamortgagecrm.net ad campaign, named after the campaign, holding the Reel (.mp4), the cover photo (.png) and a campaign-sheet.txt with every field the CRM's New campaign form asks for. Use whenever the user asks to create, plan or set up an ad campaign, Reel ad or Facebook/Instagram ad for the CRM.
---

# Campaign package for altamortgagecrm.net

When the user asks to create a campaign, produce one folder they can open beside
the CRM's **Ad Campaigns → New campaign** form and copy from, field by field.

## The folder

Name it after the campaign, e.g. `Plain City - Tour Reel/` (drop `/ \ : * ? " < > |`).

```
<Campaign name>/
  <slug>.mp4             the Reel: 1080x1920, 15-60 s, captions burned in
  <slug>-cover.png       cover photo, always PNG (1080x1920 for a Reel, 1080x1080 for an image ad)
  campaign-sheet.txt     every form field, in the form's order
```

Build it with the helper. It validates the fields, writes the sheet and copies the media:

```bash
python3 .claude/skills/campaign-package/make_package.py campaign.json --out <parent dir>
```

`campaign.json` holds the fields below (see `example.json`). `reel` and `image` are
paths to files you made or the user supplied. A JPG or WebP cover is converted to PNG. The script prints the folder path and
any warnings; fix every warning before handing it over.

### Where it goes

1. A folder the user named. If it is on their computer (e.g. `G:\claudefolder\...`),
   call `list_computer_folders` and write there when it is listed and online.
2. Otherwise build it in the scratchpad under `campaign-packages/`, zip it, and send
   the zip and the sheet with `SendUserFile`. Say plainly that it was not saved to
   their computer. Never commit packages to the repo: the MP4s don't belong in git.

## Fields (in the CRM form's order)

| Sheet field | CRM tab | Notes |
|---|---|---|
| Campaign name | Basics | Also the Meta campaign name and the folder name. |
| Internal notes | Basics | Funnel summary, e.g. `Reel -> plain-city-tour split (A/B) -> tour calendar`. |
| Objective | Basics | One of the CRM's: Leads, Traffic, Awareness, Engagement, Sales. Tour or lead goals use **Leads**. |
| Daily budget / Lifetime budget | Basics | Use one, not both. |
| End date | Basics | YYYY-MM-DD, usually about 30 days out. |
| Target areas | Basics | Town plus radius from the map picker, **15 mi or more**. Never ZIP codes. |
| Platforms | Basics | Facebook, Instagram, Messenger, Threads, Audience Network. Threads needs Instagram; Messenger and Audience Network need Facebook. |
| Audience | Basics | "Show to" / "Leave out" lists from **Audiences**. Usually leave out *Converted*. |
| Landing page | Landing page | Existing page title and its live URL; the URL's domain must be in Settings -> Websites. |
| Primary text | Ad creative | Hook in the first 125 characters. End with name, brokerage and license number. |
| Headline | Ad creative | About 40 characters. Match the landing page button (e.g. "Schedule a Personal Tour"). |
| Link description | Ad creative | About 30 characters. |
| Media | Ad creative | Video / Reel or Image, and the file names in this folder. |
| Call to action | Ad creative | One of LEARN_MORE, SIGN_UP, GET_QUOTE, APPLY_NOW, CONTACT_US, GET_OFFER, SUBSCRIBE. |
| Follow-up | Follow-up | Nurture sequence name, or "None". Optional. |

## Rules for housing ads (Meta's special ad category)

- No ZIP codes, no age or gender targeting, and locations of 15 miles or more.
- Describe the home, not who should live there. Avoid "perfect for families", "safe
  neighborhood", "walking distance to church" and similar.
- Real estate listings: name the brokerage (Equity Real Estate), show the agent's
  license number and the Equal Housing Opportunity logo in the Reel and in the copy.
- The Reel's end card and the Headline should say the same thing as the landing
  page's button.

## Process

1. Gather facts: property or offer, landing page, budget, dates, areas. Ask only
   for what you can't find in the CRM repo or earlier conversation.
2. Make or locate the Reel and cover image. Check the Reel with ffprobe (1080x1920,
   H.264/AAC, under 60 s, under 100 MB).
3. Write `campaign.json`, run `make_package.py`, fix warnings.
4. Deliver the folder (see "Where it goes") and list the next steps: upload the Reel
   and cover from the folder in the Ad creative tab, paste the fields, Publish, then
   Start delivery once Meta approves.
