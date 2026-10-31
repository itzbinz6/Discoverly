"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "../../lib/supabase/client";
import "./auth.css";

type AuthMode = "login" | "signup";

export default function AuthPage() {
  const [supabase] = useState(() => createClient());
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "info">("info");
  const [loading, setLoading] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

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
          setMessage("Your account has been created. You're signed in!");
        } else {
          setMessageType("info");
          setMessage("Account created. Check your email if confirmation is required.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        setMessageType("success");
        setMessage("Welcome back! You're signed in.");
      }
    } catch (error) {
      setMessageType("error");
      setMessage(error instanceof Error ? error.message : "Something went wrong. Please try again.");
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
                <h2>You're signed in.</h2>
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
                  <div className="auth-input-wrap"><span aria-hidden="true">✉</span><input id="auth-email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={event => setEmail(event.target.value)} required /></div>

                  <div className="auth-password-label"><label htmlFor="auth-password">Password</label>{mode === "signup" && <span>6+ characters</span>}</div>
                  <div className="auth-input-wrap"><span aria-hidden="true">⌑</span><input id="auth-password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} placeholder={mode === "signup" ? "Create a password" : "Enter your password"} minLength={6} value={password} onChange={event => setPassword(event.target.value)} required /></div>

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
