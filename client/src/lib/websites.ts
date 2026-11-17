import { trpc } from "@/lib/trpc";

export type SiteOption = { siteKey: string; name: string; baseUrl: string };

const FALLBACK: SiteOption[] = [
  { siteKey: "altamortgagecrm", name: "altamortgagecrm.net", baseUrl: "https://altamortgagecrm.net" },
  { siteKey: "freehomesearchutah", name: "freehomesearchutah.com", baseUrl: "https://freehomesearchutah.com" },
];

/** Websites landing pages can be hosted on (Settings → Meta Ads → Websites). */
export function useWebsites() {
  const { data } = trpc.websites.list.useQuery(undefined, { staleTime: 60_000 });
  const sites: SiteOption[] = data && data.length > 0 ? data : FALLBACK;
  const byKey = (key?: string | null) => sites.find((s) => s.siteKey === (key || "altamortgagecrm"));
  return {
    sites,
    origin: (key?: string | null) => (byKey(key) ?? sites[0]).baseUrl,
    label: (key?: string | null) => byKey(key)?.name ?? key ?? "altamortgagecrm.net",
  };
}
