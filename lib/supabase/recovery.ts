import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export const PASSWORD_RECOVERY_COOKIE = "discoverly-password-recovery";
export const PASSWORD_RECOVERY_TYPE = "recovery";
export const PASSWORD_RECOVERY_MAX_AGE_SECONDS = 15 * 60;

export type RecoveryTransaction = {
  userId: string;
  expiresAt: number;
};

type RecoveryPayload = RecoveryTransaction & {
  nonce: string;
};

export function recoveryCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    maxAge,
    path: "/auth",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

function getSigningKey() {
  const secret = process.env.SUPABASE_RECOVERY_COOKIE_SECRET;
  if (!secret || !/^[a-f0-9]{64}$/i.test(secret)) {
    throw new Error("Invalid password recovery signing configuration.");
  }

  return Buffer.from(secret, "hex");
}

export function createRecoveryTransaction(userId: string) {
  const payload: RecoveryPayload = {
    userId,
    expiresAt:
      Math.floor(Date.now() / 1000) + PASSWORD_RECOVERY_MAX_AGE_SECONDS,
    nonce: randomUUID(),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url"
  );
  const signature = createHmac("sha256", getSigningKey())
    .update(encodedPayload)
    .digest("base64url");

  return {
    token: `${encodedPayload}.${signature}`,
    transaction: {
      userId: payload.userId,
      expiresAt: payload.expiresAt,
    },
  };
}

export function verifyRecoveryTransaction(
  token: string
): RecoveryTransaction | null {
  const [encodedPayload, providedSignature, ...extraParts] = token.split(".");
  if (!encodedPayload || !providedSignature || extraParts.length > 0) {
    return null;
  }

  const expectedSignature = createHmac("sha256", getSigningKey())
    .update(encodedPayload)
    .digest();
  let actualSignature: Buffer;
  try {
    actualSignature = Buffer.from(providedSignature, "base64url");
  } catch {
    return null;
  }

  if (
    actualSignature.length !== expectedSignature.length ||
    !timingSafeEqual(actualSignature, expectedSignature)
  ) {
    return null;
  }

  let payload: RecoveryPayload;
  try {
    payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8")
    ) as RecoveryPayload;
  } catch {
    return null;
  }

  if (
    typeof payload.userId !== "string" ||
    payload.userId.length === 0 ||
    !Number.isInteger(payload.expiresAt) ||
    payload.expiresAt <= Math.floor(Date.now() / 1000) ||
    typeof payload.nonce !== "string" ||
    payload.nonce.length === 0
  ) {
    return null;
  }

  return { userId: payload.userId, expiresAt: payload.expiresAt };
}
