# IMPLEMENTATION PROMPT — Orin AI Desktop Auth & Traffic Flow

You are a senior full-stack engineer working on the **Orin AI desktop experience**.
Everything below is self-contained: the current state of the system, exactly what to
build, and the acceptance tests that prove it works. Do not skip the security rules.

---

## 1. CURRENT STATE (what already exists and MUST NOT break)

Repo: `github.com/Januth1234/Orin-AI` (website + API + Electron shell in `pc-app/`).
Deployed on Vercel. Backend = Vercel functions under `api/` with shared lib `api/_lib/`.
Auth today:

- **Password accounts** exist: `api/auth/password.js`
  - `POST /api/auth/password` with `action:'register'` → body `{name, identifier, password}`
    where `identifier` is an email OR a phone number (E.164-normalized, Sri Lankan formats supported).
    Returns `{customToken}`; client signs in with `signInWithCustomToken`.
  - `action:'login'` → `{identifier, password}` → `{customToken}`.
  - `action:'set-password'` (Bearer auth) → adds a password to an existing account.
  - scrypt hashing (`api/_lib/passwords.js`), identifier lookups in Firestore collection
    `auth_identifiers/{email:<addr>|phone:<e164>}`, credential hashes in
    `password_credentials/{uid}` — both denied to clients by `firestore.rules`.
  - Rate limiting: `api/_lib/ratelimit.js` (Firestore-backed fixed windows).

- **Desktop device flow (browser login)** exists end-to-end:
  - `api/auth/device.js`: `action:'start'` → `{device_code, user_code, verify_url}`;
    `action:'approve'` (Bearer ID token, from the website) approves; `action:'token'`
    polls and returns `{custom_token}` once approved. Codes are single-use, 10-min TTL.
  - Web approval page: `components/DeviceAuthPage.tsx` at route `#device-auth?code=XXXX-XXXX`.
  - Electron (`pc-app/main.js` + `preload.js`): IPC `browserLogin` opens the system
    browser at the approval URL and polls until approved. Exposed as
    `window.orinDesktop.browserLogin()`.
  - `AccountSettings.tsx` shows a "Sign in with your browser" button in the desktop shell.

- **Admin panel / LLM router** is a SEPARATE deployed instance
  (`github.com/Januth1234/Orin-Router`, OmniRoute-based, 4-factor admin gate — DO NOT touch it).
  The website routes chat/agent text through it when env vars are set:
  `ROUTER_BASE_URL`, `ROUTER_API_KEY` (see `api/chat.js` → `callOpenRouter()`),
  with automatic failover to direct OpenRouter. Media modes stay Gemini-direct.

- **Traffic rule**: EVERY authenticated request from the app/site carries the user's
  Firebase ID token (`Authorization: Bearer …`). Chat goes
  `desktop/web UI → api/chat.js → Orin-Router instance (/v1/chat/completions)`.

---

## 2. PRODUCT DECISIONS YOU ARE IMPLEMENTING (owner's orders)

1. **No Google sign-in anywhere.** Orin AI accounts are the ONLY way to sign in.
   Remove the Google button and all Google-login branches from the sign-in UI
   (server code may remain dormant; do not delete `firebaseService.loginWithGoogle`
   internals used elsewhere, but no UI entry point may remain).
2. **Registration collects ALL of**: Name, Email, Phone number, Password,
   Re-entered password. Both email AND phone become REQUIRED identifiers of the
   account (today's backend accepts only one — extend it).
3. **Login requires**: Email OR Phone number (treat phone as the "username") + Password.
4. **Password reset requires identity proof**: Name + Email + Phone number.
   If all three match the account, the user may set a new password (with re-enter).
   No email/SMS OTP — this knowledge check IS the gate per owner spec. Compensate
   with strict rate limiting (below) and generic errors.

---

## 3. BACKEND WORK — `api/auth/password.js`

Extend the existing file. Keep response envelope `{customToken?, ...}` and error style
`{error: "…"}` from `_lib/http.js`. Use `api/_lib/identity.js`,
`api/_lib/passwords.js`, `api/_lib/ratelimit.js`.

### 3.1 `action:'register'` — NEW shape

Request: `{name, email, phone, password, confirmPassword}`
(keep backward compat: if `email`/`phone` absent but legacy `identifier` present,
map it to the matching field so old clients don't hard-break during transition).

Rules:
- `namePolicyError(name)` must pass.
- `normalizeIdentifier(email)` must yield type `'email'`; `normalizeIdentifier(phone)`
  must yield type `'phone'`. Reject otherwise with clear field-level messages.
- `password === confirmPassword` (case-sensitive compare server-side too).
- `passwordPolicyError(password)` must pass (≥8 chars, letters + numbers).
- Uniqueness: NEITHER identifier may belong to any account.
  Lookup docs live at `auth_identifiers/email:<lower>` and `auth_identifiers/phone:<e164>`.
  If taken → `409` with a message telling the user to sign in instead
  ("An account with this email already exists." / same for phone).
- Creation order (all-or-nothing):
  1. `admin.auth().createUser({email, password: <random unusable>, displayName: name})`
     — logins NEVER use Firebase's provider; they go through this endpoint.
  2. `password_credentials/{uid}`: `{hash, identifierType:'email', email, phone, …}`.
  3. BOTH lookup docs (`email:` and `phone:`) → `{uid}`.
  4. `users/{uid}` profile doc: `{name, email, phone, plan:'free', role:'visitor', …}`
     (mirror `syncUserSession` defaults in `services/firebaseService.ts`).
  5. On ANY failure after createUser → delete the orphan Auth user and return the error.
- Response: `{customToken, user:{id, name, email, phone}}`.
- Rate limit: `rateLimit('auth-register:'+ip, 10, 1h)` (already the pattern).

### 3.2 `action:'login'` — unchanged contract

`{identifier, password}` where identifier matches either lookup family.
Lookup order: try `email:<normalized>` then `phone:<normalized>`; first hit wins.
Keep the existing per-identifier (10/15min) and per-IP (30/h) limits and the
generic `"Invalid credentials"` message (never reveal whether the account exists).

### 3.3 NEW `action:'reset-verify'`

Request: `{name, email, phone}`.
- Rate limits (STRICT — this is the weakest gate by design):
  `rateLimit('reset-ip:'+ip, 5, 15min)` AND `rateLimit('reset-id:'+identifierKey(email), 5, 60min)`.
- Load uid via the EMAIL lookup only. Then load `users/{uid}` AND
  `password_credentials/{uid}` and verify ALL of:
  - stored `users.name` ≈ provided name (case-insensitive, trimmed compare)
  - normalized email equals the account email
  - normalized phone equals the account phone (digits-only compare)
  Use constant-time compares where practical; on ANY mismatch return ONE generic:
  `401 {"error":"The details do not match our records."}` — never say which field failed.
- On success: generate `crypto.randomBytes(32).toString('hex')` reset token; store
  SHA-256(token) in Firestore `password_resets/{sha256hex}` with
  `{uid, expiresAt: now+15min, used:false}`. Return `{resetToken}` (raw, shown once).
- Collection `password_resets/**` must be added to `firestore.rules` as deny-all
  (same pattern as `password_credentials`). Update `firestore.rules` accordingly.

### 3.4 NEW `action:'reset-confirm'`

Request: `{resetToken, password, confirmPassword}`.
- Hash the incoming token, load `password_resets/{hash}`; reject if missing,
  `used:true`, or expired (`410 {"error":"Reset request expired. Start again."}`).
- Validate password policy + match; `verifyPassword` must NOT equal the old hash
  (reuse allowed only if you cannot cheaply compare — prefer rejecting identical reuse).
- Transaction: update `password_credentials/{uid}.hash` with the new scrypt hash,
  mark reset doc `{used:true}`, delete ALL other outstanding reset docs for this uid
  (query `where('uid','==',uid)`), and revoke sessions:
  `admin.auth().revokeRefreshTokens(uid)` so stolen sessions die with the reset.
- Response: `{ok:true}` — client redirects to login.

### 3.5 Firestore rules (`firestore.rules`) — add:

```
match /password_resets/{docId} {
  allow read, write: if false;
}
```

---

## 4. FRONTEND WORK — website pages rendered INSIDE the desktop app

All in `components/OrinAuthPanel.tsx` (rewrite) + `components/AccountSettings.tsx`.

### 4.1 Three tabs: **Sign In | Create Account | Forgot Password**

**Create Account** (default for guests):
Fields: Full Name · Email · Phone number · Password · Re-enter Password.
Client-side validation mirrors server rules (email regex, phone digits ≥9≤15 after
normalization, ≥8 chars letters+numbers, passwords match). Show requirements inline
BEFORE submit. Field-level errors from server map back to the right input.
On success (`customToken`) → `signInWithCustom` → normal signed-in flow runs.

**Sign In**:
Fields: "Email or phone" (single input, auto-detected server-side) + Password +
"Forgot password?" link (switches tab). On success → signed-in flow.
Show remaining-attempt hint ONLY when the API explicitly returns one; otherwise
show generic error. Never invent attempt counts client-side.

**Forgot Password** (two steps, clearly numbered):
Step 1 — Name, Email, Phone number → `reset-verify`. On failure show the generic
message and a cooldown notice if 429. On success store `resetToken` IN MEMORY ONLY
(never localStorage) and advance.
Step 2 — New password + Re-enter → `reset-confirm`. Success → message
"Password updated. Sign in with your new password." → switch to Sign In tab.

### 4.2 Remove Google everywhere in auth UI
Delete the Google button, its divider, and its handler wiring from
`AccountSettings.tsx`'s signed-out card. The desktop "Sign in with your browser"
button stays and becomes the PRIMARY desktop affordance (it simply opens THIS
panel in the system browser). LandingPage guest-limit prompt (`showLoginPrompt`)
must also point to the Orin-account flow only — audit every `loginWithGoogle`
call site and remove/replace it.

### 4.3 Desktop shell specifics (`window.orinDesktop`)
- In the desktop shell, the signed-out card leads with "Sign in with your browser"
  (`orinDesktop.browserLogin()` → custom token → `signInWithCustom`) followed by a
  subtle "Create an account" link that ALSO goes through the browser flow
  (open the same URL with `#account` so registration happens in the browser where
  the session persists, then approval completes instantly).
- After sign-in, the existing one-click PC pairing (`ExecutorControllerPage` +
  `window.orinDesktop.registerAgent`) must still fire automatically — do not regress it.
- Add a tray menu item "Sign in…" calling the same IPC (nice-to-have).

---

## 5. TRAFFIC FLOW TO VERIFY (must hold after your changes)

```
[Desktop app] --browser device-flow--> [orinai.org login form] --> Firebase custom token
[Desktop app renderer] --Bearer ID token--> /api/chat.js --ROUTER_BASE_URL--> [Orin-Router admin instance]
                                                     \--failover--> openrouter.ai direct
[PC agent] --HMAC long-poll--> /api/executor/*  (unchanged)
```

No chat request may bypass authentication. No provider keys reach the client.
Do not modify the Orin-Router repo or its gate.

---

## 6. SECURITY CHECKLIST (hard requirements)

- Generic auth errors everywhere; no user-enumeration signals (register is the one
  exception where "already exists" is acceptable product UX).
- Reset tokens: server-side random ≥256-bit, stored HASHED, single-use, 15-min TTL,
  revoked on use; all sessions invalidated after reset.
- Every new action rate-limited via `_lib/ratelimit.js` (numbers above are minimums).
- New collections denied to clients in `firestore.rules`.
- No secrets/tokens in localStorage; reset token lives in React state only.
- Confirm-password comparison happens server-side too (never trust the client).
- Keep compact-JSON HMAC compatibility in any agent-related code you touch
  (Python clients sign `json.dumps(..., separators=(",",":"))` — never change serialization).

---

## 7. ACCEPTANCE TESTS (run all before declaring done)

1. Register A (Name/Email/Phone/Pass×2) → signed in; Firestore shows BOTH lookup docs
   pointing to the same uid.
2. Logout → login with EMAIL + password ✓; logout → login with PHONE + password ✓.
3. Register again with A's email → 409; with A's phone → 409; mismatched confirms → inline error.
4. Forgot password with WRONG name → generic error; wrong phone → generic error.
5. Correct name+email+phone → reset token → set new password → login with old password FAILS,
   new password WORKS, and pre-reset sessions are dead (revoke check).
6. Reset token reuse → rejected; expiry (mock clock) → 410.
7. Desktop: fresh Electron profile → "Sign in with browser" → approve in browser →
   app signed in; one-click pairing connects the local agent; send one chat message and
   confirm it appears in the Orin-Router dashboard analytics (ROUTER_BASE_URL set).
8. Router instance stopped → chat still answers (OpenRouter failover logged).
9. `npm run build` ✓, `npx tsc --noEmit` ✓, no console errors on the auth screens.
10. No Google UI remains anywhere (grep `loginWithGoogle`, `Continue with Google`).

Deliver with: files changed, test results per item above, and any deviations flagged.
