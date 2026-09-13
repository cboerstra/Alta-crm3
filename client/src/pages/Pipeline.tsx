import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { Users, Sparkles, GripVertical } from "lucide-react";
import { toast } from "sonner";

const STAGES = [
  { key: "new_lead", label: "New Lead", color: "#3B82F6" },
  { key: "registered", label: "Registered", color: "#2A5B3F" },
  { key: "attended", label: "Attended", color: "#10B981" },
  { key: "no_show", label: "No Show", color: "#EF4444" },
  { key: "consultation_booked", label: "Consultation Booked", color: "#C9A84C" },
  { key: "under_contract", label: "Under Contract", color: "#8B5CF6" },
  { key: "closed", label: "Closed", color: "#6B7280" },
];

export default function Pipeline() {
  const [, setLocation] = useLocation();
  const [draggedLead, setDraggedLead] = useState<number | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

  const { data, isLoading, refetch } = trpc.leads.list.useQuery({ limit: 500 });
  const updateStage = trpc.leads.updateStage.useMutation({
    onSuccess: () => { toast.success("Lead moved"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const leadsByStage = useMemo(() => {
    const map: Record<string, any[]> = {};
    STAGES.forEach((s) => { map[s.key] = []; });
    data?.items.forEach((lead) => {
      if (map[lead.stage]) (map[lead.stage] as any[]).push(lead);
    });
    return map;
  }, [data]);

  const handleDragStart = (e: React.DragEvent, leadId: number) => {
    setDraggedLead(leadId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, stageKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverStage(stageKey);
  };

  const handleDragLeave = () => {
    setDragOverStage(null);
  };

  const handleDrop = (e: React.DragEvent, stageKey: string) => {
    e.preventDefault();
    setDragOverStage(null);
    if (draggedLead !== null) {
      updateStage.mutate({ id: draggedLead, stage: stageKey as any });
      setDraggedLead(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "Raleway, sans-serif" }}>Pipeline</h1>
          <p className="text-muted-foreground text-sm mt-1">Loading pipeline...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "Raleway, sans-serif" }}>Pipeline</h1>
        <p className="text-muted-foreground text-sm mt-1">Drag and drop leads between stages</p>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: "calc(100vh - 200px)" }}>
        {STAGES.map((stage) => {
          const stageLeads = (leadsByStage[stage.key] as any[]) || [];
          const isOver = dragOverStage === stage.key;
          return (
            <div
              key={stage.key}
              className={`flex-shrink-0 w-[260px] rounded-xl transition-all ${
                isOver ? "bg-brand-green/5 ring-2 ring-brand-green/30" : "bg-muted/20"
              }`}
              onDragOver={(e) => handleDragOver(e, stage.key)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, stage.key)}
            >
              {/* Column Header */}
              <div className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
                  <span className="text-xs font-semibold uppercase tracking-wider text-foreground">{stage.label}</span>
                </div>
                <Badge variant="secondary" className="text-xs h-5 px-1.5">
                  {stageLeads.length}
                </Badge>
              </div>

              {/* Cards */}
              <div className="px-2 pb-2 space-y-2">
                {stageLeads.length === 0 ? (
                  <div className="p-4 text-center text-xs text-muted-foreground border border-dashed border-border/50 rounded-lg">
                    No leads
                  </div>
                ) : (
                  stageLeads.map((lead: any) => (
                    <Card
                      key={lead.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, lead.id)}
                      className={`border-0 shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing ${
                        draggedLead === lead.id ? "opacity-50" : ""
                      }`}
                      onClick={() => setLocation(`/leads/${lead.id}`)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-full bg-brand-green/10 flex items-center justify-center shrink-0">
                              <span className="text-[10px] font-bold text-brand-green">
                                {lead.firstName.charAt(0)}{lead.lastName.charAt(0)}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{lead.firstName} {lead.lastName}</p>
                              <p className="text-xs text-muted-foreground truncate">{lead.email}</p>
                            </div>
                          </div>
                          <GripVertical className="h-4 w-4 text-muted-foreground/30 shrink-0" />
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          {lead.source && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{lead.source}</span>
                          )}
                          {lead.score !== null && lead.score > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-gold/10 text-brand-gold font-semibold flex items-center gap-0.5">
                              <Sparkles className="h-2.5 w-2.5" /> {lead.score}
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
