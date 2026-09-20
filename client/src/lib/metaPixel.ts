/**
 * Meta Pixel loader.
 *
 * The pixel is injected at runtime from the CRM's settings rather than hardcoded
 * into the page, so the pixel id can be changed (or a per-campaign pixel used)
 * without a redeploy.
 *
 * Every conversion is reported twice on purpose — once here in the browser and
 * once from the server via the Conversions API — sharing one `eventID` so Meta
 * counts it a single time. When the browser event is blocked, the server event
 * still lands; when both arrive, de-duplication keeps the numbers honest.
 */

declare global {
  interface Window {
    fbq?: ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void; queue?: unknown[] };
    _fbq?: unknown;
  }
}

let loadedPixelId: string | null = null;
/** True when the active pixel came from a pasted snippet rather than our loader. */
let adoptedExternalPixel = false;

/**
 * Detects a Meta Pixel base snippet inside staff-pasted tracking code.
 *
 * Landing pages have a "Tracking code" box that injects arbitrary markup into
 * <head>. If someone pastes Meta's base snippet there while a pixel is also
 * configured centrally, both would initialise and both would send PageView —
 * and Meta does not de-duplicate PageView, because it carries no eventID. The
 * traffic numbers would quietly double.
 *
 * So we look for an `fbq('init', ...)` call and, when present, treat the pasted
 * snippet as the owner of the pixel. Returns the pixel id it initialises, or
 * `"unknown"` when the call is there but the id cannot be read (a templated or
 * minified snippet). Returns null when there is no Meta pixel in the markup.
 */
export function detectPixelInMarkup(markup: string | null | undefined): string | null {
  if (!markup) return null;
  // fbq('init', '123...') / fbq("init","123...") / fbq( 'init' , `123` )
  const init = markup.match(/fbq\s*\(\s*['"`]init['"`]\s*,\s*['"`]([^'"`]+)['"`]/i);
  if (init) return init[1].trim();
  // An init call we can see but cannot parse an id from still means "they own it".
  if (/fbq\s*\(\s*['"`]init['"`]/i.test(markup)) return "unknown";
  return null;
}

/**
 * Hands pixel ownership to a snippet already on the page.
 *
 * Call before `initPixel` when `detectPixelInMarkup` finds a pasted pixel. The
 * CRM then skips its own `init` and `PageView`, but still fires conversions
 * through the snippet's `fbq` — so the shared eventID reaches Meta and
 * de-duplication against the Conversions API keeps working.
 */
export function adoptExternalPixel(pixelId: string): void {
  loadedPixelId = pixelId;
  adoptedExternalPixel = true;
}

/** Whether the active pixel was adopted from pasted tracking code. */
export function isExternalPixel(): boolean {
  return adoptedExternalPixel;
}

/** Injects Meta's pixel bootstrap exactly once per page. */
export function initPixel(pixelId: string): void {
  if (typeof window === "undefined" || !pixelId) return;
  if (loadedPixelId === pixelId) return;
  // A pasted snippet already owns the pixel — initialising again would double
  // every event it sends.
  if (adoptedExternalPixel) return;

  if (!window.fbq) {
    /* eslint-disable */
    const fbq: any = function (...args: unknown[]) {
      fbq.callMethod ? fbq.callMethod.apply(fbq, args) : fbq.queue.push(args);
    };
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = "2.0";
    fbq.queue = [];
    window.fbq = fbq;
    window._fbq = fbq;
    /* eslint-enable */

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(script);
  }

  window.fbq?.("init", pixelId);
  loadedPixelId = pixelId;
}

/** Fires a PageView. Safe to call before the script finishes loading — fbq queues. */
export function trackPageView(eventId?: string): void {
  if (!loadedPixelId) return;
  // The pasted snippet sends its own PageView; a second one would inflate traffic.
  if (adoptedExternalPixel) return;
  // The eventID must match the server-side PageView or Meta counts the view twice.
  if (eventId) window.fbq?.("track", "PageView", {}, { eventID: eventId });
  else window.fbq?.("track", "PageView");
}

/**
 * Event id for the PageView belonging to a visit.
 *
 * Derived from the visit's base event id so the browser and the server arrive at
 * the same value independently, without passing it back and forth. Meta
 * de-duplicates on (event_name, event_id), so PageView needs its own id rather
 * than reusing the Lead one.
 */
export function pageViewEventId(baseEventId: string): string {
  return `${baseEventId}_pv`;
}

/**
 * Fires a standard conversion event. `eventId` must match the id sent to the
 * Conversions API, or Meta will count the conversion twice.
 */
export function trackConversion(
  eventName: string,
  eventId: string,
  params?: Record<string, unknown>
): void {
  if (!loadedPixelId) return;
  window.fbq?.("track", eventName, params ?? {}, { eventID: eventId });
}

/** Whether a pixel is active on this page — used to explain a quiet Events Manager. */
export function isPixelLoaded(): boolean {
  return loadedPixelId !== null;
}
