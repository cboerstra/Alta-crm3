import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Workflow, Plus, Trash2, Loader2, Mail, MessageSquare, Phone, Clock,
  ArrowDownUp, CheckCircle2, Bell, ListChecks, Play,
} from "lucide-react";
import { toast } from "sonner";

type StepType = "email" | "sms" | "call_task" | "wait" | "stage_change" | "notify_owner";

type StepDraft = {
  type: StepType;
  delayMinutes: number;
  subject: string;
  body: string;
  taskTitle: string;
  taskNotes: string;
  targetStage: string;
  isActive: boolean;
};

const STEP_META: Record<StepType, { label: string; icon: any; hint: string }> = {
  email: { label: "Email", icon: Mail, hint: "Sent through the connected Gmail account." },
  sms: { label: "Text message", icon: MessageSquare, hint: "Only sent to leads who opted in to SMS." },
  call_task: { label: "Call task", icon: Phone, hint: "Creates a task for a loan officer to work." },
  wait: { label: "Wait", icon: Clock, hint: "Pauses the sequence before the next step." },
  stage_change: { label: "Move stage", icon: ArrowDownUp, hint: "Advances the lead in the pipeline." },
  notify_owner: { label: "Notify owner", icon: Bell, hint: "Alerts you inside the platform." },
};

const STAGES = [
  "new_lead", "registered", "attended", "no_show",
  "consultation_booked", "under_contract", "closed",
];

const TRIGGERS = [
  { value: "campaign_lead", label: "Lead from a campaign landing page" },
  { value: "lead_created", label: "Any new lead" },
  { value: "stage_change", label: "Lead reaches a pipeline stage" },
  { value: "manual", label: "Manual enrollment only" },
];

const emptyStep = (type: StepType = "email"): StepDraft => ({
  type,
  delayMinutes: type === "email" ? 5 : 60,
  subject: "",
  body: "",
  taskTitle: "",
  taskNotes: "",
  targetStage: "",
  isActive: true,
});

/** Human-readable delay, so "1440" reads as "1 day". */
function formatDelay(minutes: number): string {
  if (minutes === 0) return "immediately";
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 60 * 24) {
    const hours = minutes / 60;
    return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} hr`;
  }
  const days = minutes / (60 * 24);
  return `${Number.isInteger(days) ? days : days.toFixed(1)} day${days === 1 ? "" : "s"}`;
}

/** A sensible starter track so nobody stares at an empty builder. */
const STARTER_STEPS: StepDraft[] = [
  {
    ...emptyStep("email"),
    delayMinutes: 2,
    subject: "Thanks for reaching out, {{firstName}}",
    body: "Hi {{firstName}},\n\nThanks for getting in touch with Alta Mortgage Group. I'm reviewing what you sent and will follow up shortly with next steps.\n\nIf it's easier to talk it through, just reply to this email and we'll find a time.",
  },
  {
    ...emptyStep("sms"),
    delayMinutes: 180,
    body: "Hi {{firstName}}, it's Alta Mortgage Group. I just sent you an email with next steps — happy to answer anything by text. Reply STOP to opt out.",
  },
  { ...emptyStep("call_task"), delayMinutes: 60 * 20, taskTitle: "Call {{fullName}} — new lead follow-up" },
  {
    ...emptyStep("email"),
    delayMinutes: 60 * 72,
    subject: "A few things worth knowing before you apply",
    body: "Hi {{firstName}},\n\nA quick rundown of what lenders actually look at, and the assistance programs most buyers don't know exist.\n\nReply any time with questions.",
  },
];

export default function Automations() {
  const utils = trpc.useUtils();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [triggerType, setTriggerType] = useState("campaign_lead");
  const [triggerValue, setTriggerValue] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [steps, setSteps] = useState<StepDraft[]>([]);

  const { data: sequences, isLoading } = trpc.automations.list.useQuery();
  const { data: tasks } = trpc.automations.tasks.useQuery({ status: "open" });

  const createSequence = trpc.automations.create.useMutation();
  const updateSequence = trpc.automations.update.useMutation();
  const deleteSequence = trpc.automations.delete.useMutation({
    onSuccess: () => {
      toast.success("Sequence deleted");
      utils.automations.list.invalidate();
    },
  });
  const completeTask = trpc.automations.completeTask.useMutation({
    onSuccess: () => {
      utils.automations.tasks.invalidate();
      toast.success("Task completed");
    },
  });
  const runDue = trpc.automations.runDueNow.useMutation({
    onSuccess: (r) => toast.success(r.executed > 0 ? `Ran ${r.executed} step(s)` : "Nothing was due"),
  });

  const openNew = () => {
    setEditingId(null);
    setName("");
    setDescription("");
    setTriggerType("campaign_lead");
    setTriggerValue("");
    setIsActive(true);
    setSteps(STARTER_STEPS.map((s) => ({ ...s })));
    setDialogOpen(true);
  };

  const openEdit = async (id: number) => {
    const sequence = await utils.automations.getById.fetch({ id });
    if (!sequence) return;
    setEditingId(id);
    setName(sequence.name);
    setDescription(sequence.description ?? "");
    setTriggerType(sequence.triggerType);
    setTriggerValue(sequence.triggerValue ?? "");
    setIsActive(sequence.isActive);
    setSteps(
      sequence.steps.map((s: any) => ({
        type: s.type,
        delayMinutes: s.delayMinutes ?? 0,
        subject: s.subject ?? "",
        body: s.body ?? "",
        taskTitle: s.taskTitle ?? "",
        taskNotes: s.taskNotes ?? "",
        targetStage: s.targetStage ?? "",
        isActive: s.isActive,
      }))
    );
    setDialogOpen(true);
  };

  const save = async () => {
    if (!name.trim()) {
      toast.error("Give the sequence a name");
      return;
    }
    const payload = steps.map((s) => ({
      type: s.type,
      delayMinutes: Number(s.delayMinutes) || 0,
      subject: s.subject || null,
      body: s.body || null,
      taskTitle: s.taskTitle || null,
      taskNotes: s.taskNotes || null,
      targetStage: s.targetStage || null,
      isActive: s.isActive,
    }));

    try {
      if (editingId) {
        await updateSequence.mutateAsync({
          id: editingId,
          name: name.trim(),
          description: description.trim() || null,
          triggerType: triggerType as any,
          triggerValue: triggerValue || null,
          isActive,
          steps: payload as any,
        });
        toast.success("Sequence saved");
      } else {
        await createSequence.mutateAsync({
          name: name.trim(),
          description: description.trim() || undefined,
          triggerType: triggerType as any,
          triggerValue: triggerValue || undefined,
          isActive,
          steps: payload as any,
        });
        toast.success("Sequence created");
      }
      utils.automations.list.invalidate();
      setDialogOpen(false);
    } catch (err: any) {
      toast.error(err?.message ?? "Could not save the sequence");
    }
  };

  const updateStep = (index: number, patch: Partial<StepDraft>) => {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const moveStep = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= steps.length) return;
    setSteps((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Workflow className="h-6 w-6 text-brand-green" /> Automations
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Nurture tracks that fire when a campaign produces a lead — texts, emails and call tasks.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={runDue.isPending} onClick={() => runDue.mutate()}>
            {runDue.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-1.5" />}
            Run due steps
          </Button>
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-1.5" /> New sequence</Button>
        </div>
      </div>

      <Tabs defaultValue="sequences">
        <TabsList>
          <TabsTrigger value="sequences">Sequences</TabsTrigger>
          <TabsTrigger value="tasks">Open tasks ({tasks?.length ?? 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="sequences" className="pt-4">
          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : !sequences || sequences.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Workflow className="h-10 w-10 mx-auto text-muted-foreground/50" />
                <h3 className="mt-3 font-semibold">No sequences yet</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                  A sequence is what happens after the form is filled in. Start from the default
                  four-step track and tune it from there.
                </p>
                <Button className="mt-4" onClick={openNew}>
                  <Plus className="h-4 w-4 mr-1.5" /> Create a sequence
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {sequences.map((seq) => (
                <Card key={seq.id}>
                  <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold">{seq.name}</h3>
                        <Badge variant="outline" className={seq.isActive ? "bg-green-50 text-green-700 border-green-200" : ""}>
                          {seq.isActive ? "active" : "paused"}
                        </Badge>
                        <Badge variant="outline">{seq.stepCount} step{seq.stepCount === 1 ? "" : "s"}</Badge>
                      </div>
                      {seq.description && (
                        <p className="text-xs text-muted-foreground mt-1">{seq.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        Trigger: {TRIGGERS.find((t) => t.value === seq.triggerType)?.label ?? seq.triggerType}
                        {seq.triggerValue ? ` (${seq.triggerValue.replace(/_/g, " ")})` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button variant="outline" size="sm" onClick={() => openEdit(seq.id)}>Edit</Button>
                      <Button
                        variant="ghost" size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          if (confirm(`Delete "${seq.name}"? Leads currently in it stop receiving follow-up.`)) {
                            deleteSequence.mutate({ id: seq.id });
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="tasks" className="pt-4">
          <Card>
            <CardContent className="p-0">
              {!tasks || tasks.length === 0 ? (
                <div className="py-12 text-center">
                  <ListChecks className="h-8 w-8 mx-auto text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground mt-2">No open tasks.</p>
                </div>
              ) : (
                <div className="divide-y">
                  {tasks.map((task) => (
                    <div key={task.id} className="p-4 flex items-center gap-3">
                      <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{task.title}</p>
                        {task.notes && <p className="text-xs text-muted-foreground truncate">{task.notes}</p>}
                        <p className="text-xs text-muted-foreground">
                          {task.dueAt ? `Due ${new Date(task.dueAt).toLocaleString()}` : "No due date"}
                          {task.source === "automation" ? " · from an automation" : ""}
                        </p>
                      </div>
                      <Button
                        size="sm" variant="outline" className="shrink-0"
                        onClick={() => completeTask.mutate({ id: task.id })}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Done
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── Sequence builder ─────────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit sequence" : "New sequence"}</DialogTitle>
            <DialogDescription>
              Steps run in order. Each delay counts from the moment the previous step ran.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Grant lead nurture" />
              </div>
              <div className="space-y-1.5">
                <Label>Trigger</Label>
                <Select value={triggerType} onValueChange={setTriggerType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TRIGGERS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {triggerType === "stage_change" && (
              <div className="space-y-1.5">
                <Label>Stage that starts this sequence</Label>
                <Select value={triggerValue} onValueChange={setTriggerValue}>
                  <SelectTrigger><SelectValue placeholder="Choose a stage" /></SelectTrigger>
                  <SelectContent>
                    {STAGES.map((s) => (
                      <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">Active</p>
                <p className="text-xs text-muted-foreground">Inactive sequences accept no new enrollments.</p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Steps</h3>
              <Select value="" onValueChange={(v) => setSteps([...steps, emptyStep(v as StepType)])}>
                <SelectTrigger className="w-[160px] h-8 text-xs">
                  <SelectValue placeholder="+ Add step" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(STEP_META) as StepType[]).map((t) => (
                    <SelectItem key={t} value={t}>{STEP_META[t].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {steps.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                No steps yet — add one above.
              </p>
            )}

            {steps.map((step, index) => {
              const meta = STEP_META[step.type];
              const Icon = meta.icon;
              return (
                <Card key={index} className={step.isActive ? "" : "opacity-60"}>
                  <CardContent className="p-3 space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="shrink-0">{index + 1}</Badge>
                      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm font-medium flex-1">{meta.label}</span>
                      <span className="text-xs text-muted-foreground">
                        after {formatDelay(Number(step.delayMinutes) || 0)}
                      </span>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => moveStep(index, -1)}>↑</Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => moveStep(index, 1)}>↓</Button>
                      <Button
                        size="sm" variant="ghost"
                        className="h-7 w-7 p-0 text-destructive"
                        onClick={() => setSteps(steps.filter((_, i) => i !== index))}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    <p className="text-xs text-muted-foreground">{meta.hint}</p>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Delay before this step (minutes)</Label>
                      <Input
                        type="number" min="0" className="h-8"
                        value={step.delayMinutes}
                        onChange={(e) => updateStep(index, { delayMinutes: Number(e.target.value) })}
                      />
                    </div>

                    {step.type === "email" && (
                      <>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Subject</Label>
                          <Input
                            className="h-8"
                            value={step.subject}
                            onChange={(e) => updateStep(index, { subject: e.target.value })}
                            placeholder="Thanks for reaching out, {{firstName}}"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Body</Label>
                          <Textarea
                            rows={4}
                            value={step.body}
                            onChange={(e) => updateStep(index, { body: e.target.value })}
                          />
                        </div>
                      </>
                    )}

                    {step.type === "sms" && (
                      <div className="space-y-1.5">
                        <Label className="text-xs">Message</Label>
                        <Textarea
                          rows={3}
                          value={step.body}
                          onChange={(e) => updateStep(index, { body: e.target.value })}
                        />
                        <p className="text-xs text-muted-foreground">
                          {step.body.length} characters. Include a way to opt out — required for 10DLC.
                        </p>
                      </div>
                    )}

                    {step.type === "call_task" && (
                      <>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Task title</Label>
                          <Input
                            className="h-8"
                            value={step.taskTitle}
                            onChange={(e) => updateStep(index, { taskTitle: e.target.value })}
                            placeholder="Call {{fullName}} — new lead follow-up"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Notes for whoever picks it up</Label>
                          <Textarea
                            rows={2}
                            value={step.taskNotes}
                            onChange={(e) => updateStep(index, { taskNotes: e.target.value })}
                          />
                        </div>
                      </>
                    )}

                    {step.type === "stage_change" && (
                      <div className="space-y-1.5">
                        <Label className="text-xs">Move the lead to</Label>
                        <Select value={step.targetStage} onValueChange={(v) => updateStep(index, { targetStage: v })}>
                          <SelectTrigger className="h-8"><SelectValue placeholder="Choose a stage" /></SelectTrigger>
                          <SelectContent>
                            {STAGES.map((s) => (
                              <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {step.type === "notify_owner" && (
                      <div className="space-y-1.5">
                        <Label className="text-xs">Alert text</Label>
                        <Input
                          className="h-8"
                          value={step.body}
                          onChange={(e) => updateStep(index, { body: e.target.value })}
                          placeholder="{{fullName}} hasn't been reached yet"
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}

            <p className="text-xs text-muted-foreground">
              Placeholders: <code>{"{{firstName}}"}</code>, <code>{"{{lastName}}"}</code>,{" "}
              <code>{"{{fullName}}"}</code>, <code>{"{{email}}"}</code>, <code>{"{{phone}}"}</code>.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={createSequence.isPending || updateSequence.isPending}>
              {createSequence.isPending || updateSequence.isPending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : editingId ? "Save changes" : "Create sequence"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
