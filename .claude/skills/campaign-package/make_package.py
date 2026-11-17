#!/usr/bin/env python3
"""Build a campaign folder: <Campaign name>/ with the Reel (.mp4), cover photo (.png) and campaign-sheet.txt."""
import argparse, json, re, shutil, subprocess, sys
from pathlib import Path

OBJECTIVES = {"leads": "Leads - collect contact details", "traffic": "Traffic - send visits to the page",
              "awareness": "Awareness - maximise reach", "engagement": "Engagement - likes, comments, shares",
              "sales": "Sales - optimise for conversions"}
CTAS = {"LEARN_MORE", "SIGN_UP", "GET_QUOTE", "APPLY_NOW", "CONTACT_US", "GET_OFFER", "SUBSCRIBE"}
PLATFORMS = {"facebook", "instagram", "messenger", "threads", "audience_network"}
RISKY = ["perfect for families", "family-friendly", "safe neighborhood", "safe area", "walking distance to church",
         "ideal for retirees", "young professionals", "bachelor", "exclusive neighborhood", "no children"]


def slugify(s: str) -> str:
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", s.lower())).strip("-")


def folder_name(s: str) -> str:
    return re.sub(r'[/\\:*?"<>|]+', "-", s).strip(" .")


def to_png(src: Path, dest: Path) -> None:
    """Convert an image to PNG with ffmpeg, or Pillow when ffmpeg isn't installed."""
    if shutil.which("ffmpeg"):
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(src), "-frames:v", "1", str(dest)], check=True)
        return
    from PIL import Image
    Image.open(src).convert("RGB").save(dest, "PNG", optimize=True)


def build(c: dict, out: Path) -> tuple[Path, list[str]]:
    warn: list[str] = []
    name = c["name"].strip()
    obj = OBJECTIVES.get(str(c.get("objective", "leads")).lower().replace("outcome_", ""))
    if not obj:
        warn.append(f"Objective must be one of: {', '.join(OBJECTIVES)}")
    daily, life = c.get("dailyBudget"), c.get("lifetimeBudget")
    if bool(daily) == bool(life):
        warn.append("Set either dailyBudget or lifetimeBudget (exactly one).")
    if c.get("endDate") and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", c["endDate"]):
        warn.append("endDate must be YYYY-MM-DD.")
    areas = c.get("targetAreas", [])
    if not areas:
        warn.append("Add at least one target area.")
    for a in areas:
        if a.get("radiusMiles", 0) < 15:
            warn.append(f"{a.get('name')}: housing ads need a radius of 15 miles or more.")
    if any(re.fullmatch(r"\d{5}", str(a.get("name", ""))) for a in areas):
        warn.append("Use towns on the map, not ZIP codes (Meta rejects ZIPs for housing ads).")
    plats = [p.lower() for p in c.get("platforms", ["facebook", "instagram"])]
    if set(plats) - PLATFORMS:
        warn.append(f"Unknown platforms: {', '.join(set(plats) - PLATFORMS)}")
    if "threads" in plats and "instagram" not in plats:
        warn.append("Threads needs Instagram selected too.")
    if {"messenger", "audience_network"} & set(plats) and "facebook" not in plats:
        warn.append("Messenger and Audience Network need Facebook selected too.")
    text = c.get("primaryText", "")
    if len(text.split("\n")[0]) > 125:
        warn.append("Primary text: the first line is over 125 characters, so the hook gets cut off.")
    if len(c.get("headline", "")) > 40:
        warn.append("Headline is over 40 characters.")
    if len(c.get("linkDescription", "")) > 30:
        warn.append("Link description is over 30 characters; Meta may cut it.")
    cta = c.get("callToAction", "LEARN_MORE")
    if cta not in CTAS:
        warn.append(f"Call to action must be one of: {', '.join(sorted(CTAS))}")
    lower = " ".join([text, c.get("headline", ""), c.get("linkDescription", "")]).lower()
    for phrase in RISKY:
        if phrase in lower:
            warn.append(f'"{phrase}" can get a housing ad rejected; describe the home instead.')
    if c.get("housing", True) and not re.search(r"lic", text, re.I):
        warn.append("Primary text has no license number.")

    folder = out / folder_name(name)
    folder.mkdir(parents=True, exist_ok=True)
    slug = slugify(name)
    files = {}
    for key in ("reel", "image"):
        src = c.get(key)
        if not src:
            continue
        p = Path(src)
        if not p.is_file():
            warn.append(f"{key}: file not found: {src}")
            continue
        if key == "reel":
            dest = folder / f"{slug}.mp4"
            if p.suffix.lower() != ".mp4":
                warn.append(f"Reel should be an MP4, got {p.suffix}.")
            shutil.copy2(p, dest)
        else:
            # The cover photo is always delivered as PNG.
            dest = folder / f"{slug}-cover.png"
            if p.suffix.lower() == ".png":
                shutil.copy2(p, dest)
            else:
                to_png(p, dest)
        files[key] = dest.name
    if c.get("mediaType", "video") == "video" and "reel" not in files:
        warn.append("No Reel MP4 in the folder.")

    money = lambda v: f"${v:,.2f}".replace(".00", "") if isinstance(v, (int, float)) else (v or "-")
    aud = c.get("audience", {})
    lp = c.get("landingPage", {})
    lines = [
        f"CAMPAIGN SHEET: {name}",
        "Copy each field into altamortgagecrm.net -> Ad Campaigns -> New campaign.",
        "",
        "== Basics ==",
        f"Campaign name:     {name}",
        f"Internal notes:    {c.get('internalNotes', '-')}",
        f"Objective:         {obj or c.get('objective')}",
        f"Daily budget:      {money(daily)}",
        f"Lifetime budget:   {money(life)}",
        f"End date:          {c.get('endDate', '-')}",
        "Target areas:      " + ("; ".join(f"{a['name']} ({a['radiusMiles']} mi)" for a in areas) or "-"),
        "Platforms:         " + ", ".join(p.replace("_", " ").title() for p in plats),
        "Audience:",
        "  Show to:         " + (", ".join(aud.get("include", [])) or "Everyone in the target areas"),
        "  Leave out:       " + (", ".join(aud.get("exclude", [])) or "-"),
        "",
        "== Landing page ==",
        f"Landing page:      {lp.get('title', '-')}",
        f"URL:               {lp.get('url', '-')}",
        "",
        "== Ad creative ==",
        "Primary text:",
        *[f"  {l}" for l in text.split("\n")],
        f"Headline:          {c.get('headline', '-')}",
        f"Link description:  {c.get('linkDescription', '-')}",
        f"Media type:        {'Video / Reel' if c.get('mediaType', 'video') == 'video' else 'Image'}",
        f"Reel:              {files.get('reel', '-')}",
        f"Image / cover:     {files.get('image', '-')}",
        f"Call to action:    {cta}",
        "",
        "== Follow-up ==",
        f"Nurture sequence:  {c.get('followUp') or 'None'}",
    ]
    if warn:
        lines += ["", "== Check before publishing ==", *[f"- {w}" for w in warn]]
    (folder / "campaign-sheet.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
    return folder, warn


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("config", help="campaign JSON (see example.json)")
    ap.add_argument("--out", default=".", help="parent directory for the campaign folder")
    a = ap.parse_args()
    folder, warnings = build(json.loads(Path(a.config).read_text(encoding="utf-8")), Path(a.out))
    print(folder)
    for w in warnings:
        print("WARNING:", w, file=sys.stderr)
