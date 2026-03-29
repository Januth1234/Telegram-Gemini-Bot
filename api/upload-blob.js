/**
 * POST /api/upload-blob
 * Receives a multipart form with a `file` field, uploads to Vercel Blob,
 * and returns { url } — the permanent public blob URL.
 *
 * Requires BLOB_READ_WRITE_TOKEN env var (set in Vercel project settings).
 */
import { put } from '@vercel/blob';

export const config = {
  api: { bodyParser: false },
  // allow up to 100 MB
  maxDuration: 30,
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'BLOB_READ_WRITE_TOKEN not configured in Vercel env vars' });
  }

  try {
    // Parse multipart form
    const busboy = (await import('busboy')).default;
    const bb = busboy({ headers: req.headers, limits: { fileSize: 100 * 1024 * 1024 } });

    const result = await new Promise((resolve, reject) => {
      bb.on('file', async (_field, stream, info) => {
        try {
          const { filename, mimeType } = info;
          const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
          const pathname = `creations/${Date.now()}-${safe}`;

          // Collect stream into buffer for Vercel Blob put()
          const chunks = [];
          for await (const chunk of stream) chunks.push(chunk);
          const buffer = Buffer.concat(chunks);

          const blob = await put(pathname, buffer, {
            access: 'public',
            contentType: mimeType,
            token,
          });
          resolve({ url: blob.url, contentType: mimeType, size: buffer.length });
        } catch (e) {
          reject(e);
        }
      });
      bb.on('error', reject);
      req.pipe(bb);
    });

    return res.status(200).json(result);
  } catch (e) {
    console.error('Blob upload error:', e);
    return res.status(500).json({ error: e.message || 'Upload failed' });
  }
}
