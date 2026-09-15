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

/** Injects Meta's pixel bootstrap exactly once per page. */
export function initPixel(pixelId: string): void {
  if (typeof window === "undefined" || !pixelId) return;
  if (loadedPixelId === pixelId) return;

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
export function trackPageView(): void {
  if (!loadedPixelId) return;
  window.fbq?.("track", "PageView");
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
