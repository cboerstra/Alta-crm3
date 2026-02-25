import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Settings, Video, Calendar, CheckCircle, AlertCircle,
  Upload, Image, Trash2, Edit, ImageIcon, FileImage,
  LayoutGrid, Tag, Loader2, X,
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

    // Upload each file
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

    // Reset file input
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "Raleway, sans-serif" }}>Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage integrations, media library, and preferences</p>
      </div>

      <Tabs defaultValue="media" className="space-y-4">
        <TabsList className="bg-muted/30">
          <TabsTrigger value="media" className="gap-1"><Image className="h-3.5 w-3.5" /> Media Library</TabsTrigger>
          <TabsTrigger value="zoom" className="gap-1"><Video className="h-3.5 w-3.5" /> Zoom</TabsTrigger>
          <TabsTrigger value="google" className="gap-1"><Calendar className="h-3.5 w-3.5" /> Google Calendar</TabsTrigger>
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
                    Upload logos, images, and artwork to use across your landing pages. These assets appear as foreground elements over the landing page background.
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
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </div>
            </CardHeader>
            <CardContent>
              {/* Filter bar */}
              <div className="flex items-center gap-2 mb-4">
                <LayoutGrid className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Filter:</span>
                {["all", "logo", "image", "background"].map((type) => (
                  <button
                    key={type}
                    onClick={() => setFilterType(type)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      filterType === type
                        ? "bg-brand-green text-white"
                        : "bg-muted/50 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {type === "all" ? "All" : type.charAt(0).toUpperCase() + type.slice(1) + "s"}
                  </button>
                ))}
                <span className="text-xs text-muted-foreground ml-auto">
                  {filteredMedia.length} item{filteredMedia.length !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Upload drop zone */}
              <div
                className="mb-6 border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:border-brand-green/50 hover:bg-brand-green/5 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  Click or drag files here to upload logos, images, and artwork
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Supports JPG, PNG, SVG, WebP — Max 10MB per file — Select multiple files at once
                </p>
              </div>

              {/* Media grid */}
              {mediaLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="aspect-square rounded-lg bg-muted animate-pulse" />
                  ))}
                </div>
              ) : filteredMedia.length === 0 ? (
                <div className="text-center py-12">
                  <Image className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground">
                    {filterType === "all"
                      ? "No media uploaded yet. Upload logos and images to use on your landing pages."
                      : `No ${filterType}s found.`}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {filteredMedia.map((item: MediaItem) => (
                    <div
                      key={item.id}
                      className="group relative rounded-lg border overflow-hidden hover:shadow-md transition-shadow bg-white"
                    >
                      {/* Image preview */}
                      <div className="aspect-square bg-[#f8f8f8] flex items-center justify-center p-2">
                        <img
                          src={item.fileUrl}
                          alt={item.label || item.fileName}
                          className="max-w-full max-h-full object-contain"
                        />
                      </div>

                      {/* Overlay actions */}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-8 w-8 p-0"
                          onClick={() => openEditDialog(item)}
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-8 w-8 p-0 text-destructive"
                          onClick={() => deleteMedia.mutate({ id: item.id })}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      {/* Info bar */}
                      <div className="p-2 border-t">
                        <p className="text-xs font-medium truncate" title={item.label || item.fileName}>
                          {item.label || item.fileName}
                        </p>
                        <div className="flex items-center justify-between mt-1">
                          <Badge variant="outline" className={`text-[10px] gap-0.5 ${typeBadgeColor(item.fileType)}`}>
                            {typeIcon(item.fileType)}
                            {item.fileType}
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
                Connect your Zoom account to create webinars and auto-register leads. Provide your Zoom Server-to-Server OAuth access token.
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
                <img
                  src={editingMedia.fileUrl}
                  alt={editingMedia.label || editingMedia.fileName}
                  className="max-w-full max-h-full object-contain"
                />
              </div>
              <div>
                <Label>Label</Label>
                <Input
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  placeholder="Enter a descriptive label"
                />
              </div>
              <div>
                <Label>Type</Label>
                <Select value={editType} onValueChange={setEditType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
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
                  onClick={() => updateMedia.mutate({
                    id: editingMedia.id,
                    label: editLabel,
                    fileType: editType as any,
                  })}
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
