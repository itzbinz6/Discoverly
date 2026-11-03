import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import {
  PASSWORD_RECOVERY_COOKIE,
  recoveryCookieOptions,
  verifyRecoveryTransaction,
} from "../../../../lib/supabase/recovery";

function invalidRecoveryResponse() {
  const response = NextResponse.json(
    { error: "invalid-recovery-session" },
    { status: 401 }
  );
  response.cookies.set(
    PASSWORD_RECOVERY_COOKIE,
    "",
    recoveryCookieOptions(0)
  );
  return response;
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get(PASSWORD_RECOVERY_COOKIE)?.value;
  if (!token) return invalidRecoveryResponse();

  try {
    const transaction = verifyRecoveryTransaction(token);
    if (!transaction) return invalidRecoveryResponse();

    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || data.user?.id !== transaction.userId) {
      return invalidRecoveryResponse();
    }

    return new NextResponse(null, { status: 204 });
  } catch {
    return invalidRecoveryResponse();
  }
}
