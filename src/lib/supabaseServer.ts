/**
 * Supabase Server Client
 *
 * ⭐ 项目亮点：
 * - 基于 Next.js cookies 实现服务端 session 读取
 * - 用于 Route Handler / Server Component
 * - 配合 RLS 实现真正的数据隔离
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function getSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from Server Component; cookie writes silently no-op
          }
        },
      },
    }
  );
}
