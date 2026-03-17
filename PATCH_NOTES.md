# Orin AI — Production Patch Notes

## Files Changed: 4

```
services/casSteps.ts            ← CRITICAL crash fix + full rewrite
services/casService.ts          ← Safety fixes + solveEquations guard
components/MathsMode.tsx        ← AI→CAS pipeline rewrite, original UI kept
api/create-checkout-session.js  ← CRITICAL payment crash fix
```

---

## 🔴 Critical Bug Fixes (were crashing the app)

### 1. `services/casSteps.ts` — `args` used instead of `opArgs`

**File:** `services/casSteps.ts`, function `diffWithSteps`, operator `'add'` branch  
**Bug:**
```typescript
// BEFORE (crashes):
if (fn === 'add') {
  const [u, v] = args;  // `args` was NEVER defined — always ReferenceError
```
```typescript
// AFTER (fixed):
if (fn === 'add') {
  const [u, v] = opArgs;  // `opArgs` is the actual operator arguments array
```
**Impact:** Every differentiation of a sum (e.g. `x² + 3x + 2`, `sin(x) + cos(x)`) crashed with
`ReferenceError: args is not defined`. Since almost every real expression is a sum, this meant
the entire local step-by-step differentiation was broken.

---

### 2. `services/casSteps.ts` — duplicate `const evalAt` (SyntaxError in strict mode)

**File:** `services/casSteps.ts`, function `solveEquationWithSteps`  
**Bug:**
```typescript
// BEFORE — evalAt declared twice with `const` in the same function scope:
const evalAt = (x: number) => { ... };   // first declaration
...
const evalAt = (x: number) => { ... };   // second declaration → SyntaxError / TDZ crash
```
**Fix:** Merged into a single function with the correct logic.

---

### 3. `api/create-checkout-session.js` — `stripe` used but never created

**File:** `api/create-checkout-session.js`  
**Bug:**
```javascript
// BEFORE — stripe used without instantiation:
const session = await stripe.checkout.sessions.create({ ... });
// ↑ ReferenceError: stripe is not defined
```
```javascript
// AFTER — properly instantiated:
const stripe = new Stripe(secret);
const session = await stripe.checkout.sessions.create({ ... });
```
**Impact:** Every checkout/upgrade attempt threw a ReferenceError. Payments completely broken.

---

## 🟡 Math Mode — AI→CAS Pipeline Rewrite

### Original problems
- Text mode used `geminiService.extractMathFromInput` but if CAS returned no steps for `factor`/`expand`, it
  silently fell through without sending anything to AI. User saw no result.
- Image mode went to AI with just a description prompt, losing extracted expression.
- No feedback to user during AI extraction (spinner/status message).
- MathLive element `.smartMode = true` assignment was attempting to set a non-standard property.

### What was fixed

**New pipeline for text input:**
```
User types "find the integral of x squared plus 3"
  → geminiService.extractMathFromInput(text)
  → { latexExpression: "x^2+3", operation: "integrate", variable: "x" }
  → casService.integralWithSteps("x^2+3", "x")
  → Display numbered step card
  → If CAS fails: onSend(structured AI prompt with extracted expression)
```

**New pipeline for image input:**
```
User uploads photo of equation
  → geminiService.extractMathFromInput(undefined, fileData)
  → { latexExpression: "...", operation: "solve", ... }
  → casService.solveEquationWithSteps(expr, var)
  → Display step card  OR  fallback to AI with extracted expression
```

**AI extraction status indicator** — small banner shows "Reading image with AI…" / "Solving: expr"  
**Fallback guaranteed** — if CAS fails at any point, prompt always goes to AI with the extracted expression  
**Original UI completely preserved** — categories, tools, matrix grid, MathLive field all unchanged

---

## 🟢 `services/casService.ts` Safety Fixes

### `solveEquations` — nerdamer.solveEquations may not exist

```typescript
// BEFORE — crashes if nerdamer build doesn't include solveEquations:
const sol = (nerdamer as any).solveEquations(converted, vars);

// AFTER — guarded:
if (typeof nerd.solveEquations !== 'function') {
  return { error: 'System solve not available; try individual equations' };
}
```

### `evaluateRHSAt` / `getFunctionRHS` — self-referencing via `this`

These methods used `this.getFunctionRHS(...)` which is safe when called as
`casService.evaluateRHSAt(...)` but breaks if destructured. Refactored to call
`casService.getFunctionRHS(...)` directly (explicit reference) for safety.

---

## How to Apply

**Drop-in replacement** — replace these 4 files. No other changes needed.
No new dependencies. All imports/exports remain identical.

```
services/casSteps.ts
services/casService.ts
components/MathsMode.tsx
api/create-checkout-session.js
```
