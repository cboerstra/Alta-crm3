import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useLocation, useParams } from "wouter";
import {
  ArrowLeft, Mail, Phone, MapPin, Calendar, MessageSquare, Send,
  Sparkles, Clock, User, FileText, Zap, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

const stageColors: Record<string, string> = {
  new_lead: "bg-blue-100 text-blue-700",
  registered: "bg-green-100 text-green-700",
  attended: "bg-emerald-100 text-emerald-700",
  no_show: "bg-red-100 text-red-700",
  consultation_booked: "bg-amber-100 text-amber-700",
  under_contract: "bg-purple-100 text-purple-700",
  closed: "bg-gray-100 text-gray-700",
};

const activityIcons: Record<string, any> = {
  note: FileText,
  stage_change: ChevronRight,
  email_sent: Mail,
  sms_sent: MessageSquare,
  sms_received: MessageSquare,
  webinar_registered: Calendar,
  webinar_attended: User,
  webinar_no_show: User,
  consultation_booked: Calendar,
  deal_created: Zap,
  deal_updated: Zap,
  score_updated: Sparkles,
  call_logged: Phone,
  system: Zap,
};

export default function LeadProfile() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const leadId = Number(params.id);
  const [noteText, setNoteText] = useState("");
  const [smsText, setSmsText] = useState("");

  const { data: lead, refetch } = trpc.leads.getById.useQuery({ id: leadId });
  const { data: activity, refetch: refetchActivity } = trpc.leads.getActivity.useQuery({ leadId });
  const { data: smsMessages, refetch: refetchSms } = trpc.sms.getByLead.useQuery({ leadId });

  const updateStage = trpc.leads.updateStage.useMutation({
    onSuccess: () => { toast.success("Stage updated"); refetch(); refetchActivity(); },
    onError: (e) => toast.error(e.message),
  });

  const addNote = trpc.leads.addNote.useMutation({
    onSuccess: () => { toast.success("Note added"); setNoteText(""); refetchActivity(); },
    onError: (e) => toast.error(e.message),
  });

  const sendSms = trpc.sms.send.useMutation({
    onSuccess: () => { toast.success("SMS sent"); setSmsText(""); refetchSms(); refetchActivity(); },
    onError: (e) => toast.error(e.message),
  });

  const scoreLead = trpc.leads.scoreWithLLM.useMutation({
    onSuccess: (data) => { toast.success(`Score: ${data.score}/100`); refetch(); refetchActivity(); },
    onError: (e) => toast.error(e.message),
  });

  const updateLead = trpc.leads.update.useMutation({
    onSuccess: () => { toast.success("Lead updated"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  if (!lead) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading lead...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/leads")} className="gap-1">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left: Lead Info */}
        <div className="lg:w-1/3 space-y-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="h-14 w-14 rounded-full bg-brand-green/10 flex items-center justify-center">
                  <span className="text-lg font-bold text-brand-green">{lead.firstName.charAt(0)}{lead.lastName.charAt(0)}</span>
                </div>
                <div>
                  <h2 className="text-xl font-bold" style={{ fontFamily: "Raleway, sans-serif" }}>
                    {lead.firstName} {lead.lastName}
                  </h2>
                  <Badge className={`text-xs ${stageColors[lead.stage] || ""}`}>
                    {lead.stage.replace(/_/g, " ")}
                  </Badge>
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-4 w-4" /> {lead.email}
                </div>
                {lead.phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-4 w-4" /> {lead.phone}
                  </div>
                )}
                {lead.source && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4" /> Source: {lead.source}
                  </div>
                )}
                {lead.campaign && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <FileText className="h-4 w-4" /> Campaign: {lead.campaign}
                  </div>
                )}
              </div>

              {/* Score */}
              <div className="mt-4 p-3 rounded-lg bg-muted/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Lead Score</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => scoreLead.mutate({ leadId })}
                    disabled={scoreLead.isPending}
                  >
                    <Sparkles className="h-3 w-3" /> {scoreLead.isPending ? "Scoring..." : "Rescore"}
                  </Button>
                </div>
                {lead.score !== null && lead.score > 0 ? (
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="text-3xl font-bold text-brand-gold" style={{ fontFamily: "Raleway, sans-serif" }}>{lead.score}</div>
                      <span className="text-sm text-muted-foreground">/100</span>
                    </div>
                    {lead.scoreReason && <p className="text-xs text-muted-foreground mt-1">{lead.scoreReason}</p>}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Not scored yet</p>
                )}
              </div>

              {/* Stage Selector */}
              <div className="mt-4">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pipeline Stage</Label>
                <Select value={lead.stage} onValueChange={(v) => updateStage.mutate({ id: leadId, stage: v as any })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["new_lead", "registered", "attended", "no_show", "consultation_booked", "under_contract", "closed"].map((s) => (
                      <SelectItem key={s} value={s}>{s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* SMS Consent */}
              <div className="mt-4 flex items-center justify-between">
                <Label className="text-sm">SMS Consent</Label>
                <Switch
                  checked={lead.smsConsent ?? false}
                  onCheckedChange={(v) => updateLead.mutate({ id: leadId, smsConsent: v })}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Tabs */}
        <div className="lg:w-2/3">
          <Tabs defaultValue="activity" className="space-y-4">
            <TabsList className="bg-muted/30">
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
              <TabsTrigger value="sms">SMS</TabsTrigger>
              <TabsTrigger value="reminders">Reminders</TabsTrigger>
            </TabsList>

            <TabsContent value="activity">
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  {activity && activity.length > 0 ? (
                    <div className="space-y-0">
                      {activity.map((item, i) => {
                        const Icon = activityIcons[item.type] || Zap;
                        return (
                          <div key={item.id} className="flex gap-3 py-3 border-b border-border/30 last:border-0">
                            <div className="h-8 w-8 rounded-full bg-brand-green/10 flex items-center justify-center shrink-0 mt-0.5">
                              <Icon className="h-3.5 w-3.5 text-brand-green" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{item.title}</p>
                              {item.content && <p className="text-xs text-muted-foreground mt-0.5">{item.content}</p>}
                              <p className="text-xs text-muted-foreground/60 mt-1">
                                <Clock className="h-3 w-3 inline mr-1" />
                                {new Date(item.createdAt).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">No activity yet</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notes">
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4 space-y-4">
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Add a note..."
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      className="min-h-[80px]"
                    />
                  </div>
                  <Button
                    className="bg-brand-green hover:bg-brand-green-dark text-white gap-2"
                    disabled={!noteText.trim() || addNote.isPending}
                    onClick={() => addNote.mutate({ leadId, content: noteText })}
                  >
                    <FileText className="h-4 w-4" /> {addNote.isPending ? "Saving..." : "Add Note"}
                  </Button>
                  <div className="space-y-3 mt-4">
                    {activity?.filter((a) => a.type === "note").map((note) => (
                      <div key={note.id} className="p-3 rounded-lg bg-muted/30 border border-border/30">
                        <p className="text-sm">{note.content}</p>
                        <p className="text-xs text-muted-foreground mt-2">{new Date(note.createdAt).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sms">
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  {!lead.smsConsent ? (
                    <div className="text-center py-8">
                      <MessageSquare className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">SMS consent not granted</p>
                      <p className="text-xs text-muted-foreground mt-1">Enable SMS consent in the lead details to send messages</p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-3 max-h-[400px] overflow-y-auto mb-4">
                        {smsMessages && smsMessages.length > 0 ? smsMessages.map((msg) => (
                          <div key={msg.id} className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}>
                            <div className={`max-w-[70%] p-3 rounded-lg text-sm ${
                              msg.direction === "outbound"
                                ? "bg-brand-green text-white rounded-br-sm"
                                : "bg-muted rounded-bl-sm"
                            }`}>
                              <p>{msg.body}</p>
                              <p className={`text-xs mt-1 ${msg.direction === "outbound" ? "text-white/60" : "text-muted-foreground"}`}>
                                {new Date(msg.createdAt).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        )) : (
                          <p className="text-sm text-muted-foreground text-center py-4">No messages yet</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Type a message..."
                          value={smsText}
                          onChange={(e) => setSmsText(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter" && smsText.trim()) sendSms.mutate({ leadId, body: smsText }); }}
                        />
                        <Button
                          className="bg-brand-green hover:bg-brand-green-dark text-white"
                          disabled={!smsText.trim() || sendSms.isPending}
                          onClick={() => sendSms.mutate({ leadId, body: smsText })}
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="reminders">
              <RemindersList leadId={leadId} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function RemindersList({ leadId }: { leadId: number }) {
  const { data: reminders } = trpc.webinars.getReminders.useQuery({ leadId });
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-4">
        {reminders && reminders.length > 0 ? (
          <div className="space-y-3">
            {reminders.map((r) => (
              <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/30">
                <div>
                  <p className="text-sm font-medium">{r.subject}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Scheduled: {new Date(r.scheduledAt).toLocaleString()}
                  </p>
                </div>
                <Badge variant={r.status === "sent" ? "default" : r.status === "pending" ? "secondary" : "destructive"}>
                  {r.status}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">No reminders scheduled</p>
        )}
      </CardContent>
    </Card>
  );
}
