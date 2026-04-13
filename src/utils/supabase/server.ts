// Shim: delegate to the canonical server client in src/lib/supabaseServer.ts.
// This keeps a single implementation while preserving the `createClient` export
// name expected by auth/callback and any future callers using this path.
export { getSupabaseServerClient as createClient } from "@/lib/supabaseServer";