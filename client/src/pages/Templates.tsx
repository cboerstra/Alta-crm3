import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  LayoutTemplate, Plus, Loader2, Trash2, Lock, Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const CATEGORY_LABELS: Record<string, string> = {
  home_value: "Home value",
  grant: "Grant / assistance",
  purchase: "Purchase",
  refinance: "Refinance",
  webinar: "Webinar",
  general: "General",
};

const CATEGORY_STYLES: Record<string, string> = {
  home_value: "bg-emerald-50 text-emerald-700 border-emerald-200",
  grant: "bg-amber-50 text-amber-700 border-amber-200",
  purchase: "bg-blue-50 text-blue-700 border-blue-200",
  refinance: "bg-purple-50 text-purple-700 border-purple-200",
  webinar: "bg-pink-50 text-pink-700 border-pink-200",
  general: "bg-slate-50 text-slate-700 border-slate-200",
};

/** Pulls {{token}} names out of a template's copy so the form can ask for them. */
function extractTokens(template: any): string[] {
  const text = [template.headline, template.subheadline, template.bodyText, template.confirmationEmailBody]
    .filter(Boolean)
    .join(" ");
  const found: string[] = [];
  const pattern = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    // Lead fields are filled at send time from the lead record, not here.
    const token = match[1];
    if (["firstName", "lastName", "fullName", "email", "phone"].includes(token)) continue;
    if (!found.includes(token)) found.push(token);
  }
  return found;
}

export default function Templates() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const { data: templates, isLoading } = trpc.templates.list.useQuery();

  const [useOpen, setUseOpen] = useState(false);
  const [active, setActive] = useState<any | null>(null);
  const [pageTitle, setPageTitle] = useState("");
  const [tokens, setTokens] = useState<Record<string, string>>({});

  const [createOpen, setCreateOpen] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    key: "", name: "", category: "general", description: "",
    headline: "", subheadline: "", bodyText: "", ctaText: "",
  });

  const createPage = trpc.templates.createLandingPage.useMutation({
    onSuccess: (res) => {
      toast.success(`Landing page created at /lp/${res.slug}`);
      utils.marketing.landingPagePicker.invalidate();
      setUseOpen(false);
      navigate("/landing-pages");
    },
    onError: (err) => toast.error(err.message),
  });

  const createTemplate = trpc.templates.create.useMutation({
    onSuccess: () => {
      toast.success("Template created");
      utils.templates.list.invalidate();
      setCreateOpen(false);
      setNewTemplate({ key: "", name: "", category: "general", description: "", headline: "", subheadline: "", bodyText: "", ctaText: "" });
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteTemplate = trpc.templates.delete.useMutation({
    onSuccess: () => {
      toast.success("Template deleted");
      utils.templates.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const openUse = (template: any) => {
    setActive(template);
    setPageTitle(template.name);
    const initial: Record<string, string> = {};
    for (const token of extractTokens(template)) initial[token] = "";
    setTokens(initial);
    setUseOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <LayoutTemplate className="h-6 w-6 text-brand-green" /> Page templates
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Reusable, branded landing pages. Pick one, fill in the specifics, and it goes live with
            tracking already wired up.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> New template
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(templates ?? []).map((t) => (
            <Card key={t.id} className="flex flex-col">
              <CardContent className="p-4 flex flex-col flex-1 gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold truncate">{t.name}</h3>
                    <Badge variant="outline" className={`mt-1 ${CATEGORY_STYLES[t.category] ?? ""}`}>
                      {CATEGORY_LABELS[t.category] ?? t.category}
                    </Badge>
                  </div>
                  {t.isSystem && (
                    <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1" />
                  )}
                </div>

                {t.description && (
                  <p className="text-xs text-muted-foreground line-clamp-4 flex-1">{t.description}</p>
                )}

                {Array.isArray(t.steps) && t.steps.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {(t.steps as any[]).map((step, i) => (
                      <Badge key={i} variant="outline" className="text-[10px] font-normal">
                        {i + 1}. {step.title?.replace(/\{\{[^}]*\}\}/g, "").trim() || step.key}
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <Button size="sm" className="flex-1" onClick={() => openUse(t)}>
                    <Wand2 className="h-3.5 w-3.5 mr-1.5" /> Use template
                  </Button>
                  {!t.isSystem && (
                    <Button
                      size="sm" variant="ghost" className="text-destructive hover:text-destructive"
                      onClick={() => {
                        if (confirm(`Delete the "${t.name}" template? Pages already built from it are unaffected.`)) {
                          deleteTemplate.mutate({ id: t.id });
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ─── Build a page from a template ─────────────────────────────────── */}
      <Dialog open={useOpen} onOpenChange={setUseOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Build a page from "{active?.name}"</DialogTitle>
            <DialogDescription>
              The page goes live immediately with the Meta pixel and Conversions API switched on.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Page title</Label>
              <Input value={pageTitle} onChange={(e) => setPageTitle(e.target.value)} />
              <p className="text-xs text-muted-foreground">The URL is generated from this.</p>
            </div>

            {Object.keys(tokens).length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Fill in the specifics
                </p>
                {Object.keys(tokens).map((token) => (
                  <div key={token} className="space-y-1.5">
                    <Label className="capitalize">{token.replace(/([A-Z])/g, " $1").trim()}</Label>
                    <Input
                      value={tokens[token]}
                      onChange={(e) => setTokens({ ...tokens, [token]: e.target.value })}
                      placeholder={token === "grantAmount" ? "$15,000" : token === "countyName" ? "Weber County" : ""}
                    />
                  </div>
                ))}
              </div>
            )}

            {active?.headline && (
              <div className="rounded-md border bg-muted/30 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Preview</p>
                <p className="text-sm font-semibold">
                  {String(active.headline).replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m: string, k: string) => tokens[k] || `{{${k}}}`)}
                </p>
                {active.subheadline && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {String(active.subheadline).replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m: string, k: string) => tokens[k] || `{{${k}}}`)}
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setUseOpen(false)}>Cancel</Button>
            <Button
              disabled={!pageTitle.trim() || createPage.isPending}
              onClick={() =>
                createPage.mutate({
                  templateId: active.id,
                  title: pageTitle.trim(),
                  tokens,
                  sourceTag: "facebook",
                  isActive: true,
                })
              }
            >
              {createPage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create page"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── New template ─────────────────────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New template</DialogTitle>
            <DialogDescription>
              Use <code>{"{{tokenName}}"}</code> anywhere in the copy for values you'll fill in per
              campaign, like <code>{"{{countyName}}"}</code>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Key</Label>
                <Input
                  value={newTemplate.key}
                  onChange={(e) => setNewTemplate({ ...newTemplate, key: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })}
                  placeholder="va-loan"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={newTemplate.category} onValueChange={(v) => setNewTemplate({ ...newTemplate, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                rows={2}
                value={newTemplate.description}
                onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                placeholder="When to reach for this template"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Headline</Label>
              <Input
                value={newTemplate.headline}
                onChange={(e) => setNewTemplate({ ...newTemplate, headline: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Subheadline</Label>
              <Input
                value={newTemplate.subheadline}
                onChange={(e) => setNewTemplate({ ...newTemplate, subheadline: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Body</Label>
              <Textarea
                rows={4}
                value={newTemplate.bodyText}
                onChange={(e) => setNewTemplate({ ...newTemplate, bodyText: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Button text</Label>
              <Input
                value={newTemplate.ctaText}
                onChange={(e) => setNewTemplate({ ...newTemplate, ctaText: e.target.value })}
                placeholder="Get Started"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              disabled={!newTemplate.key || !newTemplate.name || createTemplate.isPending}
              onClick={() => createTemplate.mutate(newTemplate as any)}
            >
              {createTemplate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
