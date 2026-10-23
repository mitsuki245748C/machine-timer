import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// ログインセッション（Cookie）を自動で更新し続けるための仕組み。
// ページアクセスのたびに走り、ログイン状態を維持する。
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublicPath = pathname === "/login" || pathname.startsWith("/auth/");

  if (!user && !isPublicPath) {
    if (pathname.startsWith("/api/")) {
      return withSessionCookies(
        NextResponse.json({ error: "ログインしてください。" }, { status: 401 }),
        response,
      );
    }
    return redirectTo("/login", request, response);
  }

  // ログイン済みならログインページは不要
  if (user && pathname === "/login") {
    return redirectTo("/", request, response);
  }

  return response;
}

function withSessionCookies(target: NextResponse, source: NextResponse) {
  source.cookies.getAll().forEach((cookie) => target.cookies.set(cookie));
  return target;
}

function redirectTo(path: string, request: NextRequest, response: NextResponse) {
  const url = request.nextUrl.clone();
  url.pathname = path;
  url.search = "";
  return withSessionCookies(NextResponse.redirect(url), response);
}

// この middleware を動かす対象パス。
// 静的ファイルや画像は除外して、無駄に走らないようにする。
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};