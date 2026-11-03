import { NextRequest, NextResponse } from "next/server";
import {
  PASSWORD_RECOVERY_COOKIE,
  recoveryCookieOptions,
} from "../../../../lib/supabase/recovery";

function clearRecoveryCookie(response: NextResponse) {
  response.cookies.set(
    PASSWORD_RECOVERY_COOKIE,
    "",
    recoveryCookieOptions(0)
  );
  return response;
}

export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(
    new URL("/auth/reset-password?error=invalid-link", request.url)
  );
  return clearRecoveryCookie(response);
}

export async function POST() {
  return clearRecoveryCookie(
    NextResponse.json({ ok: true }, { status: 200 })
  );
}
