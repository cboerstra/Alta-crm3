import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useParams } from "wouter";
import { Building2, CheckCircle, Loader2, Calendar, Clock, MapPin } from "lucide-react";

export default function PublicLandingPage() {
  const params = useParams<{ slug: string }>();
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "" });
  const [smsConsent, setSmsConsent] = useState(false);
  const [contactOptIn, setContactOptIn] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [submitted, setSubmitted] = useState(false);
  const [joinUrl, setJoinUrl] = useState<string | null>(null);

  const { data: page, isLoading: pageLoading } = trpc.landingPages.getBySlug.useQuery({ slug: params.slug });

  const submitLead = trpc.leads.captureFromLandingPage.useMutation({
    onSuccess: (data) => {
      setSubmitted(true);
      if (data.joinUrl) setJoinUrl(data.joinUrl);
    },
    onError: () => setSubmitted(true),
  });

  // Parse enabled fields from the landing page config
  const enabledFields = useMemo(() => {
    if (!page?.enabledFields) return ["firstName", "lastName", "email", "phone"];
    return Array.isArray(page.enabledFields) ? page.enabledFields as string[] : ["firstName", "lastName", "email", "phone"];
  }, [page?.enabledFields]);

  const sessions = useMemo(() => {
    if (!page?.sessions) return [];
    return (page.sessions as any[]).filter(s => new Date(s.sessionDate) > new Date());
  }, [page?.sessions]);

  const showField = (key: string) => enabledFields.includes(key);
  const accentColor = page?.accentColor || "#2A5B3F";

  if (pageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#2A5B3F] to-[#1F7B47]">
        <Loader2 className="h-8 w-8 text-white animate-spin" />
      </div>
    );
  }

  if (!page) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#2A5B3F] to-[#1F7B47]">
        <div className="text-center text-white">
          <h1 className="text-3xl font-bold" style={{ fontFamily: "Raleway, sans-serif" }}>Page Not Found</h1>
          <p className="text-white/70 mt-2">This landing page does not exist or has been deactivated.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#2A5B3F] to-[#1F7B47] p-4">
        <Card className="max-w-md w-full border-0 shadow-2xl">
          <CardContent className="p-8 text-center">
            <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: "Raleway, sans-serif" }}>You're Registered!</h2>
            <p className="text-muted-foreground mb-4">
              Thank you for signing up. You'll receive a confirmation email shortly with all the details.
            </p>
            {joinUrl && (
              <div className="mt-4 p-4 rounded-lg bg-green-50 border border-green-200">
                <p className="text-sm font-medium text-green-800 mb-2">Your webinar join link:</p>
                <a href={joinUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-green-700 underline break-all">
                  {joinUrl}
                </a>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSubmit = () => {
    submitLead.mutate({
      slug: params.slug,
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email,
      phone: form.phone || undefined,
      smsConsent,
      contactOptIn,
      webinarSessionId: selectedSessionId ? Number(selectedSessionId) : undefined,
    });
  };

  const isFormValid = form.firstName && form.lastName && form.email &&
    (!showField("sessionSelect") || !sessions.length || selectedSessionId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#2A5B3F] via-[#1F7B47] to-[#165E2E]">
      {/* Hero Section with Artwork */}
      {page.artworkUrl && (
        <div className="relative w-full h-64 md:h-80 overflow-hidden">
          <img
            src={page.artworkUrl}
            alt={page.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#2A5B3F]" />
        </div>
      )}

      <div className="flex items-center justify-center p-4 pb-12">
        <div className="max-w-lg w-full">
          {/* Header */}
          <div className={`text-center ${page.artworkUrl ? "mt-0" : "mt-12"} mb-8`}>
            <div className="flex items-center justify-center gap-2 mb-4">
              <Building2 className="h-7 w-7" style={{ color: "#C9A84C" }} />
              <span className="text-white/80 text-sm font-medium tracking-widest uppercase" style={{ fontFamily: "Raleway, sans-serif" }}>
                Clarke & Associates
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight" style={{ fontFamily: "Raleway, sans-serif" }}>
              {page.headline || page.title}
            </h1>
            {page.subheadline && (
              <p className="text-white/80 mt-3 text-lg">{page.subheadline}</p>
            )}
          </div>

          {/* Body Text */}
          {page.bodyText && (
            <div className="text-white/75 text-sm leading-relaxed mb-6 text-center max-w-md mx-auto">
              {page.bodyText}
            </div>
          )}

          {/* Available Sessions Preview */}
          {sessions.length > 0 && !showField("sessionSelect") && (
            <div className="mb-6 space-y-2">
              {sessions.slice(0, 3).map((s: any) => (
                <div key={s.id} className="flex items-center gap-3 text-white/80 text-sm bg-white/10 rounded-lg px-4 py-2">
                  <Calendar className="h-4 w-4 text-[#C9A84C]" />
                  <span>{new Date(s.sessionDate).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</span>
                  <Clock className="h-4 w-4 text-[#C9A84C] ml-auto" />
                  <span>{new Date(s.sessionDate).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>
                </div>
              ))}
            </div>
          )}

          {/* Form Card */}
          <Card className="border-0 shadow-2xl">
            <CardContent className="p-6 md:p-8">
              <div className="space-y-4">
                {/* Name Fields */}
                {(showField("firstName") || showField("lastName")) && (
                  <div className="grid grid-cols-2 gap-3">
                    {showField("firstName") && (
                      <div>
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">First Name *</Label>
                        <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} placeholder="John" className="mt-1" />
                      </div>
                    )}
                    {showField("lastName") && (
                      <div>
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Last Name *</Label>
                        <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} placeholder="Doe" className="mt-1" />
                      </div>
                    )}
                  </div>
                )}

                {/* Email */}
                {showField("email") && (
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email *</Label>
                    <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="john@example.com" className="mt-1" />
                  </div>
                )}

                {/* Phone */}
                {showField("phone") && (
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Phone Number</Label>
                    <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(555) 123-4567" className="mt-1" />
                  </div>
                )}

                {/* Session Selection */}
                {showField("sessionSelect") && sessions.length > 0 && (
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Select Seminar Date *</Label>
                    <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Choose a date..." />
                      </SelectTrigger>
                      <SelectContent>
                        {sessions.map((s: any) => (
                          <SelectItem key={s.id} value={String(s.id)}>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-3.5 w-3.5" />
                              <span>
                                {new Date(s.sessionDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                                {" at "}
                                {new Date(s.sessionDate).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                              </span>
                              {s.label && <span className="text-muted-foreground">— {s.label}</span>}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* SMS Consent */}
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="sms-consent"
                    checked={smsConsent}
                    onCheckedChange={(v) => setSmsConsent(v === true)}
                    className="mt-0.5"
                  />
                  <label htmlFor="sms-consent" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
                    I consent to receive SMS notifications and reminders. Message and data rates may apply.
                  </label>
                </div>

                {/* Opt-In Consent */}
                {(showField("optIn") || page.showOptIn) && (
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="contact-optin"
                      checked={contactOptIn}
                      onCheckedChange={(v) => setContactOptIn(v === true)}
                      className="mt-0.5"
                    />
                    <label htmlFor="contact-optin" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
                      {page.optInLabel || "I agree to receive communications about this event and future opportunities"}
                    </label>
                  </div>
                )}

                {/* Submit Button */}
                <Button
                  className="w-full h-12 text-base font-semibold text-white shadow-lg hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: accentColor }}
                  disabled={!isFormValid || submitLead.isPending}
                  onClick={handleSubmit}
                >
                  {submitLead.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : (page.ctaText || "Register Now")}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Footer */}
          <p className="text-center text-white/40 text-xs mt-6">
            &copy; {new Date().getFullYear()} Clarke & Associates. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
