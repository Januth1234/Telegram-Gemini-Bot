import Stripe from 'stripe';

const PLAN_STRIPE = {
  basic:    { productId: 'prod_TqkoeMg8E0bPjg', unitAmount: 500 },
  pro:      { productId: 'prod_TqqFGqkDNOzfU9', unitAmount: 1000 },
  elite:    { productId: 'prod_Tr7ARTolkwQVoL', unitAmount: 3000 },
  basic_yearly: { productId: 'prod_Tr7AD8al5JQCA1', unitAmount: 5000 },
  pro_yearly:   { productId: 'prod_Tr7ARTolkwQVoL', unitAmount: 10000 },
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
  if (!plan) {
    return res.status(400).json({ error: 'Invalid plan. Use: basic, pro, elite, basic_yearly, pro_yearly' });
  }

  const origin = getOrigin(req);
  const success = successUrl || `${origin}/#pricing?success=true&session_id={CHECKOUT_SESSION_ID}`;
  const cancel = cancelUrl || `${origin}/#pricing?canceled=true`;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: userEmail || undefined,
      client_reference_id: userId || undefined,
      metadata: { planKey: planKey.toLowerCase() },
      line_items: [{
        price_data: {
          currency: 'lkr',
          product: plan.productId,
          unit_amount: plan.unitAmount,
        },
        quantity: 1,
      }],
      success_url: success,
      cancel_url: cancel,
    });

    return res.status(200).json({ url: session.url });
  } catch (e) {
    console.error('Stripe checkout session error:', e.message);
    return res.status(500).json({ error: e.message || 'Checkout failed' });
  }
}
