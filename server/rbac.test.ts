import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createMockUser(overrides?: Partial<AuthenticatedUser>): AuthenticatedUser {
  return {
    id: 1,
    openId: "test-admin-001",
    email: "admin@clarke.com",
    name: "Admin User",
    loginMethod: "manus",
    role: "admin",
    schedulingSlug: null,
    avatarUrl: null,
    phone: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };
}

function createAdminContext(): TrpcContext {
  return {
    user: createMockUser({ role: "admin" }),
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function createUserContext(): TrpcContext {
  return {
    user: createMockUser({ id: 2, openId: "test-user-002", role: "user", name: "Regular User", email: "user@clarke.com" }),
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("Role-Based Access Control", () => {
  describe("Auth - me endpoint", () => {
    it("returns user data with role for authenticated user", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.auth.me();
      expect(result).toBeDefined();
      expect(result?.role).toBe("admin");
      expect(result?.name).toBe("Admin User");
    });

    it("returns null for unauthenticated user", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.auth.me();
      expect(result).toBeNull();
    });

    it("returns role=user for regular user", async () => {
      const ctx = createUserContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.auth.me();
      expect(result?.role).toBe("user");
    });
  });

  describe("User Management - Admin-only procedures", () => {
    it("admin can access userManagement.list", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);
      // Should not throw - admin has access
      const result = await caller.userManagement.list({});
      expect(Array.isArray(result)).toBe(true);
    });

    it("admin can access userManagement.stats", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.userManagement.stats();
      expect(result).toHaveProperty("total");
      expect(result).toHaveProperty("admins");
      expect(result).toHaveProperty("users");
      expect(typeof result.total).toBe("number");
    });

    it("regular user cannot access userManagement.list", async () => {
      const ctx = createUserContext();
      const caller = appRouter.createCaller(ctx);
      await expect(caller.userManagement.list({})).rejects.toThrow();
    });

    it("regular user cannot access userManagement.stats", async () => {
      const ctx = createUserContext();
      const caller = appRouter.createCaller(ctx);
      await expect(caller.userManagement.stats()).rejects.toThrow();
    });

    it("unauthenticated user cannot access userManagement.list", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);
      await expect(caller.userManagement.list({})).rejects.toThrow();
    });

    it("admin can access userManagement.updateRole", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);
      // This will try to update a user in the DB - it should not throw for auth reasons
      // It may throw for DB reasons (user not found) but not for permission
      try {
        await caller.userManagement.updateRole({ userId: 999, role: "user" });
      } catch (e: any) {
        // Should not be a FORBIDDEN or UNAUTHORIZED error
        expect(e.code).not.toBe("FORBIDDEN");
        expect(e.code).not.toBe("UNAUTHORIZED");
      }
    });

    it("regular user cannot access userManagement.updateRole", async () => {
      const ctx = createUserContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.userManagement.updateRole({ userId: 1, role: "admin" })
      ).rejects.toThrow();
    });
  });

  describe("Settings - Admin-only integrations", () => {
    it("admin can access integrations.getStatus", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.integrations.getStatus();
      expect(result).toHaveProperty("zoom");
      expect(result).toHaveProperty("google");
    });

    it("regular user cannot access integrations.getStatus", async () => {
      const ctx = createUserContext();
      const caller = appRouter.createCaller(ctx);
      await expect(caller.integrations.getStatus()).rejects.toThrow();
    });
  });

  describe("Media Library - Admin-only", () => {
    it("admin can access media.list", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.media.list({});
      expect(Array.isArray(result)).toBe(true);
    });

    it("regular user cannot access media.list", async () => {
      const ctx = createUserContext();
      const caller = appRouter.createCaller(ctx);
      await expect(caller.media.list({})).rejects.toThrow();
    });
  });

  describe("CRM Features - Accessible to all authenticated users", () => {
    it("regular user can access leads.list", async () => {
      const ctx = createUserContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.leads.list({});
      expect(result).toHaveProperty("items");
      expect(result).toHaveProperty("total");
    });

    it("regular user can access analytics.dashboard", async () => {
      const ctx = createUserContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.analytics.dashboard();
      expect(result).toHaveProperty("totalLeads");
    });

    it("regular user can access webinars.list", async () => {
      const ctx = createUserContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.webinars.list();
      expect(Array.isArray(result)).toBe(true);
    });

    it("regular user can access deals.list", async () => {
      const ctx = createUserContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.deals.list({});
      expect(Array.isArray(result)).toBe(true);
    });

    it("unauthenticated user cannot access leads.list", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);
      await expect(caller.leads.list({})).rejects.toThrow();
    });

    it("unauthenticated user cannot access analytics.dashboard", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);
      await expect(caller.analytics.dashboard()).rejects.toThrow();
    });
  });

  describe("Public endpoints - No auth required", () => {
    it("unauthenticated user can access landingPages.getBySlug", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);
      // Should not throw for auth - may return null for non-existent slug
      const result = await caller.landingPages.getBySlug({ slug: "test-page" });
      // null is fine - just means no page found, but no auth error
      expect(result === null || result === undefined || typeof result === "object").toBe(true);
    });
  });
});
