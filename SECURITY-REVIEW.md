# Discoverly Password Recovery Review

Review date: 2026-11-03

Scope: Batch 1 password recovery callback and reset page. This was a
read-only code review; no live recovery email or password update was performed.

## Findings

| # | Severity | File and lines | Finding | Confidence |
|---|----------|----------------|---------|------------|
| 1 | LOW | `app/auth/callback/route.ts:43-48`; `app/auth/reset-password/page.tsx:15-22` | The recovery marker is an unsigned cookie containing the user ID. The callback also treats the caller-provided `flow=recovery` parameter as the recovery-flow signal after exchanging a valid PKCE code; it does not independently establish that the code came from a password-recovery event. The reset page requires the marker to match the currently authenticated user, so this does not let one account use another account's session. However, an authenticated user can supply their own user ID as the cookie value, bypassing the intended recovery-only page gate for that account. | 8/10 |
| 2 | LOW | `app/auth/reset-password/password-reset-form.tsx:128-134`; `app/auth/callback/route.ts:43-49` | After a successful password update, the form signs out but does not clear the HttpOnly recovery marker. The marker remains usable for up to 15 minutes. If the same user signs in again during that interval, the server page sees a matching marker and session and accepts the ordinary session as a recovery session. A session mismatch or expired session also does not proactively clear the marker; its cookie lifetime eventually expires. | 9/10 |

These are recovery-flow integrity issues for the same authenticated account,
not findings that permit cross-account access. The marker's user-ID comparison
is an important account boundary, but an unsigned client cookie is not proof
that a recovery transaction is active.

## Other review notes

- The callback accepts a PKCE `code`, requires `flow=recovery`, exchanges the
  code through the existing cookie-aware Supabase server client, and redirects
  to a fixed internal path. Callback parameters cannot select an external
  redirect destination.
- The marker is HttpOnly, SameSite=Lax, Secure in production, scoped to `/`,
  and assigned a 15-minute `Max-Age`. Missing/invalid callback inputs clear it
  with `Max-Age=0`. Browser cookie expiration is enforced, but the reset page
  does not explicitly clear a marker when its session check fails.
- The reset page requires a matching authenticated user. The browser form
  checks the same user again before `updateUser({ password })`. Passwords are
  held in component state only, are not logged or persisted, and are cleared
  after a successful update.
- The callback and reset form show generic failures rather than exposing
  authentication details. The callback catches unexpected failures and
  redirects to the invalid-link screen without server-side diagnostics.
- `supabase.auth.signOut()` defaults to global scope in the installed Supabase
  Auth client. This can sign the user out on other devices as well as ending
  the current recovery session; confirm that this is the desired product
  behavior.
- The reset page uses the existing authentication stylesheet and its desktop,
  tablet, and mobile breakpoints. No visual browser test was performed.
- The full ESLint command scans `.next.backup-20261103-151254` because
  `eslint.config.mjs` globally ignores `.next/**`, but not the separately named
  backup directory. `.gitignore` does not configure ESLint traversal. Excluding
  this generated snapshot from lint does not change application behavior; it
  can be excluded for a one-off run with
  `npx eslint . --ignore-pattern ".next.backup-20261103-151254/**"`.
- A production build was not run during review because project Next.js
  development/production server processes were active. Stop them normally in
  their owning terminals with Ctrl+C, verify no project-specific Next.js
  processes remain, then run `npm run build`. The build writes `.next`; it does
  not require deleting the retained backup.

## Readiness and follow-up

Batch 1 is not yet ready for recovery end-to-end testing because the recovery
marker is not cleared after success and is not a reliable recovery-event
proof. Before Batch 2, replace the user-ID-only marker with a short-lived,
integrity-protected recovery transaction tied to the exchanged user, and
invalidate it after password update and when the session check fails. Verify
the reset-email redirect URL and template in Supabase before integration.

No Supabase dashboard settings were inspected or changed. No recovery email
was received and no password update was tested. End-to-end behavior remains
unverified.
