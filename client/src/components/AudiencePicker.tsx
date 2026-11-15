import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

type Props = {
  include: number[];
  exclude: number[];
  onChange: (include: number[], exclude: number[]) => void;
};

/** Show-to and leave-out Custom Audiences for one ad campaign. An audience is in one list at most. */
export function AudiencePicker({ include, exclude, onChange }: Props) {
  const { data: audiences = [], isLoading } = trpc.audiences.list.useQuery();

  const toggle = (id: number, list: "include" | "exclude", on: boolean) => {
    const inc = include.filter((x) => x !== id);
    const exc = exclude.filter((x) => x !== id);
    if (on) (list === "include" ? inc : exc).push(id);
    onChange(inc, exc);
  };

  return (
    <div className="space-y-2">
      <Label>Audiences</Label>
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading audiences…</p>
      ) : audiences.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No audiences yet. <Link href="/audiences" className="underline">Create one</Link> to retarget
          landing-page visitors or leave out people who already applied.
        </p>
      ) : (
        <div className="rounded-md border divide-y">
          <div className="grid grid-cols-[1fr_auto_auto] gap-3 px-3 py-1.5 text-xs font-medium text-muted-foreground">
            <span>Audience</span><span className="w-14 text-center">Show to</span><span className="w-14 text-center">Leave out</span>
          </div>
          {audiences.map((a) => (
            <div key={a.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-3 py-2 text-sm">
              <span className="min-w-0">
                <span className="block truncate">{a.name}</span>
                {!a.metaAudienceId && (
                  <span className="text-xs text-amber-600">Not in Meta yet. Sync it before publishing.</span>
                )}
              </span>
              <span className="flex w-14 justify-center">
                <Checkbox
                  aria-label={`Show to ${a.name}`}
                  checked={include.includes(a.id)}
                  onCheckedChange={(v) => toggle(a.id, "include", v === true)}
                />
              </span>
              <span className="flex w-14 justify-center">
                <Checkbox
                  aria-label={`Leave out ${a.name}`}
                  checked={exclude.includes(a.id)}
                  onCheckedChange={(v) => toggle(a.id, "exclude", v === true)}
                />
              </span>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        "Show to" narrows the ad to those people. "Leave out" stops spending on people who already converted.
      </p>
    </div>
  );
}
