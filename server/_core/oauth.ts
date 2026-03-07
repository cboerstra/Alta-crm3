import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      // Check if there's an invite token in the state (encoded as base64 JSON)
      let inviteRole: "admin" | "user" | undefined;
      let inviteToken: string | undefined;
      try {
        const decoded = atob(state);
        // State may be a JSON object with redirectUri and inviteToken
        if (decoded.startsWith("{")) {
          const parsed = JSON.parse(decoded) as { redirectUri?: string; inviteToken?: string };
          inviteToken = parsed.inviteToken;
        }
      } catch {
        // State is plain redirectUri, no invite token
      }

      // If there's an invite token, validate it and get the role
      if (inviteToken && userInfo.email) {
        const invite = await db.getInviteByToken(inviteToken);
        if (
          invite &&
          !invite.acceptedAt &&
          new Date(invite.expiresAt) > new Date() &&
          invite.email.toLowerCase() === userInfo.email.toLowerCase()
        ) {
          inviteRole = invite.role as "admin" | "user";
          await db.acceptInvite(inviteToken);
        }
      }

      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
        ...(inviteRole ? { role: inviteRole } : {}),
      });

      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
