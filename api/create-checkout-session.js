import Stripe from 'stripe';

// Use Stripe Price IDs so amounts (300/1500/3000/15000 LKR) meet Stripe's minimum (~50 cents USD)
const PLAN_STRIPE = {
  basic:         { priceId: 'price_1St3JKQguCNBtUJsTT2IIdNv' },
  pro:           { priceId: 'price_1St8ZQQguCNBtUJsIfn3XDEt' },
  basic_yearly:  { priceId: 'price_1StOwMQguCNBtUJsvqzrTCoa' },
  pro_yearly:    { priceId: 'price_1StOvpQguCNBtUJs2ei9gxkE' },
  elite:         { priceId: 'price_1StOvpQguCNBtUJs2ei9gxkE' }, // same as Pro Yearly (15000 LKR)
};

function getOrigin(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  return `${proto}://${host}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return res.status(500).json({ error: 'Stripe not configured' });
  }

  const stripe = new Stripe(secret);
  const { planKey, userId, userEmail, successUrl, cancelUrl } = req.body || {};

  const plan = planKey ? PLAN_STRIPE[planKey.toLowerCase()] : null;
  if (!plan?.priceId) {
    return res.status(400).json({ error: 'Invalid plan. Use: basic, pro, basic_yearly, pro_yearly, elite' });
  }

  const origin = getOrigin(req);
  const success = successUrl || `${origin}/#pricing?success=true&session_id={CHECKOUT_SESSION_ID}`;
  const cancel = cancelUrl || `${origin}/#pricing?canceled=true`;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: userEmail || undefined,
      client_reference_id: userId || undefined,
      metadata: { planKey: planKey.toLowerCase() },
      line_items: [{ price: plan.priceId, quantity: 1 }],
      success_url: success,
      cancel_url: cancel,
    });

    return res.status(200).json({ url: session.url });
  } catch (e) {
    console.error('Stripe checkout session error:', e.message);
    return res.status(500).json({ error: e.message || 'Checkout failed' });
  }
}
