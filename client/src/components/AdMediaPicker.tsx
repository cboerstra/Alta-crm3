import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Film, Image as ImageIcon, Upload, X } from "lucide-react";
import { toast } from "sonner";

export type AdMediaType = "image" | "video";

type Props = {
  mediaType: AdMediaType;
  imageUrl: string;
  videoUrl: string;
  thumbnailUrl: string;
  onChange: (next: { mediaType: AdMediaType; imageUrl: string; videoUrl: string; thumbnailUrl: string }) => void;
};

const MAX_VIDEO_MB = 250;

/** POST a file with upload progress (fetch can't report it). Resolves with the stored /uploads/… address. */
function uploadWithProgress(endpoint: string, file: File, onProgress: (pct: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", endpoint);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => {
      let body: any = null;
      try { body = JSON.parse(xhr.responseText); } catch { /* not JSON */ }
      if (xhr.status >= 200 && xhr.status < 300 && body?.url) resolve(body.url);
      else if (xhr.status === 413) reject(new Error("That file is larger than the server accepts. Export a smaller version (under 100 MB is safest)."));
      else reject(new Error(body?.error || `Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Upload failed. Check your connection and try again."));
    const form = new FormData();
    form.append("file", file);
    xhr.send(form);
  });
}

/** Image or video (Reel) for an ad, uploaded to the CRM or given as a public address. */
export function AdMediaPicker({ mediaType, imageUrl, videoUrl, thumbnailUrl, onChange }: Props) {
  const videoInput = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [videoShape, setVideoShape] = useState<string | null>(null);
  const value = { mediaType, imageUrl, videoUrl, thumbnailUrl };

  const upload = async (file: File, endpoint: string, field: "imageUrl" | "videoUrl" | "thumbnailUrl") => {
    if (field === "videoUrl" && file.size > MAX_VIDEO_MB * 1024 * 1024) {
      toast.error(`The video is over ${MAX_VIDEO_MB} MB. Export it smaller (1080×1920, under 100 MB is plenty).`);
      return;
    }
    setProgress(0);
    try {
      const url = await uploadWithProgress(endpoint, file, setProgress);
      onChange({ ...value, [field]: url });
      if (field === "videoUrl") setVideoShape(null);
      toast.success(field === "videoUrl" ? "Video uploaded" : "Image uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setProgress(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button type="button" size="sm" variant={mediaType === "image" ? "default" : "outline"} onClick={() => onChange({ ...value, mediaType: "image" })}>
          <ImageIcon className="h-4 w-4 mr-1" /> Image
        </Button>
        <Button type="button" size="sm" variant={mediaType === "video" ? "default" : "outline"} onClick={() => onChange({ ...value, mediaType: "video" })}>
          <Film className="h-4 w-4 mr-1" /> Video / Reel
        </Button>
      </div>

      {progress !== null && (
        <div className="space-y-1">
          <Progress value={progress} />
          <p className="text-xs text-muted-foreground">Uploading… {progress}%</p>
        </div>
      )}

      {mediaType === "image" ? (
        <div className="space-y-1.5">
          <Label>Image</Label>
          <div className="flex gap-2">
            <Input value={imageUrl} onChange={(e) => onChange({ ...value, imageUrl: e.target.value })} placeholder="https://…/ad-image.jpg or upload" />
            <Button type="button" variant="outline" disabled={progress !== null} onClick={() => imageInput.current?.click()}>
              <Upload className="h-4 w-4" />
            </Button>
          </div>
          {imageUrl && <img src={imageUrl} alt="Ad image preview" className="mt-2 max-h-48 rounded-md border object-contain" />}
          <input ref={imageInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) upload(f, "/api/upload", "imageUrl"); }} />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Video</Label>
            {videoUrl ? (
              <div className="flex items-start gap-3">
                <video
                  src={videoUrl}
                  controls
                  playsInline
                  className="w-40 aspect-[9/16] rounded-md border bg-black object-contain"
                  onLoadedMetadata={(e) => {
                    const v = e.currentTarget;
                    const ratio = v.videoWidth / v.videoHeight;
                    const secs = Math.round(v.duration);
                    const shape = ratio < 0.7 ? "vertical (Reels-ready)" : ratio > 1.3 ? "horizontal: Reels will crop it; vertical 9:16 works best" : "square: fine for Feed; vertical 9:16 is best for Reels";
                    setVideoShape(`${v.videoWidth}×${v.videoHeight}, ${secs}s, ${shape}${secs > 90 ? ". Reels ads work best under 60 seconds" : ""}`);
                  }}
                />
                <div className="space-y-2 text-xs text-muted-foreground">
                  {videoShape && <p>{videoShape}</p>}
                  <Button type="button" size="sm" variant="ghost" onClick={() => onChange({ ...value, videoUrl: "" })}>
                    <X className="h-4 w-4 mr-1" /> Remove video
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                disabled={progress !== null}
                onClick={() => videoInput.current?.click()}
                className="w-full rounded-lg border-2 border-dashed p-5 text-sm text-muted-foreground hover:border-brand-green/50 hover:text-brand-green transition-colors"
              >
                <Upload className="mx-auto mb-1 h-5 w-5" />
                Upload an MP4 or MOV (up to {MAX_VIDEO_MB} MB)
              </button>
            )}
            <input ref={videoInput} type="file" accept="video/mp4,video/quicktime,.mp4,.mov,.m4v" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) upload(f, "/api/upload-video", "videoUrl"); }} />
            <p className="text-xs text-muted-foreground">
              Vertical 9:16 (1080×1920), 15–60 seconds, with captions burned in, since most people watch muted.
              It runs in Facebook and Instagram Reels, Stories and Feed.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Cover image (optional)</Label>
            <div className="flex gap-2">
              <Input value={thumbnailUrl} onChange={(e) => onChange({ ...value, thumbnailUrl: e.target.value })} placeholder="Meta picks a frame if left blank" />
              <Button type="button" variant="outline" disabled={progress !== null} onClick={() => coverInput.current?.click()}>
                <Upload className="h-4 w-4" />
              </Button>
            </div>
            <input ref={coverInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) upload(f, "/api/upload", "thumbnailUrl"); }} />
          </div>
        </div>
      )}
    </div>
  );
}
