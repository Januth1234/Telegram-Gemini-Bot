# Changelog

All notable changes to Orin AI. Format: date — change (reason).

## 2026-08-23 (pass 2) — Backend unification, broken features restored, deprecations

### CRITICAL discovery fixed: 9 chat modes were dead in production
The OpenRouter migration commit replaced the multi-mode backend with a slim text-only proxy, but the
frontend still sends `image`, `video`, `tts`, `embed`, `code`, `url`, `research`, `math-extract`,
`computer-use` and `agent-plan` modes to `/api/chat`. Every one of those fell through to plain
text chat — image/video/TTS generation and semantic search were silently broken.
**Restored all modes server-side** with capability-based provider routing:
- Text modes (chat / title / memory-update / math / math-extract / agent-plan) → **OpenRouter**
- Media + tool modes (image / video Veo / TTS / embeddings / code-execution / url-context /
  google-search research / computer-use) → **Google Gemini API** (`GEMINI_API_KEY`, legacy
  `API_KEY` accepted). These tool surfaces are Gemini-exclusive; OpenRouter cannot serve them.

### Server-side quota enforcement (was client-only)
Daily text limits per plan + rolling 30-day image/video windows are now enforced in `/api/chat`
itself, with authoritative usage increments after each success. The old enforcement lived entirely
in browser localStorage — trivially bypassable. Client counters remain for display only.

### One backend: Firebase Cloud Functions retired
`functions/index.js` was a parallel deployment that could not even be rebuilt from this repo (no
firebase.json). Its four callables are now REST actions on **`/api/admin`** with custom-claim role
checks (approve-user → owner-only, generate-api-key → devops/owner, ocr → training+, signup request
→ any user + daily rate limit), audit logging preserved, hardcoded secret-code fallback removed.
`services/firebaseService.ts` calls REST instead of `httpsCallable`; the `firebase/compat/functions`
SDK import is gone; **`functions/` directory deleted** — the entire backend is now one Vercel
deployment.

### Executor channel efficiency: long-polling
`POST /agent/jobs/next` accepts `wait` (≤25 s) and holds the request open until a job is due,
cutting idle polling from ~28,800 to ~4,300 requests/day per paired PC (~8×). Python clients send
`wait=20`; legacy agents without the param behave exactly as before. Verified compact-JSON HMAC
compatibility maintained.

### Scheduled maintenance (`/api/maintenance`, Vercel Cron daily 03:00 UTC)
Purges data that previously grew forever: expired rate-limit windows, executor nonces >7 d,
finished executor jobs >30 d, pair attempts stuck 'pending' >24 h (active pairs untouched),
legacy broker rows >90 d. Auth via `CRON_SECRET`. Wired through new `crons` entry in vercel.json.

### Observability
Every API response carries `x-request-id` (echoed from callers when present); each request emits
one structured JSON log line (level, requestId, method, path, status, ms) — greppable in Vercel
logs; error responses include the requestId for support triage. *(api/_lib/http.js)*

### Deprecated / removed (verified unused before deletion)
- `functions/` — retired Cloud Functions deployment (replaced by /api/admin)
- `mobile-app/` — empty Capacitor scaffold: no native projects, README claimed unimplemented
  features; site already works in mobile browsers and as a WebView
- `scripts/strip-cursor-*` (AI-tooling junk), `scripts/testFlow.js` (tested the retired functions)
- `services/mathAccessibility.ts`, `hooks/useMathHistory.ts`, `hooks/useKeyboardShortcuts.ts`,
  `utils/audio.ts` — zero importers
- root `sitemap.xml` — inert duplicate of public/sitemap.xml

### Owner checklist additions (Vercel env vars)
| Variable | Why |
|---|---|
| `GEMINI_API_KEY` | **REQUIRED for image/video/TTS/embeddings/research/code-exec/computer-use** |
| `CRON_SECRET` | enables the daily maintenance cron |
| `ORIN_SECRET_CODE` | optional; re-provisions the signup bypass code safely |

## 2026-08-23 — Backend hardening, password auth, desktop sign-in, cleanup

### Security (P0 fixes)
- **Checkout requires auth** — `api/create-checkout-session.js` previously accepted a body-supplied
  `userId` from ANY caller, letting anyone mint checkout sessions attributed to another user.
  The session is now bound to the verified Firebase ID token. The fixed copy that sat at repo root
  (never deployed by Vercel) was merged in and the root duplicate deleted. `services/stripeService.ts`
  now sends the Authorization header. *(api/create-checkout-session.js, services/stripeService.ts)*
- **Hardcoded AES key removed** — `TOKEN_ENCRYPTION_KEY` fallback literal in google/spotify OAuth
  handlers let anyone with repo access decrypt stored tokens. Encryption now fails closed when the
  env var is unset. **Action for owner: set TOKEN_ENCRYPTION_KEY (32+ chars) in Vercel; rotate any
  stored Google/Spotify tokens if it was ever unset in production.** *(api/_lib/crypto.js)*
- **Signup bypass code removed** — hardcoded `#710273` devops-gate code deleted; must now be
  provisioned via functions config/env. *(functions/index.js)*
- **Chat endpoint locked down** — `title` / `memory-update` modes required no auth (free OpenRouter
  quota burn); GET leaked API-key prefix/suffix and config status. All modes now require a valid
  Bearer token and plan is read from the server-side profile instead of trusting the request body.
  *(api/chat.js)*
- **Uploads gated** — anonymous uploads to public blob storage were possible. Auth is now required,
  MIME types are allow-listed, paths namespaced per user. Note: @vercel/blob v2 only supports
  public access mode; URLs remain unlisted-but-public until the SDK supports private ACLs.
  *(api/upload-blob.js)*
- **Firestore rules tightened** — `pending_signups` was readable AND writable by every signed-in
  user (anyone could see/tamper with applicants' emails); comment update/delete had no ownership
  check; `api_keys` hashes were world-readable to signed-in users. Added deny-all for
  `password_credentials` / `auth_identifiers` / `rate_limits`. *(firestore.rules)*
- **Extension origin bypass closed** — `sender.origin.startsWith()` allowed lookalike domains
  (`orinai.org.evil.com`) and neighboring localhost ports full browser control (navigate, type,
  screenshot). Now exact-match via URL parsing; `*.vercel.app` removed from externally_connectable;
  bundled zip regenerated. *(orin-agent-extension/background.js, manifest.json)*

### New: Orin AI accounts (Name + Email-or-Phone + password)
- First-party registration/sign-in: users create an account with name + email OR phone number +
  password. Sri Lankan phone formats normalize to E.164 (+94). No SMS OTP — the phone number is a
  login identifier, not a verified channel (layer later if needed).
- Password hashing uses Node's built-in scrypt (per-user salt, timing-safe compare) — zero new
  dependencies. Hashes live in `password_credentials/{uid}`, identifier lookup indexes in
  `auth_identifiers/*`; both are client-unreadable by Firestore rules.
- Login returns a Firebase **custom token** → client `signInWithCustomToken`, so every existing
  endpoint and Firestore rule works unchanged. Brute-force limiting is Firestore-backed
  (10 fails / 15 min per identifier, 30/hour per IP) and survives serverless cold starts.
- Google users can add a password later ("Orin AI password" in Account Settings) which unlocks
  email/phone login everywhere including the desktop app.
- Frontend: new `components/OrinAuthPanel.tsx` (login ⇄ signup tabs, inline validation, loading/
  error states), integrated into the Account Settings sign-in card alongside Google. Profile tab
  gained display-name + phone editing.

### Desktop app (pc-app)
- **Sign-in inside the app now works**: the Electron window loads orinai.org where the new password
  form signs the user in without popups (Google OAuth inside Electron was broken by design — popups
  were pushed to the system browser and never returned).
- **One-click pairing**: "Pair this PC" hands pair_id + code straight to the local agent through a
  new `registerAgent` IPC bridge; the agent completes the handshake itself. Replaces manual
  code-copying; dead injected-JS shim removed.
- **Navigation hardened** — in-frame navigation restricted to orinai.org so third-party pages can
  never touch the `window.orinDesktop` bridge.
- **Agent scripts refresh on version bump** (previously stale copies ran forever after install).
- **HMAC signature bug fixed** — Python clients serialized JSON with spaces while the server signed
  Node-style compact JSON, so agent signatures could never verify. All clients now send compact JSON;
  byte-equality against `JSON.stringify` verified.
- Agent exits cleanly when a pair is revoked and re-reads state when credentials change, instead of
  erroring forever.
- Divergent agent copies unified: website download == installer payload (Spotify support preserved);
  all four copies byte-identical pairs. *(pc-app/assets/*, public/*.py)*

### Backend consolidation
- New shared foundation `api/_lib/`: single Firebase Admin bootstrap (accepts both legacy service-
  account env var names), CORS allow-list (was `Access-Control-Allow-Origin: *` everywhere),
  uniform error mapping, auth helpers, scrypt passwords, identity normalization, rate limiting.
- Migrated onto it: chat, checkout, stripe-webhook, upload-blob, files, task-router, executor,
  broker, auth/google, auth/spotify, auth/password.
- **Stripe lifecycle handled** — `customer.subscription.deleted`, `customer.subscription.updated`,
  `invoice.payment_failed` now sync plan changes/downgrades to Firestore (plans previously could
  never lapse). *(api/stripe-webhook.js)*
- **Dead second queue retired** — `/api/broker/*` writes returned success but NO consumer ever
  existed (scheduled tasks silently vanished). PC-routed dispatches now enqueue real executor jobs;
  scheduled jobs carry `notBefore` and recurring ones re-arm on completion. Broker endpoints return
  explicit 410 Gone. *(api/task-router.js, api/broker.js, api/executor.js)*
- TaskScheduler UI polls real job status after dispatch (was stuck at "queued" forever).

### Cleanup
- App.tsx: two ~90-line duplicated sign-in paths merged into one `applyUser`; service-worker message
  listener registered once with cleanup (a listener previously stacked on every sign-in).
- Deleted dead components (verified zero importers): BlogPage, ChatPreview, AboutModal, FeatureAsk,
  FeatureTranslate, FeatureVision, MathLoadingState, BotSimulator.
- Removed unused dependencies: plotly.js (duplicate of -dist-min), mathquill, lucide-react.
- Removed dev-tooling entries (vite, @vitejs/plugin-react) from the index.html importmap.
- Removed broken `_syncToFirestore` call targeting a non-existent method; BYO provider keys are
  local-only by design. Deleted never-imported services/aiRouter.ts.
- vercel.json: removed self-referential no-op rewrites.
- Purged from repo: committed `.env` (corrupted bytes, but tracked despite .gitignore), `.bak` file,
  test.txt, root duplicate checkout file, duplicate root firebase-messaging-sw.js.
  **Action for owner: scrub git history of `.env` if an older commit ever contained readable
  secrets (requires coordinated force-push).**
- Fixed pre-existing crash: `geminiService.getVoiceSystemInstruction` was called but never defined.
- Fixed type drift: `'executor'` added to `AppView` union + route tables.
- package-lock.json reconciled with package.json (pdf-parse drift).
- `.env.example` rewritten as a complete, accurate template.

### Environment variables (owner checklist for Vercel)
| Variable | Status |
|---|---|
| `TOKEN_ENCRYPTION_KEY` | **now REQUIRED** (32+ chars) |
| `FIREBASE_SERVICE_ACCOUNT` | preferred name (legacy `_JSON` alias still accepted) |
| `OPENROUTER_API_KEY`, `STRIPE_*`, `BLOB_READ_WRITE_TOKEN`, `GOOGLE_CLIENT_*`, `SPOTIFY_CLIENT_*`, `VAPID_KEY` | unchanged |

### Testing performed
- Production build passes; `tsc --noEmit` clean except pre-existing Capacitor scaffold error.
- 21 unit assertions on new pure logic: identifier normalization (SL phones/E.164/emails),
  password policy, scrypt roundtrip, AES-GCM roundtrip, HMAC helpers — all pass.
- Cross-language serialization equality (Python compact json.dumps ≡ Node JSON.stringify) verified —
  the precondition for agent HMAC verification.
- Extension origin validation tested against lookalike-domain/port/decoy-path bypasses — all blocked.
- NOT testable locally (needs deployed env): live Stripe webhook delivery, real SMS-free mobile
  flows on iOS Safari, actual paired-agent execution end-to-end. These need a Vercel deploy.
