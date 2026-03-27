/**
 * FilesWorkspace — Upload, search and manage files via Gemini File Search API.
 * Free: 1 GB storage, 3 searches/day
 * Basic: 5 GB storage, 10 searches/day  
 * Pro: 100 GB storage, unlimited searches
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { geminiService } from '../services/geminiService';
import { cacheService, CacheKey } from '../services/cacheService';
import { Language, UserAccount } from '../types';

interface FilesWorkspaceProps {
  onClose: () => void;
  lang: Language;
  user: UserAccount | null;
}

const MAX_FILE_SIZE_MB = 100; // per file

const getStorageLimitMB = (user: UserAccount | null): number => {
  const plan = user?.plan?.toLowerCase() ?? 'free';
  if (plan === 'pro' || plan === 'pro_yearly') return 100 * 1024; // 100 GB
  if (plan === 'basic' || plan === 'basic_yearly') return 5 * 1024;  // 5 GB
  return 1024; // 1 GB free
};

const getSearchLimit = (user: UserAccount | null): number | null => {
  const plan = user?.plan?.toLowerCase() ?? 'free';
  if (plan === 'pro' || plan === 'pro_yearly') return null; // unlimited
  if (plan === 'basic' || plan === 'basic_yearly') return 10;
  return 3;
};

const formatBytes = (mb: number) =>
  mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`;

const FilesWorkspace: React.FC<FilesWorkspaceProps> = ({ onClose, user }) => {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<{ text: string; citations: Array<{ fileName: string; snippet: string }> } | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [storeName, setStoreName] = useState<string>('');
  const [searchesUsedToday, setSearchesUsedToday] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ name: string; size: string; date: string }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const storageLimitMB = getStorageLimitMB(user);
  const searchLimit = getSearchLimit(user);
  const plan = user?.plan?.toLowerCase() ?? 'free';

  useEffect(() => {
    // Load stored file store name and today's search count
    const cached = localStorage.getItem('orin_file_store_name') || '';
    setStoreName(cached);
    const today = new Date().toDateString();
    const usageKey = `orin_file_searches_${today}`;
    setSearchesUsedToday(parseInt(localStorage.getItem(usageKey) || '0', 10));

    const files = JSON.parse(localStorage.getItem('orin_uploaded_files') || '[]');
    setUploadedFiles(files);
  }, []);

  const initStore = async (): Promise<string> => {
    if (storeName) return storeName;
    setUploadProgress('Creating your personal file library…');
    try {
      const name = await geminiService.createFileSearchStore(`orin-files-${user?.id || 'guest'}`);
      if (name) {
        localStorage.setItem('orin_file_store_name', name);
        setStoreName(name);
        return name;
      }
    } catch { /* Store may already exist or API not available */ }
    // Fallback store name format
    const fallback = `fileSearchStores/orin-${user?.id || 'guest'}`;
    localStorage.setItem('orin_file_store_name', fallback);
    setStoreName(fallback);
    return fallback;
  };

  const handleUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    setIsUploading(true);

    for (const file of Array.from(files)) {
      const sizeMB = file.size / (1024 * 1024);
      if (sizeMB > MAX_FILE_SIZE_MB) {
        setError(`${file.name} exceeds 100 MB limit.`);
        continue;
      }

      setUploadProgress(`Uploading ${file.name}…`);
      try {
        const store = await initStore();
        await geminiService.uploadToFileStore(store, file);
        // Track in localStorage
        const existing = JSON.parse(localStorage.getItem('orin_uploaded_files') || '[]');
        const updated = [...existing, {
          name: file.name,
          size: sizeMB < 1 ? `${(sizeMB * 1024).toFixed(0)} KB` : `${sizeMB.toFixed(1)} MB`,
          date: new Date().toLocaleDateString()
        }];
        localStorage.setItem('orin_uploaded_files', JSON.stringify(updated));
        setUploadedFiles(updated);
        setUploadProgress(`${file.name} added ✓`);
      } catch (e: any) {
        setError(`Failed to upload ${file.name}: ${e?.message || 'Unknown error'}`);
      }
    }
    setIsUploading(false);
    setTimeout(() => setUploadProgress(null), 2000);
  }, [storeName, user]);

  const handleSearch = async () => {
    if (!query.trim()) return;

    // Check daily limit
    if (searchLimit !== null && searchesUsedToday >= searchLimit) {
      setError(`Daily search limit reached (${searchLimit}/day on ${plan} plan). Upgrade for more.`);
      return;
    }

    if (!storeName && uploadedFiles.length === 0) {
      setError('Upload files first before searching.');
      return;
    }

    setIsSearching(true);
    setError(null);
    setResult(null);

    try {
      const store = storeName || await initStore();
      const res = await geminiService.searchFiles({ query: query.trim(), fileSearchStoreName: store });
      setResult(res);

      // Increment usage
      const today = new Date().toDateString();
      const usageKey = `orin_file_searches_${today}`;
      const newCount = searchesUsedToday + 1;
      localStorage.setItem(usageKey, String(newCount));
      setSearchesUsedToday(newCount);
    } catch (e: any) {
      setError(e?.message || 'Search failed. Try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleUpload(e.dataTransfer.files);
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 overflow-hidden">
      {/* Header */}
      <header className="shrink-0 h-14 flex items-center justify-between px-4 border-b border-slate-100 dark:border-white/5 bg-white dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <i className="fa-solid fa-folder-open text-indigo-500" />
          <span className="font-black text-sm uppercase tracking-tight text-slate-900 dark:text-white">File Library</span>
          <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
            plan === 'pro' || plan === 'pro_yearly' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
            plan.includes('basic') ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' :
            'bg-slate-100 text-slate-500'
          }`}>
            {formatBytes(storageLimitMB)} storage
          </span>
        </div>
        <button onClick={onClose} className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/5 text-slate-400 hover:text-red-500 flex items-center justify-center">
          <i className="fa-solid fa-xmark text-xs" />
        </button>
      </header>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left: Upload zone + file list */}
        <div className="w-full md:w-64 shrink-0 border-b md:border-b-0 md:border-r border-slate-100 dark:border-white/5 flex flex-col">
          {/* Upload zone */}
          <div
            onDrop={onDrop}
            onDragOver={e => e.preventDefault()}
            className="m-3 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-2xl p-4 text-center hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <i className="fa-solid fa-cloud-arrow-up text-2xl text-slate-300 dark:text-slate-600 mb-2" />
            <p className="text-xs font-bold text-slate-500">Drop files or click</p>
            <p className="text-[10px] text-slate-400 mt-0.5">PDF, DOCX, TXT, MD — up to 100 MB each</p>
            {uploadProgress && <p className="text-[10px] text-indigo-500 font-bold mt-1">{uploadProgress}</p>}
          </div>
          <input ref={fileInputRef} type="file" className="hidden" multiple accept=".pdf,.docx,.txt,.md,.csv,.json" onChange={e => handleUpload(e.target.files)} />

          {/* Usage bar */}
          <div className="mx-3 mb-3 px-3 py-2 bg-slate-50 dark:bg-white/5 rounded-xl">
            <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-1">
              <span>Searches today</span>
              <span>{searchesUsedToday}{searchLimit !== null ? `/${searchLimit}` : ' (unlimited)'}</span>
            </div>
            {searchLimit !== null && (
              <div className="h-1.5 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${Math.min(100, (searchesUsedToday / searchLimit) * 100)}%` }} />
              </div>
            )}
          </div>

          {/* File list */}
          <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1.5">
            {uploadedFiles.length === 0 ? (
              <p className="text-[11px] text-slate-400 text-center py-4">No files yet</p>
            ) : (
              uploadedFiles.map((f, i) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-white/5">
                  <i className="fa-solid fa-file-lines text-indigo-400 text-xs shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">{f.name}</p>
                    <p className="text-[9px] text-slate-400">{f.size} · {f.date}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Search */}
        <div className="flex-1 flex flex-col overflow-hidden p-4 gap-3">
          {/* Search input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Search your files… e.g. 'What does the contract say about payment?'"
              className="flex-1 px-4 py-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <button
              onClick={handleSearch}
              disabled={isSearching || !query.trim()}
              className="px-5 py-3 rounded-2xl bg-indigo-600 text-white text-xs font-black uppercase tracking-wider hover:bg-indigo-500 disabled:opacity-50 transition-colors"
            >
              {isSearching ? <i className="fa-solid fa-circle-notch animate-spin" /> : 'Search'}
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-400 font-medium">
              {error}
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="flex-1 overflow-y-auto space-y-3">
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-white/10 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <i className="fa-solid fa-magnifying-glass text-indigo-500 text-xs" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Answer from your files</span>
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{result.text}</p>
              </div>
              {result.citations.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sources</p>
                  {result.citations.map((c, i) => (
                    <div key={i} className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
                      <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-0.5">{c.fileName}</p>
                      {c.snippet && <p className="text-[11px] text-slate-400 italic">"{c.snippet}"</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {!result && !error && (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 opacity-40">
              <i className="fa-solid fa-magnifying-glass-arrow-right text-4xl text-slate-300" />
              <div>
                <p className="text-sm font-bold text-slate-400">Search your documents</p>
                <p className="text-xs text-slate-400 mt-1">Upload PDFs, Word docs, text files —<br/>then ask questions in plain English</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FilesWorkspace;
