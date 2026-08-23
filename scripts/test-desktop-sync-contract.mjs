// Contract test for /api/desktop-sync against a DEPLOYED environment.
// Usage: node scripts/test-desktop-sync-contract.mjs <baseUrl> <idToken>
const [base, token] = process.argv.slice(2);
if (!base || !token) {
  console.error('usage: node test-desktop-sync-contract.mjs <baseUrl> <idToken>');
  process.exit(1);
}
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

const r1 = await fetch(`${base}/api/desktop-sync`, { headers });
console.log('GET empty →', r1.status, await r1.json());

const blob = { settings: { theme: 'dark' }, chats: [], schemaVersion: 1 };
const r2 = await fetch(`${base}/api/desktop-sync`, {
  method: 'PUT',
  headers,
  body: JSON.stringify({ blob }),
});
console.log('PUT →', r2.status, await r2.json());
if (r2.status !== 200) process.exit(1);

const r3 = await fetch(`${base}/api/desktop-sync`, { headers });
const out = await r3.json();
console.log('GET roundtrip →', r3.status, JSON.stringify(out).slice(0, 120));
if (!out.blob || out.blob.settings.theme !== 'dark') {
  console.error('ROUNDTRIP MISMATCH');
  process.exit(1);
}
console.log('CONTRACT OK');
