# Orin AI

**A sophisticated, bilingual smart workspace built for the modern Sri Lankan professional.**

Featuring high-speed neural reasoning (Sinhala/English/Tamil), creative synthesis, real-time voice, math solving, agent mode, and secure cloud synchronization — powered by the Gemini API.

**Author:** Januth Nimnal — nimnaljanuth@gmail.com

---

## Features

- **Chat** — Bilingual AI chat (Sinhala · English · Tamil) with memory, private mode, semantic search
- **Math Solver** — Step-by-step solutions (Symbolab-style), image input, handwriting recognition
- **Agent Mode** — Computer-use AI agent *(Pro plan)*
- **Music Studio** — AI music generation with BPM, scale, and density controls
- **Live Vision** — Real-time multimodal camera analysis
- **Voice Assistant** — Native audio AI with translation
- **Studio** — AI creative content generation

## Plan Tiers

| Feature | Free | Basic | Pro |
|---|---|---|---|
| Model | Gemini 2.0 Flash | Gemini 2.5 Flash | Gemini 2.5 Pro |
| Context | 5 messages | 10 messages | 20 messages |
| Agent mode | ✗ | ✗ | ✓ |

## Setup

```bash
npm install
npm run dev
```

## Environment Variables

```
VITE_FIREBASE_*        # Firebase config
STRIPE_SECRET_KEY      # Stripe secret key
STRIPE_WEBHOOK_SECRET  # Stripe webhook signing secret
FIREBASE_SERVICE_ACCOUNT_JSON  # Firebase admin (for webhook)
VITE_RECAPTCHA_SITE_KEY        # Optional App Check
```

## Deploy

Deployed on Vercel. Set env vars in Vercel project settings.

For Stripe webhooks, add endpoint `https://your-domain.com/api/stripe-webhook` in Stripe Dashboard with events: `checkout.session.completed`, `customer.subscription.deleted`, `customer.subscription.updated`, `invoice.payment_failed`.
