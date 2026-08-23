/**
 * Login-identifier normalization: users may register/sign in with an email OR a phone number.
 * Phone numbers are normalized to E.164. Local Sri Lankan formats (07X XXX XXXX) get +94.
 * Returns { type: 'email'|'phone', value } or null if unparseable.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeIdentifier(raw) {
  const input = String(raw ?? '').trim();
  if (!input) return null;

  if (input.includes('@')) {
    if (!EMAIL_RE.test(input) || input.length > 254) return null;
    return { type: 'email', value: input.toLowerCase() };
  }

  let digits = input.replace(/[\s()\-.]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  else if (digits.startsWith('00')) digits = digits.slice(2);
  else if (digits.startsWith('0')) digits = '94' + digits.slice(1); // national → E.164 country code
  // anything else is assumed to already carry a country code

  if (!/^\d{9,15}$/.test(digits)) return null;
  return { type: 'phone', value: '+' + digits };
}

/** Firestore doc ID for an identifier's lookup record ('/' is illegal in doc IDs). */
export function identifierKey(norm) {
  return `${norm.type}:${norm.value}`;
}

export function passwordPolicyError(pw) {
  if (typeof pw !== 'string' || pw.length < 8) return 'Password must be at least 8 characters.';
  if (pw.length > 128) return 'Password must be at most 128 characters.';
  if (!/[a-zA-Z]/.test(pw) || !/\d/.test(pw)) return 'Password must contain both letters and numbers.';
  return null;
}

export function namePolicyError(name) {
  const n = String(name ?? '').trim();
  if (n.length < 2 || n.length > 60) return 'Name must be 2–60 characters.';
  return null;
}
