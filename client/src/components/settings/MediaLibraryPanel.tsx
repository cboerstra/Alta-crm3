import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Upload, Image, Trash2, Edit, ImageIcon, FileImage, Tag, Loader2, Film, Folder, FolderOpen,
  FolderPlus, Megaphone, Star, Inbox, Layers, Pencil, Check, X,
} from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";

type MediaItem = {
  id: number;
  fileName: string;
  fileUrl: string;
  fileType: string;
  mimeType: string | null;
  fileSize: number | null;
  label: string | null;
  folderId: number | null;
  createdAt: Date;
};

/** "all" = every file, "unfiled" = files in no folder, or a folder id. */
type Selection = "all" | "unfiled" | number;

const IMAGE_MAX = 10 * 1024 * 1024;
const VIDEO_MAX = 250 * 1024 * 1024;
const isVideoFile = (f: File) => f.type.startsWith("video/") || /\.(mp4|mov|m4v)$/i.test(f.name);
const isVideoItem = (i: MediaItem) => i.fileType === "video" || /^video\//.test(i.mimeType ?? "") || /\.(mp4|mov|m4v)$/i.test(i.fileName);

function formatFileSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function typeIcon(type: string) {
  switch (type) {
    case "logo": return <Tag className="h-3 w-3" />;
    case "background": return <FileImage className="h-3 w-3" />;
    case "video": return <Film className="h-3 w-3" />;
    default: return <ImageIcon className="h-3 w-3" />;
  }
}

function typeBadgeColor(type: string) {
  switch (type) {
    case "logo": return "bg-amber-100 text-amber-700 border-amber-200";
    case "background": return "bg-blue-100 text-blue-700 border-blue-200";
    case "image": return "bg-green-100 text-green-700 border-green-200";
    case "video": return "bg-purple-100 text-purple-700 border-purple-200";
    default: return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

/** POST one file with progress; resolves with the stored /uploads/… address. */
function uploadFile(endpoint: string, file: File, onProgress: (pct: number) => void): Promise<{ url: string; filename: string; size: number }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", endpoint);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => {
      let body: any = null;
      try { body = JSON.parse(xhr.responseText); } catch { /* not JSON */ }
      if (xhr.status >= 200 && xhr.status < 300 && body?.url) resolve(body);
      else if (xhr.status === 413) reject(new Error("The file is larger than the server accepts."));
      else reject(new Error(body?.error || `Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Upload failed. Check your connection and try again."));
    const form = new FormData();
    form.append("file", file);
    xhr.send(form);
  });
}

export default function MediaLibraryPanel() {
  const utils = trpc.useUtils();
  const [selected, setSelected] = useState<Selection>("all");
  const [filterType, setFilterType] = useState("all");
  const [progress, setProgress] = useState<{ name: string; pct: number } | null>(null);
  const [newFolder, setNewFolder] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: number; name: string } | null>(null);
  const [editing, setEditing] = useState<MediaItem | null>(null);
  const [edit, setEdit] = useState({ label: "", fileType: "image", folder: "none" });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: folderData } = trpc.media.folders.useQuery();
  const folders = folderData?.folders ?? [];
  const listInput = selected === "all" ? undefined : { folderId: selected };
  const { data: items = [], isLoading } = trpc.media.list.useQuery(listInput);

  const refresh = () => { utils.media.list.invalidate(); utils.media.folders.invalidate(); };
  const onError = (e: { message: string }) => toast.error(e.message);
  const saveItem = trpc.media.upload.useMutation({ onError });
  const updateItem = trpc.media.update.useMutation({ onSuccess: () => { toast.success("Saved"); refresh(); setEditing(null); }, onError });
  const deleteItem = trpc.media.delete.useMutation({ onSuccess: () => { toast.success("File deleted"); refresh(); }, onError });
  const deleteMany = trpc.media.deleteMany.useMutation({
    onSuccess: (r) => { toast.success(`${r.deleted} file${r.deleted === 1 ? "" : "s"} deleted`); setPicked([]); refresh(); },
    onError,
  });
  /** Files ticked for a bulk delete. */
  const [picked, setPicked] = useState<number[]>([]);
  const togglePicked = (id: number, on: boolean) => setPicked((p) => (on ? [...p, id] : p.filter((x) => x !== id)));
  // A bulk delete only ever covers files on screen.
  useEffect(() => { setPicked([]); }, [selected, filterType]);
  const createFolder = trpc.media.createFolder.useMutation({
    onSuccess: ({ id }) => { setNewFolder(null); refresh(); setSelected(id); }, onError,
  });
  const renameFolder = trpc.media.renameFolder.useMutation({ onSuccess: () => { setRenaming(null); refresh(); }, onError });
  const deleteFolder = trpc.media.deleteFolder.useMutation({
    onSuccess: () => { toast.success("Folder deleted. Its files are now unfiled."); setSelected("unfiled"); refresh(); }, onError,
  });

  const current = typeof selected === "number" ? folders.find((f) => f.id === selected) : undefined;
  const title = selected === "all" ? "All files" : selected === "unfiled" ? "Unfiled" : current?.name ?? "Folder";
  const uploadFolderId = typeof selected === "number" ? selected : null;
  const shown = (items as MediaItem[]).filter((i) => filterType === "all" || i.fileType === filterType);

  const handleFiles = async (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      const video = isVideoFile(file);
      if (file.size > (video ? VIDEO_MAX : IMAGE_MAX)) {
        toast.error(`${file.name} is too large (max ${video ? "250" : "10"} MB)`);
        continue;
      }
      try {
        setProgress({ name: file.name, pct: 0 });
        const res = await uploadFile(video ? "/api/upload-video" : "/api/upload", file, (pct) => setProgress({ name: file.name, pct }));
        await saveItem.mutateAsync({
          fileUrl: res.url,
          fileKey: res.filename,
          fileName: file.name,
          contentType: file.type || (video ? "video/mp4" : "image/jpeg"),
          fileSize: res.size ?? file.size,
          fileType: video ? "video" : file.name.toLowerCase().includes("logo") ? "logo" : "image",
          label: file.name.replace(/\.[^.]+$/, ""),
          folderId: uploadFolderId,
        });
        toast.success(`${file.name} uploaded${current ? ` to ${current.name}` : ""}`);
      } catch (err) {
        toast.error(`Couldn't upload ${file.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    setProgress(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    refresh();
  };

  const openEdit = (item: MediaItem) => {
    setEditing(item);
    setEdit({ label: item.label || "", fileType: item.fileType, folder: item.folderId ? String(item.folderId) : "none" });
  };

  const folderRow = (key: string, sel: Selection, icon: React.ReactNode, name: string, count: number) => (
    <button
      key={key}
      type="button"
      onClick={() => setSelected(sel)}
      className={`w-full flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-left transition-colors ${
        selected === sel ? "bg-brand-green text-white" : "hover:bg-muted text-foreground"
      }`}
    >
      <span className="shrink-0">{icon}</span>
      <span className="flex-1 min-w-0 truncate" title={name}>{name}</span>
      <span className={`text-xs tabular-nums ${selected === sel ? "text-white/80" : "text-muted-foreground"}`}>{count}</span>
    </button>
  );

  const shared = folders.filter((f) => f.kind === "shared");
  const campaignFolders = folders.filter((f) => f.kind === "campaign");
  const custom = folders.filter((f) => f.kind === "custom");

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base" style={{ fontFamily: "Raleway, sans-serif" }}>Corporate Media Library</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Logos, images and videos, filed by campaign. Shared Assets holds the brand files every campaign uses.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
          {/* Folders */}
          <nav className="space-y-4" aria-label="Media folders">
            <div className="space-y-0.5">
              {folderRow("all", "all", <Layers className="h-4 w-4" />, "All files", folderData?.total ?? 0)}
              {shared.map((f) => folderRow(`f${f.id}`, f.id, <Star className="h-4 w-4" />, f.name, f.count))}
            </div>
            {campaignFolders.length > 0 && (
              <div className="space-y-0.5">
                <p className="px-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Campaigns</p>
                {campaignFolders.map((f) => folderRow(`f${f.id}`, f.id, <Megaphone className="h-4 w-4" />, f.name, f.count))}
              </div>
            )}
            <div className="space-y-0.5">
              <p className="px-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Folders</p>
              {custom.map((f) => folderRow(`f${f.id}`, f.id, selected === f.id ? <FolderOpen className="h-4 w-4" /> : <Folder className="h-4 w-4" />, f.name, f.count))}
              {folderRow("unfiled", "unfiled", <Inbox className="h-4 w-4" />, "Unfiled", folderData?.unfiled ?? 0)}
              {newFolder === null ? (
                <button type="button" onClick={() => setNewFolder("")}
                  className="w-full flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
                  <FolderPlus className="h-4 w-4" /> New folder
                </button>
              ) : (
                <form className="flex items-center gap-1 px-1 pt-1"
                  onSubmit={(e) => { e.preventDefault(); if (newFolder.trim()) createFolder.mutate({ name: newFolder.trim() }); }}>
                  <Input id="new-folder-name" autoFocus value={newFolder} onChange={(e) => setNewFolder(e.target.value)} placeholder="Folder name" className="h-8 text-sm" />
                  <Button type="submit" size="sm" className="h-8 w-8 p-0" aria-label="Create folder" disabled={!newFolder.trim() || createFolder.isPending}><Check className="h-4 w-4" /></Button>
                  <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0" aria-label="Cancel" onClick={() => setNewFolder(null)}><X className="h-4 w-4" /></Button>
                </form>
              )}
            </div>
          </nav>

          {/* Files */}
          <section className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {renaming && renaming.id === selected ? (
                <form className="flex items-center gap-1"
                  onSubmit={(e) => { e.preventDefault(); renameFolder.mutate({ id: renaming.id, name: renaming.name }); }}>
                  <Input id="rename-folder" autoFocus value={renaming.name} onChange={(e) => setRenaming({ ...renaming, name: e.target.value })} className="h-8 w-56" />
                  <Button type="submit" size="sm" className="h-8 w-8 p-0" aria-label="Save name"><Check className="h-4 w-4" /></Button>
                  <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0" aria-label="Cancel" onClick={() => setRenaming(null)}><X className="h-4 w-4" /></Button>
                </form>
              ) : (
                <h3 className="text-lg font-semibold mr-1 min-w-0 truncate">{title}</h3>
              )}
              {current?.kind === "campaign" && <Badge variant="outline" className="text-[10px]">Campaign folder</Badge>}
              {current && current.kind !== "campaign" && !renaming && (
                <Button size="sm" variant="ghost" className="h-8 px-2 text-muted-foreground" onClick={() => setRenaming({ id: current.id, name: current.name })}>
                  <Pencil className="h-3.5 w-3.5 mr-1" /> Rename
                </Button>
              )}
              {current?.kind === "custom" && (
                <Button size="sm" variant="ghost" className="h-8 px-2 text-muted-foreground hover:text-destructive"
                  onClick={() => { if (window.confirm(`Delete the folder "${current.name}"? Its files are kept and become unfiled.`)) deleteFolder.mutate({ id: current.id }); }}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete folder
                </Button>
              )}
              <Button className="ml-auto bg-brand-green hover:bg-brand-green-dark text-white gap-1.5" disabled={!!progress} onClick={() => fileInputRef.current?.click()}>
                {progress ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Upload{current ? ` to ${current.kind === "campaign" ? "this campaign" : current.name}` : ""}
              </Button>
              <input ref={fileInputRef} type="file" accept="image/*,video/mp4,video/quicktime,.mp4,.mov,.m4v" multiple className="hidden"
                onChange={(e) => e.target.files?.length && handleFiles(e.target.files)} />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {["all", "logo", "image", "background", "video"].map((type) => (
                <button key={type} type="button" onClick={() => setFilterType(type)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    filterType === type ? "bg-brand-green text-white" : "bg-muted/50 text-muted-foreground hover:bg-muted"
                  }`}>
                  {type === "all" ? "All" : type.charAt(0).toUpperCase() + type.slice(1) + "s"}
                </button>
              ))}
              <span className="text-xs text-muted-foreground ml-auto">{shown.length} item{shown.length !== 1 ? "s" : ""}</span>
            </div>

            {shown.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted/40 px-3 py-2 text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={picked.length > 0 && shown.every((i) => picked.includes(i.id))}
                    onCheckedChange={(v) => setPicked(v === true ? shown.map((i) => i.id) : [])}
                    aria-label="Select all files shown"
                  />
                  Select all
                </label>
                {picked.length > 0 && (
                  <>
                    <span className="text-muted-foreground">{picked.length} selected</span>
                    <Button size="sm" variant="outline" className="ml-auto text-destructive hover:text-destructive" disabled={deleteMany.isPending}
                      onClick={() => { if (window.confirm(`Delete ${picked.length} file${picked.length === 1 ? "" : "s"}? This can't be undone.`)) deleteMany.mutate({ ids: picked }); }}>
                      {deleteMany.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Trash2 className="h-3.5 w-3.5 mr-1" />}
                      Delete selected
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setPicked([])}>Clear</Button>
                  </>
                )}
              </div>
            )}

            {progress && (
              <div className="space-y-1">
                <Progress value={progress.pct} />
                <p className="text-xs text-muted-foreground">Uploading {progress.name}… {progress.pct}%</p>
              </div>
            )}

            <div
              className="border-2 border-dashed rounded-xl p-5 text-center cursor-pointer hover:border-brand-green/50 hover:bg-brand-green/5 transition-colors"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files); }}
            >
              <Upload className="h-7 w-7 mx-auto mb-1.5 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                Click or drag files here{current ? ` to add them to ${current.name}` : selected === "all" ? " (they'll be unfiled)" : ""}
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">Images up to 10 MB · MP4 or MOV videos up to 250 MB</p>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => <div key={i} className="aspect-square rounded-lg bg-muted animate-pulse" />)}
              </div>
            ) : shown.length === 0 ? (
              <div className="text-center py-10">
                <Image className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-muted-foreground text-sm">
                  {current?.kind === "campaign" ? "No files for this campaign yet. Upload its Reel, images and cover here."
                    : filterType === "all" ? "Nothing here yet." : `No ${filterType}s here.`}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {shown.map((item) => (
                  <div key={item.id} className={`group relative rounded-lg border overflow-hidden hover:shadow-md transition-shadow bg-white ${picked.includes(item.id) ? "ring-2 ring-brand-green" : ""}`}>
                    <div className="absolute left-2 top-2 z-10 rounded bg-white/90 p-0.5 shadow-sm">
                      <Checkbox checked={picked.includes(item.id)} onCheckedChange={(v) => togglePicked(item.id, v === true)}
                        aria-label={`Select ${item.label || item.fileName}`} />
                    </div>
                    <div className="aspect-square bg-[#f8f8f8] flex items-center justify-center p-2">
                      {isVideoItem(item) ? (
                        <video src={item.fileUrl} muted playsInline preload="metadata" className="max-w-full max-h-full object-contain bg-black rounded" />
                      ) : (
                        <img src={item.fileUrl} alt={item.label || item.fileName} className="max-w-full max-h-full object-contain" />
                      )}
                    </div>
                    <div className="p-2 border-t">
                      <p className="text-xs font-medium truncate" title={item.label || item.fileName}>{item.label || item.fileName}</p>
                      <div className="flex items-center justify-between mt-1">
                        <Badge variant="outline" className={`text-[10px] gap-0.5 ${typeBadgeColor(item.fileType)}`}>
                          {typeIcon(item.fileType)}{item.fileType}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">{formatFileSize(item.fileSize)}</span>
                      </div>
                      {selected === "all" && (
                        <p className="mt-1 text-[10px] text-muted-foreground truncate">
                          {folders.find((f) => f.id === item.folderId)?.name ?? "Unfiled"}
                        </p>
                      )}
                      <div className="mt-2 flex items-center gap-1 border-t pt-2">
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => openEdit(item)} aria-label={`Edit or move ${item.label || item.fileName}`}>
                          <Edit className="h-3.5 w-3.5 mr-1" /> Edit
                        </Button>
                        <a href={item.fileUrl} target="_blank" rel="noopener noreferrer" aria-label={`Open ${item.label || item.fileName}`}
                          className="inline-flex h-7 items-center rounded-md px-2 text-xs font-medium hover:bg-muted">Open</a>
                        <Button size="sm" variant="ghost" className="ml-auto h-7 w-7 p-0 text-destructive hover:text-destructive" aria-label={`Delete ${item.label || item.fileName}`}
                          onClick={() => { if (window.confirm(`Delete "${item.label || item.fileName}"?`)) deleteItem.mutate({ id: item.id }); }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </CardContent>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "Raleway, sans-serif" }}>Edit file</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="aspect-video bg-[#f8f8f8] rounded-lg overflow-hidden flex items-center justify-center p-3 border">
                {isVideoItem(editing) ? (
                  <video src={editing.fileUrl} controls playsInline className="max-w-full max-h-full" />
                ) : (
                  <img src={editing.fileUrl} alt={editing.label || editing.fileName} className="max-w-full max-h-full object-contain" />
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="media-label">Label</Label>
                <Input id="media-label" value={edit.label} onChange={(e) => setEdit({ ...edit, label: e.target.value })} placeholder="A descriptive name" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={edit.fileType} onValueChange={(v) => setEdit({ ...edit, fileType: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="logo">Logo</SelectItem>
                      <SelectItem value="image">Image</SelectItem>
                      <SelectItem value="background">Background</SelectItem>
                      <SelectItem value="video">Video</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Folder</Label>
                  <Select value={edit.folder} onValueChange={(v) => setEdit({ ...edit, folder: v })}>
                    <SelectTrigger aria-label="Folder"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Unfiled</SelectItem>
                      {folders.map((f) => <SelectItem key={f.id} value={String(f.id)}>{f.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="text-xs text-muted-foreground space-y-0.5">
                <p className="truncate">File: {editing.fileName}</p>
                <p>Size: {formatFileSize(editing.fileSize)}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button className="bg-brand-green hover:bg-brand-green-dark text-white" disabled={updateItem.isPending}
              onClick={() => editing && updateItem.mutate({
                id: editing.id, label: edit.label, fileType: edit.fileType as any,
                folderId: edit.folder === "none" ? null : Number(edit.folder),
              })}>
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
