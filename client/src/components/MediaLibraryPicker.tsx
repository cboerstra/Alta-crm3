import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, Film, ImageIcon, Loader2 } from "lucide-react";

export type LibraryKind = "image" | "video";

type Props = {
  open: boolean;
  onClose: () => void;
  kind: LibraryKind;
  /** The campaign being edited; its folder opens first. */
  campaignId?: number | null;
  onPick: (url: string) => void;
};

type Item = { id: number; fileUrl: string; fileName: string; label: string | null; fileType: string; mimeType: string | null };

const isVideo = (i: Item) => i.fileType === "video" || /^video\//.test(i.mimeType ?? "") || /\.(mp4|mov|m4v)$/i.test(i.fileName);

/** Pick an image or video already in Settings → Media Library. */
export function MediaLibraryPicker({ open, onClose, kind, campaignId, onPick }: Props) {
  const { data: folderData } = trpc.media.folders.useQuery(undefined, { enabled: open });
  const folders = folderData?.folders ?? [];
  const [folder, setFolder] = useState<string>("all");

  // Open on the campaign's own folder when it has one, else Shared Assets.
  useEffect(() => {
    if (!open || folders.length === 0) return;
    const own = campaignId ? folders.find((f) => f.kind === "campaign" && f.adCampaignId === campaignId) : undefined;
    const shared = folders.find((f) => f.kind === "shared");
    setFolder(String((own ?? shared)?.id ?? "all"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, folders.length, campaignId]);

  const input = folder === "all" ? undefined : folder === "unfiled" ? { folderId: "unfiled" as const } : { folderId: Number(folder) };
  const { data: items = [], isLoading } = trpc.media.list.useQuery(input, { enabled: open });
  const shown = (items as Item[]).filter((i) => (kind === "video" ? isVideo(i) : !isVideo(i)));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Choose {kind === "video" ? "a video" : "an image"} from the Media Library</DialogTitle>
          <DialogDescription>Files you've uploaded in Settings → Media Library.</DialogDescription>
        </DialogHeader>
        <Select value={folder} onValueChange={setFolder}>
          <SelectTrigger aria-label="Folder" className="w-full sm:w-72"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All files</SelectItem>
            {folders.map((f) => <SelectItem key={f.id} value={String(f.id)}>{f.name} ({f.count})</SelectItem>)}
            <SelectItem value="unfiled">Unfiled</SelectItem>
          </SelectContent>
        </Select>
        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : shown.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No {kind === "video" ? "videos" : "images"} in this folder. Upload them in Settings → Media Library, or use the upload button.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {shown.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => { onPick(item.fileUrl); onClose(); }}
                className="group rounded-lg border overflow-hidden text-left hover:border-brand-green hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-green"
              >
                <div className="aspect-square bg-[#f4f4f4] flex items-center justify-center p-2 relative">
                  {isVideo(item) ? (
                    <video src={item.fileUrl} muted playsInline preload="metadata" className="max-h-full max-w-full bg-black rounded" />
                  ) : (
                    <img src={item.fileUrl} alt={item.label || item.fileName} className="max-h-full max-w-full object-contain" />
                  )}
                  <span className="absolute inset-0 hidden group-hover:flex items-center justify-center bg-black/30">
                    <span className="flex items-center gap-1 rounded-md bg-white px-2 py-1 text-xs font-medium"><Check className="h-3.5 w-3.5" /> Use this</span>
                  </span>
                </div>
                <p className="flex items-center gap-1 px-2 py-1.5 text-xs truncate">
                  {isVideo(item) ? <Film className="h-3 w-3 shrink-0" /> : <ImageIcon className="h-3 w-3 shrink-0" />}
                  <span className="truncate">{item.label || item.fileName}</span>
                </p>
              </button>
            ))}
          </div>
        )}
        <div className="flex justify-end"><Button variant="outline" onClick={onClose}>Cancel</Button></div>
      </DialogContent>
    </Dialog>
  );
}
