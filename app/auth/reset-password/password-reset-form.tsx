"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "../../../lib/supabase/client";

const passwordRequirements = [
  { label: "At least 8 characters", test: (value: string) => value.length >= 8 },
  { label: "At least one uppercase letter", test: (value: string) => /[A-Z]/.test(value) },
  { label: "At least one lowercase letter", test: (value: string) => /[a-z]/.test(value) },
  { label: "At least one number", test: (value: string) => /\d/.test(value) },
  {
    label: "At least one special character",
    test: (value: string) => /[^A-Za-z0-9]/.test(value),
  },
];

export default function PasswordResetForm({
  recoveryUserId,
}: {
  recoveryUserId: string;
}) {
  const [supabase] = useState(() => createClient());
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionValid, setSessionValid] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [cleanupPending, setCleanupPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function clearRecoveryMarker() {
    const response = await fetch("/auth/reset-password/clear", {
      method: "POST",
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error("Could not clear the password recovery session.");
    }
  }

  const requirementResults = useMemo(
    () =>
      passwordRequirements.map((requirement) => ({
        ...requirement,
        met: requirement.test(password),
      })),
    [password]
  );
  const passwordIsValid = requirementResults.every(
    (requirement) => requirement.met
  );
  const passwordsMatch =
    confirmation.length > 0 && password === confirmation;

  useEffect(() => {
    let active = true;

    supabase.auth
      .getUser()
      .then(({ data, error }) => {
        if (!active) return;
        const valid = !error && data.user?.id === recoveryUserId;
        setSessionValid(valid);
        setCheckingSession(false);
        if (!valid) {
          void clearRecoveryMarker().catch(() => {
            if (active) {
              setErrorMessage(
                "The reset link is no longer valid. Please request a new one."
              );
            }
          });
        }
      })
      .catch(() => {
        if (!active) return;
        setSessionValid(false);
        setCheckingSession(false);
        void clearRecoveryMarker().catch(() => {
          if (active) {
            setErrorMessage(
              "The reset link is no longer valid. Please request a new one."
            );
          }
        });
      });

    return () => {
      active = false;
    };
  }, [recoveryUserId, supabase]);

  async function endRecoverySession() {
    setSubmitting(true);
    let cleanupFailed = false;

    try {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      cleanupFailed ||= Boolean(error);
    } catch {
      cleanupFailed = true;
    }

    try {
      await clearRecoveryMarker();
    } catch {
      cleanupFailed = true;
    }

    if (cleanupFailed) {
      setCleanupPending(true);
      setErrorMessage(
        "Your password was updated, but we couldn’t finish clearing the recovery session. Please try again."
      );
    } else {
      setCleanupPending(false);
      setSessionValid(false);
      setErrorMessage("");
    }

    setSubmitting(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    if (!sessionValid || !passwordIsValid || !passwordsMatch) {
      setErrorMessage(
        !sessionValid
          ? "This password reset session is no longer valid. Request a new reset link."
          : "Meet all password requirements and make sure both passwords match."
      );
      return;
    }

    setSubmitting(true);

    try {
      const validationResponse = await fetch(
        "/auth/reset-password/validate",
        { method: "POST", cache: "no-store" }
      );
      if (!validationResponse.ok) {
        setSessionValid(false);
        setErrorMessage(
          "This password reset session is no longer valid. Request a new reset link."
        );
        return;
      }

      let userId: string | undefined;
      let sessionInvalid = false;
      try {
        const {
          data: { user },
          error: sessionError,
        } = await supabase.auth.getUser();
        userId = user?.id;
        sessionInvalid = Boolean(sessionError) || userId !== recoveryUserId;
      } catch {
        sessionInvalid = true;
      }

      if (sessionInvalid) {
        setSessionValid(false);
        setErrorMessage(
          "This password reset session is no longer valid. Request a new reset link."
        );
        try {
          await clearRecoveryMarker();
        } catch {
          setErrorMessage(
            "This password reset session is no longer valid. Request a new reset link."
          );
        }
        return;
      }

      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        let currentSessionValid = false;
        try {
          const {
            data: { user: currentUser },
            error: currentSessionError,
          } = await supabase.auth.getUser();
          currentSessionValid =
            !currentSessionError && currentUser?.id === recoveryUserId;
        } catch {
          currentSessionValid = false;
        }

        if (!currentSessionValid) {
          setSessionValid(false);
          try {
            await clearRecoveryMarker();
          } catch {
            // The form remains blocked even if the cookie-clear request fails.
          }
          setErrorMessage(
            "This password reset session is no longer valid. Request a new reset link."
          );
          return;
        }

        setErrorMessage(
          "We couldn’t update your password. The reset link may have expired. Request a new one and try again."
        );
        return;
      }

      setPassword("");
      setConfirmation("");
      setCompleted(true);

      let cleanupFailed = false;
      try {
        const { error: signOutError } = await supabase.auth.signOut({
          scope: "local",
        });
        cleanupFailed = Boolean(signOutError);
      } catch {
        cleanupFailed = true;
      }

      try {
        await clearRecoveryMarker();
      } catch {
        cleanupFailed = true;
      }

      if (cleanupFailed) {
        setCleanupPending(true);
        setErrorMessage(
          "Your password was updated, but we couldn’t finish clearing the recovery session. Please try again."
        );
      } else {
        setSessionValid(false);
      }
    } catch {
      setErrorMessage(
        "We couldn’t update your password. The reset link may have expired. Request a new one and try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (checkingSession) {
    return (
      <div className="auth-reset-result" role="status" aria-live="polite">
        <div className="auth-card-eyebrow">PASSWORD RESET</div>
        <h2 id="reset-heading">Checking your reset link…</h2>
        <p className="auth-card-description">
          Please wait while we verify your recovery session.
        </p>
      </div>
    );
  }

  if (!sessionValid && !completed) {
    return (
      <div className="auth-reset-result">
        <div className="auth-card-eyebrow">PASSWORD RESET</div>
        <h2 id="reset-heading">This link can’t be used.</h2>
        <p className="auth-card-description">
          The password reset link is invalid or has expired. Return to login to
          request another one.
        </p>
        <Link
          href="/auth?mode=login"
          className="auth-submit-button auth-reset-login-link"
        >
          Back to login <span>→</span>
        </Link>
        {errorMessage && (
          <p className="auth-message error" role="alert">
            {errorMessage}
          </p>
        )}
      </div>
    );
  }

  if (completed) {
    return (
      <div className="auth-reset-result">
        <div className="auth-success-mark" aria-hidden="true">
          ✓
        </div>
        <div className="auth-card-eyebrow">PASSWORD UPDATED</div>
        <h2 id="reset-heading">You’re all set.</h2>
        <p className="auth-card-description">
          Your password has been updated. You can now log in with your new
          password.
        </p>
        {errorMessage && (
          <p className="auth-message error" role="alert">
            {errorMessage}
          </p>
        )}
        {cleanupPending ? (
          <button
            className="auth-submit-button auth-reset-login-link"
            type="button"
            onClick={() => void endRecoverySession()}
            disabled={submitting}
          >
            {submitting ? "Signing out…" : "End recovery session"}
          </button>
        ) : (
          <Link
            href="/auth?mode=login"
            className="auth-submit-button auth-reset-login-link"
          >
            Back to login <span>→</span>
          </Link>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="auth-card-eyebrow">PASSWORD RESET</div>
      <h2 id="reset-heading">Choose a new password</h2>
      <p className="auth-card-description">
        Create a strong password to secure your Discoverly account.
      </p>

      <form className="auth-form auth-reset-form" onSubmit={handleSubmit}>
        <div className="auth-password-label">
          <label htmlFor="reset-password">New password</label>
        </div>
        <div className="auth-input-wrap">
          <span aria-hidden="true">⌑</span>
          <input
            id="reset-password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Enter a new password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            aria-describedby="password-requirements"
          />
          <button
            className="auth-password-toggle"
            type="button"
            onClick={() => setShowPassword((visible) => !visible)}
            aria-label={showPassword ? "Hide new password" : "Show new password"}
            aria-pressed={showPassword}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>

        <ul
          className="auth-password-requirements"
          id="password-requirements"
          aria-label="Password requirements"
        >
          {requirementResults.map((requirement) => (
            <li
              className={requirement.met ? "met" : ""}
              key={requirement.label}
            >
              <span aria-hidden="true">{requirement.met ? "✓" : "○"}</span>
              {requirement.label}
            </li>
          ))}
        </ul>

        <div className="auth-password-label">
          <label htmlFor="confirm-password">Confirm new password</label>
        </div>
        <div className="auth-input-wrap">
          <span aria-hidden="true">⌑</span>
          <input
            id="confirm-password"
            type={showConfirmation ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Enter your new password again"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            required
            aria-invalid={confirmation.length > 0 && !passwordsMatch}
            aria-describedby="password-match"
          />
          <button
            className="auth-password-toggle"
            type="button"
            onClick={() => setShowConfirmation((visible) => !visible)}
            aria-label={
              showConfirmation ? "Hide password confirmation" : "Show password confirmation"
            }
            aria-pressed={showConfirmation}
          >
            {showConfirmation ? "Hide" : "Show"}
          </button>
        </div>
        <p
          className={`auth-password-match ${
            confirmation.length > 0 ? (passwordsMatch ? "met" : "unmatched") : ""
          }`}
          id="password-match"
          aria-live="polite"
        >
          {confirmation.length > 0
            ? passwordsMatch
              ? "Passwords match."
              : "Passwords do not match."
            : " "}
        </p>

        {errorMessage && (
          <p className="auth-message error" role="alert">
            {errorMessage}
          </p>
        )}

        <button
          className="auth-submit-button"
          type="submit"
          disabled={
            submitting ||
            !passwordIsValid ||
            !passwordsMatch ||
            !sessionValid
          }
        >
          {submitting ? (
            <>
              <span className="auth-spinner" /> Updating password…
            </>
          ) : (
            <>
              Update password <span>→</span>
            </>
          )}
        </button>
      </form>
    </>
  );
}
