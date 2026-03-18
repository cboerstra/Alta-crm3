import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { MessageSquare, Send, ArrowLeft, User } from "lucide-react";

function formatTime(date: Date | string) {
  const d = new Date(date);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function SmsInbox() {
  const [, setLocation] = useLocation();
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: conversations = [], refetch: refetchConversations } =
    trpc.sms.getConversations.useQuery(undefined, { refetchInterval: 10000 });

  const { data: messages = [], refetch: refetchMessages } =
    trpc.sms.getByLead.useQuery(
      { leadId: selectedLeadId! },
      { enabled: selectedLeadId !== null, refetchInterval: 5000 }
    );

  const markRead = trpc.sms.markRead.useMutation({
    onSuccess: () => refetchConversations(),
  });

  const reply = trpc.sms.replyToLead.useMutation({
    onSuccess: () => {
      setReplyText("");
      refetchMessages();
      refetchConversations();
    },
    onError: (err) => toast.error(err.message),
  });

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Mark as read when opening a conversation
  function openConversation(leadId: number) {
    setSelectedLeadId(leadId);
    markRead.mutate({ leadId });
  }

  const selectedConv = conversations.find((c) => c.leadId === selectedLeadId);

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unread ?? 0), 0);

  function handleSend() {
    if (!replyText.trim() || !selectedLeadId) return;
    reply.mutate({ leadId: selectedLeadId, body: replyText.trim() });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
        {/* Conversation list */}
        <div className="w-80 flex-shrink-0 border-r border-border flex flex-col bg-card">
          <div className="p-4 border-b border-border flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-base">SMS Inbox</h2>
            {totalUnread > 0 && (
              <Badge variant="destructive" className="ml-auto text-xs">
                {totalUnread}
              </Badge>
            )}
          </div>
          <ScrollArea className="flex-1">
            {conversations.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
                No conversations yet. Inbound messages from leads will appear here.
              </div>
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv.leadId}
                  onClick={() => openConversation(conv.leadId)}
                  className={`w-full text-left px-4 py-3 hover:bg-accent transition-colors border-b border-border/50 ${
                    selectedLeadId === conv.leadId ? "bg-accent" : ""
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm truncate max-w-[160px]">{conv.leadName}</span>
                    <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                      {formatTime(conv.lastAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <p className={`text-xs truncate flex-1 ${conv.unread > 0 ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                      {conv.lastDirection === "outbound" ? "You: " : ""}
                      {conv.lastBody}
                    </p>
                    {conv.unread > 0 && (
                      <Badge variant="destructive" className="text-xs h-4 w-4 p-0 flex items-center justify-center rounded-full flex-shrink-0">
                        {conv.unread}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{conv.leadPhone}</p>
                </button>
              ))
            )}
          </ScrollArea>
        </div>

        {/* Message thread */}
        <div className="flex-1 flex flex-col bg-background">
          {selectedLeadId && selectedConv ? (
            <>
              {/* Thread header */}
              <div className="px-4 py-3 border-b border-border bg-card flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                  onClick={() => setSelectedLeadId(null)}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center justify-center h-9 w-9 rounded-full bg-primary/10 text-primary flex-shrink-0">
                  <User className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{selectedConv.leadName}</p>
                  <p className="text-xs text-muted-foreground">{selectedConv.leadPhone}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-auto text-xs"
                  onClick={() => setLocation(`/leads/${selectedLeadId}`)}
                >
                  View Lead Profile
                </Button>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                <div className="flex flex-col gap-3 max-w-2xl mx-auto">
                  {messages.length === 0 ? (
                    <p className="text-center text-muted-foreground text-sm py-8">No messages yet.</p>
                  ) : (
                    messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                            msg.direction === "outbound"
                              ? "bg-primary text-primary-foreground rounded-br-sm"
                              : "bg-muted text-foreground rounded-bl-sm"
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                          <p className={`text-xs mt-1 ${msg.direction === "outbound" ? "text-primary-foreground/70 text-right" : "text-muted-foreground"}`}>
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            {msg.direction === "outbound" && msg.status && (
                              <span className="ml-1 capitalize">· {msg.status}</span>
                            )}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Reply box */}
              <div className="p-4 border-t border-border bg-card">
                <div className="flex gap-2 max-w-2xl mx-auto">
                  <Input
                    placeholder="Type a message… (Enter to send)"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={reply.isPending}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleSend}
                    disabled={!replyText.trim() || reply.isPending}
                    size="icon"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1.5 max-w-2xl mx-auto">
                  Press Enter to send · Shift+Enter for new line
                </p>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
              <MessageSquare className="h-12 w-12 opacity-20" />
              <p className="text-sm">Select a conversation to view messages</p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
