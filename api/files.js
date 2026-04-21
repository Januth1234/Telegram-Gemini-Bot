/**
 * GET  /api/files            — list user's files
 * GET  /api/files?id=X       — get file metadata (+ parsedText if &text=1)
 * DELETE /api/files?id=X     — delete single file
 * DELETE /api/files?all=true — delete all files for user
 */
import { del } from '@vercel/blob';
import admin from 'firebase-admin';

if (!admin.apps.length) {
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    : null;
  admin.initializeApp(sa ? { credential: admin.credential.cert(sa) } : undefined);
}
const db = () => admin.firestore();

export const config = { maxDuration: 30 };

async function verifyUser(req) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) throw Object.assign(new Error('Unauthorized'), { code: 401 });
  const d = await admin.auth().verifyIdToken(token);
  return d.uid;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  let uid;
  try { uid = await verifyUser(req); }
  catch { return res.status(401).json({ error: 'Unauthorized' }); }

  const filesCol = () => db().collection('users').doc(uid).collection('files');

  // ── GET ──────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { id, text } = req.query;

    if (id) {
      const snap = await filesCol().doc(id).get();
      if (!snap.exists) return res.status(404).json({ error: 'File not found' });
      const d = snap.data();
      const out = { id: snap.id, name: d.name, size: d.size, mimeType: d.mimeType, url: d.url, parsedStatus: d.parsedStatus, createdAt: d.createdAt };
      if (text === '1') out.parsedText = d.parsedText || '';
      return res.status(200).json(out);
    }

    // List all
    const snap = await filesCol().orderBy('createdAt', 'desc').limit(50).get();
    const files = snap.docs.map(d => ({
      id: d.id,
      name: d.data().name,
      size: d.data().size,
      mimeType: d.data().mimeType,
      url: d.data().url,
      parsedStatus: d.data().parsedStatus,
      createdAt: d.data().createdAt,
    }));
    return res.status(200).json({ files });
  }

  // ── DELETE ───────────────────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    const { id, all } = req.query;
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;

    if (all === 'true') {
      const snap = await filesCol().get();
      await Promise.all(snap.docs.map(async d => {
        try { if (blobToken && d.data().url) await del(d.data().url, { token: blobToken }); } catch {}
        await d.ref.delete();
      }));
      return res.status(200).json({ deleted: snap.docs.length });
    }

    if (!id) return res.status(400).json({ error: 'id or all=true required' });
    const ref = filesCol().doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Not found' });
    try { if (blobToken && snap.data().url) await del(snap.data().url, { token: blobToken }); } catch {}
    await ref.delete();
    return res.status(200).json({ deleted: 1 });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
