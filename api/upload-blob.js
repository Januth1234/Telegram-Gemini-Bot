/**
 * POST /api/upload-blob
 * Handles images, videos, audio, PDFs, and text files.
 * Streams large files to Vercel Blob. Parses PDFs server-side.
 * Writes metadata + parsedText to Firestore users/{uid}/files/{fileId}.
 */
import { put } from '@vercel/blob';
import { formidable } from 'formidable';
import { createReadStream, statSync, readFileSync } from 'fs';
import admin from 'firebase-admin';

if (!admin.apps.length) {
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
    : null;
  admin.initializeApp(sa ? { credential: admin.credential.cert(sa) } : undefined);
}
const db = () => admin.firestore();

export const config = {
  api: { bodyParser: false },
  maxDuration: 120,
};

async function verifyUser(req) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  try {
    const d = await admin.auth().verifyIdToken(token);
    return d.uid;
  } catch { return null; }
}

async function extractPdfText(filePath) {
  try {
    const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default;
    const buf = readFileSync(filePath);
    const data = await pdfParse(buf);
    return (data.text || '').trim().slice(0, 50000); // 50k char cap
  } catch (e) {
    console.warn('[upload-blob] pdf-parse failed:', e?.message);
    return '';
  }
}

async function extractTextFile(filePath, mimeType) {
  if (mimeType.startsWith('text/') || mimeType === 'application/json') {
    try { return readFileSync(filePath, 'utf8').slice(0, 50000); } catch {}
  }
  return '';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (!blobToken) return res.status(500).json({ error: 'BLOB_READ_WRITE_TOKEN not configured' });

  const uid = await verifyUser(req);

  try {
    const form = formidable({ maxFileSize: 500 * 1024 * 1024, maxTotalFileSize: 500 * 1024 * 1024, keepExtensions: true });

    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, f, fi) => err ? reject(err) : resolve([f, fi]));
    });

    const uploaded = files.file;
    if (!uploaded) return res.status(400).json({ error: 'No "file" field in form data' });

    const fileObj   = Array.isArray(uploaded) ? uploaded[0] : uploaded;
    const filePath  = fileObj.filepath || fileObj.path;
    const mimeType  = fileObj.mimetype || fileObj.type || 'application/octet-stream';
    const origName  = (fileObj.originalFilename || fileObj.name || 'upload').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
    const fileId    = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const pathname  = `files/${fileId}-${origName}`;
    const fileSize  = statSync(filePath).size;

    // ── Upload to Vercel Blob ──────────────────────────────────────────────
    const body = fileSize > 10 * 1024 * 1024 ? createReadStream(filePath) : readFileSync(filePath);
    const blob = await put(pathname, body, { access: 'public', contentType: mimeType, token: blobToken });

    // ── Parse text content ────────────────────────────────────────────────
    let parsedText = '';
    let parsedStatus = 'none';
    if (mimeType === 'application/pdf') {
      parsedText = await extractPdfText(filePath);
      parsedStatus = parsedText ? 'done' : 'failed';
    } else if (mimeType.startsWith('text/') || mimeType === 'application/json') {
      parsedText = await extractTextFile(filePath, mimeType);
      parsedStatus = parsedText ? 'done' : 'none';
    } else {
      parsedStatus = 'not_applicable';
    }

    // ── Write metadata to Firestore ───────────────────────────────────────
    if (uid) {
      await db().collection('users').doc(uid).collection('files').doc(fileId).set({
        name:        origName,
        url:         blob.url,
        size:        fileSize,
        mimeType,
        parsedText:  parsedText || null,
        parsedStatus,
        createdAt:   admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    return res.status(200).json({
      url: blob.url,
      fileId: uid ? fileId : null,  // null for unauthenticated (still works as inline attach)
      contentType: mimeType,
      size: fileSize,
      parsedStatus,
    });
  } catch (err) {
    console.error('[upload-blob] error:', err);
    return res.status(500).json({ error: err?.message || 'Upload failed' });
  }
}
