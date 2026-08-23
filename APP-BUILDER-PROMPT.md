# ORIN AI — APP BUILDER MASTER PROMPT
## Free, chat-only Orin AI with Claude-grade capabilities

You are a senior full-stack engineer transforming Orin AI (`D:\Orin_AI`, Vite/React/TS +
Vercel functions under `api/`) into a **completely free, CHAT-ONLY** AI assistant whose
conversation experience matches **Claude's web app** (Artifacts, Projects, Styles, search,
sharing, editing). Work in stages, verify each stage, never break what works.

---

## 0. GROUND RULES

1. **Do NOT touch**: authentication (`api/auth/password.js`, `api/auth/device.js`,
   `OrinAuthPanel`, `DeviceAuthPage`), desktop pairing (`api/executor.js`, Python agents,
   `pc-app/`), router plumbing (`ROUTER_BASE_URL` logic in `api/chat.js` → failover),
   `api/_lib/*`, maintenance cron, firestore rules beyond what is specified here.
2. **Everything is FREE**: no plans, no quotas, no pricing UI, no Stripe, no usage counters.
3. **Chat is the only product surface.** All other consumer pages die (§1 keeps the
   exceptions the desktop app needs).
4. Verify after every stage: `npm run build`, `npx tsc --noEmit`, app boots, chat works,
   desktop sign-in still works. Commit per stage.

---

## 1. STAGE A — STRIP TO CHAT-ONLY (do this first)

### Remove views & routing
In `types.ts` (`AppView`, `WorkspaceMode`) and `App.tsx` (`VALID_VIEWS`, `WORKSPACE_VIEWS`,
`VIEW_TO_MODE`, `WORKSPACE_TO_VIEW`, lazy imports, `renderContent()`):
DELETE `'art' | 'camera' | 'voice' | 'math' | 'translator' | 'community' | 'pricing' |
'downloads' | 'releases' | 'logic' | 'creator' | 'telegram-bot' | 'admin-portal'`.
KEEP: `'landing' | 'chat' | 'account' | 'privacy' | 'terms' | 'device-auth' | 'executor'`.

### Delete components (verify zero importers before each deletion batch)
`PricingPage, DownloadsPage, ReleasesPage, LogicFlowPage, CreatorPage, TelegramBotPage,
AdminPortal, UserMgmtTab, TrainingTab, APIControls, BlogPage(if present), MathsMode,
Graphs, KatexBlock, VoiceAssistant, LiveVisionMode, VoiceToMathModal, FeatureAsk,
FeatureTranslate, FeatureVision, FeatureCreate, MusicStudio, CreationFeed, FilesWorkspace,
TaskScheduler, BotSimulator(if present), HandwritingCanvas, MathLoadingState(if present)`.

### Delete services & endpoints
- `services/stripeService.ts`; `api/create-checkout-session.js`; `api/stripe-webhook.js`;
  remove Stripe entries from `.env.example` and any vercel env documentation.
- `services/brokerClient.ts` (dead queue remnants), `services/githubReleasesService.ts`,
  `services/mathFormatting/mathErrorMessages/mathInputValidator/accessibility/solutionParser/
  casService/casSteps/graphIntentService/codeTrackerService/integrationActions` (each:
  confirm zero importers first).
- In `api/chat.js`: DELETE the media/tool mode handlers that belong to removed surfaces —
  `image`, `video`, `tts` handlers and their quota branches. KEEP `chat`, `title`,
  `memory-update`, `embed` (search), `research` (web-search reports), `code`, `url`,
  `math-extract` (used by chat UX), `computer-use`, `agent-plan` (desktop agent).
- Remove `LIMITS`, `enforceLimit`, `incrementUsage`, `loadUsage` from `api/chat.js`
  (free/unlimited) and `USAGE_LIMITS/checkLimit/incrementUsage` from
  `services/firebaseService.ts`; remove quota UI anywhere it renders.
- Remove `plan` parameter threading (getModels/getContextLimit): everyone gets the best
  chain `['google/gemini-2.0-flash-001', 'anthropic/claude-3.5-sonnet']`, context limit 20.

### Header/nav simplification (`App.tsx`)
Nav shows only: **Chat** (+ Account avatar + theme/language toggles). LandingPage hero CTA
→ open chat. Keep guest trial (5 msgs/day localStorage) or open chat freely — choose
freely-open; sign-in prompt appears on cloud-sync actions only.

### KEEP but relocate (desktop app depends on these)
- `ExecutorControllerPage`: reachable only when `window.orinDesktop` exists (desktop shell)
  or via Settings tab "PC control". Never in the public nav.
- File attachments: chat input paperclip (inline base64 path in ChatWorkspace) stays.
  The standalone Files library page dies; stop reading `localStorage['orin_file_ids']`;
  keep `api/upload-blob.js` endpoint dormant (don't call it).

---

## 2. STAGE B — RENDERING FOUNDATION (prerequisite for Artifacts)

Today messages render through a hand-rolled line parser (`MessageContent`,
ChatWorkspace.tsx:102-198) with fenced-code `<pre>` blocks, no highlighting, no copy, no
KaTeX, no media in bubbles. Replace it:

1. Add deps: `react-markdown remark-gfm remark-math rehype-katex rehype-raw highlight.js`
   (or shiki-lite). Bundle-split them into a lazy chunk.
2. New `components/chat/MarkdownMessage.tsx` replacing `MessageContent`: GFM tables,
   task lists, strikethrough, KaTeX (`$…$`/`$$…$$`), syntax-highlighted code blocks with
   language label + **copy button**, links safe (rel=noopener), images rendered
   (data: URLs included), sanitized via rehype-sanitize config.
3. Render attached images/PDF chips in BOTH user and assistant bubbles
   (`ChatMessage.imageUrl/fileName` already exist but are unrendered — fix).
4. Intercept ARTIFACTS before markdown parsing (§3 protocol) — the sentinel block must be
   pulled out of `content` BEFORE `MarkdownMessage` sees it, replaced by an ArtifactCard.

---

## 3. STAGE C — ARTIFACTS (the centerpiece)

Claude behavior replicated (source: Claude help center):

### 3.1 What qualifies
Substantial, self-contained content (>~15 lines) the user will edit/reuse: Markdown
documents · code snippets · single-page HTML apps · SVG images · Mermaid diagrams ·
interactive React components.

### 3.2 Emission protocol (server ⇄ client)
Add an `ARTIFACT PROTOCOL` section to the system instruction in `api/chat.js`
(`getSystemInstruction`, ~line 116, and appended after descriptive-style line ~291):

```
ARTIFACT PROTOCOL:
When your response contains substantial self-contained content (>15 lines) — a document,
code module, single-file HTML app, SVG image, Mermaid diagram, or React component — emit
it inside ONE fenced block tagged `artifact` immediately after a one-sentence lead-in:
```artifact id=<slug> title=<short title> kind=html|react|svg|mermaid|markdown|code language=<lang>
<complete content — never truncated, no placeholders>
```
Keep conversational text outside the block. For updates, RE-EMIT the whole artifact with
the SAME id and a one-line changelog sentence before it.
```

Parsing: in `ChatWorkspace`, before rendering, regex-extract ```artifact …``` fences from
assistant `content` into structured objects `{id,title,kind,language,content}` stored on
the message (`ChatMessage.artifacts?: Artifact[]` — extend `types.ts:33`; `getHistory`
spread already round-trips new fields safely). Multi-turn edits work because the model
sees prior conversation text including its own artifact block (history sanitizer keeps
`content` intact — verified geminiService.ts:216).

### 3.3 Artifact panel (side-by-side window)
New `components/artifacts/ArtifactPanel.tsx`:
- Desktop ≥md: docked flex column right of chat (split-pane; chat shrinks). Mobile:
  full-screen overlay with back-to-chat button. Reuse the existing slide-over drawer
  pattern (ChatWorkspace.tsx:761-817) for mobile only.
- Renders by kind:
  - `html` → `<iframe sandbox="allow-scripts allow-modals allow-popups" srcDoc={content}>`
    (first iframe in the codebase — build fresh; no CSP headers exist to fight).
  - `react` → iframe with Babel-standalone + React UMD (esm.sh) bootstrap shim that
    evals the component; show compile errors inline.
  - `svg` → render inline AND offer iframe preview; `mermaid` → lazy-load mermaid, render;
    failure → "Try fixing with Claude" button (below).
  - `markdown|code` → rendered markdown / highlighted read-only source.
- Bottom action bar (matches Claude): **View code** (toggle source overlay) · **Copy**
  · **Download** (correct extension: .html/.jsx/.svg/.mmd/.md/.txt) · version selector
  `< vN/total >` · close.
- Versioning: each re-emission with same id appends `{content, timestamp}` to the
  artifact's `versions[]`; selector browses them; latest shown by default.
- Multiple artifacts per conversation: chip row above input / in header listing all
  artifacts ("chat controls" switcher); clicking opens that one in the panel.
- **"Try fixing with Claude"**: iframe `onError` + console capture shim posts a button
  that inserts the error text into the composer as a prefilled message.
- Persistence: artifact bodies live ON THE MESSAGE in `historyBlob` (v1 acceptable);
  guard total conversation JSON ≤ 700 KB — if exceeded, strip oldest versions first and
  log. (Out-of-band storage to `users/{uid}/files` is the documented future step.)

### 3.4 Streaming (required for good UX — biggest engineering item)
Current pipeline is single-JSON end-to-end (`res.json()` at geminiService.ts:258; full
append at ChatWorkspace.tsx:487). Implement true streaming:
1. `api/chat.js` plain-chat branch: OpenRouter `stream:true`, forward SSE chunks
   (`res.setHeader('Content-Type','text/event-stream')`, `res.write`, flush; keep
   maxDuration 120 s; on fallback to direct OpenRouter stream the same way).
2. New `geminiService.chatStream(prompt, options, {onDelta, onArtifactDelta, signal})`
   reading the SSE body; keep old `chat()` for non-chat modes.
3. ChatWorkspace: append deltas into a live bubble; when an artifact fence completes,
   open/update the panel live. Cancel button uses existing abortControllerRef.
4. Title generation stays non-streaming after first exchange.

---

## 4. STAGE D — CLAUDE-GRADE CHAT FEATURES

Implement in this priority order:

**D1 Projects** (Claude: self-contained workspaces with own chat histories + knowledge
base + custom instructions; free tier gets 5 — we allow 20, everything is free):
- Firestore: `projects/{projectId}` `{ownerId, name, emoji, instructions, createdAt}`;
  `projects/{projectId}/knowledge/{fileId}` `{name, size, parsedText(≤50k), createdAt}`
  written through a new `POST /api/projects/knowledge` (reuse upload-blob parsing pattern,
  auth required, owner-only reads via rules: `allow read,write: if request.auth.uid == resource.ownerId` style checks — write explicit rules).
- UI: sidebar section "Projects" above chat history; project view = filtered conversation
  list + "Project instructions" editor + knowledge file manager (upload txt/pdf/md ≤5 MB,
  parsed server-side like getFilesText does).
- Chats created inside a project carry `conversation.projectId`; sending injects project
  instructions + top-knowledge snippets into the system instruction (same mechanism as
  current USER FILES CONTEXT, api/chat.js ~292).
- Rules addition required in `firestore.rules` (deny others, owner RW).

**D2 Styles** (response presets): Normal / Concise / Explanatory / Formal + Custom
(user-written). Store selected style per conversation (`Conversation.styleId`) and
custom styles in `users/{uid}` doc field `customStyles`. Server maps style → appended
system instruction (replaces TONE_MAP personas; keep tones available under Custom
templates). Selector = dropdown left of the input bar.

**D3 Conversation management**: rename (inline), delete (exists), duplicate, pin/favorite
(localStorage + `users/{uid}.pinnedIds`), and **Search chats** — fuzzy title/content
filter box atop sidebar + semantic option using existing `embedding` vectors
(cosine similarity client-side; embeddings already generated in App.tsx save effect).

**D4 Share chat (read-only link)**: `POST /api/share` {conversationId} → writes
`public_chats/{shareId}` `{ownerId, title, messages(sanitized, artifacts included),
createdAt}`; public GET `/api/share?id=` (no auth, rate-limited); frontend route
`#s/<shareId>` renders a frozen transcript with artifacts working (iframe sandbox same
component). Unshare deletes the doc. Rules: `public_chats` world-readable via the API
only — deny clients directly.

**D5 Edit user message & retry**: click-to-edit past user message truncates the
conversation there, restores the pre-edit version as a branch point (simple: keep
`edits[]` on conversation; regenerate answer). Claude parity: "edit creates a different
version of the conversation".

**D6 Model & thinking controls**: header dropdown listing router models
(gemini-2.0-flash / claude-3.5-sonnet / gpt-4o-mini via existing ROUTER_BASE_URL chain —
send `model` override through api/chat.js `getModels` replacement); Thinking toggle now
actually works: maps to a reasoning nudge system instruction + (if router supports)
reasoning_effort param; store per conversation (existing `thinkingMode` flag finally used).

**D7 Incognito chat**: private mode already bypasses persistence (privateMessages) —
surface it as a one-click toggle in the header with clear badge.

**D8 Memory upgrades**: keep auto-memory; add Settings section to view/edit/export/import
memory JSON (Claude parity: import/export memory).

**D9 Dictation**: Web Speech API mic button in composer (graceful unsupported hide).
Voice *mode* stays removed.

**Explicitly OUT OF SCOPE v1**: artifact publishing/remixing to public URLs, MCP-in-artifacts,
artifact persistent cloud storage, Office/Excel integrations, Skills, Claude Design.

---

## 5. STAGE E — POLISH & QA

- Empty states: new chat screen with suggestion cards (chat-only branding, trilingual
  en/si/ta via translations.ts).
- Landing page rewritten: single hero → Start chatting (guest) + Sign in.
- Console clean, no dead imports, `npm run build` ✓, `npx tsc --noEmit` ✓.
- Regression checklist per stage: register/login/reset ✓ · device-flow desktop login ✓ ·
  PC pairing in desktop shell ✓ · chat streams ✓ · artifact create→edit(v2)→download ✓ ·
  project create→knowledge→scoped chat ✓ · share link opens logged-out ✓ ·
  router-down failover ✓.
- Update `CHANGELOG.md` per stage. Update `translations.ts` keys you add/remove.

## 6. KEY FILE MAP (current state, verified)
- Send path: `ChatWorkspace.tsx:300→465` → `geminiService.chat` (:191-290) → `api/chat.js`
  plain branch (:266-331, single JSON :326).
- Renderer to replace: `MessageContent` ChatWorkspace.tsx:102-198; bubbles :682-733.
- System prompt: `api/chat.js` getSystemInstruction :102-117, assembly :290-294.
- Layout/sidebar precedent: :758-1000 (drawer :761-817; NO split-pane yet).
- State owner: App.tsx conversations (:351+) + setMessages wiring (:703-717);
  persistence firebaseService.saveHistory/getHistory (single historyBlob doc).
- Types: types.ts ChatMessage :33-44 / Conversation :46-59.
