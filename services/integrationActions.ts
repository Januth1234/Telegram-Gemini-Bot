/**
 * integrationActions — wires Google + Spotify into chat context.
 * Called by ChatWorkspace before sending to Gemini.
 * If user's message matches an integration intent, performs the API call
 * and appends real data as context.
 */
import {
  isModuleEnabled, getValidToken,
  gmailListThreads, gmailGetThread, gmailSend,
  calendarListEvents, calendarCreateEvent,
  driveListFiles, docsCreate, sheetsCreate, slidesCreate,
} from './googleIntegrationService';
import { getDecryptedToken } from './aiProviderService';

export interface IntegrationContext {
  data: string;
  action?: 'send_email' | 'create_event' | 'create_doc' | 'none';
  requiresApproval?: boolean;
  approvalPayload?: object;
}

// Detect intent from message
function detect(msg: string) {
  const m = msg.toLowerCase();
  return {
    gmail:    /email|inbox|mail|message|unread|send.*to|draft/.test(m),
    calendar: /calendar|event|schedule|meeting|appointment|book|remind/.test(m),
    drive:    /drive|document|doc|sheet|slide|spreadsheet|presentation|file/.test(m),
    spotify:  /spotify|play|song|music|track|pause|skip|volume/.test(m),
  };
}

export async function buildIntegrationContext(userMsg: string): Promise<IntegrationContext | null> {
  const intent = detect(userMsg);
  const msg = userMsg.toLowerCase();

  // ── Gmail ──────────────────────────────────────────────────────────────────
  if (intent.gmail && isModuleEnabled('gmail')) {
    try {
      // Send email — needs approval
      const sendMatch = msg.match(/send.*(?:email|mail).*to\s+([\w.@]+)/i);
      if (sendMatch) {
        return {
          data: `[Gmail action ready: Send email to ${sendMatch[1]}]`,
          action: 'send_email',
          requiresApproval: true,
          approvalPayload: { to: sendMatch[1], subject: 'From Orin AI', body: userMsg },
        };
      }
      // Read inbox
      const threads = await gmailListThreads(5);
      const items = threads.threads || [];
      const context = `[Gmail inbox — ${items.length} recent thread(s) found. Thread IDs: ${items.map((t:any) => t.id).join(', ')}]`;
      return { data: context, action: 'none' };
    } catch (e: any) {
      return { data: `[Gmail: ${e.message}]`, action: 'none' };
    }
  }

  // ── Calendar ───────────────────────────────────────────────────────────────
  if (intent.calendar && isModuleEnabled('calendar')) {
    try {
      const events = await calendarListEvents(10);
      const items: any[] = events.items || [];
      const list = items.slice(0, 5).map((e: any) =>
        `• ${e.summary} — ${e.start?.dateTime || e.start?.date}`).join('\n');
      return {
        data: `[Google Calendar — upcoming events:\n${list || 'No events found'}]`,
        action: 'none',
      };
    } catch (e: any) { return { data: `[Calendar: ${e.message}]`, action: 'none' }; }
  }

  // ── Drive / Docs / Sheets / Slides ─────────────────────────────────────────
  if (intent.drive) {
    if (/create.*doc|write.*doc|new.*document/.test(msg) && isModuleEnabled('docs')) {
      return {
        data: '[Google Docs: ready to create document. Confirm to proceed.]',
        action: 'create_doc', requiresApproval: true,
        approvalPayload: { type: 'doc', title: userMsg.slice(0, 60) },
      };
    }
    if (/create.*sheet|spreadsheet|table/.test(msg) && isModuleEnabled('sheets')) {
      return {
        data: '[Google Sheets: ready to create spreadsheet. Confirm to proceed.]',
        action: 'create_doc', requiresApproval: true,
        approvalPayload: { type: 'sheet', title: userMsg.slice(0, 60) },
      };
    }
    if (/slide|presentation|deck/.test(msg) && isModuleEnabled('slides')) {
      return {
        data: '[Google Slides: ready to create presentation. Confirm to proceed.]',
        action: 'create_doc', requiresApproval: true,
        approvalPayload: { type: 'slide', title: userMsg.slice(0, 60) },
      };
    }
    if (isModuleEnabled('drive')) {
      try {
        const files = await driveListFiles();
        const list = (files.files || []).slice(0, 8).map((f: any) => `• ${f.name} (${f.mimeType?.split('.').pop()})`).join('\n');
        return { data: `[Google Drive files:\n${list || 'No files'}]`, action: 'none' };
      } catch {}
    }
  }

  // ── Spotify ────────────────────────────────────────────────────────────────
  if (intent.spotify) {
    const tok = getDecryptedToken('spotify');
    if (tok?.access) {
      try {
        const r = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
          headers: { Authorization: `Bearer ${tok.access}` },
        });
        if (r.status === 200) {
          const d = await r.json();
          const track = d?.item?.name || 'unknown';
          const artist = d?.item?.artists?.[0]?.name || '';
          const playing = d?.is_playing ? '▶' : '⏸';
          return { data: `[Spotify: ${playing} ${track}${artist ? ' — ' + artist : ''}]`, action: 'none' };
        }
        if (r.status === 204) return { data: '[Spotify: nothing playing]', action: 'none' };
      } catch {}
    } else {
      return { data: '[Spotify: not connected. Go to Account → AI & Services to connect.]', action: 'none' };
    }
  }

  return null;
}

/** Execute approved action (called after user confirms) */
export async function executeApprovedAction(action: string, payload: any): Promise<string> {
  if (action === 'send_email') {
    await gmailSend(payload.to, payload.subject || 'From Orin AI', payload.body);
    return `✅ Email sent to ${payload.to}`;
  }
  if (action === 'create_doc') {
    if (payload.type === 'sheet') {
      const r = await sheetsCreate(payload.title);
      return `✅ Sheet created: https://docs.google.com/spreadsheets/d/${r.spreadsheetId}`;
    }
    if (payload.type === 'slide') {
      const r = await slidesCreate(payload.title);
      return `✅ Slides created: https://docs.google.com/presentation/d/${r.presentationId}`;
    }
    const r = await docsCreate(payload.title);
    return `✅ Doc created: https://docs.google.com/document/d/${r.documentId}`;
  }
  return 'Done';
}
