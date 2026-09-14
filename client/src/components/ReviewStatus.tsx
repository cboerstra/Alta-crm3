import { Badge } from "@/components/ui/badge";

export type ReviewStatus = "new" | "in_review" | "approved" | "declined" | "closed";

export const REVIEW_LABELS: Record<ReviewStatus, string> = {
  new: "New",
  in_review: "In review",
  approved: "Approved",
  declined: "Declined",
  closed: "Closed",
};

const TONE: Record<ReviewStatus, string> = {
  new: "bg-blue-100 text-blue-700",
  in_review: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  declined: "bg-red-100 text-red-700",
  closed: "bg-muted text-muted-foreground",
};

export function ReviewStatusBadge({ value }: { value: ReviewStatus }) {
  return (
    <Badge variant="outline" className={`border-0 ${TONE[value] ?? ""}`}>
      {REVIEW_LABELS[value] ?? value}
    </Badge>
  );
}
