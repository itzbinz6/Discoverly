import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";
import {
  PASSWORD_RECOVERY_COOKIE,
  verifyRecoveryTransaction,
} from "../../../lib/supabase/recovery";
import PasswordResetForm from "./password-reset-form";
import "../auth.css";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const recoveryToken = cookieStore.get(PASSWORD_RECOVERY_COOKIE)?.value;
  let verifiedRecoveryUserId: string | null = null;

  if (recoveryToken) {
    try {
      const transaction = verifyRecoveryTransaction(recoveryToken);
      if (transaction && params.error !== "invalid-link") {
        const supabase = await createClient();
        const { data, error } = await supabase.auth.getUser();
        if (!error && data.user?.id === transaction.userId) {
          verifiedRecoveryUserId = data.user.id;
        }
      }
    } catch {
      verifiedRecoveryUserId = null;
    }

    if (!verifiedRecoveryUserId) {
      redirect("/auth/reset-password/clear?error=invalid-link");
    }
  }

  return (
    <main className="discoverly-auth-page">
      <div className="auth-glow auth-glow-one" aria-hidden="true" />
      <div className="auth-glow auth-glow-two" aria-hidden="true" />

      <header className="auth-topbar">
        <Link href="/" className="auth-wordmark">
          Discoverly<span>.</span>
        </Link>
        <Link href="/" className="auth-back-link">
          ← Back to discover
        </Link>
      </header>

      <section className="auth-layout">
        <div className="auth-intro">
          <div className="auth-eyebrow">
            <span /> A BETTER WAY TO DISCOVER
          </div>
          <h1>
            Follow your curiosity.
            <br />
            <em>Find your next favorite.</em>
          </h1>
          <p className="auth-intro-copy">
            A personal space for ideas, stories, and videos worth your time.
            Make your account yours.
          </p>
        </div>

        <div className="auth-card-wrap">
          <section className="auth-card" aria-labelledby="reset-heading">
            {!verifiedRecoveryUserId ? (
              <div className="auth-reset-result">
                <div className="auth-card-eyebrow">PASSWORD RESET</div>
                <h2 id="reset-heading">This link can’t be used.</h2>
                <p className="auth-card-description">
                  The password reset link is invalid or has expired. Return to
                  login to request another one.
                </p>
                <Link
                  href="/auth?mode=login"
                  className="auth-submit-button auth-reset-login-link"
                >
                  Back to login <span>→</span>
                </Link>
              </div>
            ) : (
              <PasswordResetForm recoveryUserId={verifiedRecoveryUserId} />
            )}
          </section>
        </div>
      </section>

      <footer className="auth-footer">
        <span>© {new Date().getFullYear()} Discoverly</span>
        <span>Find videos worth your time.</span>
      </footer>
    </main>
  );
}
