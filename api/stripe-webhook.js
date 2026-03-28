import Stripe from 'stripe';
import admin from 'firebase-admin';

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

  if (event.type !== 'checkout.session.completed') {
    return res.status(200).json({ received: true });
  }

  const session = event.data.object;
  const userId = session.client_reference_id;
  const planKey = session.metadata?.planKey;
  if (!userId || !planKey) {
    return res.status(200).json({ received: true });
  }

  try {
    initFirebase();
    const db = admin.firestore();
    await db.collection('users').doc(userId).update({
      plan: planKey.toLowerCase(),
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (e) {
    console.error('Webhook Firestore update error:', e);
    return res.status(500).json({ error: 'Fulfillment failed' });
  }

  return res.status(200).json({ received: true });
}
