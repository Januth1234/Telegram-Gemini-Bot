/**
 * POST/GET /api/cu-relay — Computer-Use relay between orinai.org and the desktop app.
 *
 * The signed-in user's doc `cu_relay/{uid}` is a tiny mailbox:
 *   online : server timestamp of the desktop app's last poll/upload ("connected" if <45 s old)
 *   cmd    : { id, text, status pending|taken, ts }  — written by web, consumed by desktop
 *   frame  : { jpeg, w, h, ts }                      — latest screenshot from the desktop (base64 JPEG)
 *   log    : [{ k user|status|action|done|error|orin, text, ts }] capped at 40 entries
 *
 * Web page  : GET                → { onlineAgeSec, frame, log }
 * Web page  : POST action=say    → queue an instruction for the desktop
 * Desktop   : GET ?poll=1        → fetch + consume a pending command; refreshes `online`
 * Desktop   : POST frame/log     → publish screen + progress; refreshes `online`
 */
import { db, TS, requireUser, httpError } from './_lib/firebase.js';
import { apiHandler } from './_lib/http.js';

export const config = { maxDuration: 15 };

const LOG_CAP = 40;
const FRAME_MAX_BASE64 = 700 * 1024; // ~500 KB JPEG
const CMD_TTL_MS = 10 * 60_000;

function snapData(d = {}) {
  const now = Date.now();
  const onlineMs = d.online?.toMillis?.() ?? 0;
  return {
    onlineAgeSec: onlineMs ? Math.max(0, Math.round((now - onlineMs) / 1000)) : null,
    frame: d.frame ? { jpeg: d.frame.jpeg, w: d.frame.w, h: d.frame.h, ts: d.frame.ts } : null,
    log: Array.isArray(d.log) ? d.log.slice(-LOG_CAP) : [],
  };
}

async function handler(req, res) {
  const decoded = await requireUser(req);
  const uid = decoded.uid;
  const ref = db().collection('cu_relay').doc(uid);

  if (req.method === 'GET') {
    const snap = await ref.get();
    if (!snap.exists) {
      return res.status(200).json({ onlineAgeSec: null, frame: null, log: [] });
    }
    const d = snap.data();
    if (req.query.poll !== '1') {
      return res.status(200).json(snapData(d));
    }
    // Desktop poll: heartbeat + consume one pending command.
    let cmd = null;
    const c = d.cmd;
    if (c && c.status === 'pending') {
      const fresh = !c.ts || (Date.now() - (c.ts?.toMillis?.() ?? 0)) < CMD_TTL_MS;
      if (fresh) cmd = { id: c.id, text: c.text };
    }
    await ref.set({ online: TS(), ...(cmd ? { cmd: { ...c, status: 'taken' } } : {}) }, { merge: true });
    return res.status(200).json({ cmd });
  }

  if (req.method !== 'POST') throw httpError(405, 'GET or POST only');
  const body = req.body || {};

  if (body.action === 'say') {
    const text = String(body.text || '').trim().slice(0, 2000);
    if (!text) throw httpError(400, 'text required');
    const entry = { k: 'user', text, ts: TS() };
    await ref.set(
      {
        cmd: { id: `${Date.now()}`, text, status: 'pending', ts: TS() },
        log: [...(snapData((await ref.get()).data()).log.slice(-(LOG_CAP - 1))), entry],
      },
      { merge: true }
    );
    return res.status(200).json({ ok: true });
  }

  if (body.action === 'frame') {
    const jpeg = String(body.jpeg || '');
    if (!jpeg || jpeg.length > FRAME_MAX_BASE64) throw httpError(413, 'frame too large');
    await ref.set(
      { online: TS(), frame: { jpeg, w: Number(body.w) || 0, h: Number(body.h) || 0, ts: Date.now() } },
      { merge: true }
    );
    return res.status(200).json({ ok: true });
  }

  if (body.action === 'log') {
    const k = ['user', 'status', 'action', 'done', 'error', 'orin'].includes(body.k) ? body.k : 'status';
    const text = String(body.text || '').slice(0, 1000);
    const current = snapData((await ref.get()).data()).log;
    await ref.set(
      { online: TS(), log: [...current.slice(-(LOG_CAP - 1)), { k, text, ts: TS() }] },
      { merge: true }
    );
    return res.status(200).json({ ok: true });
  }

  throw httpError(400, 'Unknown action');
}

export default apiHandler(handler);
