# Orin AI

Sri Lanka's bilingual AI assistant — English, Sinhala and Tamil.

Built by **Januth Nimnal**.

## Setup

Set environment variables in Vercel project settings:

```
BLOB_READ_WRITE_TOKEN=...
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
FIREBASE_SERVICE_ACCOUNT_JSON=...
```

Stripe webhook endpoint: `https://orinai.org/api/stripe-webhook`
Event: `checkout.session.completed`

Firebase Admin access: Firebase Console → Project Settings → Service Accounts.
