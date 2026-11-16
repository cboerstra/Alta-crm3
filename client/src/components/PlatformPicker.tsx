import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { AD_PLATFORMS, normalizePlatforms, type AdPlatform } from "@shared/metaPlacements";

type Props = { value: string[]; onChange: (platforms: AdPlatform[]) => void };

/** Which Meta platforms the ad runs on. Ticking one that needs another ticks that too. */
export function PlatformPicker({ value, onChange }: Props) {
  const chosen = normalizePlatforms(value);
  const toggle = (id: AdPlatform, on: boolean) => {
    let next = on ? [...chosen, id] : chosen.filter((p) => p !== id);
    // Unticking a platform also unticks the ones that depend on it.
    if (!on) next = next.filter((p) => AD_PLATFORMS.find((x) => x.id === p && "needs" in x && x.needs === id) === undefined);
    if (next.length === 0) return; // at least one platform
    onChange(normalizePlatforms(next));
  };
  return (
    <div className="space-y-2">
      <Label>Platforms</Label>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {AD_PLATFORMS.map((p) => (
          <label key={p.id} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer hover:bg-muted/50">
            <Checkbox
              checked={chosen.includes(p.id)}
              onCheckedChange={(v) => toggle(p.id, v === true)}
              aria-label={p.label}
            />
            {p.label}
          </label>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        The ad runs in every spot on each platform you tick (Feed, Stories, Reels). Threads needs Instagram;
        Messenger and Audience Network need Facebook. Threads only works once your ad account has access to your Threads profile.
      </p>
    </div>
  );
}
