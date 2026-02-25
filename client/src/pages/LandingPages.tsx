import { useState, useRef, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Plus, FileText, Copy, Trash2, Edit, Upload, Image, FileIcon, X, Eye, Calendar, Clock, AlertCircle, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const ALL_FORM_FIELDS = [
  { key: "firstName", label: "First Name", required: true },
  { key: "lastName", label: "Last Name", required: true },
  { key: "email", label: "Email", required: true },
  { key: "phone", label: "Phone Number", required: false },
  { key: "sessionSelect", label: "Seminar Date Selection", required: false },
  { key: "optIn", label: "Opt-In Consent Checkbox", required: false },
];

type FormState = {
  title: string;
  slug: string;
  headline: string;
  subheadline: string;
  bodyText: string;
  ctaText: string;
  campaignTag: string;
  sourceTag: string;
  webinarId: number | undefined;
  isActive: boolean;
  accentColor: string;
  enabledFields: string[];
  optInLabel: string;
  showOptIn: boolean;
  confirmationEmailSubject: string;
  confirmationEmailBody: string;
};

const defaultForm: FormState = {
  title: "", slug: "", headline: "", subheadline: "", bodyText: "",
  ctaText: "Register Now", campaignTag: "", sourceTag: "",
  webinarId: undefined, isActive: true, accentColor: "#C9A84C",
  enabledFields: ["firstName", "lastName", "email", "phone"],
  optInLabel: "I agree to receive communications about this event and future opportunities",
  showOptIn: true,
  confirmationEmailSubject: "",
  confirmationEmailBody: "",
};

function RequiredStar() {
  return <span className="text-red-500 ml-0.5 font-bold">*</span>;
}

function FieldError({ message }: { message: string }) {
  return (
    <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
      <AlertCircle className="h-3 w-3 flex-shrink-0" />
      {message}
    </p>
  );
}

export default function LandingPages() {
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>({ ...defaultForm });
  const [artworkPreview, setArtworkPreview] = useState<string | null>(null);
  const [pdfName, setPdfName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const artworkRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);

  const { data: pages, isLoading, refetch } = trpc.landingPages.list.useQuery();
  const { data: webinars } = trpc.webinars.list.useQuery();

  const webinarMap = useMemo(() => {
    const map = new Map<number, { title: string; scheduledAt: Date; durationMinutes: number | null; status: string }>();
    if (webinars) {
      for (const w of webinars) {
        map.set(w.id, { title: w.title, scheduledAt: w.scheduledAt, durationMinutes: w.durationMinutes, status: w.status });
      }
    }
    return map;
  }, [webinars]);

  const createMutation = trpc.landingPages.create.useMutation({
    onSuccess: (data) => {
      toast.success("Landing page created");
      handlePostCreateUploads(data.id);
      setShowCreate(false);
      resetForm();
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.landingPages.update.useMutation({
    onSuccess: () => { toast.success("Landing page updated"); setEditId(null); resetForm(); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.landingPages.delete.useMutation({
    onSuccess: () => { toast.success("Landing page deleted"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const uploadArtwork = trpc.landingPages.uploadArtwork.useMutation({
    onSuccess: () => { toast.success("Artwork uploaded"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const uploadPdf = trpc.landingPages.uploadPdf.useMutation({
    onSuccess: () => { toast.success("PDF uploaded"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const [pendingArtwork, setPendingArtwork] = useState<{ base64: string; name: string; type: string } | null>(null);
  const [pendingPdf, setPendingPdf] = useState<{ base64: string; name: string } | null>(null);

  async function handlePostCreateUploads(pageId: number) {
    if (pendingArtwork) {
      uploadArtwork.mutate({ landingPageId: pageId, fileBase64: pendingArtwork.base64, fileName: pendingArtwork.name, contentType: pendingArtwork.type });
      setPendingArtwork(null);
    }
    if (pendingPdf) {
      uploadPdf.mutate({ landingPageId: pageId, fileBase64: pendingPdf.base64, fileName: pendingPdf.name });
      setPendingPdf(null);
    }
  }

  function resetForm() {
    setForm({ ...defaultForm });
    setArtworkPreview(null);
    setPdfName(null);
    setPendingArtwork(null);
    setPendingPdf(null);
    setTouched({});
    setSubmitAttempted(false);
  }

  function openEdit(page: any) {
    setForm({
      title: page.title, slug: page.slug,
      headline: page.headline || "", subheadline: page.subheadline || "",
      bodyText: page.bodyText || "", ctaText: page.ctaText || "Register Now",
      campaignTag: page.campaignTag || "", sourceTag: page.sourceTag || "",
      webinarId: page.webinarId || undefined, isActive: page.isActive,
      accentColor: page.accentColor || "#C9A84C",
      enabledFields: (page.enabledFields as string[]) || ["firstName", "lastName", "email", "phone"],
      optInLabel: page.optInLabel || "I agree to receive communications about this event and future opportunities",
      showOptIn: page.showOptIn ?? true,
      confirmationEmailSubject: page.confirmationEmailSubject || "",
      confirmationEmailBody: page.confirmationEmailBody || "",
    });
    setArtworkPreview(page.artworkUrl || null);
    setPdfName(page.confirmationPdfUrl ? "Attached PDF" : null);
    setEditId(page.id);
    setTouched({});
    setSubmitAttempted(false);
  }

  const handleArtworkSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("Image must be under 10MB"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      setArtworkPreview(URL.createObjectURL(file));
      if (editId) {
        setUploading(true);
        uploadArtwork.mutate({ landingPageId: editId, fileBase64: base64, fileName: file.name, contentType: file.type }, { onSettled: () => setUploading(false) });
      } else {
        setPendingArtwork({ base64, name: file.name, type: file.type });
      }
    };
    reader.readAsDataURL(file);
  };

  const handlePdfSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) { toast.error("PDF must be under 25MB"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      setPdfName(file.name);
      if (editId) {
        setUploading(true);
        uploadPdf.mutate({ landingPageId: editId, fileBase64: base64, fileName: file.name }, { onSettled: () => setUploading(false) });
      } else {
        setPendingPdf({ base64, name: file.name });
      }
    };
    reader.readAsDataURL(file);
  };

  const toggleField = (key: string) => {
    const field = ALL_FORM_FIELDS.find(f => f.key === key);
    if (field?.required) return;
    setForm(prev => ({
      ...prev,
      enabledFields: prev.enabledFields.includes(key)
        ? prev.enabledFields.filter(f => f !== key)
        : [...prev.enabledFields, key],
    }));
  };

  const copyUrl = (slug: string) => {
    const fullUrl = `${window.location.origin}/lp/${slug}`;
    navigator.clipboard.writeText(fullUrl);
    toast.success("URL copied to clipboard");
  };

  // ─── Validation ───
  const validationErrors = useMemo(() => {
    const errors: Record<string, string> = {};
    if (!form.title.trim()) errors.title = "Title is required";
    if (!editId && !form.slug.trim()) errors.slug = "URL slug is required";
    if (!editId && form.slug && !/^[a-z0-9-]+$/.test(form.slug)) errors.slug = "Slug can only contain lowercase letters, numbers, and hyphens";
    if (!form.headline.trim()) errors.headline = "Headline is required";
    return errors;
  }, [form.title, form.slug, form.headline, editId]);

  const isFormValid = Object.keys(validationErrors).length === 0;
  const showError = (field: string) => (submitAttempted || touched[field]) && validationErrors[field];
  const markTouched = (field: string) => setTouched(prev => ({ ...prev, [field]: true }));

  const handleSubmit = () => {
    setSubmitAttempted(true);
    if (!isFormValid) {
      toast.error("Please fill in all required fields before creating the page");
      return;
    }
    if (editId) {
      updateMutation.mutate({
        id: editId, title: form.title,
        headline: form.headline || undefined, subheadline: form.subheadline || undefined,
        bodyText: form.bodyText || undefined, ctaText: form.ctaText || undefined,
        campaignTag: form.campaignTag || undefined, sourceTag: form.sourceTag || undefined,
        webinarId: form.webinarId ?? null, isActive: form.isActive,
        accentColor: form.accentColor || undefined, enabledFields: form.enabledFields,
        optInLabel: form.optInLabel || undefined, showOptIn: form.showOptIn,
        confirmationEmailSubject: form.confirmationEmailSubject || undefined,
        confirmationEmailBody: form.confirmationEmailBody || undefined,
      });
    } else {
      createMutation.mutate({
        title: form.title, slug: form.slug,
        headline: form.headline || undefined, subheadline: form.subheadline || undefined,
        bodyText: form.bodyText || undefined, ctaText: form.ctaText || undefined,
        campaignTag: form.campaignTag || undefined, sourceTag: form.sourceTag || undefined,
        webinarId: form.webinarId, isActive: form.isActive,
        accentColor: form.accentColor || undefined, enabledFields: form.enabledFields,
        optInLabel: form.optInLabel || undefined, showOptIn: form.showOptIn,
        confirmationEmailSubject: form.confirmationEmailSubject || undefined,
        confirmationEmailBody: form.confirmationEmailBody || undefined,
      });
    }
  };

  const formatWebinarDate = (date: Date) => {
    try { return format(new Date(date), "MMM d, yyyy 'at' h:mm a"); }
    catch { return "Date TBD"; }
  };

  const getFullUrl = (slug: string) => `${window.location.origin}/lp/${slug}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "Raleway, sans-serif" }}>Landing Pages</h1>
          <p className="text-muted-foreground text-sm mt-1">Create and manage lead capture pages with configurable forms</p>
        </div>
        <Dialog open={showCreate || editId !== null} onOpenChange={(v) => { if (!v) { setShowCreate(false); setEditId(null); resetForm(); } else setShowCreate(true); }}>
          <DialogTrigger asChild>
            <Button className="bg-brand-green hover:bg-brand-green-dark text-white gap-2">
              <Plus className="h-4 w-4" /> Create Page
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle style={{ fontFamily: "Raleway, sans-serif" }}>
                {editId ? "Edit Landing Page" : "Create Landing Page"}
              </DialogTitle>
            </DialogHeader>

            {/* ─── Required Fields Notice ─── */}
            <div className="text-xs text-muted-foreground flex items-center gap-1 -mt-1">
              <span className="text-red-500 font-bold">*</span> indicates a required field
            </div>

            {/* ─── Validation Summary Banner ─── */}
            {submitAttempted && !isFormValid && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-800">Please complete all required fields</p>
                  <ul className="text-xs text-red-600 mt-1 space-y-0.5">
                    {Object.entries(validationErrors).map(([key, msg]) => (
                      <li key={key} className="flex items-center gap-1">
                        <span className="h-1 w-1 rounded-full bg-red-400 flex-shrink-0" />
                        {msg}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <Tabs defaultValue="content" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="content" className="relative">
                  Content
                  {submitAttempted && (validationErrors.title || validationErrors.slug || validationErrors.headline) && (
                    <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-background" />
                  )}
                </TabsTrigger>
                <TabsTrigger value="fields">Form Fields</TabsTrigger>
                <TabsTrigger value="media">Media</TabsTrigger>
                <TabsTrigger value="email">Email</TabsTrigger>
              </TabsList>

              {/* ─── Content Tab ─── */}
              <TabsContent value="content" className="space-y-4 mt-4">
                <div>
                  <Label className="flex items-center">Title <RequiredStar /></Label>
                  <Input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    onBlur={() => markTouched("title")}
                    placeholder="Spring Homebuyer Webinar"
                    className={showError("title") ? "border-red-400 focus-visible:ring-red-400" : ""}
                  />
                  {showError("title") && <FieldError message={validationErrors.title} />}
                </div>
                {!editId && (
                  <div>
                    <Label className="flex items-center">URL Slug <RequiredStar /></Label>
                    <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                      <LinkIcon className="h-3 w-3" />
                      {window.location.origin}/lp/<span className="font-medium text-foreground">{form.slug || "your-slug"}</span>
                    </div>
                    <Input
                      value={form.slug}
                      onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })}
                      onBlur={() => markTouched("slug")}
                      placeholder="spring-webinar-2026"
                      className={showError("slug") ? "border-red-400 focus-visible:ring-red-400" : ""}
                    />
                    {showError("slug") && <FieldError message={validationErrors.slug} />}
                  </div>
                )}
                <div>
                  <Label className="flex items-center">Headline <RequiredStar /></Label>
                  <Input
                    value={form.headline}
                    onChange={(e) => setForm({ ...form, headline: e.target.value })}
                    onBlur={() => markTouched("headline")}
                    placeholder="Join Our Free Webinar"
                    className={showError("headline") ? "border-red-400 focus-visible:ring-red-400" : ""}
                  />
                  {showError("headline") && <FieldError message={validationErrors.headline} />}
                </div>
                <div>
                  <Label>Subheadline</Label>
                  <Textarea value={form.subheadline} onChange={(e) => setForm({ ...form, subheadline: e.target.value })} placeholder="Learn the secrets to..." rows={2} />
                </div>
                <div>
                  <Label>Body Text / Description</Label>
                  <Textarea value={form.bodyText} onChange={(e) => setForm({ ...form, bodyText: e.target.value })} placeholder="Detailed description of the event..." rows={4} />
                </div>
                <div>
                  <Label>CTA Button Text</Label>
                  <Input value={form.ctaText} onChange={(e) => setForm({ ...form, ctaText: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Source Tag</Label>
                    <Input value={form.sourceTag} onChange={(e) => setForm({ ...form, sourceTag: e.target.value })} placeholder="facebook" />
                  </div>
                  <div>
                    <Label>Campaign Tag</Label>
                    <Input value={form.campaignTag} onChange={(e) => setForm({ ...form, campaignTag: e.target.value })} placeholder="spring-2026" />
                  </div>
                </div>
                <div>
                  <Label>Link to Webinar</Label>
                  <Select value={form.webinarId?.toString() ?? "none"} onValueChange={(v) => setForm({ ...form, webinarId: v === "none" ? undefined : Number(v) })}>
                    <SelectTrigger><SelectValue placeholder="Select webinar..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No webinar</SelectItem>
                      {webinars?.map((w) => (
                        <SelectItem key={w.id} value={w.id.toString()}>
                          {w.title} — {formatWebinarDate(w.scheduledAt)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.webinarId && webinarMap.get(form.webinarId) && (
                    <div className="mt-2 p-2.5 rounded-md bg-muted/50 flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5 text-brand-green" />
                      <span>{formatWebinarDate(webinarMap.get(form.webinarId)!.scheduledAt)}</span>
                      {webinarMap.get(form.webinarId)!.durationMinutes && (
                        <>
                          <span className="mx-1">·</span>
                          <Clock className="h-3.5 w-3.5" />
                          <span>{webinarMap.get(form.webinarId)!.durationMinutes} min</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <Label>Accent Color</Label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={form.accentColor} onChange={(e) => setForm({ ...form, accentColor: e.target.value })} className="h-8 w-12 rounded cursor-pointer" />
                    <Input value={form.accentColor} onChange={(e) => setForm({ ...form, accentColor: e.target.value })} className="w-28" />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <Label>Active</Label>
                  <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
                </div>
              </TabsContent>

              {/* ─── Form Fields Tab ─── */}
              <TabsContent value="fields" className="space-y-4 mt-4">
                <p className="text-sm text-muted-foreground">Select which fields appear on the lead capture form. Required fields cannot be disabled.</p>
                <div className="space-y-3">
                  {ALL_FORM_FIELDS.map((field) => (
                    <div key={field.key} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={form.enabledFields.includes(field.key)}
                          onCheckedChange={() => toggleField(field.key)}
                          disabled={field.required}
                        />
                        <div>
                          <span className="text-sm font-medium">{field.label}</span>
                          {field.required && <Badge variant="secondary" className="ml-2 text-[10px]">Required</Badge>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <Separator />
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Show Opt-In Consent Checkbox</Label>
                    <Switch checked={form.showOptIn} onCheckedChange={(v) => setForm({ ...form, showOptIn: v })} />
                  </div>
                  {form.showOptIn && (
                    <div>
                      <Label>Opt-In Label Text</Label>
                      <Textarea value={form.optInLabel} onChange={(e) => setForm({ ...form, optInLabel: e.target.value })} placeholder="I agree to receive communications..." rows={2} />
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* ─── Media Tab ─── */}
              <TabsContent value="media" className="space-y-4 mt-4">
                <div>
                  <Label className="mb-2 block">Artwork / Hero Image</Label>
                  <p className="text-xs text-muted-foreground mb-3">Upload a banner or hero image for this landing page. Recommended: 1200x630px, JPG or PNG.</p>
                  {artworkPreview ? (
                    <div className="relative rounded-lg overflow-hidden border">
                      <img src={artworkPreview} alt="Artwork preview" className="w-full h-48 object-cover" />
                      <Button variant="secondary" size="sm" className="absolute top-2 right-2" onClick={() => { setArtworkPreview(null); setPendingArtwork(null); if (editId) updateMutation.mutate({ id: editId, artworkUrl: null }); }}>
                        <X className="h-3 w-3 mr-1" /> Remove
                      </Button>
                    </div>
                  ) : (
                    <button onClick={() => artworkRef.current?.click()} className="w-full h-40 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-brand-green/50 hover:text-brand-green transition-colors cursor-pointer">
                      <Image className="h-8 w-8" />
                      <span className="text-sm">Click to upload artwork</span>
                      <span className="text-xs">JPG, PNG up to 10MB</span>
                    </button>
                  )}
                  <input ref={artworkRef} type="file" accept="image/*" className="hidden" onChange={handleArtworkSelect} />
                </div>
                <Separator />
                <div>
                  <Label className="mb-2 block">PDF Attachment for Confirmation Email</Label>
                  <p className="text-xs text-muted-foreground mb-3">Upload a PDF document that will be attached to the confirmation email sent to leads upon signup.</p>
                  {pdfName ? (
                    <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                      <FileIcon className="h-5 w-5 text-red-500" />
                      <span className="text-sm font-medium flex-1">{pdfName}</span>
                      <Button variant="ghost" size="sm" onClick={() => { setPdfName(null); setPendingPdf(null); if (editId) updateMutation.mutate({ id: editId, confirmationPdfUrl: null }); }}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <button onClick={() => pdfRef.current?.click()} className="w-full p-4 border-2 border-dashed rounded-lg flex items-center justify-center gap-2 text-muted-foreground hover:border-brand-green/50 hover:text-brand-green transition-colors cursor-pointer">
                      <Upload className="h-5 w-5" />
                      <span className="text-sm">Click to upload PDF (up to 25MB)</span>
                    </button>
                  )}
                  <input ref={pdfRef} type="file" accept=".pdf" className="hidden" onChange={handlePdfSelect} />
                </div>
              </TabsContent>

              {/* ─── Email Tab ─── */}
              <TabsContent value="email" className="space-y-4 mt-4">
                <p className="text-sm text-muted-foreground">Configure the confirmation email sent to leads upon registration. If left blank, a default confirmation will be sent.</p>
                <div>
                  <Label>Email Subject</Label>
                  <Input value={form.confirmationEmailSubject} onChange={(e) => setForm({ ...form, confirmationEmailSubject: e.target.value })} placeholder="You're registered for our webinar!" />
                </div>
                <div>
                  <Label>Email Body</Label>
                  <Textarea value={form.confirmationEmailBody} onChange={(e) => setForm({ ...form, confirmationEmailBody: e.target.value })} placeholder="Thank you for registering! Here are the details..." rows={6} />
                </div>
                <div className="p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
                  <p className="font-medium mb-1">Available placeholders:</p>
                  <p>{"{{firstName}}"} — Lead's first name</p>
                  <p>{"{{lastName}}"} — Lead's last name</p>
                  <p>{"{{webinarTitle}}"} — Webinar title</p>
                  <p>{"{{joinUrl}}"} — Zoom join link</p>
                  <p>{"{{date}}"} — Webinar date</p>
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-2 pt-4 border-t mt-4">
              <Button variant="outline" onClick={() => { setShowCreate(false); setEditId(null); resetForm(); }}>Cancel</Button>
              <Button
                className="bg-brand-green hover:bg-brand-green-dark text-white"
                disabled={uploading || createMutation.isPending || updateMutation.isPending}
                onClick={handleSubmit}
              >
                {uploading ? "Uploading..." : editId ? "Update Page" : "Create Page"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* ─── Landing Pages List ─── */}
      {isLoading ? (
        <div className="grid gap-4">{[1, 2].map((i) => <Card key={i} className="border-0 shadow-sm"><CardContent className="p-6"><div className="animate-pulse space-y-3"><div className="h-5 w-48 bg-muted rounded" /><div className="h-3 w-32 bg-muted rounded" /></div></CardContent></Card>)}</div>
      ) : !pages?.length ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No landing pages yet. Create your first one to start capturing leads.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {pages.map((page) => {
            const linkedWebinar = page.webinarId ? webinarMap.get(page.webinarId) : null;
            const fullUrl = getFullUrl(page.slug);
            return (
              <Card key={page.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    {/* Artwork thumbnail */}
                    {page.artworkUrl && (
                      <div className="w-20 h-14 rounded-md overflow-hidden flex-shrink-0 border">
                        <img src={page.artworkUrl} alt="" className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      {/* Title row with badges */}
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="text-base font-semibold" style={{ fontFamily: "Raleway, sans-serif" }}>{page.title}</h3>
                        <Badge variant={page.isActive ? "default" : "secondary"} className={page.isActive ? "bg-brand-green text-white" : ""}>
                          {page.isActive ? "Active" : "Inactive"}
                        </Badge>
                        {page.webinarId && <Badge variant="outline" className="text-[10px]">Webinar Linked</Badge>}
                        {page.confirmationPdfUrl && <Badge variant="outline" className="text-[10px]">PDF Attached</Badge>}
                      </div>

                      {/* ─── Full URL Display ─── */}
                      <div className="flex items-center gap-1.5 mt-1 group">
                        <LinkIcon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        <a
                          href={fullUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-brand-green hover:text-brand-green-dark hover:underline truncate transition-colors"
                          title={fullUrl}
                        >
                          {fullUrl}
                        </a>
                        <button
                          onClick={(e) => { e.preventDefault(); copyUrl(page.slug); }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted"
                          title="Copy URL"
                        >
                          <Copy className="h-3 w-3 text-muted-foreground" />
                        </button>
                      </div>

                      {/* ─── Webinar Date/Time Display ─── */}
                      {linkedWebinar && (
                        <div className="flex items-center gap-3 mt-2.5 p-2.5 rounded-md bg-brand-green/5 border border-brand-green/10">
                          <Calendar className="h-4 w-4 text-brand-green flex-shrink-0" />
                          <div className="text-sm min-w-0">
                            <span className="font-medium text-foreground">{linkedWebinar.title}</span>
                            <span className="text-muted-foreground mx-1.5">·</span>
                            <span className="text-muted-foreground">{formatWebinarDate(linkedWebinar.scheduledAt)}</span>
                            {linkedWebinar.durationMinutes && (
                              <>
                                <span className="text-muted-foreground mx-1.5">·</span>
                                <Clock className="h-3 w-3 inline text-muted-foreground mr-0.5" />
                                <span className="text-muted-foreground">{linkedWebinar.durationMinutes} min</span>
                              </>
                            )}
                          </div>
                          <Badge
                            variant="outline"
                            className={`ml-auto text-[10px] flex-shrink-0 ${
                              linkedWebinar.status === "scheduled" ? "border-blue-300 text-blue-600" :
                              linkedWebinar.status === "live" ? "border-green-300 text-green-600" :
                              linkedWebinar.status === "completed" ? "border-gray-300 text-gray-500" :
                              "border-gray-300 text-gray-500"
                            }`}
                          >
                            {linkedWebinar.status.charAt(0).toUpperCase() + linkedWebinar.status.slice(1)}
                          </Badge>
                        </div>
                      )}

                      {/* Tags row */}
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        {page.sourceTag && <span>Source: {page.sourceTag}</span>}
                        {page.campaignTag && <span>Campaign: {page.campaignTag}</span>}
                        {Array.isArray(page.enabledFields) && <span>{(page.enabledFields as string[]).length} fields</span>}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-1 flex-shrink-0">
                      <a href={`/lp/${page.slug}`} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Preview"><Eye className="h-4 w-4" /></Button>
                      </a>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(page)} title="Edit">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => deleteMutation.mutate({ id: page.id })} title="Delete">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
