import { useState, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
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

  // ─── Embedded HTML state ───
  const htmlContainerRef = useRef<HTMLDivElement>(null);
  const [formMountPoint, setFormMountPoint] = useState<HTMLElement | null>(null);
  const [fetchedHtml, setFetchedHtml] = useState<string | null>(null);

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

  const foregroundLogos = useMemo(() =>
    mediaItems?.filter(m => m.placement === "foreground_logo" && m.media) || [], [mediaItems]);
  const foregroundImages = useMemo(() =>
    mediaItems?.filter(m => m.placement === "foreground_image" && m.media && m.media.fileUrl !== page?.artworkUrl) || [], [mediaItems, page?.artworkUrl]);

  const showField = (key: string) => enabledFields.includes(key);
  const accentColor = page?.accentColor || "#C9A84C";
  const hasHtmlBackground = !!(page as any)?.backgroundHtmlUrl;
  const hasImageBackground = !!page?.artworkUrl && !hasHtmlBackground;
  const hasBackground = hasHtmlBackground || hasImageBackground;
  const logoSize = (page as any)?.logoSize ?? 64;

  // ─── Derived feature flags ───
  const formEmbedded = !!(page as any)?.formEmbedded && hasHtmlBackground;
  // logoOnBackground only applies in non-embedded mode (embedded mode has the logo inside the form card in the HTML)
  const logoOnBackground = !!(page as any)?.logoOnHtmlBackground && hasHtmlBackground && !formEmbedded;

  // ─── Fetch HTML for embedded mode ───
  useEffect(() => {
    if (!formEmbedded) { setFetchedHtml(null); setFormMountPoint(null); return; }
    const url = (page as any)?.backgroundHtmlUrl as string;
    if (!url) return;
    fetch(url)
      .then(r => r.text())
      .then(html => setFetchedHtml(html))
      .catch(() => setFetchedHtml(""));
  }, [formEmbedded, (page as any)?.backgroundHtmlUrl]);

  // ─── Inject HTML into container div and locate form mount point ───
  useEffect(() => {
    if (fetchedHtml === null || !htmlContainerRef.current) return;
    const placeholder = '<div id="alta-crm-form-mount"></div>';
    const modified = fetchedHtml.includes("{{alta_form}}")
      ? fetchedHtml.replace(/\{\{alta_form\}\}/g, placeholder)
      : fetchedHtml.replace(/<\/body>/i, `${placeholder}</body>`);
    // Replace {{alta_logo}} with actual logo img tags from the media library
    const logoHtml = foregroundLogos.map(item =>
      `<img src="${item.media!.fileUrl}" alt="${item.media!.label || ""}" style="height:${logoSize}px;width:auto;object-fit:contain;display:block;">`
    ).join("");
    modified = modified.replace(/\{\{alta_logo\}\}/g, logoHtml);
    htmlContainerRef.current.innerHTML = modified;
    // Re-execute any inline scripts so the HTML template animations run
    htmlContainerRef.current.querySelectorAll("script").forEach((oldScript) => {
      const newScript = document.createElement("script");
      Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
      newScript.textContent = oldScript.textContent;
      oldScript.parentNode?.replaceChild(newScript, oldScript);
    });
    const mountEl = htmlContainerRef.current.querySelector("#alta-crm-form-mount") as HTMLElement | null;
    setFormMountPoint(mountEl);
  }, [fetchedHtml, foregroundLogos, logoSize]);

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
        {hasHtmlBackground && (
          <div className="absolute inset-0">
            <iframe
              src={(page as any).backgroundHtmlUrl}
              title=""
              aria-hidden="true"
              tabIndex={-1}
              className="h-full w-full border-0 pointer-events-none"
            />
          </div>
        )}
        {hasImageBackground && (
          <div className="absolute inset-0">
            <img src={page.artworkUrl!} alt="" className="w-full h-full object-cover" style={{ objectPosition: (page as any).artworkPosition || "center" }} />
            <div className="absolute inset-0 bg-black/60" />
          </div>
        )}
        {!hasBackground && (
          <div className="absolute inset-0 bg-gradient-to-br from-[#2A5B3F] via-[#1F7B47] to-[#165E2E]" />
        )}
        <div className="relative z-10 max-w-md w-full mx-4">
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl p-8 text-center border border-white/20">
            {foregroundLogos.length > 0 && (
              <div className="flex items-center justify-center gap-3 mb-5">
                {foregroundLogos.map((item) => (
                  <img key={item.mediaId} src={item.media!.fileUrl} alt={item.media!.label || ""} style={{ height: `${logoSize}px` }} className="object-contain" />
                ))}
              </div>
            )}
            <div className="h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: `${accentColor}20` }}>
              <CheckCircle className="h-8 w-8" style={{ color: accentColor }} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2" style={{ fontFamily: "Raleway, sans-serif" }}>You're Registered!</h2>
            <p className="text-gray-600 mb-4">Thank you for signing up. You'll receive a confirmation email shortly with all the details.</p>
            {joinUrl && (
              <div className="mt-4 p-4 rounded-lg border" style={{ backgroundColor: `${accentColor}10`, borderColor: `${accentColor}30` }}>
                <p className="text-sm font-medium mb-2" style={{ color: accentColor }}>Your webinar join link:</p>
                <a href={joinUrl} target="_blank" rel="noopener noreferrer" className="text-sm underline break-all" style={{ color: accentColor }}>{joinUrl}</a>
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

  // ─── Form card content (shared between normal and embedded modes) ───
  const formCardContent = (
    <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl p-6 md:p-8 border border-white/20">
      {/* Logo — shown inside the card in both normal and embedded modes */}
      {foregroundLogos.length > 0 && (
        <div className="flex items-center justify-center gap-4 mb-4">
          {foregroundLogos.map((item) => (
            <img key={item.mediaId} src={item.media!.fileUrl} alt={item.media!.label || ""} style={{ height: `${logoSize}px` }} className="object-contain" />
          ))}
        </div>
      )}
      {(page.headline || page.title) && (
        <div className="text-center mb-4">
          <h2 className="text-lg font-bold text-gray-900 leading-tight" style={{ fontFamily: "Raleway, sans-serif" }}>
            {page.headline || page.title}
          </h2>
          {page.subheadline && <p className="text-sm text-gray-500 mt-1">{page.subheadline}</p>}
        </div>
      )}
      <div className="space-y-4">
        {(showField("firstName") || showField("lastName")) && (
          <div className="grid grid-cols-2 gap-3">
            {showField("firstName") && (
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-gray-500">First Name *</Label>
                <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} placeholder="John" className="mt-1 bg-gray-50/80 border-gray-200 focus:border-gray-400 text-gray-900" />
              </div>
            )}
            {showField("lastName") && (
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Last Name *</Label>
                <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} placeholder="Doe" className="mt-1 bg-gray-50/80 border-gray-200 focus:border-gray-400 text-gray-900" />
              </div>
            )}
          </div>
        )}
        {showField("email") && (
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Email *</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="john@example.com" className="mt-1 bg-gray-50/80 border-gray-200 focus:border-gray-400 text-gray-900" />
          </div>
        )}
        {showField("phone") && (
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Phone Number</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(555) 123-4567" className="mt-1 bg-gray-50/80 border-gray-200 focus:border-gray-400 text-gray-900" />
          </div>
        )}
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
        {showField("phone") && (
          <div className="space-y-2 pt-1">
            <div className="flex items-start gap-2.5">
              <Checkbox id="sms-consent" checked={smsConsent} onCheckedChange={(v) => setSmsConsent(v === true)} className="mt-0.5 flex-shrink-0" />
              <label htmlFor="sms-consent" className="text-xs text-gray-500 leading-relaxed cursor-pointer">
                By checking this box, I consent to receive recurring automated and non-automated SMS text messages from Alta Mortgage Group at the mobile number provided above. Messages may include event reminders, follow-up information, mortgage updates, and appointment confirmations. Consent is not a condition of any purchase.
              </label>
            </div>
            <p className="text-[10px] text-gray-400 leading-relaxed pl-7">
              <strong>Message frequency varies.</strong> Message &amp; data rates may apply. Reply <strong>STOP</strong> to cancel at any time. Reply <strong>HELP</strong> for help. Mobile carriers are not liable for delayed or undelivered messages. No mobile information will be shared with third parties for marketing purposes. View our{" "}
              <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-600" style={{ color: accentColor }}>Privacy Policy</a>{" "}and{" "}
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-600" style={{ color: accentColor }}>Terms of Service</a>.
            </p>
          </div>
        )}
        {(showField("optIn") || page.showOptIn) && (
          <div className="flex items-start gap-2.5">
            <Checkbox id="contact-optin" checked={contactOptIn} onCheckedChange={(v) => setContactOptIn(v === true)} className="mt-0.5" />
            <label htmlFor="contact-optin" className="text-xs text-gray-500 leading-relaxed cursor-pointer">
              {page.optInLabel || "I agree to receive communications about this event and future opportunities"}
            </label>
          </div>
        )}
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
  );

  // ═══════════════════════════════════════════════════════════
  // EMBEDDED MODE — HTML template is rendered as page content,
  // form is portalled into {{alta_form}} placeholder
  // ═══════════════════════════════════════════════════════════
  if (formEmbedded) {
    return (
      <div className="w-full min-h-screen">
        {/* Full-page HTML rendered via innerHTML */}
        <div ref={htmlContainerRef} className="w-full min-h-screen" />
        {/* Portal form into the #alta-crm-form-mount element */}
        {formMountPoint && createPortal(
          <div className="p-4 flex justify-center">
            <div className="w-full max-w-md">
              {formCardContent}
            </div>
          </div>,
          formMountPoint
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // NORMAL MODE — floating glass card over background
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen relative">
      {/* ─── Full-bleed background ─── */}
      {hasHtmlBackground && (
        <div className="fixed inset-0 z-0">
          <iframe src={(page as any).backgroundHtmlUrl} title="" aria-hidden="true" tabIndex={-1} className="h-full w-full border-0 pointer-events-none" />
        </div>
      )}
      {hasImageBackground && (
        <div className="fixed inset-0 z-0">
          <img src={page.artworkUrl!} alt="" className="w-full h-full object-cover" style={{ objectPosition: (page as any).artworkPosition || "center" }} />
          <div className="absolute inset-0 backdrop-blur-[1px]" style={{ backgroundColor: `rgba(0,0,0,${page.bgOverlayOpacity != null ? Number(page.bgOverlayOpacity) : 0.5})` }} />
        </div>
      )}
      {!hasBackground && (
        <div className="fixed inset-0 z-0 bg-gradient-to-br from-[#2A5B3F] via-[#1F7B47] to-[#165E2E]" />
      )}

      {/* ─── Logo overlaid on HTML background (top of page) ─── */}
      {logoOnBackground && foregroundLogos.length > 0 && (
        <div className="fixed top-0 left-0 right-0 z-20 flex justify-center items-center gap-4 px-6 py-5 pointer-events-none">
          {foregroundLogos.map((item) => (
            <img
              key={item.mediaId}
              src={item.media!.fileUrl}
              alt={item.media!.label || ""}
              style={{ height: `${logoSize}px` }}
              className="object-contain drop-shadow-lg"
            />
          ))}
        </div>
      )}

      {/* ─── Foreground content ─── */}
      <div className={`relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-8 md:py-12 ${logoOnBackground && foregroundLogos.length > 0 ? "pt-24" : ""}`}>

        {/* Available sessions preview */}
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

        {/* Registration form card */}
        <div className="w-full max-w-md">
          {/* When logo is shown on the background, hide it inside the card to avoid duplication */}
          {logoOnBackground && foregroundLogos.length > 0
            ? (() => {
                // Clone formCardContent without the logo block by re-rendering without logos
                const noLogoCard = (
                  <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl p-6 md:p-8 border border-white/20">
                    {(page.headline || page.title) && (
                      <div className="text-center mb-4">
                        <h2 className="text-lg font-bold text-gray-900 leading-tight" style={{ fontFamily: "Raleway, sans-serif" }}>
                          {page.headline || page.title}
                        </h2>
                        {page.subheadline && <p className="text-sm text-gray-500 mt-1">{page.subheadline}</p>}
                      </div>
                    )}
                    <div className="space-y-4">
                      {(showField("firstName") || showField("lastName")) && (
                        <div className="grid grid-cols-2 gap-3">
                          {showField("firstName") && (
                            <div>
                              <Label className="text-xs font-semibold uppercase tracking-wider text-gray-500">First Name *</Label>
                              <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} placeholder="John" className="mt-1 bg-gray-50/80 border-gray-200 focus:border-gray-400 text-gray-900" />
                            </div>
                          )}
                          {showField("lastName") && (
                            <div>
                              <Label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Last Name *</Label>
                              <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} placeholder="Doe" className="mt-1 bg-gray-50/80 border-gray-200 focus:border-gray-400 text-gray-900" />
                            </div>
                          )}
                        </div>
                      )}
                      {showField("email") && (
                        <div>
                          <Label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Email *</Label>
                          <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="john@example.com" className="mt-1 bg-gray-50/80 border-gray-200 focus:border-gray-400 text-gray-900" />
                        </div>
                      )}
                      {showField("phone") && (
                        <div>
                          <Label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Phone Number</Label>
                          <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(555) 123-4567" className="mt-1 bg-gray-50/80 border-gray-200 focus:border-gray-400 text-gray-900" />
                        </div>
                      )}
                      {showField("sessionSelect") && sessions.length > 0 && (
                        <div>
                          <Label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Select Seminar Date *</Label>
                          <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
                            <SelectTrigger className="mt-1 bg-gray-50/80 border-gray-200 text-gray-900"><SelectValue placeholder="Choose a date..." /></SelectTrigger>
                            <SelectContent>
                              {sessions.map((s: any) => (
                                <SelectItem key={s.id} value={String(s.id)}>
                                  <div className="flex items-center gap-2">
                                    <Calendar className="h-3.5 w-3.5" />
                                    <span>{new Date(s.sessionDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}{" at "}{new Date(s.sessionDate).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>
                                    {s.label && <span className="text-muted-foreground">— {s.label}</span>}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      {showField("phone") && (
                        <div className="space-y-2 pt-1">
                          <div className="flex items-start gap-2.5">
                            <Checkbox id="sms-consent" checked={smsConsent} onCheckedChange={(v) => setSmsConsent(v === true)} className="mt-0.5 flex-shrink-0" />
                            <label htmlFor="sms-consent" className="text-xs text-gray-500 leading-relaxed cursor-pointer">
                              By checking this box, I consent to receive recurring automated and non-automated SMS text messages from Alta Mortgage Group at the mobile number provided above. Messages may include event reminders, follow-up information, mortgage updates, and appointment confirmations. Consent is not a condition of any purchase.
                            </label>
                          </div>
                          <p className="text-[10px] text-gray-400 leading-relaxed pl-7">
                            <strong>Message frequency varies.</strong> Message &amp; data rates may apply. Reply <strong>STOP</strong> to cancel at any time. Reply <strong>HELP</strong> for help. Mobile carriers are not liable for delayed or undelivered messages. No mobile information will be shared with third parties for marketing purposes. View our{" "}
                            <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-600" style={{ color: accentColor }}>Privacy Policy</a>{" "}and{" "}
                            <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-600" style={{ color: accentColor }}>Terms of Service</a>.
                          </p>
                        </div>
                      )}
                      {(showField("optIn") || page.showOptIn) && (
                        <div className="flex items-start gap-2.5">
                          <Checkbox id="contact-optin" checked={contactOptIn} onCheckedChange={(v) => setContactOptIn(v === true)} className="mt-0.5" />
                          <label htmlFor="contact-optin" className="text-xs text-gray-500 leading-relaxed cursor-pointer">
                            {page.optInLabel || "I agree to receive communications about this event and future opportunities"}
                          </label>
                        </div>
                      )}
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
                );
                return noLogoCard;
              })()
            : formCardContent
          }
        </div>

        {/* Footer */}
        <div className="text-center text-white/40 text-xs mt-8 space-y-1" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.3)" }}>
          <p>&copy; {new Date().getFullYear()} Alta Mortgage Group. All rights reserved.</p>
          <p>
            <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-white/70 transition-colors">Privacy Policy</a>
            {" · "}
            <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-white/70 transition-colors">Terms of Service</a>
          </p>
        </div>
      </div>
    </div>
  );
}
