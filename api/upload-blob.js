/**
 * POST /api/upload-blob
 * Handles images, videos, and audio. Streams large files to Vercel Blob.
 * Supports up to 500MB (video). Uses formidable for multipart parsing.
 */
import { put } from '@vercel/blob';
import { formidable } from 'formidable';
import { createReadStream, statSync } from 'fs';

export const config = {
  api: { bodyParser: false },
  maxDuration: 120, // 2 minutes for large video uploads
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
    const form = formidable({
      maxFileSize: 500 * 1024 * 1024, // 500 MB for video
      maxTotalFileSize: 500 * 1024 * 1024,
      keepExtensions: true,
    });

    const [, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve([fields, files]);
      });
    });

    const uploaded = files.file;
    if (!uploaded) {
      return res.status(400).json({ error: 'No "file" field found in form data' });
    }

    const fileObj = Array.isArray(uploaded) ? uploaded[0] : uploaded;
    const filePath = fileObj.filepath || fileObj.path;
    const mimeType = fileObj.mimetype || fileObj.type || 'application/octet-stream';
    const originalName = (fileObj.originalFilename || fileObj.name || 'upload')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 100);
    const pathname = `creations/${Date.now()}-${originalName}`;

    // Use streaming for large files (video) instead of readFileSync
    const fileSize = statSync(filePath).size;
    let body;
    if (fileSize > 10 * 1024 * 1024) {
      // Stream large files
      body = createReadStream(filePath);
    } else {
      const { readFileSync } = await import('fs');
      body = readFileSync(filePath);
    }

    const blob = await put(pathname, body, {
      access: 'public',
      contentType: mimeType,
      token,
    });

    return res.status(200).json({
      url: blob.url,
      contentType: mimeType,
      size: fileSize,
    });
  } catch (err) {
    console.error('Blob upload error:', err);
    return res.status(500).json({ error: err?.message || 'Upload failed' });
  }
}
