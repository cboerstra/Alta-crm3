import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useParams } from "wouter";
import { CheckCircle, Loader2, Calendar, Clock } from "lucide-react";

export default function PublicLandingPage() {
  const params = useParams<{ slug: string }>();
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "" });
  const [smsConsent, setSmsConsent] = useState(false);
  const [contactOptIn, setContactOptIn] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [submitted, setSubmitted] = useState(false);
  const [joinUrl, setJoinUrl] = useState<string | null>(null);

  const { data: page, isLoading: pageLoading } = trpc.landingPages.getBySlug.useQuery({ slug: params.slug });
  const { data: mediaItems } = trpc.media.getForLandingPageBySlug.useQuery(
    { slug: params.slug },
    { enabled: !!params.slug }
  );

  const submitLead = trpc.leads.captureFromLandingPage.useMutation({
    onSuccess: (data) => {
      setSubmitted(true);
      if (data.joinUrl) setJoinUrl(data.joinUrl);
    },
    onError: () => setSubmitted(true),
  });

  const enabledFields = useMemo(() => {
    if (!page?.enabledFields) return ["firstName", "lastName", "email", "phone"];
    return Array.isArray(page.enabledFields) ? page.enabledFields as string[] : ["firstName", "lastName", "email", "phone"];
  }, [page?.enabledFields]);

  const sessions = useMemo(() => {
    if (!page?.sessions) return [];
    return (page.sessions as any[]).filter(s => new Date(s.sessionDate) > new Date());
  }, [page?.sessions]);

  // Separate foreground logos and images
  const foregroundLogos = useMemo(() =>
    mediaItems?.filter(m => m.placement === "foreground_logo" && m.media) || [], [mediaItems]);
  const foregroundImages = useMemo(() =>
    mediaItems?.filter(m => m.placement === "foreground_image" && m.media) || [], [mediaItems]);

  const showField = (key: string) => enabledFields.includes(key);
  const accentColor = page?.accentColor || "#C9A84C";
  const hasBackground = !!page?.artworkUrl;

  if (pageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1a1a2e]">
        <Loader2 className="h-8 w-8 text-white animate-spin" />
      </div>
    );
  }

  if (!page) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1a1a2e]">
        <div className="text-center text-white">
          <h1 className="text-3xl font-bold" style={{ fontFamily: "Raleway, sans-serif" }}>Page Not Found</h1>
          <p className="text-white/60 mt-2">This landing page does not exist or has been deactivated.</p>
        </div>
      </div>
    );
  }

  // ─── Success Screen ───
  if (submitted) {
    return (
      <div className="min-h-screen relative flex items-center justify-center">
        {/* Full-bleed background */}
        {hasBackground && (
          <div className="absolute inset-0">
            <img src={page.artworkUrl!} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/60" />
          </div>
        )}
        {!hasBackground && (
          <div className="absolute inset-0 bg-gradient-to-br from-[#2A5B3F] via-[#1F7B47] to-[#165E2E]" />
        )}

        <div className="relative z-10 max-w-md w-full mx-4">
          {/* Foreground logos on success too */}
          {foregroundLogos.length > 0 && (
            <div className="flex items-center justify-center gap-4 mb-6">
              {foregroundLogos.map((item) => (
                <img
                  key={item.mediaId}
                  src={item.media!.fileUrl}
                  alt={item.media!.label || ""}
                  className="h-12 md:h-16 object-contain drop-shadow-lg"
                />
              ))}
            </div>
          )}

          <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl p-8 text-center border border-white/20">
            <div className="h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: `${accentColor}20` }}>
              <CheckCircle className="h-8 w-8" style={{ color: accentColor }} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2" style={{ fontFamily: "Raleway, sans-serif" }}>
              You're Registered!
            </h2>
            <p className="text-gray-600 mb-4">
              Thank you for signing up. You'll receive a confirmation email shortly with all the details.
            </p>
            {joinUrl && (
              <div className="mt-4 p-4 rounded-lg border" style={{ backgroundColor: `${accentColor}10`, borderColor: `${accentColor}30` }}>
                <p className="text-sm font-medium mb-2" style={{ color: accentColor }}>Your webinar join link:</p>
                <a href={joinUrl} target="_blank" rel="noopener noreferrer" className="text-sm underline break-all" style={{ color: accentColor }}>
                  {joinUrl}
                </a>
              </div>
            )}
          </div>
        </div>
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
    <div className="min-h-screen relative">
      {/* ═══════════════════════════════════════════════════════════
          FULL-BLEED BACKGROUND IMAGE
          ═══════════════════════════════════════════════════════════ */}
      {hasBackground && (
        <div className="fixed inset-0 z-0">
          <img
            src={page.artworkUrl!}
            alt=""
            className="w-full h-full object-cover"
          />
          {/* Dark overlay for readability */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[1px]" />
        </div>
      )}
      {!hasBackground && (
        <div className="fixed inset-0 z-0 bg-gradient-to-br from-[#2A5B3F] via-[#1F7B47] to-[#165E2E]" />
      )}

      {/* ═══════════════════════════════════════════════════════════
          FOREGROUND CONTENT
          ═══════════════════════════════════════════════════════════ */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-8 md:py-12">

        {/* ─── Corporate Logos (Foreground) ─── */}
        {foregroundLogos.length > 0 && (
          <div className="flex items-center justify-center gap-5 md:gap-8 mb-6 md:mb-8">
            {foregroundLogos.map((item) => (
              <img
                key={item.mediaId}
                src={item.media!.fileUrl}
                alt={item.media!.label || ""}
                className="h-12 md:h-20 object-contain drop-shadow-2xl"
                style={{ filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.4))" }}
              />
            ))}
          </div>
        )}

        {/* ─── Headline & Subheadline ─── */}
        <div className="text-center mb-6 md:mb-8 max-w-2xl">
          <h1
            className="text-3xl md:text-5xl font-bold text-white leading-tight drop-shadow-lg"
            style={{ fontFamily: "Raleway, sans-serif", textShadow: "0 2px 20px rgba(0,0,0,0.5)" }}
          >
            {page.headline || page.title}
          </h1>
          {page.subheadline && (
            <p
              className="text-white/90 mt-3 md:mt-4 text-lg md:text-xl drop-shadow-md"
              style={{ textShadow: "0 1px 10px rgba(0,0,0,0.4)" }}
            >
              {page.subheadline}
            </p>
          )}
        </div>

        {/* ─── Body Text ─── */}
        {page.bodyText && (
          <div
            className="text-white/85 text-sm md:text-base leading-relaxed mb-6 text-center max-w-lg"
            style={{ textShadow: "0 1px 8px rgba(0,0,0,0.3)" }}
          >
            {page.bodyText}
          </div>
        )}

        {/* ─── Foreground Images ─── */}
        {foregroundImages.length > 0 && (
          <div className="flex items-center justify-center gap-4 md:gap-6 mb-6 flex-wrap">
            {foregroundImages.map((item) => (
              <div
                key={item.mediaId}
                className="rounded-xl overflow-hidden shadow-2xl border-2 border-white/20"
                style={{ maxWidth: foregroundImages.length === 1 ? "400px" : "200px" }}
              >
                <img
                  src={item.media!.fileUrl}
                  alt={item.media!.label || ""}
                  className="w-full h-auto object-cover"
                />
              </div>
            ))}
          </div>
        )}

        {/* ─── Available Sessions Preview ─── */}
        {sessions.length > 0 && !showField("sessionSelect") && (
          <div className="mb-6 space-y-2 w-full max-w-md">
            {sessions.slice(0, 3).map((s: any) => (
              <div key={s.id} className="flex items-center gap-3 text-white text-sm bg-white/10 backdrop-blur-md rounded-xl px-4 py-3 border border-white/10">
                <Calendar className="h-4 w-4 flex-shrink-0" style={{ color: accentColor }} />
                <span className="flex-1">{new Date(s.sessionDate).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</span>
                <Clock className="h-4 w-4 flex-shrink-0" style={{ color: accentColor }} />
                <span>{new Date(s.sessionDate).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>
              </div>
            ))}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            REGISTRATION FORM (Foreground Glass Card)
            ═══════════════════════════════════════════════════════════ */}
        <div className="w-full max-w-md">
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl p-6 md:p-8 border border-white/20">
            <div className="space-y-4">
              {/* Name Fields */}
              {(showField("firstName") || showField("lastName")) && (
                <div className="grid grid-cols-2 gap-3">
                  {showField("firstName") && (
                    <div>
                      <Label className="text-xs font-semibold uppercase tracking-wider text-gray-500">First Name *</Label>
                      <Input
                        value={form.firstName}
                        onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                        placeholder="John"
                        className="mt-1 bg-gray-50/80 border-gray-200 focus:border-gray-400 text-gray-900"
                      />
                    </div>
                  )}
                  {showField("lastName") && (
                    <div>
                      <Label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Last Name *</Label>
                      <Input
                        value={form.lastName}
                        onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                        placeholder="Doe"
                        className="mt-1 bg-gray-50/80 border-gray-200 focus:border-gray-400 text-gray-900"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Email */}
              {showField("email") && (
                <div>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Email *</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="john@example.com"
                    className="mt-1 bg-gray-50/80 border-gray-200 focus:border-gray-400 text-gray-900"
                  />
                </div>
              )}

              {/* Phone */}
              {showField("phone") && (
                <div>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Phone Number</Label>
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="(555) 123-4567"
                    className="mt-1 bg-gray-50/80 border-gray-200 focus:border-gray-400 text-gray-900"
                  />
                </div>
              )}

              {/* Session Selection */}
              {showField("sessionSelect") && sessions.length > 0 && (
                <div>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Select Seminar Date *</Label>
                  <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
                    <SelectTrigger className="mt-1 bg-gray-50/80 border-gray-200 text-gray-900">
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
              <div className="flex items-start gap-2.5 pt-1">
                <Checkbox
                  id="sms-consent"
                  checked={smsConsent}
                  onCheckedChange={(v) => setSmsConsent(v === true)}
                  className="mt-0.5"
                />
                <label htmlFor="sms-consent" className="text-xs text-gray-500 leading-relaxed cursor-pointer">
                  I consent to receive SMS notifications and reminders. Message and data rates may apply.
                </label>
              </div>

              {/* Opt-In Consent */}
              {(showField("optIn") || page.showOptIn) && (
                <div className="flex items-start gap-2.5">
                  <Checkbox
                    id="contact-optin"
                    checked={contactOptIn}
                    onCheckedChange={(v) => setContactOptIn(v === true)}
                    className="mt-0.5"
                  />
                  <label htmlFor="contact-optin" className="text-xs text-gray-500 leading-relaxed cursor-pointer">
                    {page.optInLabel || "I agree to receive communications about this event and future opportunities"}
                  </label>
                </div>
              )}

              {/* Submit Button */}
              <Button
                className="w-full h-12 text-base font-semibold text-white shadow-lg hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] transition-all rounded-xl"
                style={{ backgroundColor: accentColor }}
                disabled={!isFormValid || submitLead.isPending}
                onClick={handleSubmit}
              >
                {submitLead.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : (page.ctaText || "Register Now")}
              </Button>
            </div>
          </div>
        </div>

        {/* ─── Footer ─── */}
        <p className="text-center text-white/40 text-xs mt-8" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.3)" }}>
          &copy; {new Date().getFullYear()} Clarke & Associates. All rights reserved.
        </p>
      </div>
    </div>
  );
}
