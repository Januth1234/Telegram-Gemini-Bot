import { firebaseService } from './firebaseService';

/**
 * Calls the backend to create a Stripe Checkout Session and returns the redirect URL.
 * Backend validates that userId matches the authenticated Firebase user.
 */
const API_BASE = typeof window !== 'undefined' ? window.location.origin : '';

export async function createCheckoutSession(params: {
  planKey: string;
  userId: string;
  userEmail?: string | null;
  successUrl?: string;
  cancelUrl?: string;
}): Promise<{ url: string } | { error: string }> {
  const user = firebaseService.currentUser();
  const token = await user?.getIdToken?.();
  if (!token) return { error: 'Sign in required' };

  const res = await fetch(`${API_BASE}/api/create-checkout-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
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
