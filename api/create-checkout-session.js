/**
 * POST /api/create-checkout-session — Stripe subscription checkout.
 * Auth: Bearer Firebase ID token REQUIRED. The session can only ever be
 * attributed to the caller's own uid — never to a body-supplied userId.
 */
import Stripe from 'stripe';
import { requireUser, httpError } from './_lib/firebase.js';
import { apiHandler } from './_lib/http.js';

const PLAN_STRIPE = {
  basic:         { priceId: 'price_1St3JKQguCNBtUJsTT2IIdNv' },
  pro:           { priceId: 'price_1St8ZQQguCNBtUJsIfn3XDEt' },
  basic_yearly:  { priceId: 'price_1StOwMQguCNBtUJsvqzrTCoa' },
  pro_yearly:    { priceId: 'price_1StOvpQguCNBtUJs2ei9gxkE' },
};

function getOrigin(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  return `${proto}://${host}`;
}

async function handler(req, res) {
  if (req.method !== 'POST') throw httpError(405, 'Method not allowed');

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) throw httpError(500, 'Stripe not configured');

  const decoded = await requireUser(req);
  const userId = decoded.uid;
  const userEmail = decoded.email || undefined;

  const { planKey, successUrl, cancelUrl } = req.body || {};

  const plan = planKey ? PLAN_STRIPE[planKey.toLowerCase()] : null;
  if (!plan?.priceId) throw httpError(400, 'Invalid plan. Use: basic, pro, basic_yearly, pro_yearly');

  const origin = getOrigin(req);
  const success = successUrl || `${origin}/#pricing?success=true&session_id={CHECKOUT_SESSION_ID}`;
  const cancel  = cancelUrl || `${origin}/#pricing?canceled=true`;

  try {
    const stripe = new Stripe(secret);
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: userEmail,
      client_reference_id: userId,
      metadata: { planKey: planKey.toLowerCase() },
      line_items: [{ price: plan.priceId, quantity: 1 }],
      success_url: success,
      cancel_url:  cancel,
    });
    return res.status(200).json({ url: session.url });
  } catch (e) {
    console.error('Stripe checkout session error:', e.message);
    throw httpError(500, 'Checkout failed. Please try again.');
  }
}

export default apiHandler(handler, { headers: [] });
