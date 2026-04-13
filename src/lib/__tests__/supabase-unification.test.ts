import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock next/headers before any module imports that depend on it
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: vi.fn().mockReturnValue([]),
    get: vi.fn().mockReturnValue(undefined),
    set: vi.fn(),
  }),
}));

// Mock @supabase/ssr
vi.mock("@supabase/ssr", () => ({
  createBrowserClient: vi.fn().mockReturnValue({ type: "browser-client" }),
  createServerClient: vi.fn().mockReturnValue({ type: "server-client" }),
}));

// Mock @supabase/supabase-js
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn().mockReturnValue({ type: "raw-supabase-client" }),
}));

describe("supabase helpers unification", () => {
  beforeEach(() => {
    vi.resetModules();
    // Ensure env vars are set for tests
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  });

  it("utils/supabase/client path resolves without error", async () => {
    const mod = await import("@/utils/supabase/client");
    expect(typeof mod.createClient).toBe("function");
  });

  it("utils/supabase/server path resolves without error", async () => {
    const mod = await import("@/utils/supabase/server");
    expect(typeof mod.createClient).toBe("function");
  });

  it("utils/supabase/middleware path resolves without error", async () => {
    const mod = await import("@/utils/supabase/middleware");
    expect(typeof mod.updateSession).toBe("function");
  });

  it("lib/supabaseClient path resolves without error", async () => {
    const mod = await import("@/lib/supabaseClient");
    expect(typeof mod.getSupabaseClient).toBe("function");
  });

  it("lib/supabaseServer path resolves without error", async () => {
    const mod = await import("@/lib/supabaseServer");
    expect(typeof mod.getSupabaseServerClient).toBe("function");
  });

  it("utils/supabase/server and lib/supabaseServer both return async functions that create server clients", async () => {
    const utilsMod = await import("@/utils/supabase/server");
    const libMod = await import("@/lib/supabaseServer");

    // Both should be async functions (they await cookies())
    const utilsClientPromise = utilsMod.createClient();
    const libClientPromise = libMod.getSupabaseServerClient();

    expect(utilsClientPromise).toBeInstanceOf(Promise);
    expect(libClientPromise).toBeInstanceOf(Promise);

    const utilsClient = await utilsClientPromise;
    const libClient = await libClientPromise;

    // Both should return objects (Supabase clients)
    expect(typeof utilsClient).toBe("object");
    expect(typeof libClient).toBe("object");
  });

  it("utils/supabase/server re-exports the same function as lib/supabaseServer", async () => {
    // After the shim, utils/supabase/server.createClient should be the same
    // function reference as lib/supabaseServer.getSupabaseServerClient
    const utilsMod = await import("@/utils/supabase/server");
    const libMod = await import("@/lib/supabaseServer");

    expect(utilsMod.createClient).toBe(libMod.getSupabaseServerClient);
  });
});
