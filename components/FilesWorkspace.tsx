/**
 * FilesWorkspace — Upload, search and manage files.
 * Files stored in Vercel Blob, metadata + parsed text in Firestore via /api/upload-blob and /api/files.
 * PDF text extraction happens server-side; AI can read file content in chat.
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { firebaseService } from '../services/firebaseService';
import { Language, UserAccount } from '../types';

interface FilesWorkspaceProps {
  onClose: () => void;
  lang: Language;
  user: UserAccount | null;
}

interface FileRecord {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  url: string;
  parsedStatus: 'done' | 'failed' | 'none' | 'not_applicable';
  createdAt: any;
}

const MAX_FILE_SIZE_MB = 100;

const formatBytes = (bytes: number) => {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
};

const getStorageLabel = (user: UserAccount | null): string => {
  const plan = user?.plan?.toLowerCase() ?? 'free';
  if (plan === 'pro' || plan === 'pro_yearly') return '100 GB';
  if (plan.includes('basic')) return '5 GB';
  return '1 GB';
};

async function getAuthHeader(): Promise<Record<string, string>> {
  try {
    const tok = await (firebaseService as any).getIdToken?.();
    return tok ? { Authorization: `Bearer ${tok}` } : {};
  } catch { return {}; }
}

const FilesWorkspace: React.FC<FilesWorkspaceProps> = ({ onClose, user }) => {
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deletingAll, setDeletingAll] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const plan = user?.plan?.toLowerCase() ?? 'free';

  // ── Load file list from backend ─────────────────────────────────────────
  const loadFiles = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    try {
      const headers = await getAuthHeader();
      const r = await fetch('/api/files', { headers });
      if (r.ok) {
        const d = await r.json();
        setFiles(d.files || []);
        // Sync file IDs to localStorage for ChatWorkspace to pick up
        const ids = (d.files || []).map((f: FileRecord) => f.id);
        localStorage.setItem('orin_file_ids', JSON.stringify(ids));
        window.dispatchEvent(new CustomEvent('orin-files-updated', { detail: { count: ids.length, ids } }));
      }
    } catch (e: any) { setError(e?.message || 'Failed to load files'); }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  // ── Upload ───────────────────────────────────────────────────────────────
  const handleUpload = useCallback(async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    if (!user) { setError('Sign in to upload files.'); return; }
    setError(null);
    setIsUploading(true);

    for (const file of Array.from(fileList)) {
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        setError(`${file.name} exceeds ${MAX_FILE_SIZE_MB} MB.`);
        continue;
      }
      setUploadProgress(`Uploading ${file.name}…`);
      try {
        const headers = await getAuthHeader();
        const fd = new FormData();
        fd.append('file', file);
        const r = await fetch('/api/upload-blob', { method: 'POST', headers, body: fd });
        if (!r.ok) { const d = await r.json(); throw new Error(d.error || 'Upload failed'); }
        const d = await r.json();
        setUploadProgress(`${file.name} uploaded${d.parsedStatus === 'done' ? ' + text extracted ✓' : ' ✓'}`);
      } catch (e: any) {
        setError(`Failed to upload ${file.name}: ${e?.message}`);
      }
    }
    setIsUploading(false);
    setTimeout(() => setUploadProgress(null), 2500);
    await loadFiles();
  }, [user, loadFiles]);

  // ── Delete single ────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    try {
      const headers = await getAuthHeader();
      await fetch(`/api/files?id=${encodeURIComponent(id)}`, { method: 'DELETE', headers });
      setDeleteConfirmId(null);
      await loadFiles();
    } catch (e: any) { setError(e?.message || 'Delete failed'); }
  };

  // ── Delete all ───────────────────────────────────────────────────────────
  const handleDeleteAll = async () => {
    setDeletingAll(true);
    try {
      const headers = await getAuthHeader();
      await fetch('/api/files?all=true', { method: 'DELETE', headers });
      localStorage.removeItem('orin_file_ids');
      window.dispatchEvent(new CustomEvent('orin-files-updated', { detail: { count: 0, ids: [] } }));
      await loadFiles();
    } catch (e: any) { setError(e?.message || 'Delete all failed'); }
    finally { setDeletingAll(false); }
  };

  const onDrop = (e: React.DragEvent) => { e.preventDefault(); handleUpload(e.dataTransfer.files); };

  const statusIcon = (s: FileRecord['parsedStatus']) => {
    if (s === 'done')           return <span title="AI can read this file" className="text-[9px] text-green-500 font-bold">AI✓</span>;
    if (s === 'failed')         return <span title="Text extraction failed" className="text-[9px] text-red-400 font-bold">✗</span>;
    if (s === 'not_applicable') return <span title="Binary file — attach directly in chat" className="text-[9px] text-slate-400">IMG</span>;
    return null;
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 overflow-hidden">
      {/* Header */}
      <header className="shrink-0 h-14 flex items-center justify-between px-4 border-b border-slate-100 dark:border-white/5">
        <div className="flex items-center gap-3">
          <i className="fa-solid fa-folder-open text-indigo-500" />
          <span className="font-black text-sm uppercase tracking-tight text-slate-900 dark:text-white">File Library</span>
          <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
            plan === 'pro' || plan === 'pro_yearly' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
            plan.includes('basic') ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' :
            'bg-slate-100 text-slate-500'
          }`}>
            {getStorageLabel(user)} storage
          </span>
        </div>
        <div className="flex items-center gap-2">
          {files.length > 0 && (
            <button onClick={handleDeleteAll} disabled={deletingAll}
              className="text-[10px] text-red-400 hover:text-red-600 font-bold px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-40">
              {deletingAll ? 'Deleting…' : 'Delete All'}
            </button>
          )}
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/5 text-slate-400 hover:text-red-500 flex items-center justify-center">
            <i className="fa-solid fa-xmark text-xs" />
          </button>
        </div>
      </header>

      <div className="flex-1 flex flex-col overflow-hidden p-3 gap-3">
        {/* Upload zone */}
        <div
          onDrop={onDrop} onDragOver={e => e.preventDefault()}
          className="border-2 border-dashed border-slate-200 dark:border-white/10 rounded-2xl p-5 text-center hover:border-indigo-400 transition-colors cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <i className="fa-solid fa-cloud-arrow-up text-2xl text-slate-300 dark:text-slate-600 mb-2" />
          <p className="text-xs font-bold text-slate-500">Drop files or click to upload</p>
          <p className="text-[10px] text-slate-400 mt-0.5">PDF, TXT, MD, JSON — up to 100 MB · PDFs are parsed so AI can read them</p>
          {uploadProgress && <p className="text-[10px] text-indigo-500 font-bold mt-1">{uploadProgress}</p>}
        </div>
        <input ref={fileInputRef} type="file" className="hidden" multiple accept=".pdf,.txt,.md,.csv,.json" onChange={e => handleUpload(e.target.files)} />

        {/* Error */}
        {error && (
          <div className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded-xl px-3 py-2 flex items-center gap-2">
            <i className="fa-solid fa-triangle-exclamation" /> {error}
            <button onClick={() => setError(null)} className="ml-auto text-red-400"><i className="fa-solid fa-xmark" /></button>
          </div>
        )}

        {/* Not signed in */}
        {!user && (
          <p className="text-xs text-slate-400 text-center py-6">Sign in to use File Library</p>
        )}

        {/* File list */}
        {user && (
          <div className="flex-1 overflow-y-auto space-y-1.5">
            {loading ? (
              <p className="text-[11px] text-slate-400 text-center py-4">Loading files…</p>
            ) : files.length === 0 ? (
              <p className="text-[11px] text-slate-400 text-center py-4">No files yet — upload a PDF or text file above</p>
            ) : (
              files.map(f => (
                <div key={f.id} className="group relative">
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-white/5 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors">
                    <i className="fa-solid fa-file-lines text-indigo-400 text-xs shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">{f.name}</p>
                      <p className="text-[9px] text-slate-400">{formatBytes(f.size)}</p>
                    </div>
                    {statusIcon(f.parsedStatus)}
                    <button onClick={() => setDeleteConfirmId(deleteConfirmId === f.id ? null : f.id)}
                      className="shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-all">
                      <i className="fa-solid fa-trash text-[10px]" />
                    </button>
                  </div>
                  {deleteConfirmId === f.id && (
                    <div className="mt-1 flex items-center gap-2 px-2 py-2 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                      <p className="text-[10px] text-red-600 flex-1">Remove "{f.name}"?</p>
                      <button onClick={() => handleDelete(f.id)} className="px-2.5 py-1 rounded-lg bg-red-500 text-white text-[9px] font-black">Delete</button>
                      <button onClick={() => setDeleteConfirmId(null)} className="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-white/10 text-slate-500 text-[9px] font-black">Cancel</button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FilesWorkspace;
