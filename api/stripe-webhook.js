/**
 * POST /api/stripe-webhook — Stripe subscription lifecycle → Firestore plan sync.
 * Handles: checkout.session.completed, customer.subscription.updated,
 * customer.subscription.deleted, invoice.payment_failed.
 * Raw body + signature verification required (STRIPE_WEBHOOK_SECRET).
 */
import Stripe from 'stripe';
import { initAdmin, db, TS } from './_lib/firebase.js';

async function getRawBody(req) {
  if (typeof req.text === 'function') return Buffer.from(await req.text(), 'utf8');
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export const config = { api: { bodyParser: false } };

const PAID_PLANS = new Set(['basic', 'pro', 'basic_yearly', 'pro_yearly']);

async function setPlan(userId, plan) {
  await db().collection('users').doc(userId).set({
    plan,
    lastUpdated: TS(),
  }, { merge: true });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!webhookSecret || !secret) {
    return res.status(500).json({ error: 'Webhook not configured' });
  }

  const rawBody = await getRawBody(req);
  const sig = req.headers['stripe-signature'];
  if (!sig) return res.status(400).json({ error: 'Missing stripe-signature' });

  const stripe = new Stripe(secret);
  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  initAdmin();

  try {
    switch (event.type) {
      // ── Fulfillment ──────────────────────────────────────────────────────
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.client_reference_id;
        const planKey = session.metadata?.planKey;
        if (userId && planKey && PAID_PLANS.has(planKey.toLowerCase())) {
          await setPlan(userId, planKey.toLowerCase());
        }
        break;
      }

      // ── Plan changes (upgrades/downgrades mid-cycle) ─────────────────────
      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const userId = sub.metadata?.userId || sub.client_reference_id;
        const priceId = sub.items?.data?.[0]?.price?.id;
        if (userId && priceId) {
          const plan = planFromPriceId(priceId);
          if (sub.status === 'active' || sub.status === 'trialing') {
            if (plan) await setPlan(userId, plan);
          } else {
            await setPlan(userId, 'free');
          }
        }
        break;
      }

      // ── Cancellations / end of cycle ─────────────────────────────────────
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const userId = sub.metadata?.userId || sub.client_reference_id;
        if (userId) await setPlan(userId, 'free');
        break;
      }

      // ── Payment failure → downgrade after final attempt ──────────────────
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const userId = invoice.subscription_details?.metadata?.userId
          || invoice.metadata?.userId
          || null;
        if (userId) await setPlan(userId, 'free');
        break;
      }

      default:
        break;
    }
  } catch (e) {
    console.error('Webhook Firestore update error:', e);
    return res.status(500).json({ error: 'Fulfillment failed' });
  }

  return res.status(200).json({ received: true });
}

// Price IDs mirror PLAN_STRIPE in create-checkout-session.js
function planFromPriceId(priceId) {
  const map = {
    price_1St3JKQguCNBtUJsTT2IIdNv: 'basic',
    price_1St8ZQQguCNBtUJsIfn3XDEt: 'pro',
    price_1StOwMQguCNBtUJsvqzrTCoa: 'basic_yearly',
    price_1StOvpQguCNBtUJs2ei9gxkE: 'pro_yearly',
  };
  return map[priceId] || null;
}
