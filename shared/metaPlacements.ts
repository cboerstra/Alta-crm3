// Where an ad runs. Meta ties some platforms to others: Threads ads need
// Instagram, and Messenger and Audience Network ads need Facebook.

export const AD_PLATFORMS = [
  { id: "facebook", label: "Facebook" },
  { id: "instagram", label: "Instagram" },
  { id: "threads", label: "Threads", needs: "instagram" },
  { id: "messenger", label: "Messenger", needs: "facebook" },
  { id: "audience_network", label: "Audience Network", needs: "facebook" },
] as const;

export type AdPlatform = (typeof AD_PLATFORMS)[number]["id"];

export const DEFAULT_PLATFORMS: AdPlatform[] = ["facebook", "instagram"];

/** The platforms to send, with any platform another one needs added, in a stable order. */
export function normalizePlatforms(chosen: readonly string[] | null | undefined): AdPlatform[] {
  const set = new Set<string>(chosen?.length ? chosen : DEFAULT_PLATFORMS);
  for (const p of AD_PLATFORMS) if (set.has(p.id) && "needs" in p) set.add(p.needs);
  const result = AD_PLATFORMS.map((p) => p.id).filter((id) => set.has(id));
  return result.length ? result : [...DEFAULT_PLATFORMS];
}
