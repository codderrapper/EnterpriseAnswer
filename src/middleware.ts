import { type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * 1. 排除所有静态资源 (js, css, images, etc.)
     * 2. 排除 Next.js 内部路径 (_next)
     * 3. 排除 API 接口（通常 API 内部有自己的鉴权，Middleware 只管页面重定向）
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|pdf)$).*)",
  ],
};