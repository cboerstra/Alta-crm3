import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { processPendingReminders } from "../emailService";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  // ── Startup environment validation ──────────────────────────────────────────
  const missingEnvVars: string[] = [];
  if (!process.env.JWT_SECRET) missingEnvVars.push("JWT_SECRET");
  if (!process.env.DATABASE_URL) missingEnvVars.push("DATABASE_URL");
  if (missingEnvVars.length > 0) {
    console.error(
      `[Startup] CRITICAL: Missing required environment variables: ${missingEnvVars.join(", ")}. ` +
      `Set these in Hostinger → Node.js → Environment Variables and restart the app.`
    );
    // Generate a temporary JWT_SECRET so the server can still start and show
    // a meaningful error to the user instead of crashing with "zero-length key".
    if (!process.env.JWT_SECRET) {
      const crypto = await import("crypto");
      process.env.JWT_SECRET = crypto.randomBytes(32).toString("hex");
      console.warn(
        "[Startup] JWT_SECRET is not set — generated a temporary random secret. " +
        "Sessions will be invalidated on every restart until you set JWT_SECRET permanently."
      );
    }
  }

  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });

  // Email reminder scheduler: process pending reminders every 60 seconds
  setInterval(async () => {
    try {
      const sent = await processPendingReminders();
      if (sent > 0) console.log(`[Email Scheduler] Sent ${sent} reminder(s)`);
    } catch (err) {
      console.error("[Email Scheduler] Error:", err);
    }
  }, 60_000);
}

startServer().catch(console.error);
