import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Settings, Video, Calendar, CheckCircle, AlertCircle,
  Upload, Image, Trash2, Edit, ImageIcon, FileImage,
  LayoutGrid, Tag, Loader2, X, MessageSquare, Phone, Eye, EyeOff, Send, Mail, Plus,
} from "lucide-react";
import { toast } from "sonner";

type MediaItem = {
  id: number;
  fileName: string;
  fileUrl: string;
  fileType: string;
  mimeType: string | null;
  fileSize: number | null;
  label: string | null;
  createdAt: Date;
};

export default function SettingsPage() {
  const { data: status, refetch: refetchStatus } = trpc.integrations.getStatus.useQuery();
  const { data: mediaItems, isLoading: mediaLoading, refetch: refetchMedia } = trpc.media.list.useQuery();
  const { data: smsTemplateList, isLoading: templatesLoading, refetch: refetchTemplates } = trpc.smsTemplates.list.useQuery();

  const [zoomForm, setZoomForm] = useState({ accountId: "", clientId: "", clientSecret: "", accountEmail: "" });
  const [gcalForm, setGcalForm] = useState({ accessToken: "", accountEmail: "" });
  const [telnyxForm, setTelnyxForm] = useState({ apiKey: "", fromPhone: "+18017840672" });
  const [editFromPhone, setEditFromPhone] = useState("");
  const [showEditFromPhone, setShowEditFromPhone] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [showTestSms, setShowTestSms] = useState(false);

  // Gmail state
  const [gmailForm, setGmailForm] = useState({ gmailAddress: "", appPassword: "" });
  const [showAppPassword, setShowAppPassword] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [showTestEmail, setShowTestEmail] = useState(false);

  // SMS Templates state
  const [editingTemplate, setEditingTemplate] = useState<number | null>(null); // now uses id
  const [templateDrafts, setTemplateDrafts] = useState<Record<number, { body: string; isActive: boolean }>>({});
  const [showAddTemplate, setShowAddTemplate] = useState(false);
  const [newTemplateTrigger, setNewTemplateTrigger] = useState<string>("new_lead");
  const SMS_TEMPLATE_DEFAULTS: Record<string, string> = {
    new_lead: "Hi {{first_name}}, this is Clarke & Associates Mortgage. Thanks for reaching out — a member of our team will be in touch with you shortly. Reply STOP to opt out.",
    registered: "Hi {{first_name}}, you're confirmed for {{webinar_title}} on {{session_date}}! Use this link to join: {{webinar_link}} — We look forward to seeing you there. Reply STOP to opt out.",
    reminder_24h: "Hi {{first_name}}, just a reminder that {{webinar_title}} is tomorrow on {{session_date}}. Your join link: {{webinar_link}} — See you then! Reply STOP to opt out.",
    reminder_1h: "Hi {{first_name}}, {{webinar_title}} starts in 1 hour! Click here to join: {{webinar_link}} — We'll see you soon. Reply STOP to opt out.",
    attended: "Hi {{first_name}}, thank you for attending {{webinar_title}}! We hope it was valuable. If you're ready to explore your mortgage options, reply here or book a free consultation with our team. Reply STOP to opt out.",
    no_show: "Hi {{first_name}}, we missed you at {{webinar_title}}! No worries — reply here if you have any questions or would like to register for an upcoming session. We're happy to help. Reply STOP to opt out.",
    consultation_booked: "Hi {{first_name}}, your consultation with Clarke & Associates is confirmed. Please check your email for the details. We look forward to speaking with you! Reply STOP to opt out.",
    under_contract: "Hi {{first_name}}, congratulations — you're under contract! The Clarke & Associates team is here to help you through the next steps. We'll be in touch soon. Reply STOP to opt out.",
    deal_closed: "Hi {{first_name}}, congratulations on your new home! It was a pleasure working with you at Clarke & Associates. Wishing you all the best — don't hesitate to reach out if you ever need us. Reply STOP to opt out.",
  };
  const [newTemplateBody, setNewTemplateBody] = useState(SMS_TEMPLATE_DEFAULTS["new_lead"]);
  const [newTemplateActive, setNewTemplateActive] = useState(true);
  const [deletingTemplateId, setDeletingTemplateId] = useState<number | null>(null);
  const [previewTemplateId, setPreviewTemplateId] = useState<number | null>(null);

  const SAMPLE_VARS: Record<string, string> = {
    '{{first_name}}': 'John',
    '{{last_name}}': 'Smith',
    '{{full_name}}': 'John Smith',
    '{{webinar_title}}': 'Home Buying Seminar',
    '{{webinar_link}}': 'https://zoom.us/j/123456789',
    '{{session_date}}': 'Saturday, April 5 at 10:00 AM',
  };

  const renderPreview = (body: string) =>
    Object.entries(SAMPLE_VARS).reduce((msg, [key, val]) => msg.replaceAll(key, val), body);

  const upsertTemplate = trpc.smsTemplates.upsert.useMutation({
    onSuccess: () => { toast.success("Template saved"); refetchTemplates(); setEditingTemplate(null); },
    onError: (e: any) => toast.error(e.message),
  });
  const resetTemplate = trpc.smsTemplates.reset.useMutation({
    onSuccess: () => { toast.success("Template reset to default"); refetchTemplates(); setEditingTemplate(null); },
    onError: (e: any) => toast.error(e.message),
  });
  const createTemplate = trpc.smsTemplates.create.useMutation({
    onSuccess: () => {
      toast.success("Template created");
      refetchTemplates();
      setShowAddTemplate(false);
      setNewTemplateTrigger("new_lead");
      setNewTemplateBody(SMS_TEMPLATE_DEFAULTS["new_lead"]);
      setNewTemplateActive(true);
    },
    onError: (e: any) => toast.error(e.message),
  });
  const updateTemplate = trpc.smsTemplates.update.useMutation({
    onSuccess: () => { toast.success("Template saved"); refetchTemplates(); setEditingTemplate(null); },
    onError: (e: any) => toast.error(e.message),
  });
  const deleteTemplate = trpc.smsTemplates.delete.useMutation({
    onSuccess: () => { toast.success("Template deleted"); refetchTemplates(); setDeletingTemplateId(null); },
    onError: (e: any) => toast.error(e.message),
  });

  // Media upload state
  const [uploading, setUploading] = useState(false);
  const [editingMedia, setEditingMedia] = useState<MediaItem | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editType, setEditType] = useState<string>("image");
  const [filterType, setFilterType] = useState<string>("all");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const connectZoom = trpc.integrations.connectZoom.useMutation({
    onSuccess: () => { toast.success("Zoom connected"); refetchStatus(); },
    onError: (e: any) => toast.error(e.message),
  });

  const connectGoogle = trpc.integrations.connectGoogle.useMutation({
    onSuccess: () => { toast.success("Google Calendar connected"); refetchStatus(); },
    onError: (e: any) => toast.error(e.message),
  });

  const disconnect = trpc.integrations.disconnect.useMutation({
    onSuccess: () => { toast.success("Disconnected"); refetchStatus(); },
    onError: (e: any) => toast.error(e.message),
  });
  // ─── Telnyx mutations ────────────────────────────────────────────────────────────
  const connectTelnyx = trpc.integrations.connectTelnyx.useMutation({
    onSuccess: () => {
      toast.success("Telnyx connected successfully!");
      refetchStatus();
      setTelnyxForm({ apiKey: "", fromPhone: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const testTelnyx = trpc.integrations.testTelnyx.useMutation({
    onSuccess: () => {
      toast.success("Test SMS sent! Check your phone.");
      setShowTestSms(false);
      setTestPhone("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleTelnyx = trpc.integrations.toggleTelnyx.useMutation({
    onSuccess: (_: any, vars: { enabled: boolean }) => {
      toast.success(vars.enabled ? "SMS sending enabled" : "SMS sending disabled");
      refetchStatus();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const disconnectTelnyx = trpc.integrations.disconnectTelnyx.useMutation({
    onSuccess: () => { toast.success("Telnyx disconnected"); refetchStatus(); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateFromPhone = trpc.integrations.updateTelnyxFromPhone.useMutation({
    onSuccess: () => {
      toast.success("From phone number updated!");
      refetchStatus();
      setShowEditFromPhone(false);
      setEditFromPhone("");
    },
    onError: (e: any) => toast.error(e.message),
  });// ─── Gmail mutations ────────────────────────────────────────────────────────
  const connectGmail = trpc.integrations.connectGmail.useMutation({
    onSuccess: () => {
      toast.success("Gmail connected successfully! Emails will now be sent via Gmail.");
      refetchStatus();
      setGmailForm({ gmailAddress: "", appPassword: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const testGmailMutation = trpc.integrations.testGmail.useMutation({
    onSuccess: () => {
      toast.success("Test email sent! Check your inbox.");
      setShowTestEmail(false);
      setTestEmail("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleGmail = trpc.integrations.toggleGmail.useMutation({
    onSuccess: (_: any, vars: { enabled: boolean }) => {
      toast.success(vars.enabled ? "Email sending enabled" : "Email sending paused");
      refetchStatus();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const disconnectGmail = trpc.integrations.disconnectGmail.useMutation({
    onSuccess: () => { toast.success("Gmail disconnected"); refetchStatus(); },
    onError: (e: any) => toast.error(e.message),
  });

  // ─── Media helpers ──────────────────────────────────────────────────────────
  const uploadMedia = trpc.media.upload.useMutation({
    onSuccess: () => { toast.success("File uploaded to media library"); refetchMedia(); setUploading(false); },
    onError: (e: any) => { toast.error(e.message); setUploading(false); },
  });

  const updateMedia = trpc.media.update.useMutation({
    onSuccess: () => { toast.success("Media updated"); refetchMedia(); setEditingMedia(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMedia = trpc.media.delete.useMutation({
    onSuccess: () => { toast.success("Media deleted"); refetchMedia(); },
    onError: (e: any) => toast.error(e.message),
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    const uploads = Array.from(files);
    let completed = 0;
    for (const file of uploads) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} is too large (max 10MB)`);
        completed++;
        if (completed === uploads.length) setUploading(false);
        continue;
      }
      try {
        // Step 1: Upload the file to the server via multipart POST
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(err.error ?? "Upload failed");
        }
        const { url, filename, size } = await res.json();
        // Step 2: Save the file metadata to the database
        const isLogo = file.name.toLowerCase().includes("logo");
        uploadMedia.mutate({
          fileUrl: url,
          fileKey: filename,
          fileName: file.name,
          contentType: file.type,
          fileSize: size ?? file.size,
          fileType: isLogo ? "logo" : "image",
          label: file.name.replace(/\.[^.]+$/, ""),
        });
      } catch (err: any) {
        toast.error(`Failed to upload ${file.name}: ${err.message}`);
        setUploading(false);
      }
      completed++;
      if (completed === uploads.length) {
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    }
  };

  const openEditDialog = (item: MediaItem) => {
    setEditingMedia(item);
    setEditLabel(item.label || "");
    setEditType(item.fileType);
  };

  const filteredMedia = mediaItems?.filter(
    (item: MediaItem) => filterType === "all" || item.fileType === filterType
  ) ?? [];

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const typeIcon = (type: string) => {
    switch (type) {
      case "logo": return <Tag className="h-3 w-3" />;
      case "background": return <FileImage className="h-3 w-3" />;
      default: return <ImageIcon className="h-3 w-3" />;
    }
  };

  const typeBadgeColor = (type: string) => {
    switch (type) {
      case "logo": return "bg-amber-100 text-amber-700 border-amber-200";
      case "background": return "bg-blue-100 text-blue-700 border-blue-200";
      case "image": return "bg-green-100 text-green-700 border-green-200";
      default: return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  const telnyxConnected = status?.telnyx?.connected;
  const gmailConnected = status?.gmail?.connected;
  const gmailDetails = gmailConnected && "gmailAddress" in status!.gmail! ? status!.gmail as {
    connected: true; gmailAddress: string; appPasswordHint: string; enabled: boolean;
  } : null;
  const telnyxDetails = telnyxConnected && "apiKeyHint" in status!.telnyx! ? status!.telnyx as {
    connected: true; apiKeyHint: string; fromPhone: string; enabled: boolean;
  } : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "Raleway, sans-serif" }}>Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage integrations, media library, and preferences</p>
      </div>

      <Tabs defaultValue="media" className="space-y-4">
        <TabsList className="bg-muted/30 flex-wrap h-auto gap-1">
          <TabsTrigger value="media" className="gap-1"><Image className="h-3.5 w-3.5" /> Media Library</TabsTrigger>
          <TabsTrigger value="zoom" className="gap-1 relative">
            <Video className="h-3.5 w-3.5" /> Zoom
            {status?.zoom?.connected && (
              <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-green-500" />
            )}
          </TabsTrigger>
          <TabsTrigger value="google" className="gap-1 relative">
            <Calendar className="h-3.5 w-3.5" /> Google Calendar
            {status?.google?.connected && (
              <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-green-500" />
            )}
          </TabsTrigger>
          <TabsTrigger value="sms" className="gap-1 relative">
            <MessageSquare className="h-3.5 w-3.5" /> SMS
            {telnyxConnected && (
              <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-green-500" />
            )}
          </TabsTrigger>
          <TabsTrigger value="email" className="gap-1 relative">
            <Mail className="h-3.5 w-3.5" /> Email
            {gmailConnected && (
              <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-green-500" />
            )}
          </TabsTrigger>
          <TabsTrigger value="sms-templates" className="gap-1"><MessageSquare className="h-3.5 w-3.5" /> SMS Templates</TabsTrigger>
          <TabsTrigger value="general" className="gap-1"><Settings className="h-3.5 w-3.5" /> General</TabsTrigger>
        </TabsList>

        {/* ─── Media Library Tab ─── */}
        <TabsContent value="media">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base" style={{ fontFamily: "Raleway, sans-serif" }}>
                    Corporate Media Library
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Upload logos, images, and artwork to use across your landing pages.
                  </p>
                </div>
                <Button
                  className="bg-brand-green hover:bg-brand-green-dark text-white gap-1.5"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Upload Files
                </Button>
                <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileUpload} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 mb-4">
                <LayoutGrid className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Filter:</span>
                {["all", "logo", "image", "background"].map((type) => (
                  <button
                    key={type}
                    onClick={() => setFilterType(type)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      filterType === type ? "bg-brand-green text-white" : "bg-muted/50 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {type === "all" ? "All" : type.charAt(0).toUpperCase() + type.slice(1) + "s"}
                  </button>
                ))}
                <span className="text-xs text-muted-foreground ml-auto">{filteredMedia.length} item{filteredMedia.length !== 1 ? "s" : ""}</span>
              </div>
              <div
                className="mb-6 border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:border-brand-green/50 hover:bg-brand-green/5 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">Click or drag files here to upload logos, images, and artwork</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Supports JPG, PNG, SVG, WebP — Max 10MB per file</p>
              </div>
              {mediaLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {[1, 2, 3, 4, 5].map(i => <div key={i} className="aspect-square rounded-lg bg-muted animate-pulse" />)}
                </div>
              ) : filteredMedia.length === 0 ? (
                <div className="text-center py-12">
                  <Image className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground">
                    {filterType === "all" ? "No media uploaded yet." : `No ${filterType}s found.`}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {filteredMedia.map((item: MediaItem) => (
                    <div key={item.id} className="group relative rounded-lg border overflow-hidden hover:shadow-md transition-shadow bg-white">
                      <div className="aspect-square bg-[#f8f8f8] flex items-center justify-center p-3">
                        <img src={item.fileUrl} alt={item.label || item.fileName} className="max-w-full max-h-full object-contain" />
                      </div>
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                        <Button size="sm" variant="secondary" className="h-8 w-8 p-0" onClick={() => openEditDialog(item)}>
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="secondary" className="h-8 w-8 p-0 text-destructive" onClick={() => deleteMedia.mutate({ id: item.id })}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <div className="p-2 border-t">
                        <p className="text-xs font-medium truncate" title={item.label || item.fileName}>{item.label || item.fileName}</p>
                        <div className="flex items-center justify-between mt-1">
                          <Badge variant="outline" className={`text-[10px] gap-0.5 ${typeBadgeColor(item.fileType)}`}>
                            {typeIcon(item.fileType)}{item.fileType}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">{formatFileSize(item.fileSize)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Zoom Tab ─── */}
        <TabsContent value="zoom">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2" style={{ fontFamily: "Raleway, sans-serif" }}>
                  <Video className="h-5 w-5 text-brand-green" />
                  Zoom Integration
                </CardTitle>
                {status?.zoom.connected ? (
                  <Badge className="bg-green-100 text-green-700 gap-1"><CheckCircle className="h-3 w-3" /> Connected</Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1"><AlertCircle className="h-3 w-3" /> Not Connected</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Connect your Zoom account using Server-to-Server OAuth. When connected, clicking "Add Session" on any webinar will automatically create a Zoom meeting and populate the join link.
              </p>
              {status?.zoom.connected ? (
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                    <p className="text-sm font-medium text-green-800">✓ Zoom is connected</p>
                    {"email" in status.zoom && status.zoom.email && (
                      <p className="text-xs text-green-600 mt-1">Account: {status.zoom.email}</p>
                    )}
                    {"accountId" in status.zoom && status.zoom.accountId && (
                      <p className="text-xs text-green-600">Account ID: {status.zoom.accountId}</p>
                    )}
                  </div>
                  <Button variant="outline" className="text-destructive" onClick={() => disconnect.mutate({ provider: "zoom" })}>
                    Disconnect Zoom
                  </Button>
                </div>
              ) : (
                <>
                  <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-800 space-y-1">
                    <p className="font-medium">How to get Server-to-Server OAuth credentials:</p>
                    <ol className="list-decimal list-inside space-y-0.5 text-xs">
                      <li>Go to <a href="https://marketplace.zoom.us" target="_blank" rel="noopener noreferrer" className="underline">marketplace.zoom.us</a> → Develop → Build App</li>
                      <li>Choose <strong>Server-to-Server OAuth</strong> and create the app</li>
                      <li>Under <strong>App Credentials</strong>, copy your Account ID, Client ID, and Client Secret</li>
                      <li>Under <strong>Scopes</strong>, add: <code>meeting:write:admin</code> and <code>meeting:read:admin</code></li>
                      <li>Activate the app, then paste the credentials below</li>
                    </ol>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <Label>Account ID <span className="text-destructive">*</span></Label>
                      <Input
                        value={zoomForm.accountId}
                        onChange={(e) => setZoomForm({ ...zoomForm, accountId: e.target.value })}
                        placeholder="e.g. AbCdEfGhIj1234567890"
                      />
                    </div>
                    <div>
                      <Label>Client ID <span className="text-destructive">*</span></Label>
                      <Input
                        value={zoomForm.clientId}
                        onChange={(e) => setZoomForm({ ...zoomForm, clientId: e.target.value })}
                        placeholder="e.g. AbCdEfGhIjKlMnOpQrSt"
                      />
                    </div>
                    <div>
                      <Label>Client Secret <span className="text-destructive">*</span></Label>
                      <Input
                        type="password"
                        value={zoomForm.clientSecret}
                        onChange={(e) => setZoomForm({ ...zoomForm, clientSecret: e.target.value })}
                        placeholder="Your Client Secret"
                      />
                    </div>
                    <div>
                      <Label>Account Email (optional)</Label>
                      <Input
                        value={zoomForm.accountEmail}
                        onChange={(e) => setZoomForm({ ...zoomForm, accountEmail: e.target.value })}
                        placeholder="zoom@company.com"
                      />
                    </div>
                    <Button
                      className="bg-brand-green hover:bg-brand-green-dark text-white w-full"
                      disabled={!zoomForm.accountId || !zoomForm.clientId || !zoomForm.clientSecret || connectZoom.isPending}
                      onClick={() => connectZoom.mutate(zoomForm)}
                    >
                      {connectZoom.isPending ? "Verifying & Connecting..." : "Connect Zoom"}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Google Calendar Tab ─── */}
        <TabsContent value="google">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base" style={{ fontFamily: "Raleway, sans-serif" }}>Google Calendar Integration</CardTitle>
                {status?.google.connected ? (
                  <Badge className="bg-green-100 text-green-700 gap-1"><CheckCircle className="h-3 w-3" /> Connected</Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1"><AlertCircle className="h-3 w-3" /> Not Connected</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Connect Google Calendar to sync webinar events and consultation bookings automatically.
              </p>
              {status?.google.connected ? (
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                    <p className="text-sm font-medium text-green-800">Google Calendar is connected</p>
                    {"email" in status.google && status.google.email && (
                      <p className="text-xs text-green-600 mt-1">Account: {status.google.email}</p>
                    )}
                  </div>
                  <Button variant="outline" className="text-destructive" onClick={() => disconnect.mutate({ provider: "google_calendar" })}>
                    Disconnect Google Calendar
                  </Button>
                </div>
              ) : (
                <>
                  <div>
                    <Label>Access Token</Label>
                    <Input type="password" value={gcalForm.accessToken} onChange={(e) => setGcalForm({ ...gcalForm, accessToken: e.target.value })} placeholder="Enter Google access token" />
                  </div>
                  <div>
                    <Label>Account Email (optional)</Label>
                    <Input value={gcalForm.accountEmail} onChange={(e) => setGcalForm({ ...gcalForm, accountEmail: e.target.value })} placeholder="you@gmail.com" />
                  </div>
                  <Button
                    className="bg-brand-green hover:bg-brand-green-dark text-white"
                    disabled={!gcalForm.accessToken || connectGoogle.isPending}
                    onClick={() => connectGoogle.mutate(gcalForm)}
                  >
                    {connectGoogle.isPending ? "Connecting..." : "Connect Google Calendar"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── SMS / Twilio Tab ─── */}
        <TabsContent value="sms">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2" style={{ fontFamily: "Raleway, sans-serif" }}>
                    <MessageSquare className="h-5 w-5 text-brand-green" />
                    SMS Integration (Telnyx)
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Send automated reminders and two-way SMS to leads via Telnyx.
                  </p>
                </div>
                {telnyxConnected ? (
                  <Badge className="bg-green-100 text-green-700 gap-1"><CheckCircle className="h-3 w-3" /> Connected</Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1"><AlertCircle className="h-3 w-3" /> Not Connected</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {telnyxConnected && telnyxDetails ? (
                <>
                  {/* Connected state */}
                  <div className="p-4 rounded-lg bg-green-50 border border-green-200 space-y-2">
                    <p className="text-sm font-semibold text-green-800 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" /> Telnyx is connected
                    </p>
                    <div className="text-xs text-green-700 space-y-1">
                      <div className="flex items-center gap-2">
                        <Phone className="h-3 w-3" />
                        <span>From:</span>
                        <span className="font-mono">{telnyxDetails.fromPhone}</span>
                        <button
                          type="button"
                          className="text-green-600 hover:text-green-800 underline text-xs ml-1"
                          onClick={() => { setEditFromPhone(telnyxDetails.fromPhone); setShowEditFromPhone(true); }}
                        >Edit</button>
                      </div>
                      {showEditFromPhone && (
                        <div className="flex gap-2 mt-1">
                          <input
                            className="font-mono text-xs border border-green-300 rounded px-2 py-1 flex-1 bg-white text-green-900"
                            value={editFromPhone}
                            onChange={(e) => setEditFromPhone(e.target.value)}
                            placeholder="+18017840672"
                          />
                          <button
                            type="button"
                            className="text-xs bg-green-700 text-white rounded px-2 py-1 hover:bg-green-800 disabled:opacity-50"
                            disabled={!editFromPhone || updateFromPhone.isPending}
                            onClick={() => updateFromPhone.mutate({ fromPhone: editFromPhone })}
                          >
                            {updateFromPhone.isPending ? "Saving..." : "Save"}
                          </button>
                          <button
                            type="button"
                            className="text-xs text-green-700 hover:text-green-900 px-1"
                            onClick={() => { setShowEditFromPhone(false); setEditFromPhone(""); }}
                          >Cancel</button>
                        </div>
                      )}
                      <p>API Key: <span className="font-mono">{telnyxDetails.apiKeyHint}</span></p>
                    </div>
                  </div>

                  {/* Enable / Disable toggle */}
                  <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                    <div>
                      <p className="text-sm font-medium">SMS Sending Enabled</p>
                      <p className="text-xs text-muted-foreground">When disabled, no SMS messages will be sent to leads.</p>
                    </div>
                    <Switch
                      checked={telnyxDetails.enabled}
                      onCheckedChange={(v) => toggleTelnyx.mutate({ enabled: v })}
                      disabled={toggleTelnyx.isPending}
                    />
                  </div>

                  {/* What SMS does */}
                  <div className="p-3 rounded-lg bg-muted/30 border border-border/30 space-y-1.5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Automated SMS triggers</p>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li className="flex items-center gap-2"><CheckCircle className="h-3 w-3 text-brand-green shrink-0" /> Registration confirmation</li>
                      <li className="flex items-center gap-2"><CheckCircle className="h-3 w-3 text-brand-green shrink-0" /> 24-hour webinar reminder</li>
                      <li className="flex items-center gap-2"><CheckCircle className="h-3 w-3 text-brand-green shrink-0" /> 1-hour webinar reminder</li>
                      <li className="flex items-center gap-2"><CheckCircle className="h-3 w-3 text-brand-green shrink-0" /> 10-minute webinar reminder</li>
                      <li className="flex items-center gap-2"><CheckCircle className="h-3 w-3 text-brand-green shrink-0" /> No-show follow-up with replay link</li>
                    </ul>
                    <p className="text-xs text-muted-foreground pt-1">Only sent to leads who have granted SMS consent on their profile.</p>
                  </div>

                  {/* Webhook URLs */}
                  <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 space-y-2">
                    <p className="text-xs font-semibold text-blue-800 uppercase tracking-wider">Telnyx Webhook URLs</p>
                    <p className="text-xs text-blue-700">Set these in your Telnyx Messaging Profile:</p>
                    <div className="space-y-1.5">
                      <div>
                        <p className="text-xs text-blue-600 font-medium">Primary (Inbound SMS):</p>
                        <p className="font-mono text-xs bg-white border border-blue-200 rounded px-2 py-1 break-all select-all">{window.location.origin}/api/sms/webhook</p>
                      </div>
                      <div>
                        <p className="text-xs text-blue-600 font-medium">Secondary (Status Callbacks):</p>
                        <p className="font-mono text-xs bg-white border border-blue-200 rounded px-2 py-1 break-all select-all">{window.location.origin}/api/sms/status</p>
                      </div>
                    </div>
                  </div>

                  {/* Test SMS — sends to the configured from number */}
                  <Button
                    variant="outline"
                    className="gap-2"
                    disabled={testTelnyx.isPending}
                    onClick={() => testTelnyx.mutate({})}
                  >
                    {testTelnyx.isPending ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Sending...</>
                    ) : (
                      <><Send className="h-4 w-4" /> Test SMS → {telnyxDetails.fromPhone}</>
                    )}
                  </Button>

                  <Separator />

                  {/* Disconnect */}
                  <Button
                    variant="outline"
                    className="text-destructive border-destructive/30 hover:bg-destructive/5 gap-2"
                    onClick={() => disconnectTelnyx.mutate()}
                    disabled={disconnectTelnyx.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                    {disconnectTelnyx.isPending ? "Disconnecting..." : "Disconnect Telnyx"}
                  </Button>
                </>
              ) : (
                <>
                  {/* Setup form */}
                  <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-800 space-y-1.5">
                    <p className="font-medium">Where to find your Telnyx credentials:</p>
                    <ol className="list-decimal list-inside space-y-1 text-xs">
                      <li>Log in at <a href="https://portal.telnyx.com" target="_blank" rel="noopener noreferrer" className="underline font-medium">portal.telnyx.com</a></li>
                      <li>Go to <strong>Auth</strong> → <strong>API Keys</strong> and create or copy your API key (starts with <span className="font-mono">KEY</span>)</li>
                      <li>Your <strong>From Phone</strong> is under <strong>Numbers</strong> → your purchased number in E.164 format</li>
                    </ol>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label>API Key <span className="text-red-500">*</span></Label>
                      <div className="relative">
                        <Input
                          type={showApiKey ? "text" : "password"}
                          value={telnyxForm.apiKey}
                          onChange={(e) => setTelnyxForm({ ...telnyxForm, apiKey: e.target.value })}
                          placeholder="KEY..."
                          className="font-mono text-sm pr-10"
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          onClick={() => setShowApiKey(!showApiKey)}
                        >
                          {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Stored securely. Starts with "KEY" — found in Telnyx portal under Auth → API Keys.</p>
                    </div>

                    <div>
                      <Label>From Phone Number <span className="text-red-500">*</span></Label>
                      <Input
                        value={telnyxForm.fromPhone}
                        onChange={(e) => setTelnyxForm({ ...telnyxForm, fromPhone: e.target.value })}
                        placeholder="+18017840672"
                        className="font-mono text-sm"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Your Telnyx phone number in E.164 format (e.g. <span className="font-mono">+18017840672</span>). Include the country code.</p>
                    </div>

                    <Button
                      className="w-full bg-brand-green hover:bg-brand-green-dark text-white h-11 gap-2"
                      disabled={!telnyxForm.apiKey || !telnyxForm.fromPhone || connectTelnyx.isPending}
                      onClick={() => connectTelnyx.mutate(telnyxForm)}
                    >
                      {connectTelnyx.isPending ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Verifying credentials...</>
                      ) : (
                        <><MessageSquare className="h-4 w-4" /> Connect Telnyx</>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Email / Gmail Tab ─── */}
        <TabsContent value="email">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2" style={{ fontFamily: "Raleway, sans-serif" }}>
                    <Mail className="h-4 w-4 text-brand-green" />
                    Gmail Integration
                    {gmailConnected && <span className="h-2 w-2 rounded-full bg-green-500 inline-block" />}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Send confirmation emails and webinar reminders directly from your Gmail account.
                  </p>
                </div>
                {gmailDetails && (
                  <Badge className={gmailDetails.enabled ? "bg-green-100 text-green-700 border-green-200" : "bg-amber-100 text-amber-700 border-amber-200"}>
                    {gmailDetails.enabled ? "Active" : "Paused"}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {gmailDetails ? (
                <>
                  {/* Connected state */}
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 border border-green-200">
                    <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-green-800">Connected</p>
                      <p className="text-xs text-green-700 truncate">{gmailDetails.gmailAddress}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
                      <p className="text-xs text-muted-foreground mb-1">Gmail Address</p>
                      <p className="font-mono text-xs truncate">{gmailDetails.gmailAddress}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
                      <p className="text-xs text-muted-foreground mb-1">App Password</p>
                      <p className="font-mono text-xs">{gmailDetails.appPasswordHint}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border border-border/40">
                    <div>
                      <p className="text-sm font-medium">Email Sending</p>
                      <p className="text-xs text-muted-foreground">Pause without disconnecting</p>
                    </div>
                    <Switch
                      checked={gmailDetails.enabled}
                      onCheckedChange={(enabled) => toggleGmail.mutate({ enabled })}
                      disabled={toggleGmail.isPending}
                    />
                  </div>

                  {/* Test email panel */}
                  {!showTestEmail ? (
                    <Button variant="outline" className="w-full gap-2" onClick={() => setShowTestEmail(true)}>
                      <Send className="h-4 w-4" /> Send Test Email
                    </Button>
                  ) : (
                    <div className="space-y-2 p-3 rounded-lg border border-border/40">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">Send Test Email</p>
                        <Button variant="ghost" size="icon" onClick={() => { setShowTestEmail(false); setTestEmail(""); }}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">Enter the address to receive the test email.</p>
                      <div className="flex gap-2">
                        <Input
                          value={testEmail}
                          onChange={(e) => setTestEmail(e.target.value)}
                          placeholder="you@example.com"
                          type="email"
                          className="flex-1"
                        />
                        <Button
                          className="bg-brand-green hover:bg-brand-green-dark text-white gap-1"
                          onClick={() => testGmailMutation.mutate({ toEmail: testEmail })}
                          disabled={!testEmail || testGmailMutation.isPending}
                        >
                          {testGmailMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                          Send
                        </Button>
                      </div>
                    </div>
                  )}

                  <Separator />

                  <Button
                    variant="outline"
                    className="w-full gap-2 text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => disconnectGmail.mutate()}
                    disabled={disconnectGmail.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                    {disconnectGmail.isPending ? "Disconnecting..." : "Disconnect Gmail"}
                  </Button>
                </>
              ) : (
                <>
                  {/* Setup form */}
                  <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-800 space-y-1.5">
                    <p className="font-medium">How to set up Gmail sending:</p>
                    <ol className="list-decimal list-inside space-y-1 text-xs">
                      <li>Enable <strong>2-Step Verification</strong> on your Google account at <a href="https://myaccount.google.com/security" target="_blank" rel="noopener noreferrer" className="underline font-medium">myaccount.google.com/security</a></li>
                      <li>Go to <strong>Security → 2-Step Verification → App Passwords</strong></li>
                      <li>Create a new App Password (select "Mail" and "Other")</li>
                      <li>Copy the 16-character password and paste it below</li>
                    </ol>
                    <p className="text-xs text-blue-700 pt-1">⚠️ Use a <strong>Gmail App Password</strong>, not your regular Google password. Regular passwords will be rejected.</p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label>Gmail Address <span className="text-red-500">*</span></Label>
                      <Input
                        value={gmailForm.gmailAddress}
                        onChange={(e) => setGmailForm({ ...gmailForm, gmailAddress: e.target.value })}
                        placeholder="team@altamortgagegroup.com"
                        type="email"
                      />
                      <p className="text-xs text-muted-foreground mt-1">The Gmail address emails will be sent from.</p>
                    </div>

                    <div>
                      <Label>App Password <span className="text-red-500">*</span></Label>
                      <div className="relative">
                        <Input
                          value={gmailForm.appPassword}
                          onChange={(e) => setGmailForm({ ...gmailForm, appPassword: e.target.value })}
                          placeholder="xxxx xxxx xxxx xxxx"
                          type={showAppPassword ? "text" : "password"}
                          className="font-mono pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowAppPassword(!showAppPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showAppPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">16-character App Password from Google. Spaces are stripped automatically.</p>
                    </div>

                    <Button
                      className="w-full bg-brand-green hover:bg-brand-green-dark text-white h-11 gap-2"
                      onClick={() => connectGmail.mutate(gmailForm)}
                      disabled={!gmailForm.gmailAddress || !gmailForm.appPassword || connectGmail.isPending}
                    >
                      {connectGmail.isPending ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Verifying credentials...</>
                      ) : (
                        <><Mail className="h-4 w-4" /> Connect Gmail</>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── General Tab ─── */}
        {/* ─── SMS Templates Tab ─── */}
        <TabsContent value="sms-templates">
          {/* Add Template Dialog */}
          <Dialog open={showAddTemplate} onOpenChange={setShowAddTemplate}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle style={{ fontFamily: 'Raleway, sans-serif' }}>Add SMS Template</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Trigger — when should this message be sent?</Label>
                  <Select value={newTemplateTrigger} onValueChange={(v) => {
                    setNewTemplateTrigger(v);
                    // Pre-populate body with default text if body is still empty
                    if (!newTemplateBody.trim() && SMS_TEMPLATE_DEFAULTS[v]) {
                      setNewTemplateBody(SMS_TEMPLATE_DEFAULTS[v]);
                    }
                  }}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select trigger" />
                    </SelectTrigger>
                    <SelectContent>
                      {([
                        { value: 'new_lead', label: 'New Lead' },
                        { value: 'registered', label: 'Webinar Registration' },
                        { value: 'reminder_24h', label: '24-Hour Reminder' },
                        { value: 'reminder_1h', label: '1-Hour Reminder' },
                        { value: 'attended', label: 'Post-Webinar (Attended)' },
                        { value: 'no_show', label: 'Post-Webinar (No Show)' },
                        { value: 'consultation_booked', label: 'Consultation Booked' },
                        { value: 'under_contract', label: 'Under Contract' },
                        { value: 'deal_closed', label: 'Deal Closed' },
                      ] as const).map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Message body</Label>
                    <span className={`text-xs ${ newTemplateBody.length > 1600 ? 'text-destructive font-semibold' : newTemplateBody.length > 160 ? 'text-amber-600' : 'text-muted-foreground' }`}>
                      {newTemplateBody.length} chars · {Math.ceil(newTemplateBody.length / 160) || 1} SMS segment{Math.ceil(newTemplateBody.length / 160) !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <textarea
                    className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder={`Hi {{first_name}}, ...`}
                    value={newTemplateBody}
                    onChange={(e) => setNewTemplateBody(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Use variables: <span className="font-mono">{'{{first_name}}'}</span>, <span className="font-mono">{'{{webinar_link}}'}</span>, <span className="font-mono">{'{{webinar_title}}'}</span>, <span className="font-mono">{'{{session_date}}'}</span></p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={newTemplateActive} onCheckedChange={setNewTemplateActive} />
                  <span className="text-sm">{newTemplateActive ? 'Active — will send automatically' : 'Inactive — saved but not sent'}</span>
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <Button variant="ghost" size="sm" onClick={() => setShowAddTemplate(false)}>Cancel</Button>
                  <Button
                    size="sm"
                    className="bg-brand-green hover:bg-brand-green-dark text-white gap-1"
                    disabled={createTemplate.isPending || newTemplateBody.trim().length === 0 || newTemplateBody.length > 1600}
                    onClick={() => createTemplate.mutate({ trigger: newTemplateTrigger as any, body: newTemplateBody.trim(), isActive: newTemplateActive })}
                  >
                    {createTemplate.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    Create Template
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Preview Template Dialog */}
          {(() => {
            const previewTmpl = smsTemplateList?.find((t: any) => t.id === previewTemplateId);
            return (
              <Dialog open={previewTemplateId !== null} onOpenChange={(open) => { if (!open) setPreviewTemplateId(null); }}>
                <DialogContent className="max-w-sm">
                  <DialogHeader>
                    <DialogTitle style={{ fontFamily: 'Raleway, sans-serif' }} className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-brand-green" />
                      {previewTmpl?.label ?? 'Preview'}
                    </DialogTitle>
                  </DialogHeader>
                  {previewTmpl && (
                    <div className="space-y-4">
                      {/* Phone frame */}
                      <div className="mx-auto w-64 rounded-3xl border-4 border-gray-800 bg-gray-800 shadow-xl overflow-hidden">
                        {/* Status bar */}
                        <div className="bg-gray-800 px-4 py-1 flex justify-between items-center">
                          <span className="text-white text-xs font-medium">9:41 AM</span>
                          <span className="text-white text-xs">●●●</span>
                        </div>
                        {/* Screen */}
                        <div className="bg-gray-100 min-h-[200px] px-3 py-4 flex flex-col gap-2">
                          {/* Contact header */}
                          <div className="text-center mb-2">
                            <div className="w-10 h-10 rounded-full bg-brand-green flex items-center justify-center mx-auto mb-1">
                              <span className="text-white text-sm font-bold">AM</span>
                            </div>
                            <p className="text-xs font-semibold text-gray-700">Alta Mortgage Group</p>
                          </div>
                          {/* Message bubble */}
                          <div className="bg-white rounded-2xl rounded-tl-sm px-3 py-2 shadow-sm max-w-[90%] self-start">
                            <p className="text-xs text-gray-800 leading-relaxed whitespace-pre-wrap">{renderPreview(previewTmpl.body)}</p>
                          </div>
                        </div>
                      </div>
                      {/* Variable legend */}
                      <div className="rounded-md border border-border/50 bg-muted/30 p-3 space-y-1">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sample values used</p>
                        {Object.entries(SAMPLE_VARS).map(([key, val]) => (
                          <div key={key} className="flex items-center gap-2 text-xs">
                            <code className="font-mono text-brand-green bg-brand-green/10 px-1 rounded">{key}</code>
                            <span className="text-muted-foreground">→</span>
                            <span className="text-foreground">{val}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-end">
                        <Button variant="outline" size="sm" onClick={() => setPreviewTemplateId(null)}>Close</Button>
                      </div>
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            );
          })()}

          <Card className="border-0 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base" style={{ fontFamily: "Raleway, sans-serif" }}>SMS Templates</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Manage automated SMS messages sent at each lead stage. Multiple templates per trigger are supported — all active templates for a trigger will be sent.
                  </p>
                </div>
                <Button
                  size="sm"
                  className="bg-brand-green hover:bg-brand-green-dark text-white gap-1 shrink-0"
                  onClick={() => setShowAddTemplate(true)}
                >
                  <Plus className="h-3.5 w-3.5" /> Add Template
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Variable reference */}
              <div className="p-3 rounded-lg bg-muted/30 border border-border/30 text-xs">
                <p className="font-semibold text-foreground mb-1">Available variables <span className="font-normal text-muted-foreground">(click to copy)</span></p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { tag: '{{first_name}}', desc: 'Lead\'s first name' },
                    { tag: '{{last_name}}', desc: 'Lead\'s last name' },
                    { tag: '{{full_name}}', desc: 'Full name' },
                    { tag: '{{webinar_link}}', desc: 'Zoom join URL' },
                    { tag: '{{webinar_title}}', desc: 'Webinar title' },
                    { tag: '{{session_date}}', desc: 'Session date' },
                  ].map(({ tag, desc }) => (
                    <button
                      key={tag}
                      type="button"
                      title={desc}
                      className="font-mono bg-background border border-border/50 px-1.5 py-0.5 rounded hover:border-brand-green hover:text-brand-green transition-colors cursor-pointer"
                      onClick={() => {
                        navigator.clipboard.writeText(tag);
                        toast.success(`Copied ${tag}`);
                      }}
                    >{tag}</button>
                  ))}
                </div>
                <p className="text-muted-foreground mt-1.5">Example: <span className="font-mono">Hi {'{{first_name}}'}, join us: {'{{webinar_link}}'}</span></p>
              </div>

              {templatesLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading templates...
                </div>
              ) : (
                <div className="space-y-3">
                  {(smsTemplateList ?? []).map((tmpl) => {
                    const isEditing = editingTemplate === tmpl.id;
                    const draft = templateDrafts[tmpl.id];
                    const currentBody = isEditing ? (draft?.body ?? tmpl.body) : tmpl.body;
                    const currentActive = isEditing ? (draft?.isActive ?? tmpl.isActive) : tmpl.isActive;
                    const charCount = currentBody.length;
                    const smsCount = Math.ceil(charCount / 160);
                    const isDeleting = deletingTemplateId === tmpl.id;

                    return (
                      <div key={tmpl.id} className={`rounded-lg border p-4 space-y-3 transition-colors ${
                        isEditing ? 'border-brand-green/40 bg-brand-green/5' : 'border-border/40 bg-muted/10'
                      }`}>
                        {/* Header row */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm" style={{ fontFamily: 'Raleway, sans-serif' }}>{tmpl.label}</span>
                              <Badge variant={tmpl.isActive ? 'default' : 'secondary'} className={`text-xs ${
                                tmpl.isActive ? 'bg-green-100 text-green-800 border-green-200' : ''
                              }`}>
                                {tmpl.isActive ? 'Active' : 'Inactive'}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{tmpl.description}</p>
                          </div>
                          {!isEditing && (
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1"
                                onClick={() => setPreviewTemplateId(tmpl.id)}
                              >
                                <Eye className="h-3.5 w-3.5" /> Preview
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1"
                                onClick={() => {
                                  setEditingTemplate(tmpl.id);
                                  setTemplateDrafts(prev => ({ ...prev, [tmpl.id]: { body: tmpl.body, isActive: tmpl.isActive } }));
                                }}
                              >
                                <Edit className="h-3.5 w-3.5" /> Edit
                              </Button>
                              {isDeleting ? (
                                <div className="flex items-center gap-1">
                                  <span className="text-xs text-destructive">Delete?</span>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    disabled={deleteTemplate.isPending}
                                    onClick={() => deleteTemplate.mutate({ id: tmpl.id })}
                                  >
                                    {deleteTemplate.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Yes'}
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => setDeletingTemplateId(null)}>No</Button>
                                </div>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => setDeletingTemplateId(tmpl.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Body — textarea when editing, read-only preview otherwise */}
                        {isEditing ? (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs">Message body</Label>
                              <div className="flex items-center gap-2">
                                <span className={`text-xs ${ charCount > 1600 ? 'text-destructive font-semibold' : charCount > 160 ? 'text-amber-600' : 'text-muted-foreground' }`}>
                                  {charCount} chars · {smsCount} SMS segment{smsCount !== 1 ? 's' : ''}
                                </span>
                                <Switch
                                  checked={currentActive}
                                  onCheckedChange={(v) => setTemplateDrafts(prev => ({ ...prev, [tmpl.id]: { ...prev[tmpl.id], isActive: v } }))}
                                />
                                <span className="text-xs text-muted-foreground">{currentActive ? 'Active' : 'Inactive'}</span>
                              </div>
                            </div>
                            <textarea
                              className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                              value={currentBody}
                              onChange={(e) => setTemplateDrafts(prev => ({ ...prev, [tmpl.id]: { ...prev[tmpl.id], body: e.target.value } }))}
                            />
                            <div className="flex gap-2 justify-end">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => { setEditingTemplate(null); }}
                              >
                                Cancel
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1"
                                disabled={resetTemplate.isPending}
                                onClick={() => resetTemplate.mutate({ trigger: tmpl.trigger as any })}
                              >
                                {resetTemplate.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                                Reset to default
                              </Button>
                              <Button
                                size="sm"
                                className="bg-brand-green hover:bg-brand-green-dark text-white gap-1"
                                disabled={updateTemplate.isPending || charCount === 0 || charCount > 1600}
                                onClick={() => updateTemplate.mutate({ id: tmpl.id, body: currentBody, isActive: currentActive })}
                              >
                                {updateTemplate.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                                Save
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground font-mono bg-muted/30 rounded px-3 py-2 whitespace-pre-wrap">{tmpl.body}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="general">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base" style={{ fontFamily: "Raleway, sans-serif" }}>General Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/30 border border-border/30">
                <h3 className="text-sm font-semibold mb-2">About Clarke & Associates CRM</h3>
                <p className="text-sm text-muted-foreground">
                  A comprehensive CRM platform for real estate webinar-based lead generation.
                  Manage leads, webinars, landing pages, deals, and scheduling all in one place.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted/30 border border-border/30">
                <h3 className="text-sm font-semibold mb-2">Email Reminders</h3>
                <p className="text-sm text-muted-foreground">
                  Automated email reminders are sent at these intervals: immediately after registration,
                  24 hours before, 1 hour before, and 10 minutes before each webinar.
                  No-show follow-up emails with replay links are sent automatically.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted/30 border border-border/30">
                <h3 className="text-sm font-semibold mb-2">SMS Notifications</h3>
                <p className="text-sm text-muted-foreground">
                  SMS reminders are sent to leads who have granted consent at 24 hours, 1 hour,
                  and 10 minutes before webinars. Two-way SMS messaging is available on lead profiles.
                  Configure your Twilio account in the SMS tab above.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── Edit Media Dialog ─── */}
      <Dialog open={!!editingMedia} onOpenChange={(open) => !open && setEditingMedia(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "Raleway, sans-serif" }}>Edit Media</DialogTitle>
          </DialogHeader>
          {editingMedia && (
            <div className="space-y-4">
              <div className="aspect-video bg-[#f8f8f8] rounded-lg overflow-hidden flex items-center justify-center p-4 border">
                <img src={editingMedia.fileUrl} alt={editingMedia.label || editingMedia.fileName} className="max-w-full max-h-full object-contain" />
              </div>
              <div>
                <Label>Label</Label>
                <Input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} placeholder="Enter a descriptive label" />
              </div>
              <div>
                <Label>Type</Label>
                <Select value={editType} onValueChange={setEditType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="logo">Logo</SelectItem>
                    <SelectItem value="image">Image</SelectItem>
                    <SelectItem value="background">Background</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>File: {editingMedia.fileName}</p>
                <p>Size: {formatFileSize(editingMedia.fileSize)}</p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditingMedia(null)}>Cancel</Button>
                <Button
                  className="bg-brand-green hover:bg-brand-green-dark text-white"
                  onClick={() => updateMedia.mutate({ id: editingMedia.id, label: editLabel, fileType: editType as any })}
                >
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
