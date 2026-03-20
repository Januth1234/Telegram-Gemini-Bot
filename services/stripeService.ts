/**
 * Calls the backend to create a Stripe Checkout Session and returns the redirect URL.
 * Backend (Vercel /api/create-checkout-session) must have STRIPE_SECRET_KEY set.
 */
const API_BASE = typeof window !== 'undefined' ? window.location.origin : '';

export async function createCheckoutSession(params: {
  planKey: string;
  userId: string;
  userEmail?: string | null;
  successUrl?: string;
  cancelUrl?: string;
}): Promise<{ url: string } | { error: string }> {
  const res = await fetch(`${API_BASE}/api/create-checkout-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      planKey: params.planKey,
      userId: params.userId,
      userEmail: params.userEmail || undefined,
      successUrl: params.successUrl,
      cancelUrl: params.cancelUrl,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { error: data.error || res.statusText || 'Checkout failed' };
  if (!data.url) return { error: data.error || 'No checkout URL' };
  return { url: data.url };
}
