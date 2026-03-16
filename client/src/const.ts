export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

/** Returns true when Manus OAuth env vars are present and non-empty. */
export const isManus = (): boolean => {
  const url = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  return !!(url && url.length > 0 && appId && appId.length > 0);
};

/**
 * Generate the Manus OAuth login URL at runtime so the redirect URI reflects
 * the current origin. Falls back to "/login" when Manus OAuth is not configured
 * (e.g. on Hostinger) so the app never crashes with TypeError: Invalid URL.
 */
export const getLoginUrl = (returnPath?: string): string => {
  if (!isManus()) {
    return "/login";
  }

  try {
    const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
    const appId = import.meta.env.VITE_APP_ID;
    const redirectUri = `${window.location.origin}/api/oauth/callback`;
    const state = btoa(
      JSON.stringify({ redirectUri, returnPath: returnPath ?? "/" })
    );

    const url = new URL(`${oauthPortalUrl}/app-auth`);
    url.searchParams.set("appId", appId);
    url.searchParams.set("redirectUri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("type", "signIn");

    return url.toString();
  } catch {
    // Fallback in case URL construction fails for any reason
    return "/login";
  }
};
