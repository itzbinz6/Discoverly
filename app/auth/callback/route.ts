import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";
import {
  createRecoveryTransaction,
  PASSWORD_RECOVERY_COOKIE,
  PASSWORD_RECOVERY_MAX_AGE_SECONDS,
  PASSWORD_RECOVERY_TYPE,
  recoveryCookieOptions,
} from "../../../lib/supabase/recovery";

const resetPasswordPath = "/auth/reset-password";

function invalidRecoveryResponse(request: NextRequest) {
  const response = NextResponse.redirect(
    new URL(`${resetPasswordPath}?error=invalid-link`, request.url)
  );
  response.cookies.set(
    PASSWORD_RECOVERY_COOKIE,
    "",
    recoveryCookieOptions(0)
  );
  return response;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  if (!tokenHash || type !== PASSWORD_RECOVERY_TYPE) {
    return invalidRecoveryResponse(request);
  }

  let recoverySessionCreated = false;
  let supabase: Awaited<ReturnType<typeof createClient>> | null = null;

  try {
    supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: PASSWORD_RECOVERY_TYPE,
    });

    if (error) {
      return invalidRecoveryResponse(request);
    }

    recoverySessionCreated = Boolean(data.session);
    if (
      !data.user ||
      !data.session ||
      data.session.user.id !== data.user.id
    ) {
      if (recoverySessionCreated) {
        await supabase.auth.signOut({ scope: "local" });
      }
      return invalidRecoveryResponse(request);
    }

    const { token } = createRecoveryTransaction(data.user.id);

    const response = NextResponse.redirect(
      new URL(resetPasswordPath, request.url)
    );
    response.cookies.set(
      PASSWORD_RECOVERY_COOKIE,
      token,
      recoveryCookieOptions(PASSWORD_RECOVERY_MAX_AGE_SECONDS)
    );
    return response;
  } catch {
    if (recoverySessionCreated && supabase) {
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch {
        // The invalid-link response still clears the recovery marker.
      }
    }
    return invalidRecoveryResponse(request);
  }
}
