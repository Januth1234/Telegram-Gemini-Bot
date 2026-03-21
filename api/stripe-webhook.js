import Stripe from 'stripe';
import admin from 'firebase-admin';

const PRICE_TO_PLAN = {
  'price_1St3JKQguCNBtUJsTT2IIdNv': 'basic',
  'price_1St8ZQQguCNBtUJsIfn3XDEt': 'pro',
  'price_1StOwMQguCNBtUJsvqzrTCoa': 'basic_yearly',
  'price_1StOvpQguCNBtUJs2ei9gxkE': 'pro_yearly',
};

async function getRawBody(req) {
  if (typeof req.text === 'function') return Buffer.from(await req.text(), 'utf8');
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function initFirebase() {
  if (admin.apps.length) return admin.app();
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!json) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON not set');
  const key = typeof json === 'string' ? JSON.parse(json) : json;
  return admin.initializeApp({ credential: admin.credential.cert(key) });
}

export const config = { api: { bodyParser: false } };

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

  const handled = ['checkout.session.completed', 'customer.subscription.deleted', 'customer.subscription.updated', 'invoice.payment_failed'];
  if (!handled.includes(event.type)) {
    return res.status(200).json({ received: true });
  }

  try {
    initFirebase();
    const db = admin.firestore();
    const ts = admin.firestore.FieldValue.serverTimestamp();

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userId = session.client_reference_id;
      const planKey = session.metadata?.planKey;
      if (!userId || !planKey) {
        return res.status(200).json({ received: true });
      }
      let subscriptionStatus = 'active';
      let currentPeriodEnd = null;
      if (session.subscription) {
        const subscription = await stripe.subscriptions.retrieve(session.subscription);
        subscriptionStatus = subscription.status || 'active';
        currentPeriodEnd = subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : null;
      }
      await db.collection('users').doc(userId).update({
        plan: planKey.toLowerCase(),
        stripeCustomerId: session.customer || null,
        stripeSubscriptionId: session.subscription || null,
        subscriptionStatus,
        currentPeriodEnd,
        lastUpdated: ts,
      });
      return res.status(200).json({ received: true });
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;
      const subId = subscription.id;
      const snap = await db.collection('users').where('stripeSubscriptionId', '==', subId).limit(1).get();
      if (!snap.empty) {
        await snap.docs[0].ref.update({
          plan: 'free',
          subscriptionStatus: 'cancelled',
          lastUpdated: ts,
        });
      }
      return res.status(200).json({ received: true });
    }

    if (event.type === 'customer.subscription.updated') {
      const subscription = event.data.object;
      const subId = subscription.id;
      const priceId = subscription.items?.data?.[0]?.price?.id;
      const planKey = priceId ? (PRICE_TO_PLAN[priceId] || 'free') : 'free';
      const snap = await db.collection('users').where('stripeSubscriptionId', '==', subId).limit(1).get();
      if (!snap.empty) {
        const isCanceled = subscription.status === 'canceled' || subscription.status === 'unpaid';
        await snap.docs[0].ref.update({
          plan: isCanceled ? 'free' : planKey,
          subscriptionStatus: isCanceled ? 'cancelled' : (subscription.status || 'active'),
          currentPeriodEnd: subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : null,
          lastUpdated: ts,
        });
      }
      return res.status(200).json({ received: true });
    }

    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object;
      const subId = invoice.subscription;
      const customerId = invoice.customer;
      let docRef = null;
      if (subId) {
        const snap = await db.collection('users').where('stripeSubscriptionId', '==', subId).limit(1).get();
        if (!snap.empty) docRef = snap.docs[0].ref;
      }
      if (!docRef && customerId) {
        const snap = await db.collection('users').where('stripeCustomerId', '==', customerId).limit(1).get();
        if (!snap.empty) docRef = snap.docs[0].ref;
      }
      if (docRef) {
        await docRef.update({
          subscriptionStatus: 'past_due',
          lastUpdated: ts,
        });
      }
      return res.status(200).json({ received: true });
    }
  } catch (e) {
    console.error('Webhook handler error:', e);
    return res.status(500).json({ error: 'Fulfillment failed' });
  }

  return res.status(200).json({ received: true });
}
