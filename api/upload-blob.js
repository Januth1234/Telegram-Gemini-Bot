/**
 * POST /api/upload-blob
 * Accepts multipart/form-data with a 'file' field.
 * Uploads to Vercel Blob and returns the public CDN URL.
 */
import { put } from '@vercel/blob';

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'BLOB_READ_WRITE_TOKEN not set' });
  }

  try {
    // Use formidable — available in Vercel Node.js runtime
    const formidable = (await import('formidable')).default || (await import('formidable'));
    const IncomingForm = formidable.IncomingForm || formidable;

    const data = await new Promise((resolve, reject) => {
      const form = new IncomingForm({ maxFileSize: 100 * 1024 * 1024 });
      form.parse(req, (err, _fields, files) => {
        if (err) return reject(err);
        resolve(files);
      });
    });

    const uploaded = data.file;
    if (!uploaded) {
      return res.status(400).json({ error: 'No file field found in form' });
    }

    const fileObj = Array.isArray(uploaded) ? uploaded[0] : uploaded;
    const fs = await import('fs');
    const fileBuffer = fs.readFileSync(fileObj.filepath || fileObj.path);
    const mimeType = fileObj.mimetype || fileObj.type || 'application/octet-stream';
    const originalName = fileObj.originalFilename || fileObj.name || 'upload';
    const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const pathname = `creations/${Date.now()}-${safeName}`;

    const blob = await put(pathname, fileBuffer, {
      access: 'public',
      contentType: mimeType,
      token,
    });

    return res.status(200).json({ url: blob.url, contentType: mimeType });
  } catch (err) {
    console.error('Blob upload error:', err);
    return res.status(500).json({ error: err.message || 'Upload failed' });
  }
}
