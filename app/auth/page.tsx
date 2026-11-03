"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";
import "./auth.css";

type AuthMode = "login" | "signup";

const passwordRequirements = [
  { label: "At least 8 characters", test: (value: string) => value.length >= 8 },
  { label: "At least one uppercase letter", test: (value: string) => /[A-Z]/.test(value) },
  { label: "At least one lowercase letter", test: (value: string) => /[a-z]/.test(value) },
  { label: "At least one number", test: (value: string) => /[0-9]/.test(value) },
  { label: "At least one special character", test: (value: string) => /[^A-Za-z0-9]/.test(value) },
] as const;

export default function AuthPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmPasswordTouched, setConfirmPasswordTouched] = useState(false);
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "info">("info");
  const [loading, setLoading] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const passwordChecks = passwordRequirements.map(({ label, test }) => ({
    label,
    met: test(password),
  }));
  const passwordScore = passwordChecks.filter(({ met }) => met).length;
  const strengthClass = passwordScore === 5
    ? "strong"
    : passwordScore >= 4
      ? "good"
      : passwordScore === 3
        ? "fair"
        : "weak";
  const passwordStrength = password.length === 0
    ? "Start typing"
    : passwordScore <= 2
      ? "Weak"
      : passwordScore === 3
        ? "Fair"
        : passwordScore === 4
          ? "Good"
          : "Strong";

  function getEmailError(input: HTMLInputElement) {
    if (!input.value.trim()) return "Enter your email address.";
    if (input.validity.typeMismatch) return "Enter a valid email address.";
    return "";
  }

  function getConfirmPasswordError(value: string, expectedPassword = password) {
    if (!value) return "Confirm your password.";
    if (value !== expectedPassword) return "Passwords do not match.";
    return "";
  }

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("mode") === "signup") {
      setMode("signup");
    }

    let mounted = true;
    supabase.auth.getUser().then(({ data, error }) => {
      if (mounted && !error) setUserEmail(data.user?.email ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (mode === "signup") {
      const emailInput = event.currentTarget.querySelector<HTMLInputElement>("#auth-email");
      const nextEmailError = emailInput ? getEmailError(emailInput) : "Enter a valid email address.";
      const nextConfirmPasswordError = getConfirmPasswordError(confirmPassword);
      setEmailTouched(true);
      setEmailError(nextEmailError);
      setPasswordTouched(true);
      setConfirmPasswordTouched(true);
      setConfirmPasswordError(nextConfirmPasswordError);

      if (nextEmailError || passwordScore < passwordRequirements.length || nextConfirmPasswordError) {
        return;
      }
    }

    setLoading(true);

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });

        if (error) throw error;

        if (data.session) {
          setMessageType("success");
          setMessage("Account created! Let's personalise your experience.");

          router.push("/onboarding");
        } else {
          setMessageType("info");
          setMessage(
            "Account created. Please check your email if confirmation is required."
          );
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) throw error;

        const user = data.user;

        // Check whether this user has completed onboarding.
        const { data: preferences, error: preferenceError } = await supabase
          .from("user_preferences")
          .select("onboarding_completed")
          .eq("user_id", user.id)
          .maybeSingle();

        if (preferenceError) throw preferenceError;

        setMessageType("success");
        setMessage("Welcome back!");

        if (preferences?.onboarding_completed) {
          router.push("/");
        } else {
          router.push("/onboarding");
        }
      }
    } catch (error) {
      setMessageType("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    setLoading(true);
    setMessage("");
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setMessageType("success");
      setMessage("You've signed out successfully.");
    } catch (error) {
      setMessageType("error");
      setMessage(error instanceof Error ? error.message : "Unable to sign out. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setMessage("");
    setEmailTouched(false);
    setEmailError("");
    setPasswordTouched(false);
    setConfirmPassword("");
    setConfirmPasswordTouched(false);
    setConfirmPasswordError("");
    setShowPassword(false);
    setShowConfirmPassword(false);
  }

  return (
    <main className="discoverly-auth-page">
      <div className="auth-glow auth-glow-one" aria-hidden="true" />
      <div className="auth-glow auth-glow-two" aria-hidden="true" />

      <header className="auth-topbar">
        <Link href="/" className="auth-wordmark">Discoverly<span>.</span></Link>
        <Link href="/" className="auth-back-link">← Back to discover</Link>
      </header>

      <section className="auth-layout">
        <div className="auth-intro">
          <div className="auth-eyebrow"><span /> A BETTER WAY TO DISCOVER</div>
          <h1>Follow your curiosity.<br /><em>Find your next favorite.</em></h1>
          <p className="auth-intro-copy">A personal space for ideas, stories, and videos worth your time. Sign in to make your Discoverly experience yours.</p>
          <div className="auth-feature-list">
            <div className="auth-feature"><span className="auth-feature-icon">✦</span><div><strong>Discover with purpose</strong><p>Explore ideas across the topics you care about.</p></div></div>
            <div className="auth-feature"><span className="auth-feature-icon">♡</span><div><strong>Keep the good finds</strong><p>Build a collection of videos you want to revisit.</p></div></div>
          </div>
          <div className="auth-orbit-art" aria-hidden="true"><div className="orbit orbit-a" /><div className="orbit orbit-b" /><div className="orbit-center">d<span>.</span></div><span className="orbit-dot orbit-dot-a" /><span className="orbit-dot orbit-dot-b" /></div>
        </div>

        <div className="auth-card-wrap">
          <div className="auth-card">
            {userEmail ? (
              <div className="auth-signed-in">
                <div className="auth-success-mark">✓</div>
                <div className="auth-card-eyebrow">ACCOUNT READY</div>
                <h2>You&apos;re signed in.</h2>
                <p className="auth-card-description">Your Discoverly account is connected as:</p>
                <div className="auth-user-email">{userEmail}</div>
                <Link href="/" className="auth-submit-button auth-home-button">Explore Discoverly <span>→</span></Link>
                <button className="auth-logout-button" onClick={handleLogout} disabled={loading}>{loading ? "Signing out…" : "Sign out"}</button>
                {message && <p className={`auth-message ${messageType}`} role="status">{message}</p>}
              </div>
            ) : (
              <>
                <div className="auth-card-eyebrow">YOUR DISCOVERLY ACCOUNT</div>
                <h2>{mode === "login" ? "Welcome back" : "Make yourself at home"}</h2>
                <p className="auth-card-description">{mode === "login" ? "Pick up where your curiosity left off." : "Create an account and start collecting good finds."}</p>

                <div className="auth-tabs" role="tablist" aria-label="Choose login or sign up">
                  <button type="button" role="tab" aria-selected={mode === "login"} className={mode === "login" ? "active" : ""} onClick={() => switchMode("login")}>Log in</button>
                  <button type="button" role="tab" aria-selected={mode === "signup"} className={mode === "signup" ? "active" : ""} onClick={() => switchMode("signup")}>Sign up</button>
                </div>

                <form className="auth-form" onSubmit={handleSubmit}>
                  <label htmlFor="auth-email">Email address</label>
                  <div className="auth-input-wrap"><span aria-hidden="true">✉</span><input id="auth-email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={event => { setEmail(event.target.value); if (emailTouched) setEmailError(getEmailError(event.currentTarget)); }} onBlur={event => { setEmailTouched(true); setEmailError(getEmailError(event.currentTarget)); }} onInvalid={event => { setEmailTouched(true); setEmailError(getEmailError(event.currentTarget)); }} aria-invalid={Boolean(emailError)} aria-describedby={emailError ? "auth-email-error" : undefined} required /></div>
                  {emailTouched && emailError && <p className="auth-field-error" id="auth-email-error">{emailError}</p>}

                  <div className="auth-password-label"><label htmlFor="auth-password">Password</label>{mode === "signup" && <span>Meet all 5 requirements</span>}</div>
                  <div className="auth-input-wrap"><span aria-hidden="true">⌑</span><input id="auth-password" type={showPassword ? "text" : "password"} autoComplete={mode === "signup" ? "new-password" : "current-password"} placeholder={mode === "signup" ? "Create a password" : "Enter your password"} value={password} onChange={event => { const value = event.target.value; setPassword(value); if (confirmPasswordTouched) setConfirmPasswordError(getConfirmPasswordError(confirmPassword, value)); }} onInvalid={() => setPasswordTouched(true)} aria-invalid={mode === "signup" && passwordTouched && passwordScore < passwordRequirements.length} aria-describedby={mode === "signup" ? "auth-password-feedback" : undefined} required /><button className="auth-password-toggle" type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? "Hide" : "Show"}</button></div>
                  {mode === "signup" && (
                    <div className="auth-password-feedback" id="auth-password-feedback">
                      <div className="auth-strength-heading"><span>Password strength</span><strong className={`auth-strength-label ${strengthClass}`}>{passwordStrength}</strong></div>
                      <div className="auth-strength-meter" role="meter" aria-label="Password strength" aria-valuemin={0} aria-valuemax={5} aria-valuenow={passwordScore}>
                        <span className={`auth-strength-fill ${strengthClass}`} style={{ width: `${passwordScore * 20}%` }} />
                      </div>
                      <ul className="auth-password-requirements">
                        {passwordChecks.map(({ label, met }) => <li className={met ? "met" : ""} key={label}><span aria-hidden="true">{met ? "✓" : "○"}</span>{label}</li>)}
                      </ul>
                    </div>
                  )}

                  {mode === "signup" && (
                    <>
                      <label htmlFor="auth-confirm-password">Confirm password</label>
                      <div className="auth-input-wrap"><span aria-hidden="true">⌑</span><input id="auth-confirm-password" type={showConfirmPassword ? "text" : "password"} autoComplete="new-password" placeholder="Confirm your password" value={confirmPassword} onChange={event => { const value = event.target.value; setConfirmPassword(value); if (confirmPasswordTouched) setConfirmPasswordError(getConfirmPasswordError(value)); }} onBlur={() => { setConfirmPasswordTouched(true); setConfirmPasswordError(getConfirmPasswordError(confirmPassword)); }} onInvalid={() => { setConfirmPasswordTouched(true); setConfirmPasswordError(getConfirmPasswordError(confirmPassword)); }} aria-invalid={Boolean(confirmPasswordError)} aria-describedby={confirmPasswordError ? "auth-confirm-password-error" : undefined} required /><button className="auth-password-toggle" type="button" onClick={() => setShowConfirmPassword(value => !value)} aria-label={showConfirmPassword ? "Hide confirmation password" : "Show confirmation password"}>{showConfirmPassword ? "Hide" : "Show"}</button></div>
                      {confirmPasswordTouched && confirmPasswordError && <p className="auth-field-error" id="auth-confirm-password-error">{confirmPasswordError}</p>}
                      {confirmPasswordTouched && !confirmPasswordError && confirmPassword && <p className="auth-field-success">Passwords match.</p>}
                    </>
                  )}

                  <button className="auth-submit-button" type="submit" disabled={loading}>{loading ? <><span className="auth-spinner" /> Please wait…</> : <>{mode === "signup" ? "Create my account" : "Log in to Discoverly"}<span>→</span></>}</button>
                </form>

                {message && <p className={`auth-message ${messageType}`} role="status" aria-live="polite">{message}</p>}
                <p className="auth-terms">Your account helps make your discovery experience personal.</p>
              </>
            )}
          </div>
          <p className="auth-switch-note">{mode === "login" && !userEmail ? <>New to Discoverly? <button onClick={() => switchMode("signup")}>Create an account</button></> : mode === "signup" && !userEmail ? <>Already have an account? <button onClick={() => switchMode("login")}>Log in</button></> : <>Made for the endlessly curious.</>}</p>
        </div>
      </section>
      <footer className="auth-footer"><span>© {new Date().getFullYear()} Discoverly</span><span>Find videos worth your time.</span></footer>
    </main>
  );
}
