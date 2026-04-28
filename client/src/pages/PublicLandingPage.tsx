import { useState, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { useLocation, useParams } from "wouter";
import { CheckCircle, Loader2, Calendar, Clock } from "lucide-react";

const TEMPLATE_HEAD_ATTR = "data-alta-template-head";
const EMBEDDED_FORM_CLASS = "alta-crm-embedded-form";
const EMBEDDED_FORM_CARD_CLASS = "alta-crm-embedded-form-card";
const EMBEDDED_FORM_RESET_CSS = `
  .${EMBEDDED_FORM_CLASS} {
    color: #111827;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    line-height: 1.5;
    text-align: left;
  }
  .${EMBEDDED_FORM_CLASS} * {
    box-sizing: border-box;
  }
  .${EMBEDDED_FORM_CLASS} > div,
  .${EMBEDDED_FORM_CLASS} > div > div {
    width: 100% !important;
    max-width: 28rem !important;
  }
  .${EMBEDDED_FORM_CLASS} .${EMBEDDED_FORM_CARD_CLASS} {
    background: rgba(255, 255, 255, 0.95) !important;
    border: 1px solid rgba(255, 255, 255, 0.2) !important;
    border-radius: 1rem !important;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25) !important;
    color: #111827 !important;
    margin: 0 auto !important;
    max-width: 28rem !important;
    padding: 1.5rem !important;
    text-align: left !important;
    width: 100% !important;
  }
  @media (min-width: 768px) {
    .${EMBEDDED_FORM_CLASS} .${EMBEDDED_FORM_CARD_CLASS} {
      padding: 2rem !important;
    }
  }
  .${EMBEDDED_FORM_CLASS} h2,
  .${EMBEDDED_FORM_CLASS} p,
  .${EMBEDDED_FORM_CLASS} label,
  .${EMBEDDED_FORM_CLASS} span,
  .${EMBEDDED_FORM_CLASS} a,
  .${EMBEDDED_FORM_CLASS} div,
  .${EMBEDDED_FORM_CLASS} input,
  .${EMBEDDED_FORM_CLASS} button,
  .${EMBEDDED_FORM_CLASS} [role="combobox"] {
    font-family: inherit !important;
  }
  .${EMBEDDED_FORM_CLASS} h2 {
    color: #111827 !important;
    font-size: 1.125rem !important;
    font-weight: 700 !important;
    letter-spacing: 0 !important;
    line-height: 1.25 !important;
    margin: 0 !important;
    max-width: none !important;
    text-align: center !important;
  }
  .${EMBEDDED_FORM_CLASS} p {
    color: #6b7280 !important;
    font-size: 0.75rem !important;
    font-weight: 400 !important;
    letter-spacing: 0 !important;
    line-height: 1.625 !important;
    margin: 0 !important;
    max-width: none !important;
    text-align: left !important;
  }
  .${EMBEDDED_FORM_CLASS} .${EMBEDDED_FORM_CARD_CLASS} > div:first-child,
  .${EMBEDDED_FORM_CLASS} .${EMBEDDED_FORM_CARD_CLASS} > div:first-child p {
    text-align: center !important;
  }
  .${EMBEDDED_FORM_CLASS} label {
    color: #6b7280 !important;
    font-size: 0.75rem !important;
    font-weight: 600 !important;
    letter-spacing: 0.05em !important;
    line-height: 1rem !important;
    margin: 0 !important;
    max-width: none !important;
    text-align: left !important;
    text-transform: uppercase !important;
  }
  .${EMBEDDED_FORM_CLASS} input {
    background: rgba(249, 250, 251, 0.8) !important;
    border: 1px solid #e5e7eb !important;
    border-radius: 0.375rem !important;
    box-shadow: none !important;
    color: #111827 !important;
    display: flex !important;
    font-size: 0.875rem !important;
    height: 2.5rem !important;
    line-height: 1.25rem !important;
    margin: 0.25rem 0 0 !important;
    padding: 0.5rem 0.75rem !important;
    text-align: left !important;
    width: 100% !important;
  }
  .${EMBEDDED_FORM_CLASS} input[type="checkbox"] {
    appearance: none !important;
    background: #ffffff !important;
    border: 1px solid #d1d5db !important;
    border-radius: 0.25rem !important;
    display: inline-flex !important;
    flex: 0 0 auto !important;
    height: 1rem !important;
    margin: 0.125rem 0 0 !important;
    min-height: 1rem !important;
    padding: 0 !important;
    width: 1rem !important;
  }
  .${EMBEDDED_FORM_CLASS} input[type="checkbox"]:checked {
    background: #111827 !important;
    border-color: #111827 !important;
  }
  .${EMBEDDED_FORM_CLASS} button {
    border: 0 !important;
    border-radius: 0.75rem !important;
    color: #ffffff !important;
    cursor: pointer !important;
    font-size: 1rem !important;
    font-weight: 600 !important;
    height: 3rem !important;
    line-height: 1.5rem !important;
    margin: 0 !important;
    padding: 0 1rem !important;
    text-align: center !important;
    text-decoration: none !important;
    text-transform: none !important;
    width: 100% !important;
  }
  .${EMBEDDED_FORM_CLASS} button[role="checkbox"] {
    align-items: center !important;
    background: #ffffff !important;
    border: 1px solid #d1d5db !important;
    border-radius: 0.25rem !important;
    color: #ffffff !important;
    cursor: pointer !important;
    display: inline-flex !important;
    flex: 0 0 1rem !important;
    height: 1rem !important;
    justify-content: center !important;
    margin: 0.125rem 0 0 !important;
    min-height: 1rem !important;
    padding: 0 !important;
    width: 1rem !important;
  }
  .${EMBEDDED_FORM_CLASS} button[role="checkbox"][data-state="checked"] {
    background: #1E4A36 !important;
    border-color: #1E4A36 !important;
    color: #ffffff !important;
  }
  .${EMBEDDED_FORM_CLASS} button[role="checkbox"] svg {
    display: block !important;
    height: 0.875rem !important;
    width: 0.875rem !important;
    stroke-width: 3 !important;
  }
  .${EMBEDDED_FORM_CLASS} .grid {
    display: grid !important;
  }
  .${EMBEDDED_FORM_CLASS} .flex {
    display: flex !important;
  }
  .${EMBEDDED_FORM_CLASS} .space-y-2 > :not([hidden]) ~ :not([hidden]) {
    margin-top: 0.5rem !important;
  }
  .${EMBEDDED_FORM_CLASS} .space-y-4 > :not([hidden]) ~ :not([hidden]) {
    margin-top: 1rem !important;
  }
  .${EMBEDDED_FORM_CLASS} a {
    color: inherit !important;
    text-decoration: underline !important;
  }
`;

function rewriteRelativeAssetUrls(root: ParentNode, baseUrl: string) {
  const attrs = ["src", "href", "poster"];
  const elements = root instanceof Element
    ? [root, ...Array.from(root.querySelectorAll("*"))]
    : Array.from(root.querySelectorAll("*"));

  elements.forEach((el) => {
    attrs.forEach((attr) => {
      const value = el.getAttribute(attr);
      if (!value || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(value)) return;
      try {
        el.setAttribute(attr, new URL(value, baseUrl).toString());
      } catch {
        // Leave invalid template URLs untouched so the browser handles them normally.
      }
    });
  });
}

function cloneHeadAsset(node: Element, baseUrl: string) {
  const clone = node.tagName.toLowerCase() === "script"
    ? document.createElement("script")
    : node.cloneNode(true) as HTMLElement;
  if (node.tagName.toLowerCase() === "script") {
    Array.from(node.attributes).forEach(attr => clone.setAttribute(attr.name, attr.value));
    clone.textContent = node.textContent;
  }
  clone.setAttribute(TEMPLATE_HEAD_ATTR, "true");
  rewriteRelativeAssetUrls(clone, baseUrl);
  return clone;
}

function runScripts(container: HTMLElement, baseUrl: string) {
  container.querySelectorAll("script").forEach((oldScript) => {
    const newScript = document.createElement("script");
    Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
    rewriteRelativeAssetUrls(newScript, baseUrl);
    newScript.textContent = oldScript.textContent;
    oldScript.parentNode?.replaceChild(newScript, oldScript);
  });
}

export default function PublicLandingPage() {
  const params = useParams<{ slug: string }>();
  const [, navigate] = useLocation();
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
      if (data.joinUrl) {
        setJoinUrl(data.joinUrl);
        window.sessionStorage.setItem(`lp:${params.slug}:joinUrl`, data.joinUrl);
      } else {
        window.sessionStorage.removeItem(`lp:${params.slug}:joinUrl`);
      }
      navigate(`/lp/${params.slug}/thanks`);
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
  const getSessionValue = (session: any) => String(session.id);
  const selectedSession = sessions.find((session: any) => getSessionValue(session) === selectedSessionId);
  const formatSessionLabel = (session: any) => {
    const date = new Date(session.sessionDate);
    const datePart = date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    const timePart = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    return `${datePart} at ${timePart}${session.label ? ` - ${session.label}` : ""}`;
  };
  const accentColor = page?.accentColor || "#C9A84C";
  const hasHtmlBackground = !!(page as any)?.backgroundHtmlUrl;
  const hasImageBackground = !!page?.artworkUrl && !hasHtmlBackground;
  const hasBackground = hasHtmlBackground || hasImageBackground;
  const logoSize = (page as any)?.logoSize ?? 64;

  // ─── Derived feature flags ───
  const formEmbedded = !!(page as any)?.formEmbedded && hasHtmlBackground;
  // logoOnBackground only applies in non-embedded mode (embedded mode has the logo inside the form card in the HTML)
  const logoOnBackground = !!(page as any)?.logoOnHtmlBackground && hasHtmlBackground && !formEmbedded;
  const isThanksPage = window.location.pathname.replace(/\/+$/, "").endsWith("/thanks");

  useEffect(() => {
    if (!isThanksPage) return;
    setJoinUrl(window.sessionStorage.getItem(`lp:${params.slug}:joinUrl`));
  }, [isThanksPage, params.slug]);

  useEffect(() => {
    if (!enabledFields.includes("sessionSelect")) {
      if (selectedSessionId) setSelectedSessionId("");
      return;
    }

    const sessionValues = sessions.map(getSessionValue);
    if (selectedSessionId && !sessionValues.includes(selectedSessionId)) {
      setSelectedSessionId("");
      return;
    }

    if (!selectedSessionId && sessionValues.length === 1) {
      setSelectedSessionId(sessionValues[0]);
    }
  }, [enabledFields, sessions, selectedSessionId]);

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

  // ─── Render uploaded HTML body and locate form mount point ───
  useEffect(() => {
    if (fetchedHtml === null || !htmlContainerRef.current) return;
    const container = htmlContainerRef.current;
    const baseUrl = new URL((page as any)?.backgroundHtmlUrl || window.location.href, window.location.origin).toString();
    const placeholder = '<div id="alta-crm-form-mount"></div>';
    let modified = fetchedHtml.includes("{{alta_form}}")
      ? fetchedHtml.replace(/\{\{alta_form\}\}/g, placeholder)
      : fetchedHtml.replace(/<\/body>/i, `${placeholder}</body>`);
    if (!modified.includes(placeholder)) modified += placeholder;

    // Replace {{alta_logo}} with actual logo img tags from the media library
    const logoHtml = foregroundLogos.map(item =>
      `<img src="${item.media!.fileUrl}" alt="${item.media!.label || ""}" style="height:${logoSize}px;width:auto;object-fit:contain;display:block;">`
    ).join("");
    modified = modified.replace(/\{\{alta_logo\}\}/g, logoHtml);

    const doc = new DOMParser().parseFromString(modified, "text/html");
    rewriteRelativeAssetUrls(doc, baseUrl);

    const headAssets = Array.from(doc.head.querySelectorAll(
      'style, link[rel~="stylesheet"], link[rel="preconnect"], link[rel="preload"], link[rel="modulepreload"], link[rel="dns-prefetch"], script'
    )).map((node) => cloneHeadAsset(node, baseUrl));
    headAssets.forEach((node) => document.head.appendChild(node));

    const formResetStyle = document.createElement("style");
    formResetStyle.setAttribute(TEMPLATE_HEAD_ATTR, "true");
    formResetStyle.textContent = EMBEDDED_FORM_RESET_CSS;
    document.head.appendChild(formResetStyle);
    headAssets.push(formResetStyle);

    container.className = `w-full min-h-screen ${doc.body.className || ""}`.trim();
    container.style.cssText = doc.body.getAttribute("style") || "";
    container.style.minHeight = container.style.minHeight || "100vh";
    container.innerHTML = doc.body.innerHTML;

    runScripts(container, baseUrl);

    const mountEl = container.querySelector("#alta-crm-form-mount") as HTMLElement | null;
    setFormMountPoint(mountEl);

    return () => {
      headAssets.forEach((node) => node.remove());
      container.removeAttribute("style");
      container.className = "w-full min-h-screen";
      container.innerHTML = "";
      setFormMountPoint(null);
    };
  }, [fetchedHtml, foregroundLogos, logoSize, (page as any)?.backgroundHtmlUrl]);

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
  if (submitted || isThanksPage) {
    return (
      <div className="min-h-screen bg-[#F8F4EC] flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl shadow-2xl p-8 text-center border border-[#E5E1D8]">
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
    const webinarSessionId = /^\d+$/.test(selectedSessionId) ? Number(selectedSessionId) : undefined;
    submitLead.mutate({
      slug: params.slug,
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email,
      phone: form.phone || undefined,
      smsConsent,
      contactOptIn,
      webinarSessionId,
    });
  };

  const isFormValid = form.firstName && form.lastName && form.email &&
    (!showField("sessionSelect") || !sessions.length || selectedSessionId);

  const embeddedTextStyle = formEmbedded
    ? {
        fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        letterSpacing: 0,
        lineHeight: 1.6,
        margin: 0,
        maxWidth: "none",
        textAlign: "left" as const,
      }
    : undefined;
  const embeddedHeadingStyle = formEmbedded
    ? {
        fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        fontSize: "18px",
        fontWeight: 700,
        letterSpacing: 0,
        lineHeight: 1.25,
        margin: 0,
        maxWidth: "none",
        textAlign: "center" as const,
      }
    : undefined;
  const embeddedSmallCopyStyle = formEmbedded
    ? {
        ...embeddedTextStyle,
        color: "#6b7280",
        fontSize: "12px",
        fontWeight: 400,
      }
    : undefined;
  const embeddedLabelStyle = formEmbedded
    ? {
        ...embeddedTextStyle,
        color: "#6b7280",
        fontSize: "12px",
        fontWeight: 600,
        letterSpacing: "0.05em",
        lineHeight: "16px",
        textTransform: "uppercase" as const,
      }
    : undefined;
  const embeddedConsentLabelStyle = formEmbedded
    ? {
        ...embeddedTextStyle,
        color: "#6b7280",
        fontSize: "12px",
        fontWeight: 400,
        lineHeight: 1.5,
        textTransform: "none" as const,
      }
    : undefined;

  // ─── Form card content (shared between normal and embedded modes) ───
  const formCardContent = (
    <div
      className={`${EMBEDDED_FORM_CARD_CLASS} bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl p-6 md:p-8 border border-white/20`}
      style={formEmbedded ? { fontFamily: embeddedTextStyle?.fontFamily, textAlign: "left" } : undefined}
    >
      {/* Logo — shown inside the card in normal mode; embedded templates provide their own page branding. */}
      {!formEmbedded && foregroundLogos.length > 0 && (
        <div className="flex items-center justify-center gap-4 mb-4">
          {foregroundLogos.map((item) => (
            <img key={item.mediaId} src={item.media!.fileUrl} alt={item.media!.label || ""} style={{ height: `${logoSize}px` }} className="object-contain" />
          ))}
        </div>
      )}
      {!formEmbedded && (page.headline || page.title) && (
        <div className="text-center mb-4">
          <h2 className="text-lg font-bold text-gray-900 leading-tight" style={embeddedHeadingStyle ?? { fontFamily: "Raleway, sans-serif" }}>
            {page.headline || page.title}
          </h2>
          {page.subheadline && <p className="text-sm text-gray-500 mt-1" style={embeddedSmallCopyStyle}>{page.subheadline}</p>}
        </div>
      )}
      <div className="space-y-4">
        {(showField("firstName") || showField("lastName")) && (
          <div className="grid grid-cols-2 gap-3">
            {showField("firstName") && (
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-gray-500" style={embeddedLabelStyle}>First Name *</Label>
                <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} placeholder="John" className="mt-1 bg-gray-50/80 border-gray-200 focus:border-gray-400 text-gray-900" />
              </div>
            )}
            {showField("lastName") && (
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-gray-500" style={embeddedLabelStyle}>Last Name *</Label>
                <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} placeholder="Doe" className="mt-1 bg-gray-50/80 border-gray-200 focus:border-gray-400 text-gray-900" />
              </div>
            )}
          </div>
        )}
        {showField("email") && (
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-gray-500" style={embeddedLabelStyle}>Email *</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="john@example.com" className="mt-1 bg-gray-50/80 border-gray-200 focus:border-gray-400 text-gray-900" />
          </div>
        )}
        {showField("phone") && (
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-gray-500" style={embeddedLabelStyle}>Phone Number</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(555) 123-4567" className="mt-1 bg-gray-50/80 border-gray-200 focus:border-gray-400 text-gray-900" />
          </div>
        )}
        {showField("sessionSelect") && sessions.length > 0 && (
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-gray-500" style={embeddedLabelStyle}>Select Seminar Date *</Label>
            <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
              <SelectTrigger className="mt-1 bg-gray-50/80 border-gray-200 text-gray-900">
                <span className="flex-1 truncate text-left text-gray-900" style={{ color: "#111827" }}>
                  {selectedSession ? formatSessionLabel(selectedSession) : "Choose a date..."}
                </span>
              </SelectTrigger>
              <SelectContent>
                {sessions.map((s: any) => (
                  <SelectItem key={getSessionValue(s)} value={getSessionValue(s)} textValue={formatSessionLabel(s)}>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>
                        {formatSessionLabel(s).replace(/ - .+$/, "")}
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
          <div className="space-y-2 pt-1 font-sans">
            <div className="flex items-start gap-2.5">
              <Checkbox id="sms-consent" checked={smsConsent} onCheckedChange={(v) => setSmsConsent(v === true)} className="mt-0.5 flex-shrink-0" />
              <label htmlFor="sms-consent" className="text-xs font-normal text-gray-500 leading-relaxed cursor-pointer" style={embeddedConsentLabelStyle}>
                By checking this box, I consent to receive recurring automated and non-automated SMS text messages from Alta Mortgage Group at the mobile number provided above. Messages may include event reminders, follow-up information, mortgage updates, and appointment confirmations. Consent is not a condition of any purchase.
              </label>
            </div>
            <p className="text-xs font-normal text-gray-500 leading-relaxed pl-7" style={embeddedSmallCopyStyle ? { ...embeddedSmallCopyStyle, paddingLeft: "1.75rem" } : undefined}>
              <span className="font-semibold">Message frequency varies.</span> Message &amp; data rates may apply. Reply <span className="font-semibold">STOP</span> to cancel at any time. Reply <span className="font-semibold">HELP</span> for help. Mobile carriers are not liable for delayed or undelivered messages. No mobile information will be shared with third parties for marketing purposes. View our{" "}
              <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-600" style={{ color: accentColor }}>Privacy Policy</a>{" "}and{" "}
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-600" style={{ color: accentColor }}>Terms of Service</a>.
            </p>
          </div>
        )}
        {(showField("optIn") || page.showOptIn) && (
          <div className="flex items-start gap-2.5">
            <Checkbox id="contact-optin" checked={contactOptIn} onCheckedChange={(v) => setContactOptIn(v === true)} className="mt-0.5" />
            <label htmlFor="contact-optin" className="text-xs text-gray-500 leading-relaxed cursor-pointer" style={embeddedConsentLabelStyle}>
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
          <div className={`${EMBEDDED_FORM_CLASS} p-4 flex justify-center`}>
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
                            <SelectTrigger className="mt-1 bg-gray-50/80 border-gray-200 text-gray-900">
                              <span className="flex-1 truncate text-left text-gray-900" style={{ color: "#111827" }}>
                                {selectedSession ? formatSessionLabel(selectedSession) : "Choose a date..."}
                              </span>
                            </SelectTrigger>
                            <SelectContent>
                              {sessions.map((s: any) => (
                                <SelectItem key={getSessionValue(s)} value={getSessionValue(s)} textValue={formatSessionLabel(s)}>
                                  <div className="flex items-center gap-2">
                                    <Calendar className="h-3.5 w-3.5" />
                                    <span>{formatSessionLabel(s).replace(/ - .+$/, "")}</span>
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
