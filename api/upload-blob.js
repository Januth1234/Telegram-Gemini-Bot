/**
 * POST /api/upload-blob
 * Accepts multipart/form-data with a 'file' field.
 * Uploads to Vercel Blob and returns the public CDN URL.
 */
import { put } from '@vercel/blob';
import { formidable } from 'formidable';
import { readFileSync } from 'fs';

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'BLOB_READ_WRITE_TOKEN not configured' });
  }

  try {
    const form = formidable({ maxFileSize: 100 * 1024 * 1024 });

    const [, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve([fields, files]);
      });
    });

    const uploaded = files.file;
    if (!uploaded) {
      return res.status(400).json({ error: 'No file field in form data' });
    }

    const fileObj = Array.isArray(uploaded) ? uploaded[0] : uploaded;
    const filePath = fileObj.filepath || fileObj.path;
    const mimeType = fileObj.mimetype || fileObj.type || 'application/octet-stream';
    const originalName = (fileObj.originalFilename || fileObj.name || 'upload').replace(/[^a-zA-Z0-9._-]/g, '_');
    const pathname = `creations/${Date.now()}-${originalName}`;

    const buffer = readFileSync(filePath);
    const blob = await put(pathname, buffer, {
      access: 'public',
      contentType: mimeType,
      token,
    });

    return res.status(200).json({ url: blob.url, contentType: mimeType });
  } catch (err) {
    console.error('Blob upload error:', err);
    return res.status(500).json({ error: err?.message || 'Upload failed' });
  }
}
