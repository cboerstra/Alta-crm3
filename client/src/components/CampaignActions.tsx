import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MoreHorizontal, Pause, Play, Square, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Campaign = {
  id: number;
  name: string;
  status: string;
  metaCampaignId?: string | null;
  metaAdId?: string | null;
};

type Props = {
  campaign: Campaign;
  /** Where to go after a delete; the list page stays put. */
  afterDelete?: string;
};

/**
 * Pause or resume, stop, or delete a campaign. Pause and resume need the ad to
 * exist on Meta; stop and delete work for every campaign, drafts included.
 */
export function CampaignActions({ campaign, afterDelete }: Props) {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [confirm, setConfirm] = useState<"stop" | "delete" | null>(null);

  const refresh = () => {
    utils.adCampaigns.list.invalidate();
    utils.adCampaigns.getById.invalidate({ id: campaign.id });
  };
  const setDelivery = trpc.adCampaigns.setDelivery.useMutation({
    onSuccess: (r) => { toast.success(r.status === "active" ? "Delivery started" : "Campaign paused"); refresh(); },
    onError: (e) => toast.error(e.message),
  });
  const stop = trpc.adCampaigns.stop.useMutation({
    onSuccess: () => { toast.success("Campaign stopped"); setConfirm(null); refresh(); },
    onError: (e) => { toast.error(e.message); setConfirm(null); },
  });
  const remove = trpc.adCampaigns.delete.useMutation({
    onSuccess: () => {
      toast.success("Campaign deleted");
      setConfirm(null);
      utils.adCampaigns.list.invalidate();
      if (afterDelete) navigate(afterDelete);
    },
    onError: (e) => { toast.error(e.message); setConfirm(null); },
  });

  const onMeta = !!campaign.metaCampaignId;
  const published = !!campaign.metaAdId;
  const live = campaign.status === "active";
  const finished = campaign.status === "completed" || campaign.status === "archived";
  const busy = setDelivery.isPending || stop.isPending || remove.isPending;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" aria-label={`Actions for ${campaign.name}`} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          {published && live && (
            <DropdownMenuItem onSelect={() => setDelivery.mutate({ id: campaign.id, active: false })}>
              <Pause className="h-4 w-4 mr-2" /> Pause
            </DropdownMenuItem>
          )}
          {published && !live && (
            <DropdownMenuItem onSelect={() => setDelivery.mutate({ id: campaign.id, active: true })}>
              <Play className="h-4 w-4 mr-2" /> {finished ? "Restart" : campaign.status === "draft" ? "Start delivery" : "Resume"}
            </DropdownMenuItem>
          )}
          {!finished && campaign.status !== "draft" && (
            <DropdownMenuItem onSelect={() => setConfirm("stop")}>
              <Square className="h-4 w-4 mr-2" /> Stop
            </DropdownMenuItem>
          )}
          {(published || (!finished && campaign.status !== "draft")) && <DropdownMenuSeparator />}
          <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setConfirm("delete")}>
            <Trash2 className="h-4 w-4 mr-2" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === "stop" ? `Stop "${campaign.name}"?` : `Delete "${campaign.name}"?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "stop"
                ? "Its ads stop running and it moves to Finished Campaigns. Its results stay, and you can restart it later."
                : onMeta
                  ? "The campaign, its ad set and its ad are deleted on Facebook and removed from the CRM. Its spend history goes with it. Leads it brought in stay in the CRM. This can't be undone."
                  : "The campaign is removed from the CRM. Its landing page and media files stay. This can't be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={confirm === "delete" ? "bg-destructive text-white hover:bg-destructive/90" : undefined}
              onClick={(e) => {
                e.preventDefault();
                if (confirm === "stop") stop.mutate({ id: campaign.id });
                else remove.mutate({ id: campaign.id });
              }}
            >
              {(stop.isPending || remove.isPending) && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              {confirm === "stop" ? "Stop campaign" : "Delete campaign"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
