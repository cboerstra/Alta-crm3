import { useState, useRef, useMemo, useEffect } from "react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, FileText, Copy, Trash2, Edit, Upload, Image, FileIcon, X, Eye, Calendar, Clock, AlertCircle, Link as LinkIcon, Check, ImagePlus, Users, FileCode2 } from "lucide-react";
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
  textColor: string;
  enabledFields: string[];
  optInLabel: string;
  showOptIn: boolean;
  confirmationEmailSubject: string;
  confirmationEmailBody: string;
};

type MediaSelection = {
  mediaId: number;
  placement: "foreground_logo" | "foreground_image" | "background";
  sortOrder: number;
};

const DEFAULT_EMAIL_SUBJECT = "You're Registered — {{webinarTitle}}";
const DEFAULT_EMAIL_BODY = `Dear {{firstName}} {{lastName}},

Thank you for registering for {{webinarTitle}}! We are thrilled to have you join us and look forward to sharing valuable insights with you.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOUR EVENT DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Event:      {{webinarTitle}}
  Date/Time:  {{date}}
  Join Link:  {{joinUrl}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

To join the webinar, simply click your personal join link above at the scheduled date and time. We recommend joining 5 minutes early to ensure your audio and video are working properly.

WHAT TO EXPECT:
• Expert guidance on navigating today's real estate market
• Answers to your most important homebuying questions
• Exclusive resources available only to registered attendees

If you have any questions prior to the event, please do not hesitate to reply to this email — our team is happy to assist.

We look forward to seeing you there!

Warm regards,

The Clarke & Associates Team
Clarke & Associates CRM

P.S. Add this event to your calendar now so you don't miss it. Your join link is: {{joinUrl}}`;

const defaultForm: FormState = {
  title: "", slug: "", headline: "", subheadline: "", bodyText: "",
  ctaText: "Register Now", campaignTag: "", sourceTag: "",
  webinarId: undefined, isActive: true, accentColor: "#C9A84C", textColor: "#FFFFFF",
  enabledFields: ["firstName", "lastName", "email", "phone"],
  optInLabel: "I agree to receive communications about this event and future opportunities",
  showOptIn: true,
  confirmationEmailSubject: DEFAULT_EMAIL_SUBJECT,
  confirmationEmailBody: DEFAULT_EMAIL_BODY,
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
  const [backgroundHtmlPreview, setBackgroundHtmlPreview] = useState<string | null>(null);
  const [artworkPosition, setArtworkPosition] = useState<string>("center");
  const [bgOverlayOpacity, setBgOverlayOpacity] = useState<number>(0.5);
  const [logoSize, setLogoSize] = useState<number>(64);
  const [pdfName, setPdfName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<MediaSelection[]>([]);
  const artworkRef = useRef<HTMLInputElement>(null);
  const htmlRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);

  const { data: pages, isLoading, refetch } = trpc.landingPages.list.useQuery();
  const { data: webinars } = trpc.webinars.list.useQuery();
  const { data: mediaLibraryItems } = trpc.media.list.useQuery();

  // Fetch sessions for the currently selected webinar
  const { data: selectedWebinarSessions } = trpc.webinars.getSessions.useQuery(
    { webinarId: form.webinarId! },
    { enabled: !!form.webinarId }
  );

  const webinarMap = useMemo(() => {
    const map = new Map<number, { title: string; scheduledAt: Date; durationMinutes: number | null; status: string; zoomWebinarId: string | null; zoomJoinUrl: string | null; replayUrl: string | null }>();
    if (webinars) {
      for (const w of webinars) {
        map.set(w.id, { title: w.title, scheduledAt: w.scheduledAt, durationMinutes: w.durationMinutes, status: w.status, zoomWebinarId: w.zoomWebinarId, zoomJoinUrl: w.zoomJoinUrl, replayUrl: w.replayUrl });
      }
    }
    return map;
  }, [webinars]);

  const createMutation = trpc.landingPages.create.useMutation({
    onSuccess: (data) => {
      toast.success("Landing page created");
      handlePostCreateUploads(data.id);
      // Save media selections
      if (selectedMedia.length > 0) {
        setMediaMutation.mutate({ landingPageId: data.id, items: selectedMedia });
      }
      setShowCreate(false);
      resetForm();
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.landingPages.update.useMutation({
    onSuccess: () => {
      toast.success("Landing page updated");
      // Save media selections on update
      if (editId) {
        setMediaMutation.mutate({ landingPageId: editId, items: selectedMedia });
      }
      setEditId(null);
      resetForm();
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.landingPages.delete.useMutation({
    onSuccess: () => { toast.success("Landing page deleted"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const duplicateMutation = trpc.landingPages.duplicate.useMutation({
    onSuccess: (data) => {
      toast.success(`Landing page duplicated! New slug: /lp/${data.slug}`);
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const setMediaMutation = trpc.media.setForLandingPage.useMutation({
    onError: (e) => toast.error("Failed to save media: " + e.message),
  });

  // Separate mutation for saving artwork/position without closing the dialog
  const updateArtworkMutation = trpc.landingPages.update.useMutation({
    onSuccess: () => { toast.success("Background saved"); refetch(); },
    onError: (e) => toast.error("Failed to save background: " + e.message),
  });

  const [pendingArtworkFile, setPendingArtworkFile] = useState<File | null>(null);
  const [pendingHtmlFile, setPendingHtmlFile] = useState<File | null>(null);
  const [pendingPdfFile, setPendingPdfFile] = useState<File | null>(null);
  const [savingMedia, setSavingMedia] = useState(false);

  // Load existing media selections when editing
  const { data: existingMedia } = trpc.media.getForLandingPage.useQuery(
    { landingPageId: editId! },
    { enabled: editId !== null }
  );

  useEffect(() => {
    if (existingMedia && editId) {
      setSelectedMedia(existingMedia.map(m => ({
        mediaId: m.mediaId,
        placement: (m.placement === "background" ? "foreground_image" : m.placement) as "foreground_logo" | "foreground_image",
        sortOrder: m.sortOrder ?? 0,
      })));
    }
  }, [existingMedia, editId]);

  async function handlePostCreateUploads(pageId: number) {
    if (pendingArtworkFile) {
      try {
        const formData = new FormData();
        formData.append("file", pendingArtworkFile);
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        if (!res.ok) { const err = await res.json().catch(() => ({ error: res.statusText })); throw new Error(err.error ?? "Upload failed"); }
        const { url } = await res.json();
        updateMutation.mutate({ id: pageId, artworkUrl: url });
      } catch (err: any) {
        toast.error("Failed to upload background image: " + err.message);
      }
      setPendingArtworkFile(null);
    }
    if (pendingHtmlFile) {
      try {
        const formData = new FormData();
        formData.append("file", pendingHtmlFile);
        const res = await fetch("/api/upload-html", { method: "POST", body: formData });
        if (!res.ok) { const err = await res.json().catch(() => ({ error: res.statusText })); throw new Error(err.error ?? "Upload failed"); }
        const { url } = await res.json();
        updateMutation.mutate({ id: pageId, backgroundHtmlUrl: url });
      } catch (err: any) {
        toast.error("Failed to upload HTML background: " + err.message);
      }
      setPendingHtmlFile(null);
    }
    if (pendingPdfFile) {
      try {
        const formData = new FormData();
        formData.append("file", pendingPdfFile);
        const res = await fetch("/api/upload-pdf", { method: "POST", body: formData });
        if (!res.ok) { const err = await res.json().catch(() => ({ error: res.statusText })); throw new Error(err.error ?? "Upload failed"); }
        const { url } = await res.json();
        updateMutation.mutate({ id: pageId, confirmationPdfUrl: url });
      } catch (err: any) {
        toast.error("Failed to upload PDF: " + err.message);
      }
      setPendingPdfFile(null);
    }
  }

  function resetForm() {
    setForm({ ...defaultForm });
    setArtworkPreview(null);
    setBackgroundHtmlPreview(null);
    setArtworkPosition("center");
    setPdfName(null);
    setPendingArtworkFile(null);
    setPendingHtmlFile(null);
    setPendingPdfFile(null);
    setTouched({});
    setSubmitAttempted(false);
    setSelectedMedia([]);
  }

  function openEdit(page: any) {
    setForm({
      title: page.title, slug: page.slug,
      headline: page.headline || "", subheadline: page.subheadline || "",
      bodyText: page.bodyText || "", ctaText: page.ctaText || "Register Now",
      campaignTag: page.campaignTag || "", sourceTag: page.sourceTag || "",
      webinarId: page.webinarId || undefined, isActive: page.isActive,
      accentColor: page.accentColor || "#C9A84C",
      textColor: page.textColor || "#FFFFFF",
      enabledFields: (page.enabledFields as string[]) || ["firstName", "lastName", "email", "phone"],
      optInLabel: page.optInLabel || "I agree to receive communications about this event and future opportunities",
      showOptIn: page.showOptIn ?? true,
      confirmationEmailSubject: page.confirmationEmailSubject || DEFAULT_EMAIL_SUBJECT,
      confirmationEmailBody: page.confirmationEmailBody || DEFAULT_EMAIL_BODY,
    });
    setArtworkPreview(page.artworkUrl || null);
    setBackgroundHtmlPreview((page as any).backgroundHtmlUrl || null);
    setArtworkPosition(page.artworkPosition || "center");
    setBgOverlayOpacity(page.bgOverlayOpacity != null ? Number(page.bgOverlayOpacity) : 0.5);
    setLogoSize((page as any).logoSize != null ? Number((page as any).logoSize) : 64);
    setPdfName(page.confirmationPdfUrl ? "Attached PDF" : null);
    setEditId(page.id);
    setTouched({});
    setSubmitAttempted(false);
  }

  const handleArtworkSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("Image must be under 10MB"); return; }
    // Show local preview immediately
    setArtworkPreview(URL.createObjectURL(file));
    if (editId) {
      // Upload now and save URL to DB
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        if (!res.ok) { const err = await res.json().catch(() => ({ error: res.statusText })); throw new Error(err.error ?? "Upload failed"); }
        const { url } = await res.json();
        updateArtworkMutation.mutate({ id: editId, artworkUrl: url });
      } catch (err: any) {
        toast.error("Failed to upload background image: " + err.message);
        setArtworkPreview(null);
      } finally {
        setUploading(false);
      }
    } else {
      // Store file for upload after page is created
      setPendingArtworkFile(file);
    }
    // Reset input so same file can be re-selected
    if (artworkRef.current) artworkRef.current.value = "";
  };

  const handleHtmlSelect = async (file?: File | null) => {
    if (!file) return;
    const lowerName = file.name.toLowerCase();
    const isHtmlFile = lowerName.endsWith(".html") || lowerName.endsWith(".htm") || file.type === "text/html";
    if (!isHtmlFile) { toast.error("Please upload an HTML file"); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("HTML file must be under 10MB"); return; }

    const previewUrl = URL.createObjectURL(file);
    setBackgroundHtmlPreview(previewUrl);

    if (editId) {
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/upload-html", { method: "POST", body: formData });
        if (!res.ok) { const err = await res.json().catch(() => ({ error: res.statusText })); throw new Error(err.error ?? "Upload failed"); }
        const { url } = await res.json();
        updateArtworkMutation.mutate({ id: editId, backgroundHtmlUrl: url });
        setBackgroundHtmlPreview(url);
      } catch (err: any) {
        toast.error("Failed to upload HTML background: " + err.message);
        setBackgroundHtmlPreview(null);
      } finally {
        setUploading(false);
      }
    } else {
      setPendingHtmlFile(file);
    }

    if (htmlRef.current) htmlRef.current.value = "";
  };

  const handlePdfSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) { toast.error("PDF must be under 25MB"); return; }
    setPdfName(file.name);
    if (editId) {
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/upload-pdf", { method: "POST", body: formData });
        if (!res.ok) { const err = await res.json().catch(() => ({ error: res.statusText })); throw new Error(err.error ?? "Upload failed"); }
        const { url } = await res.json();
        updateMutation.mutate({ id: editId, confirmationPdfUrl: url });
        toast.success("PDF uploaded");
      } catch (err: any) {
        toast.error("Failed to upload PDF: " + err.message);
        setPdfName(null);
      } finally {
        setUploading(false);
      }
    } else {
      setPendingPdfFile(file);
    }
    if (pdfRef.current) pdfRef.current.value = "";
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

  // ─── Media Selection Helpers ───
  const toggleMediaSelection = (mediaId: number, placement: "foreground_logo" | "foreground_image") => {
    setSelectedMedia(prev => {
      const exists = prev.find(m => m.mediaId === mediaId);
      if (exists) {
        return prev.filter(m => m.mediaId !== mediaId);
      }
      return [...prev, { mediaId, placement, sortOrder: prev.length }];
    });
  };

  const isMediaSelected = (mediaId: number) => selectedMedia.some(m => m.mediaId === mediaId);

  const getMediaPlacement = (mediaId: number) => selectedMedia.find(m => m.mediaId === mediaId)?.placement;

  const changePlacement = (mediaId: number, placement: "foreground_logo" | "foreground_image") => {
    setSelectedMedia(prev => prev.map(m => m.mediaId === mediaId ? { ...m, placement } : m));
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
        accentColor: form.accentColor || undefined, textColor: form.textColor || undefined, enabledFields: form.enabledFields,
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
        accentColor: form.accentColor || undefined, textColor: form.textColor || undefined, enabledFields: form.enabledFields,
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

  // Split media library into logos and images
  const logos = useMemo(() => mediaLibraryItems?.filter(m => m.fileType === "logo") || [], [mediaLibraryItems]);
  const images = useMemo(() => mediaLibraryItems?.filter(m => m.fileType === "image" || m.fileType === "other") || [], [mediaLibraryItems]);

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
                <TabsTrigger value="media" className="relative">
                  Media
                  {selectedMedia.length > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-brand-green text-white text-[9px] flex items-center justify-center border-2 border-background">
                      {selectedMedia.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="other">Other</TabsTrigger>
              </TabsList>

              {/* ─── Content Tab ─── */}
              <TabsContent value="content" className="space-y-4 mt-4">
                <div>
                  <Label className="flex items-center">Title <RequiredStar /></Label>
                  <Input
                    value={form.title}
                    onChange={(e) => {
                      const newTitle = e.target.value;
                      const autoSlug = newTitle.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
                      // Auto-update slug only when creating (not editing) and slug hasn't been manually customised
                      const prevAutoSlug = form.title.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
                      const slugIsAutoGenerated = !editId && (form.slug === "" || form.slug === prevAutoSlug);
                      setForm(prev => ({
                        ...prev,
                        title: newTitle,
                        slug: slugIsAutoGenerated ? autoSlug : prev.slug,
                      }));
                    }}
                    onBlur={() => markTouched("title")}
                    placeholder="Spring Homebuyer Webinar"
                    className={showError("title") ? "border-red-400 focus-visible:ring-red-400" : ""}
                  />
                  {showError("title") && <FieldError message={validationErrors.title} />}
                </div>
                {/* URL preview — always visible */}
                <div className="rounded-lg border bg-muted/40 px-3 py-2.5 flex items-center gap-2">
                  <LinkIcon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="text-xs text-muted-foreground flex-1 min-w-0 truncate">
                    {window.location.origin}/lp/<span className="font-semibold text-foreground">{form.slug || "your-slug"}</span>
                  </span>
                  <Button
                    type="button" variant="ghost" size="sm"
                    className="h-6 px-2 text-xs shrink-0"
                    disabled={!form.slug}
                    onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/lp/${form.slug}`); toast.success("URL copied!"); }}
                  >
                    Copy
                  </Button>
                </div>
                {!editId && (
                  <div>
                    <Label className="flex items-center">URL Slug <RequiredStar /></Label>
                    <p className="text-xs text-muted-foreground mb-1">Auto-generated from title — edit below if needed.</p>
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
                {editId && (
                  <p className="text-xs text-muted-foreground -mt-2">Slug is locked after creation to preserve existing links.</p>
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
                    <div className="mt-2 space-y-2">
                      <div className="p-2.5 rounded-md bg-muted/50 flex items-center gap-2 text-xs text-muted-foreground">
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
                      {/* Zoom fields from sessions */}
                      {selectedWebinarSessions && selectedWebinarSessions.length > 0 && (
                        <div className="p-3 rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 space-y-2">
                          <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                            Zoom Session Details (auto-populated)
                          </p>
                          {selectedWebinarSessions.map((sess: any) => (
                            <div key={sess.id} className="text-xs space-y-1 p-2 rounded bg-background/60">
                              <p className="font-medium text-foreground">{sess.label ?? "Session"} — {new Date(sess.sessionDate).toLocaleDateString()} at {new Date(sess.sessionDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                              <div className="grid grid-cols-1 gap-1 text-muted-foreground">
                                {sess.zoomWebinarId && (
                                  <p><span className="font-medium text-foreground">Zoom Webinar ID:</span> <span className="font-mono">{sess.zoomWebinarId}</span></p>
                                )}
                                {sess.zoomJoinUrl && (
                                  <p className="truncate"><span className="font-medium text-foreground">Zoom Join URL:</span>{" "}
                                    <a href={sess.zoomJoinUrl} target="_blank" rel="noopener noreferrer" className="text-brand-green underline">{sess.zoomJoinUrl}</a>
                                  </p>
                                )}
                                {sess.replayUrl ? (
                                  <p className="truncate"><span className="font-medium text-foreground">Replay URL:</span>{" "}
                                    <a href={sess.replayUrl} target="_blank" rel="noopener noreferrer" className="text-brand-green underline">{sess.replayUrl}</a>
                                  </p>
                                ) : (
                                  <p><span className="font-medium text-foreground">Replay URL:</span> <span className="italic">Not yet available</span></p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Webinar-level Zoom fields fallback when no sessions */}
                      {(!selectedWebinarSessions || selectedWebinarSessions.length === 0) && (webinarMap.get(form.webinarId)!.zoomWebinarId || webinarMap.get(form.webinarId)!.zoomJoinUrl) && (
                        <div className="p-3 rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 space-y-1">
                          <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">Zoom Details (webinar-level)</p>
                          <div className="text-xs text-muted-foreground space-y-0.5">
                            {webinarMap.get(form.webinarId)!.zoomWebinarId && (
                              <p><span className="font-medium text-foreground">Zoom Webinar ID:</span> <span className="font-mono">{webinarMap.get(form.webinarId)!.zoomWebinarId}</span></p>
                            )}
                            {webinarMap.get(form.webinarId)!.zoomJoinUrl && (
                              <p className="truncate"><span className="font-medium text-foreground">Zoom Join URL:</span>{" "}
                                <a href={webinarMap.get(form.webinarId)!.zoomJoinUrl!} target="_blank" rel="noopener noreferrer" className="text-brand-green underline">{webinarMap.get(form.webinarId)!.zoomJoinUrl}</a>
                              </p>
                            )}
                            {webinarMap.get(form.webinarId)!.replayUrl ? (
                              <p className="truncate"><span className="font-medium text-foreground">Replay URL:</span>{" "}
                                <a href={webinarMap.get(form.webinarId)!.replayUrl!} target="_blank" rel="noopener noreferrer" className="text-brand-green underline">{webinarMap.get(form.webinarId)!.replayUrl}</a>
                              </p>
                            ) : (
                              <p><span className="font-medium text-foreground">Replay URL:</span> <span className="italic">Not yet available</span></p>
                            )}
                          </div>
                        </div>
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
                <div>
                  <Label>Text Color</Label>
                  <p className="text-xs text-muted-foreground mb-1">Color for headline and body text on the landing page.</p>
                  <div className="flex items-center gap-2">
                    <input type="color" value={form.textColor || '#FFFFFF'} onChange={(e) => setForm({ ...form, textColor: e.target.value })} className="h-8 w-12 rounded cursor-pointer" />
                    <Input value={form.textColor || '#FFFFFF'} onChange={(e) => setForm({ ...form, textColor: e.target.value })} className="w-28" />
                    <button type="button" className="text-xs text-muted-foreground underline" onClick={() => setForm({ ...form, textColor: '#FFFFFF' })}>Reset</button>
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
              <TabsContent value="media" className="space-y-5 mt-4">
                {/* Background Image Upload + Live Preview */}
                <div>
                  <Label className="mb-2 block font-semibold">Background Image</Label>
                  <p className="text-xs text-muted-foreground mb-3">This image fills the entire landing page background. Recommended: 1920x1080px or larger, JPG or PNG.</p>
                  {artworkPreview ? (
                    <div className="space-y-3">
                      {/* Live preview with text overlay */}
                      <div
                        className="relative rounded-lg overflow-hidden border shadow-md"
                        style={{ height: "200px" }}
                      >
                        <img
                          src={artworkPreview}
                          alt="Background preview"
                          className="absolute inset-0 w-full h-full object-cover"
                          style={{ objectPosition: artworkPosition }}
                        />
                        {/* Dark gradient overlay */}
                        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.55) 60%, rgba(0,0,0,0.75) 100%)" }} />
                        {/* Text content */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
                          {form.headline ? (
                            <h2 className="text-white font-bold text-lg leading-tight drop-shadow-lg" style={{ fontFamily: "Raleway, sans-serif", textShadow: "0 2px 8px rgba(0,0,0,0.7)" }}>
                              {form.headline}
                            </h2>
                          ) : (
                            <p className="text-white/50 text-sm italic">Headline will appear here</p>
                          )}
                          {form.subheadline && (
                            <p className="text-white/85 text-sm mt-2 leading-snug drop-shadow" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}>
                              {form.subheadline}
                            </p>
                          )}
                          {form.ctaText && (
                            <div
                              className="mt-3 px-4 py-1.5 rounded text-sm font-semibold text-white shadow"
                              style={{ backgroundColor: form.accentColor || "#C9A84C" }}
                            >
                              {form.ctaText}
                            </div>
                          )}
                        </div>
                        {/* Remove button */}
                        <Button variant="secondary" size="sm" className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white border-0" onClick={() => { setArtworkPreview(null); setArtworkPosition("center"); setPendingArtworkFile(null); if (editId) updateArtworkMutation.mutate({ id: editId, artworkUrl: null }); }}>
                          <X className="h-3 w-3 mr-1" /> Remove
                        </Button>
                        {/* Change button */}
                        <button onClick={() => artworkRef.current?.click()} className="absolute bottom-2 right-2 text-[10px] text-white/70 hover:text-white underline">
                          Change image
                        </button>
                      </div>
                      {/* Position picker */}
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1.5 block">Image focal point (position)</Label>
                        <div className="grid grid-cols-3 gap-1.5">
                          {[
                            { label: "Top Left", value: "top left" },
                            { label: "Top Center", value: "top center" },
                            { label: "Top Right", value: "top right" },
                            { label: "Middle Left", value: "center left" },
                            { label: "Center", value: "center" },
                            { label: "Middle Right", value: "center right" },
                            { label: "Bottom Left", value: "bottom left" },
                            { label: "Bottom Center", value: "bottom center" },
                            { label: "Bottom Right", value: "bottom right" },
                          ].map(pos => (
                            <button
                              key={pos.value}
                              onClick={() => {
                                setArtworkPosition(pos.value);
                                if (editId) updateArtworkMutation.mutate({ id: editId, artworkPosition: pos.value });
                              }}
                              className={`text-[10px] py-1 px-1.5 rounded border transition-colors ${
                                artworkPosition === pos.value
                                  ? "bg-brand-green text-white border-brand-green font-semibold"
                                  : "bg-muted text-muted-foreground border-border hover:border-brand-green/50"
                              }`}
                            >
                              {pos.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground">Preview shows how your headline and CTA button will appear over the background. Click a position to adjust the focal point.</p>
                    </div>
                  ) : (
                    <button onClick={() => artworkRef.current?.click()} className="w-full h-40 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-brand-green/50 hover:text-brand-green transition-colors cursor-pointer">
                      <Image className="h-8 w-8" />
                      <span className="text-sm font-medium">Upload background image</span>
                      <span className="text-xs">JPG, PNG up to 10MB — fills entire page</span>
                    </button>
                  )}
                  <input ref={artworkRef} type="file" accept="image/*" className="hidden" onChange={handleArtworkSelect} />

                  {/* Background Overlay Opacity Slider — always visible */}
                  <div className="space-y-2 pt-3 border-t mt-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold">Background Overlay Darkness</Label>
                      <span className="text-xs text-muted-foreground font-mono">{Math.round(bgOverlayOpacity * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={Math.round(bgOverlayOpacity * 100)}
                      onChange={(e) => {
                        const val = Number(e.target.value) / 100;
                        setBgOverlayOpacity(val);
                      }}
                      onMouseUp={(e) => {
                        const val = Number((e.target as HTMLInputElement).value) / 100;
                        if (editId) {
                          updateArtworkMutation.mutate({ id: editId, bgOverlayOpacity: val });
                        }
                      }}
                      onTouchEnd={(e) => {
                        const val = Number((e.target as HTMLInputElement).value) / 100;
                        if (editId) {
                          updateArtworkMutation.mutate({ id: editId, bgOverlayOpacity: val });
                        }
                      }}
                      className="w-full h-2 rounded-full accent-brand-green cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>Transparent (0%)</span>
                      <span>Darker overlay</span>
                      <span>Fully dark (100%)</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Controls how dark the overlay is over your background image. Increase if text is hard to read.</p>
                  </div>
                </div>

                {/* Logo Size Slider */}
                <div className="space-y-2 pt-3 border-t mt-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">Logo Size</Label>
                    <span className="text-xs text-muted-foreground font-mono">{logoSize}px</span>
                  </div>
                  <input
                    type="range"
                    min={30}
                    max={200}
                    step={5}
                    value={logoSize}
                    onChange={(e) => setLogoSize(Number(e.target.value))}
                    onMouseUp={(e) => {
                      const val = Number((e.target as HTMLInputElement).value);
                      if (editId) {
                        updateArtworkMutation.mutate({ id: editId, logoSize: val });
                      }
                    }}
                    onTouchEnd={(e) => {
                      const val = Number((e.target as HTMLInputElement).value);
                      if (editId) {
                        updateArtworkMutation.mutate({ id: editId, logoSize: val });
                      }
                    }}
                    className="w-full h-2 rounded-full accent-brand-green cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Small (30px)</span>
                    <span>Medium (100px)</span>
                    <span>Large (200px)</span>
                  </div>
                </div>

                <Separator />

                {/* Corporate Logos & Images from Media Library */}
                <div>
                  <Label className="mb-2 block font-semibold">Foreground Logos & Images</Label>
                  <p className="text-xs text-muted-foreground mb-3">
                    Select corporate logos and images from your media library to display in the foreground of the landing page.
                    Upload new items in <span className="font-medium text-foreground">Settings → Media Library</span>.
                  </p>

                  {(!mediaLibraryItems || mediaLibraryItems.length === 0) ? (
                    <div className="text-center p-6 border-2 border-dashed rounded-lg text-muted-foreground">
                      <ImagePlus className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No media items yet.</p>
                      <p className="text-xs mt-1">Go to <span className="font-medium">Settings → Media Library</span> to upload logos and images first.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Logos Section */}
                      {logos.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Logos</p>
                          <ScrollArea className="w-full">
                            <div className="flex gap-3 pb-2">
                              {logos.map((item) => (
                                <button
                                  key={item.id}
                                  onClick={() => toggleMediaSelection(item.id, "foreground_logo")}
                                  className={`relative flex-shrink-0 w-24 h-24 rounded-lg border-2 overflow-hidden transition-all ${
                                    isMediaSelected(item.id)
                                      ? "border-brand-green ring-2 ring-brand-green/30 shadow-md"
                                      : "border-muted hover:border-brand-green/40"
                                  }`}
                                >
                                  <img src={item.fileUrl} alt={item.label || ""} className="w-full h-full object-contain p-2 bg-white" />
                                  {isMediaSelected(item.id) && (
                                    <div className="absolute top-1 right-1 h-5 w-5 rounded-full bg-brand-green flex items-center justify-center">
                                      <Check className="h-3 w-3 text-white" />
                                    </div>
                                  )}
                                  <div className="absolute bottom-0 inset-x-0 bg-black/60 px-1 py-0.5">
                                    <p className="text-[9px] text-white truncate text-center">{item.label}</p>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </ScrollArea>
                        </div>
                      )}

                      {/* Images Section */}
                      {images.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Images</p>
                          <p className="text-[10px] text-muted-foreground mb-2">Click to add to foreground · hover for background option</p>
                          <ScrollArea className="w-full">
                            <div className="flex gap-3 pb-2">
                              {images.map((item) => {
                                const isBackground = artworkPreview === item.fileUrl;
                                return (
                                <div key={item.id} className="relative flex-shrink-0 group">
                                  <button
                                    onClick={() => {
                                      if (isBackground) return; // can't add background image to foreground
                                      toggleMediaSelection(item.id, "foreground_image");
                                    }}
                                    className={`relative w-28 h-20 rounded-lg border-2 overflow-hidden transition-all ${
                                      isBackground
                                        ? "border-brand-gold ring-2 ring-brand-gold/30 shadow-md"
                                        : isMediaSelected(item.id)
                                        ? "border-brand-green ring-2 ring-brand-green/30 shadow-md"
                                        : "border-muted hover:border-brand-green/40"
                                    }`}
                                  >
                                    <img src={item.fileUrl} alt={item.label || ""} className="w-full h-full object-cover" />
                                    {isBackground && (
                                      <div className="absolute top-1 right-1 h-5 w-5 rounded-full bg-brand-gold flex items-center justify-center" title="Set as background">
                                        <Image className="h-3 w-3 text-white" />
                                      </div>
                                    )}
                                    {!isBackground && isMediaSelected(item.id) && (
                                      <div className="absolute top-1 right-1 h-5 w-5 rounded-full bg-brand-green flex items-center justify-center">
                                        <Check className="h-3 w-3 text-white" />
                                      </div>
                                    )}
                                    <div className="absolute bottom-0 inset-x-0 bg-black/60 px-1 py-0.5">
                                      <p className="text-[9px] text-white truncate text-center">{isBackground ? "BG" : item.label}</p>
                                    </div>
                                  </button>
                                  {/* Set as Background button — shown on hover */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setArtworkPreview(item.fileUrl);
                                      setPendingArtworkFile(null);
                                      // Remove from foreground selections if it was there
                                      setSelectedMedia(prev => prev.filter(m => m.mediaId !== item.id));
                                      if (editId) {
                                        updateArtworkMutation.mutate({ id: editId, artworkUrl: item.fileUrl });
                                      }
                                    }}
                                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-brand-gold text-white shadow-md opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10"
                                    title="Set as background image"
                                  >
                                    <Image className="h-3 w-3" />
                                  </button>
                                </div>
                              );
                              })}
                            </div>
                          </ScrollArea>
                        </div>
                      )}

                      {/* Selected Media Summary */}
                      {selectedMedia.length > 0 && (
                        <div className="p-3 rounded-lg bg-brand-green/5 border border-brand-green/15">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-semibold text-brand-green">{selectedMedia.length} item{selectedMedia.length > 1 ? "s" : ""} selected for foreground</p>
                            {editId && (
                              <Button
                                size="sm"
                                className="h-7 px-3 text-xs bg-brand-green hover:bg-brand-green-dark text-white gap-1"
                                disabled={savingMedia}
                                onClick={async () => {
                                  if (!editId) return;
                                  setSavingMedia(true);
                                  try {
                                    await new Promise<void>((resolve, reject) => {
                                      setMediaMutation.mutate(
                                        { landingPageId: editId, items: selectedMedia },
                                        { onSuccess: () => { toast.success("Media saved"); resolve(); }, onError: (e) => reject(e) }
                                      );
                                    });
                                  } catch (e: any) {
                                    toast.error("Failed to save media: " + e.message);
                                  } finally {
                                    setSavingMedia(false);
                                  }
                                }}
                              >
                                {savingMedia ? "Saving..." : "Save Changes"}
                              </Button>
                            )}
                          </div>
                          <div className="space-y-1.5">
                            {selectedMedia.map((sel) => {
                              const item = mediaLibraryItems?.find(m => m.id === sel.mediaId);
                              if (!item) return null;
                              return (
                                <div key={sel.mediaId} className="flex items-center gap-2 text-xs">
                                  <img src={item.fileUrl} alt="" className="h-6 w-6 rounded object-cover border" />
                                  <span className="flex-1 truncate">{item.label}</span>
                                  <Select
                                    value={sel.placement}
                                    onValueChange={(v) => changePlacement(sel.mediaId, v as "foreground_logo" | "foreground_image")}
                                  >
                                    <SelectTrigger className="h-6 w-28 text-[10px]">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="foreground_logo">Logo</SelectItem>
                                      <SelectItem value="foreground_image">Image</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <button onClick={() => toggleMediaSelection(sel.mediaId, sel.placement as "foreground_logo" | "foreground_image")} className="text-muted-foreground hover:text-destructive">
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <Separator />

                {/* PDF Attachment */}
                <div>
                  <Label className="mb-2 block font-semibold">PDF Attachment for Confirmation Email</Label>
                  <p className="text-xs text-muted-foreground mb-3">Upload a PDF document that will be attached to the confirmation email sent to leads upon signup.</p>
                  {pdfName ? (
                    <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                      <FileIcon className="h-5 w-5 text-red-500" />
                      <span className="text-sm font-medium flex-1">{pdfName}</span>
                      <Button variant="ghost" size="sm" onClick={() => { setPdfName(null); setPendingPdfFile(null); if (editId) updateMutation.mutate({ id: editId, confirmationPdfUrl: null }); }}>
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

              {/* ─── Other Tab ─── */}
              <TabsContent value="other" className="space-y-5 mt-4">
                <div>
                  <Label className="mb-2 block font-semibold">HTML Background Template</Label>
                  <p className="text-xs text-muted-foreground mb-3">
                    Upload an HTML file to use as the landing page background behind the form. This is useful for custom animated or designed backgrounds.
                  </p>

                  {backgroundHtmlPreview ? (
                    <div className="space-y-3">
                      <div className="relative rounded-lg overflow-hidden border shadow-sm bg-white" style={{ height: "320px" }}>
                        <iframe
                          src={backgroundHtmlPreview}
                          title="HTML background preview"
                          className="absolute inset-0 h-full w-full border-0"
                        />
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white/95 to-transparent" />
                        <div className="absolute right-2 top-2 flex gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            className="bg-black/50 hover:bg-black/70 text-white border-0"
                            onClick={() => htmlRef.current?.click()}
                          >
                            Change
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="bg-black/50 hover:bg-black/70 text-white border-0"
                            onClick={() => {
                              setBackgroundHtmlPreview(null);
                              setPendingHtmlFile(null);
                              if (editId) {
                                updateArtworkMutation.mutate({ id: editId, backgroundHtmlUrl: null });
                              }
                            }}
                          >
                            <X className="h-3 w-3 mr-1" /> Remove
                          </Button>
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Preview updates immediately after you drop a file. Uploaded logos are still managed from the Media tab using the shared media library.
                      </p>
                    </div>
                  ) : (
                    <div
                      onClick={() => htmlRef.current?.click()}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "copy";
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        handleHtmlSelect(e.dataTransfer.files?.[0]);
                      }}
                      className="w-full h-44 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-brand-green/50 hover:text-brand-green transition-colors cursor-pointer bg-muted/20"
                    >
                      <FileCode2 className="h-8 w-8" />
                      <span className="text-sm font-medium">Drag and drop HTML background</span>
                      <span className="text-xs">or click to browse `.html` files up to 10MB</span>
                    </div>
                  )}
                  <input
                    ref={htmlRef}
                    type="file"
                    accept=".html,.htm,text/html"
                    className="hidden"
                    onChange={(e) => handleHtmlSelect(e.target.files?.[0])}
                  />
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

                      {/* Tags row + Lead Count */}
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                        {(page as any).leadCount !== undefined && (
                          <span className="flex items-center gap-1 font-medium text-brand-green">
                            <Users className="h-3 w-3" />
                            {(page as any).leadCount} lead{(page as any).leadCount !== 1 ? "s" : ""}
                          </span>
                        )}
                        {page.sourceTag && <span>Source: {page.sourceTag}</span>}
                        {page.campaignTag && <span>Campaign: {page.campaignTag}</span>}
                        {Array.isArray(page.enabledFields) && <span>{(page.enabledFields as string[]).length} fields</span>}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-1 flex-shrink-0">
                      <a href={`/lp/${page.slug}`} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Preview landing page"><Eye className="h-4 w-4" /></Button>
                      </a>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(page)} title="Edit">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground"
                        title="Duplicate landing page"
                        disabled={duplicateMutation.isPending}
                        onClick={() => duplicateMutation.mutate({ id: page.id })}
                      >
                        <Copy className="h-4 w-4" />
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
