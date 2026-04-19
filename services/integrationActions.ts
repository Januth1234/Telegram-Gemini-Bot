/**
 * integrationActions — wires Gmail/Calendar/Drive/Spotify into chat.
 * Google tokens fetched server-side via /api/auth/google (auto-refreshes).
 * Spotify token fetched server-side via /api/auth/spotify (auto-refreshes).
 * Firebase ID token fallback removed — was always returning 401.
 */
import { firebaseService } from './firebaseService';
import { getDecryptedToken, getIntegration } from './aiProviderService';
import { getValidToken } from './googleIntegrationService';

export interface IntegrationContext {
  data: string;
  action?: 'send_email' | 'create_event' | 'create_doc' | 'none';
  requiresApproval?: boolean;
  approvalPayload?: object;
}

const DETECT = {
  gmail:       /\b(email|inbox|mail|unread|send.*to|draft|message from)\b/i,
  calendar:    /\b(calendar|event|schedule|meeting|appointment|book|remind|today|tomorrow|next week)\b/i,
  drive:       /\b(drive|my files|documents|spreadsheet|presentation|slides)\b/i,
  docsCreate:  /\b(create|write|make|new)\b.*\b(doc|document)\b/i,
  sheetCreate: /\b(create|make|new)\b.*\b(sheet|spreadsheet|table)\b/i,
  slideCreate: /\b(create|make|new)\b.*\b(slide|presentation|deck)\b/i,
  spotify:     /\b(spotify|play|playing|song|music|track|pause|skip|next track|what.*playing)\b/i,
  sendEmail:   /\bsend\b.*\b(email|mail)\b.*\bto\b/i,
};

async function gFetch(url: string, token: string, opts?: RequestInit) {
  const r = await fetch(url, { ...opts, headers: { ...(opts?.headers || {}), Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`Google API ${r.status}: ${await r.text().catch(() => r.statusText)}`);
  return r.json();
}

async function getSpotifyToken(): Promise<string | null> {
  try {
    const idTok = await (firebaseService as any).getIdToken?.();
    if (!idTok) return null;
    const r = await fetch('/api/auth/spotify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idTok}` },
      body: JSON.stringify({ action: 'getToken' }),
    });
    if (!r.ok) return null;
    return (await r.json()).accessToken || null;
  } catch { return null; }
}

export async function buildIntegrationContext(userMsg: string): Promise<IntegrationContext | null> {
  const hit = {
    gmail:       DETECT.gmail.test(userMsg),
    calendar:    DETECT.calendar.test(userMsg),
    drive:       DETECT.drive.test(userMsg),
    spotify:     DETECT.spotify.test(userMsg),
    sendEmail:   DETECT.sendEmail.test(userMsg),
    docsCreate:  DETECT.docsCreate.test(userMsg),
    sheetCreate: DETECT.sheetCreate.test(userMsg),
    slideCreate: DETECT.slideCreate.test(userMsg),
  };

  if (!Object.values(hit).some(Boolean)) return null;

  // ── Spotify ───────────────────────────────────────────────────────────────
  if (hit.spotify) {
    const token = await getSpotifyToken();
    if (!token) return { data: '[Spotify not connected. Account → AI & Services → Connect Spotify]', action: 'none' };
    try {
      const r = await fetch('https://api.spotify.com/v1/me/player', { headers: { Authorization: `Bearer ${token}` } });
      if (r.status === 204) return { data: '[Spotify: nothing playing]', action: 'none' };
      if (!r.ok) return { data: `[Spotify error: ${r.status}]`, action: 'none' };
      return buildSpotifyContext(await r.json());
    } catch (e: any) { return { data: `[Spotify: ${e.message}]`, action: 'none' }; }
  }

  // ── Google ────────────────────────────────────────────────────────────────
  // Determine which module to use for token (pick first that matches)
  const googleModule = hit.gmail ? 'gmail' : hit.calendar ? 'calendar' : 'drive';
  const token = await getValidToken(googleModule as any);

  if (!token) {
    const missing = [hit.gmail && 'Gmail', hit.calendar && 'Calendar', hit.drive && 'Drive'].filter(Boolean);
    return { data: `[${missing.join('/')} not connected. Account → AI & Services → Allow]`, action: 'none' };
  }

  // Send email
  if (hit.sendEmail) {
    const toMatch = userMsg.match(/to\s+([\w.+]+@[\w.]+)/i);
    const to = toMatch?.[1] || '';
    return { data: `[Gmail: ready to send email${to ? ` to ${to}` : ''}]`, action: 'send_email', requiresApproval: true, approvalPayload: { to, subject: 'From Orin AI', body: userMsg } };
  }

  // Create doc/sheet/slide
  if (hit.docsCreate || hit.sheetCreate || hit.slideCreate) {
    const type = hit.slideCreate ? 'slide' : hit.sheetCreate ? 'sheet' : 'doc';
    return { data: `[Google ${type}: ready to create. Confirm to proceed.]`, action: 'create_doc', requiresApproval: true, approvalPayload: { type, title: userMsg.slice(0, 60), token } };
  }

  try {
    const parts: string[] = [];

    if (hit.gmail) {
      const data = await gFetch('https://gmail.googleapis.com/gmail/v1/users/me/threads?maxResults=5&labelIds=INBOX', token).catch(() => null);
      if (data?.threads) {
        parts.push(`[Gmail inbox: ${data.threads.length} recent thread(s). Thread IDs: ${data.threads.map((t: any) => t.id).join(', ')}]`);
      } else {
        parts.push('[Gmail: connected but could not read inbox — ensure gmail.readonly scope is granted]');
      }
    }

    if (hit.calendar) {
      const now = new Date().toISOString();
      const data = await gFetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=8&timeMin=${now}&singleEvents=true&orderBy=startTime`, token).catch(() => null);
      if (data?.items?.length) {
        const list = data.items.slice(0, 5).map((e: any) => `• ${e.summary} — ${e.start?.dateTime || e.start?.date}`).join('\n');
        parts.push(`[Calendar events:\n${list}]`);
      } else {
        parts.push('[Calendar: no upcoming events or calendar scope not granted]');
      }
    }

    if (hit.drive && !hit.docsCreate && !hit.sheetCreate && !hit.slideCreate) {
      const driveToken = await getValidToken('drive');
      if (driveToken) {
        const data = await gFetch('https://www.googleapis.com/drive/v3/files?pageSize=8&fields=files(id,name,mimeType,modifiedTime)', driveToken).catch(() => null);
        if (data?.files?.length) {
          parts.push(`[Drive files:\n${data.files.slice(0, 6).map((f: any) => `• ${f.name}`).join('\n')}]`);
        } else {
          parts.push('[Drive: connected but no files found]');
        }
      }
    }

    return parts.length ? { data: parts.join('\n'), action: 'none' } : null;
  } catch (e: any) {
    return { data: `[Google API error: ${e.message}]`, action: 'none' };
  }
}

function buildSpotifyContext(d: any): IntegrationContext {
  if (!d?.item) return { data: '[Spotify: nothing playing]', action: 'none' };
  const track = d.item.name;
  const artist = d.item.artists?.[0]?.name || '';
  const icon = d.is_playing ? '▶' : '⏸';
  const pct = Math.round((d.progress_ms / d.item.duration_ms) * 100);
  return { data: `[Spotify ${icon} ${track}${artist ? ' — ' + artist : ''} (${pct}%)]`, action: 'none' };
}

/** Execute confirmed action (send email / create doc) */
export async function executeApprovedAction(action: string, payload: any): Promise<string> {
  const token = payload.token || await getValidToken('gmail');
  if (!token) return '❌ No Google token available. Grant access in Account → AI & Services.';

  if (action === 'send_email') {
    const raw = btoa(`To: ${payload.to}\r\nSubject: ${payload.subject}\r\nContent-Type: text/plain\r\n\r\n${payload.body}`).replace(/\+/g, '-').replace(/\//g, '_');
    try {
      const r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw }),
      });
      if (!r.ok) throw new Error(`${r.status}`);
      return `✅ Email sent to ${payload.to}`;
    } catch (e: any) { return `❌ Send failed: ${e.message}`; }
  }

  if (action === 'create_doc') {
    try {
      const docToken = await getValidToken(payload.type === 'sheet' ? 'sheets' : payload.type === 'slide' ? 'slides' : 'docs') || token;
      if (payload.type === 'sheet') {
        const r = await fetch('https://sheets.googleapis.com/v4/spreadsheets', { method: 'POST', headers: { Authorization: `Bearer ${docToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ properties: { title: payload.title } }) });
        const d = await r.json();
        return d.spreadsheetId ? `✅ Sheet: https://docs.google.com/spreadsheets/d/${d.spreadsheetId}` : `❌ Failed: ${JSON.stringify(d.error)}`;
      }
      if (payload.type === 'slide') {
        const r = await fetch('https://slides.googleapis.com/v1/presentations', { method: 'POST', headers: { Authorization: `Bearer ${docToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ title: payload.title }) });
        const d = await r.json();
        return d.presentationId ? `✅ Slides: https://docs.google.com/presentation/d/${d.presentationId}` : `❌ Failed: ${JSON.stringify(d.error)}`;
      }
      const r = await fetch('https://docs.googleapis.com/v1/documents', { method: 'POST', headers: { Authorization: `Bearer ${docToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ title: payload.title }) });
      const d = await r.json();
      return d.documentId ? `✅ Doc: https://docs.google.com/document/d/${d.documentId}` : `❌ Failed: ${JSON.stringify(d.error)}`;
    } catch (e: any) { return `❌ ${e.message}`; }
  }

  return 'Done';
}
