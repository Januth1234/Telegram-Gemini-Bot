/**
 * POST /api/upload-blob — file library uploads (images, video, audio, PDFs, text).
 * Auth: Bearer Firebase ID token REQUIRED. Anonymous uploads are rejected.
 * Metadata + parsedText go to Firestore users/{uid}/files/{fileId}.
 * NOTE: @vercel/blob v2 supports access:'public' only — blob URLs are unlisted,
 * not access-controlled. Paths are namespaced per-user + random. If Vercel ships
 * private ACLs on this SDK version, switch access accordingly.
 */
import { put } from '@vercel/blob';
import { formidable } from 'formidable';
import { createReadStream, statSync, readFileSync } from 'fs';
import { db, TS, requireUser, httpError } from './_lib/firebase.js';
import { apiHandler } from './_lib/http.js';

export const config = {
  api: { bodyParser: false },
  maxDuration: 120,
};

// Anything outside this list is rejected before touching storage.
const ALLOWED_MIME = [
  'image/', 'video/', 'audio/',
  'text/',
  'application/pdf',
  'application/json',
];

function mimeAllowed(mimeType) {
  return ALLOWED_MIME.some(prefix => mimeType.startsWith(prefix));
}

async function extractPdfText(filePath) {
  try {
    const { default: pdfParse } = await import('pdf-parse');
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

async function handler(req, res) {
  if (req.method !== 'POST') throw httpError(405, 'Method not allowed');

  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (!blobToken) throw httpError(500, 'BLOB_READ_WRITE_TOKEN not configured');

  const uid = await requireUser(req);

  const form = formidable({ maxFileSize: 500 * 1024 * 1024, maxTotalFileSize: 500 * 1024 * 1024, keepExtensions: true });
  const [fields, files] = await new Promise((resolve, reject) => {
    form.parse(req, (err, f, fi) => err ? reject(err) : resolve([f, fi]));
  });

  const uploaded = files.file;
  if (!uploaded) throw httpError(400, 'No "file" field in form data');

  const fileObj   = Array.isArray(uploaded) ? uploaded[0] : uploaded;
  const filePath  = fileObj.filepath || fileObj.path;
  const mimeType  = fileObj.mimetype || fileObj.type || 'application/octet-stream';
  const origName  = (fileObj.originalFilename || fileObj.name || 'upload').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
  const fileSize  = statSync(filePath).size;

  if (!mimeAllowed(mimeType)) throw httpError(415, `File type not allowed: ${mimeType}`);

  try {
    const fileId    = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const pathname  = `files/${uid}/${fileId}-${origName}`;

    // ── Upload to Vercel Blob (per-user namespaced path; SDK v2 requires public access) ──
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
    await db().collection('users').doc(uid).collection('files').doc(fileId).set({
      name:        origName,
      url:         blob.url,
      size:        fileSize,
      mimeType,
      pathname,
      parsedText:  parsedText || null,
      parsedStatus,
      createdAt:   TS(),
    });

    return res.status(200).json({
      url: blob.url,
      fileId,
      contentType: mimeType,
      size: fileSize,
      parsedStatus,
    });
  } catch (err) {
    console.error('[upload-blob] error:', err);
    throw httpError(500, 'Upload failed. Please try again.');
  }
}

export default apiHandler(handler);
