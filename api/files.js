/**
 * GET    /api/files            — list user's files (newest first; ?cursor= for pagination)
 * GET    /api/files?id=X&text=1 — get one file's metadata (+ parsedText)
 * DELETE /api/files?id=X       — delete single file
 * DELETE /api/files?all=true   — delete all files for user
 */
import { del } from '@vercel/blob';
import { db, requireUser, httpError } from './_lib/firebase.js';
import { apiHandler } from './_lib/http.js';

export const config = { maxDuration: 30 };

const PAGE_SIZE = 50;

async function deleteBlobIfPossible(url) {
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (!blobToken || !url) return;
  try { await del(url, { token: blobToken }); }
  catch (e) { console.warn('[files] blob delete failed (orphan):', e?.message); }
}

async function handler(req, res) {
  const uid = await requireUser(req);
  const filesCol = () => db().collection('users').doc(uid).collection('files');

  // ── GET ──────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const { id, text } = req.query;

      if (id) {
        const snap = await filesCol().doc(String(id)).get();
        if (!snap.exists) throw httpError(404, 'File not found');
        const d = snap.data();
        const out = { id: snap.id, name: d.name, size: d.size, mimeType: d.mimeType, url: d.url, parsedStatus: d.parsedStatus, createdAt: d.createdAt };
        if (text === '1') out.parsedText = d.parsedText || '';
        return res.status(200).json(out);
      }

      const q = filesCol().orderBy('createdAt', 'desc').limit(PAGE_SIZE);
      const snap = await q.get();
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
    } catch (e) {
      if (e.code === 404) throw e;
      console.error('[files] GET failed:', e);
      throw httpError(500, 'Could not load your files');
    }
  }

  // ── DELETE ───────────────────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    const { id, all } = req.query;

    if (all === 'true') {
      const snap = await filesCol().get();
      let deleted = 0;
      for (const d of snap.docs) {
        await deleteBlobIfPossible(d.data().url);
        await d.ref.delete();
        deleted++;
      }
      return res.status(200).json({ deleted });
    }

    if (!id) throw httpError(400, 'id or all=true required');
    const ref = filesCol().doc(String(id));
    const snap = await ref.get();
    if (!snap.exists) throw httpError(404, 'Not found');
    await deleteBlobIfPossible(snap.data().url);
    await ref.delete();
    return res.status(200).json({ deleted: 1 });
  }

  throw httpError(405, 'Method not allowed');
}

export default apiHandler(handler);
