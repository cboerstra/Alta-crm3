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
  LayoutGrid, Tag, Loader2, X, MessageSquare, Phone, Eye, EyeOff, Send,
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

  const [zoomForm, setZoomForm] = useState({ accessToken: "", accountId: "", accountEmail: "" });
  const [gcalForm, setGcalForm] = useState({ accessToken: "", accountEmail: "" });
  const [twilioForm, setTwilioForm] = useState({ accountSid: "", authToken: "", fromPhone: "" });
  const [showAuthToken, setShowAuthToken] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [showTestSms, setShowTestSms] = useState(false);

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

  // ─── Twilio mutations ───────────────────────────────────────────────────────
  const connectTwilio = trpc.integrations.connectTwilio.useMutation({
    onSuccess: () => {
      toast.success("Twilio connected successfully!");
      refetchStatus();
      setTwilioForm({ accountSid: "", authToken: "", fromPhone: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const testTwilio = trpc.integrations.testTwilio.useMutation({
    onSuccess: () => {
      toast.success("Test SMS sent! Check your phone.");
      setShowTestSms(false);
      setTestPhone("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleTwilio = trpc.integrations.toggleTwilio.useMutation({
    onSuccess: (_: any, vars: { enabled: boolean }) => {
      toast.success(vars.enabled ? "SMS sending enabled" : "SMS sending disabled");
      refetchStatus();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const disconnectTwilio = trpc.integrations.disconnectTwilio.useMutation({
    onSuccess: () => { toast.success("Twilio disconnected"); refetchStatus(); },
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    Array.from(files).forEach((file) => {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} is too large (max 10MB)`);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        const isLogo = file.name.toLowerCase().includes("logo");
        uploadMedia.mutate({
          fileBase64: base64,
          fileName: file.name,
          contentType: file.type,
          fileType: isLogo ? "logo" : "image",
          label: file.name.replace(/\.[^.]+$/, ""),
        });
      };
      reader.readAsDataURL(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
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

  const twilioConnected = status?.twilio?.connected;
  const twilioDetails = twilioConnected && "accountSid" in status!.twilio! ? status!.twilio as {
    connected: true; accountSid: string; fromPhone: string; authTokenHint: string; enabled: boolean;
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
          <TabsTrigger value="zoom" className="gap-1"><Video className="h-3.5 w-3.5" /> Zoom</TabsTrigger>
          <TabsTrigger value="google" className="gap-1"><Calendar className="h-3.5 w-3.5" /> Google Calendar</TabsTrigger>
          <TabsTrigger value="sms" className="gap-1 relative">
            <MessageSquare className="h-3.5 w-3.5" /> SMS
            {twilioConnected && (
              <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-green-500" />
            )}
          </TabsTrigger>
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
                <CardTitle className="text-base" style={{ fontFamily: "Raleway, sans-serif" }}>Zoom Integration</CardTitle>
                {status?.zoom.connected ? (
                  <Badge className="bg-green-100 text-green-700 gap-1"><CheckCircle className="h-3 w-3" /> Connected</Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1"><AlertCircle className="h-3 w-3" /> Not Connected</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Connect your Zoom account to create webinars and auto-register leads.
              </p>
              {status?.zoom.connected ? (
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                    <p className="text-sm font-medium text-green-800">Zoom is connected</p>
                    {"email" in status.zoom && status.zoom.email && (
                      <p className="text-xs text-green-600 mt-1">Account: {status.zoom.email}</p>
                    )}
                  </div>
                  <Button variant="outline" className="text-destructive" onClick={() => disconnect.mutate({ provider: "zoom" })}>
                    Disconnect Zoom
                  </Button>
                </div>
              ) : (
                <>
                  <div>
                    <Label>Access Token</Label>
                    <Input type="password" value={zoomForm.accessToken} onChange={(e) => setZoomForm({ ...zoomForm, accessToken: e.target.value })} placeholder="Enter Zoom access token" />
                  </div>
                  <div>
                    <Label>Account ID (optional)</Label>
                    <Input value={zoomForm.accountId} onChange={(e) => setZoomForm({ ...zoomForm, accountId: e.target.value })} placeholder="Zoom Account ID" />
                  </div>
                  <div>
                    <Label>Account Email (optional)</Label>
                    <Input value={zoomForm.accountEmail} onChange={(e) => setZoomForm({ ...zoomForm, accountEmail: e.target.value })} placeholder="zoom@company.com" />
                  </div>
                  <Button
                    className="bg-brand-green hover:bg-brand-green-dark text-white"
                    disabled={!zoomForm.accessToken || connectZoom.isPending}
                    onClick={() => connectZoom.mutate(zoomForm)}
                  >
                    {connectZoom.isPending ? "Connecting..." : "Connect Zoom"}
                  </Button>
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
                    SMS Integration (Twilio)
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Send automated reminders and two-way SMS to leads via Twilio.
                  </p>
                </div>
                {twilioConnected ? (
                  <Badge className="bg-green-100 text-green-700 gap-1"><CheckCircle className="h-3 w-3" /> Connected</Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1"><AlertCircle className="h-3 w-3" /> Not Connected</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {twilioConnected && twilioDetails ? (
                <>
                  {/* Connected state */}
                  <div className="p-4 rounded-lg bg-green-50 border border-green-200 space-y-2">
                    <p className="text-sm font-semibold text-green-800 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" /> Twilio is connected
                    </p>
                    <div className="text-xs text-green-700 space-y-1">
                      <p className="flex items-center gap-1.5"><Phone className="h-3 w-3" /> From: <span className="font-mono">{twilioDetails.fromPhone}</span></p>
                      <p>Account SID: <span className="font-mono">{twilioDetails.accountSid}</span></p>
                      <p>Auth Token: <span className="font-mono">{twilioDetails.authTokenHint}</span></p>
                    </div>
                  </div>

                  {/* Enable / Disable toggle */}
                  <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                    <div>
                      <p className="text-sm font-medium">SMS Sending Enabled</p>
                      <p className="text-xs text-muted-foreground">When disabled, no SMS messages will be sent to leads.</p>
                    </div>
                    <Switch
                      checked={twilioDetails.enabled}
                      onCheckedChange={(v) => toggleTwilio.mutate({ enabled: v })}
                      disabled={toggleTwilio.isPending}
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

                  {/* Test SMS */}
                  {!showTestSms ? (
                    <Button variant="outline" className="gap-2" onClick={() => setShowTestSms(true)}>
                      <Send className="h-4 w-4" /> Send Test SMS
                    </Button>
                  ) : (
                    <div className="space-y-3 p-4 rounded-lg border bg-muted/20">
                      <p className="text-sm font-medium">Send a test SMS to verify the connection</p>
                      <div className="flex gap-2">
                        <Input
                          placeholder="+15550001234"
                          value={testPhone}
                          onChange={(e) => setTestPhone(e.target.value)}
                          className="flex-1 font-mono"
                        />
                        <Button
                          className="bg-brand-green hover:bg-brand-green-dark text-white gap-1"
                          disabled={!testPhone || testTwilio.isPending}
                          onClick={() => testTwilio.mutate({ toPhone: testPhone })}
                        >
                          {testTwilio.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                          Send
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => { setShowTestSms(false); setTestPhone(""); }}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">Enter the number to receive the test SMS. Format: <span className="font-mono">+15550001234</span> (include country code). <strong>Trial accounts</strong> can only text verified numbers.</p>
                    </div>
                  )}

                  <Separator />

                  {/* Disconnect */}
                  <Button
                    variant="outline"
                    className="text-destructive border-destructive/30 hover:bg-destructive/5 gap-2"
                    onClick={() => disconnectTwilio.mutate()}
                    disabled={disconnectTwilio.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                    {disconnectTwilio.isPending ? "Disconnecting..." : "Disconnect Twilio"}
                  </Button>
                </>
              ) : (
                <>
                  {/* Setup form */}
                        <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-800 space-y-1.5">
                    <p className="font-medium">Where to find your Twilio credentials:</p>
                    <ol className="list-decimal list-inside space-y-1 text-xs">
                      <li>Log in at <a href="https://console.twilio.com" target="_blank" rel="noopener noreferrer" className="underline font-medium">console.twilio.com</a></li>
                      <li>Your <strong>Account SID</strong> and <strong>Auth Token</strong> are on the Console home page</li>
                      <li>Your <strong>From Phone</strong> is under Phone Numbers → Manage → Active Numbers</li>
                    </ol>
                    <p className="text-xs text-blue-700 pt-1">⚠️ <strong>Trial accounts</strong> can only send SMS to verified numbers. Verify numbers at Console → Phone Numbers → Verified Caller IDs.</p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label>Account SID <span className="text-red-500">*</span></Label>
                      <Input
                        value={twilioForm.accountSid}
                        onChange={(e) => setTwilioForm({ ...twilioForm, accountSid: e.target.value })}
                        placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                        className={`font-mono text-sm ${twilioForm.accountSid && !twilioForm.accountSid.trim().startsWith("AC") ? "border-red-400 focus-visible:ring-red-400" : ""}`}
                      />
                      {twilioForm.accountSid && !twilioForm.accountSid.trim().startsWith("AC") && (
                        <p className="text-xs text-red-500 mt-1">Account SID must start with "AC"</p>
                      )}
                      {(!twilioForm.accountSid || twilioForm.accountSid.trim().startsWith("AC")) && (
                        <p className="text-xs text-muted-foreground mt-1">Starts with "AC" — found on your Twilio Console home page.</p>
                      )}
                    </div>

                    <div>
                      <Label>Auth Token <span className="text-red-500">*</span></Label>
                      <div className="relative">
                        <Input
                          type={showAuthToken ? "text" : "password"}
                          value={twilioForm.authToken}
                          onChange={(e) => setTwilioForm({ ...twilioForm, authToken: e.target.value })}
                          placeholder="Your Twilio Auth Token"
                          className="font-mono text-sm pr-10"
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          onClick={() => setShowAuthToken(!showAuthToken)}
                        >
                          {showAuthToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Stored securely. Only the last 4 characters will be shown after saving.</p>
                    </div>

                    <div>
                      <Label>From Phone Number <span className="text-red-500">*</span></Label>
                      <Input
                        value={twilioForm.fromPhone}
                        onChange={(e) => setTwilioForm({ ...twilioForm, fromPhone: e.target.value })}
                        placeholder="+15550001234"
                        className="font-mono text-sm"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Your Twilio phone number in E.164 format (e.g. <span className="font-mono">+15550001234</span>). Include the country code.</p>
                    </div>

                    <Button
                      className="w-full bg-brand-green hover:bg-brand-green-dark text-white h-11 gap-2"
                      disabled={!twilioForm.accountSid || !twilioForm.authToken || !twilioForm.fromPhone || connectTwilio.isPending}
                      onClick={() => connectTwilio.mutate(twilioForm)}
                    >
                      {connectTwilio.isPending ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Verifying credentials...</>
                      ) : (
                        <><MessageSquare className="h-4 w-4" /> Connect Twilio</>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── General Tab ─── */}
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
