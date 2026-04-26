// GET /api/version — always live, never cached by SW (api/* is excluded)
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ v: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0,7) || Date.now().toString() });
}
