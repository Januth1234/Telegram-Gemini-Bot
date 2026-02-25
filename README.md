
# Orin AI - Exam Assistant & Admin System

## 1. Setup
- Ensure Firebase CLI is installed: `npm install -g firebase-tools`
- Login: `firebase login`
- Initialize functions if missing: `firebase init functions`

## 2. Configuration
Set the owner UID and secret code:
```bash
firebase functions:config:set orina.owner_uid="<YOUR_ADMIN_UID>"
firebase functions:config:set orina.secret_code="#"
```

## 3. Deploy
Deploy Firestore Rules and Cloud Functions:
```bash
firebase deploy --only functions,firestore
```

## 4. Admin Access
1. Sign up on the frontend.
2. Enter the secret code `#` in the reason field.
3. Use the Owner account to approve the request via the Admin Portal.

## 5. Stripe payments (Pricing / Checkout)
- **Local:** Copy `.env.local.example` to `.env.local` and set `STRIPE_SECRET_KEY` and (for webhook) `STRIPE_WEBHOOK_SECRET`. Keep these local only; do not commit `.env.local`.
- **Production (Vercel):** Set the same env vars in the Vercel project (Settings → Environment Variables). For the webhook to update user plans, also set `FIREBASE_SERVICE_ACCOUNT_JSON` (stringified Firebase service account key from Project Settings → Service Accounts).
- **Webhook:** In [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks), add endpoint `https://your-domain.com/api/stripe-webhook`, event `checkout.session.completed`. Use the signing secret as `STRIPE_WEBHOOK_SECRET`.
- **Products used:** Basic `prod_TqkoeMg8E0bPjg`, Pro `prod_TqqFGqkDNOzfU9`, Basic Yearly `prod_Tr7AD8al5JQCA1`, Pro Yearly `prod_Tr7ARTolkwQVoL`. Plans Pro and Elite on the Pricing page map to Stripe Checkout; after payment the webhook updates Firestore `users/{uid}.plan`.
