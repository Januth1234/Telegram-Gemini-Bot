
import React, { useState } from 'react';
import { Language } from '../types';
import { translations } from '../translations';

interface DownloadsPageProps {
  onClose: () => void;
  lang: Language;
}

const DownloadsPage: React.FC<DownloadsPageProps> = ({ onClose, lang }) => {
  const t = translations[lang];
  const [activeCodeTab, setActiveCodeTab] = useState<'js' | 'ts' | 'py'>('js');

  const handleDownload = (platform: string, arch?: string) => {
    // Simulate blob download
    const filename = `orin-setup-${platform.toLowerCase()}${arch ? '-' + arch : ''}.exe`;
    const dummyContent = `Orin AI Installer for ${platform} ${arch || ''}\n\nThis is a placeholder for the actual executable file.\nVerification Code: ORIN-${Date.now()}`;
    
    const blob = new Blob([dummyContent], { type: 'application/octet-stream' });
    const url = window.URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const codeSnippets = {
    js: `<!-- Orin AI Search Widget (HTML/JS) -->
<div style="max-width: 600px; margin: 20px auto; font-family: system-ui, sans-serif;">
  <!-- Search Bar -->
  <form onsubmit="searchOrin(event)" style="display: flex; align-items: center; background: rgba(255, 255, 255, 0.9); backdrop-filter: blur(10px); border: 1px solid rgba(0,0,0,0.1); border-radius: 28px; padding: 6px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
    <input type="text" id="orin-prompt" placeholder="How can I help you today?" required style="flex: 1; background: transparent; border: none; padding: 12px 20px; font-size: 16px; outline: none; color: #1e293b;" />
    <button type="submit" style="background: #0f172a; color: white; border: none; padding: 12px 28px; border-radius: 20px; font-weight: 800; font-size: 12px; letter-spacing: 1px; text-transform: uppercase; cursor: pointer; transition: 0.2s;">GO</button>
  </form>
  
  <!-- Footer -->
  <div style="text-align: center; margin-top: 12px; font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 2px;">
    Orin AI | JN Productions | Januth Nimnal
  </div>
</div>

<script>
  function searchOrin(e) {
    e.preventDefault();
    const query = document.getElementById('orin-prompt').value;
    if (query.trim()) {
      // Redirects to Orin AI with the prompt carried over
      window.location.href = "https://www.orinai.org/#chat?prompt=" + encodeURIComponent(query);
    }
  }
</script>`,
    ts: `// React / TypeScript Component
import React, { useState } from 'react';

export const OrinSearchWidget = () => {
  const [query, setQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      window.location.href = \`https://www.orinai.org/#chat?prompt=\${encodeURIComponent(query)}\`;
    }
  };

  const styles = {
    container: { maxWidth: '600px', margin: '20px auto', fontFamily: 'system-ui, sans-serif' },
    form: { display: 'flex', alignItems: 'center', background: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(10px)', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '28px', padding: '6px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' },
    input: { flex: 1, background: 'transparent', border: 'none', padding: '12px 20px', fontSize: '16px', outline: 'none', color: '#1e293b' },
    button: { background: '#0f172a', color: 'white', border: 'none', padding: '12px 28px', borderRadius: '20px', fontWeight: 800, fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase' as const, cursor: 'pointer' },
    footer: { textAlign: 'center' as const, marginTop: '12px', fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: '2px' }
  };

  return (
    <div style={styles.container}>
      <form onSubmit={handleSearch} style={styles.form}>
        <input 
          type="text" 
          value={query} 
          onChange={(e) => setQuery(e.target.value)} 
          placeholder="How can I help you today?" 
          style={styles.input} 
        />
        <button type="submit" style={styles.button}>GO</button>
      </form>
      <div style={styles.footer}>
        Orin AI | JN Productions | Januth Nimnal
      </div>
    </div>
  );
};`,
    py: `# Python (Flask Example serving HTML)
from flask import Flask

app = Flask(__name__)

@app.route('/orin-widget')
def orin_widget():
    # Returns the styled widget HTML
    return """
    <div style="max-width: 600px; margin: 20px auto; font-family: system-ui, sans-serif;">
      <form onsubmit="event.preventDefault(); window.location.href='https://www.orinai.org/#chat?prompt='+encodeURIComponent(this.querySelector('input').value)" 
            style="display: flex; align-items: center; background: rgba(255, 255, 255, 0.9); backdrop-filter: blur(10px); border: 1px solid rgba(0,0,0,0.1); border-radius: 28px; padding: 6px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
        <input type="text" placeholder="How can I help you today?" required 
               style="flex: 1; background: transparent; border: none; padding: 12px 20px; font-size: 16px; outline: none; color: #1e293b;" />
        <button type="submit" 
                style="background: #0f172a; color: white; border: none; padding: 12px 28px; border-radius: 20px; font-weight: 800; font-size: 12px; letter-spacing: 1px; text-transform: uppercase; cursor: pointer;">
          GO
        </button>
      </form>
      <div style="text-align: center; margin-top: 12px; font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 2px;">
        Orin AI | JN Productions | Januth Nimnal
      </div>
    </div>
    """

if __name__ == '__main__':
    app.run(port=5000)
`
  };

  return (
    <div className="h-full w-full overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-slate-950 animate-reveal">
      <div className="max-w-6xl mx-auto px-6 py-12 pb-32">
        <header className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-8 mb-12">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-cyan-600 flex items-center justify-center text-white shadow-lg">
              <i className="fa-solid fa-download"></i>
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">{t.downloads}</h2>
              <p className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.3em]">{t.downloadsDesc}</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-10 h-10 rounded-xl glass-panel flex items-center justify-center text-slate-500 hover:text-red-500 transition-all hover:rotate-90"
          >
            <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </header>

        {/* Windows Main Card */}
        <section className="mb-12 animate-reveal">
          <div className="glass-panel p-8 md:p-12 rounded-[40px] border border-cyan-500/20 shadow-2xl relative overflow-hidden bg-white/60 dark:bg-slate-900/60">
            <div className="absolute top-0 right-0 p-32 bg-cyan-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
            
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 relative z-10">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <i className="fa-brands fa-windows text-3xl text-cyan-600 dark:text-cyan-400"></i>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Windows Desktop</h3>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300 font-medium max-w-md">
                  Experience the full power of Orin Neural Workspace on your PC. Optimized for high-performance reasoning and creative tasks.
                </p>
                <div className="flex flex-wrap gap-2 pt-2">
                   <span className="px-3 py-1 bg-slate-100 dark:bg-white/5 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-500">v4.0.1</span>
                   <span className="px-3 py-1 bg-slate-100 dark:bg-white/5 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-500">Stable</span>
                </div>
              </div>

              <div className="flex flex-col gap-3 w-full md:w-auto">
                <button 
                  onClick={() => handleDownload('Windows', '64-bit')}
                  className="px-8 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-950 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-between gap-6"
                >
                  <span>Download 64-bit</span>
                  <i className="fa-solid fa-cloud-arrow-down"></i>
                </button>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => handleDownload('Windows', '32-bit')}
                    className="px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-white/5 transition-all"
                  >
                    32-bit (x86)
                  </button>
                  <button 
                    onClick={() => handleDownload('Windows', 'ARM')}
                    className="px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-white/5 transition-all"
                  >
                    Windows ARM
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Other Platforms Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20 animate-reveal" style={{ animationDelay: '0.1s' }}>
          {/* Android */}
          <div className="glass-panel p-8 rounded-[32px] border border-black/5 dark:border-white/5 hover:border-emerald-500/30 transition-all group">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 mb-6 group-hover:scale-110 transition-transform">
              <i className="fa-brands fa-android text-2xl"></i>
            </div>
            <h4 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight mb-2">Android</h4>
            <p className="text-xs text-slate-500 font-bold mb-6">Mobile Neural Assistant APK</p>
            <button 
              onClick={() => handleDownload('Android')}
              className="w-full py-3 bg-slate-100 dark:bg-white/5 hover:bg-emerald-500 hover:text-white text-slate-600 dark:text-slate-300 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all"
            >
              Download APK
            </button>
          </div>

          {/* iOS */}
          <div className="glass-panel p-8 rounded-[32px] border border-black/5 dark:border-white/5 hover:border-slate-500/30 transition-all group">
            <div className="w-12 h-12 rounded-2xl bg-slate-500/10 flex items-center justify-center text-slate-600 dark:text-slate-300 mb-6 group-hover:scale-110 transition-transform">
              <i className="fa-brands fa-apple text-2xl"></i>
            </div>
            <h4 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight mb-2">iPhone (iOS)</h4>
            <p className="text-xs text-slate-500 font-bold mb-6">TestFlight Package</p>
            <button 
              onClick={() => handleDownload('iOS')}
              className="w-full py-3 bg-slate-100 dark:bg-white/5 hover:bg-slate-900 hover:text-white text-slate-600 dark:text-slate-300 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all"
            >
              Get Package
            </button>
          </div>

          {/* macOS */}
          <div className="glass-panel p-8 rounded-[32px] border border-black/5 dark:border-white/5 hover:border-slate-500/30 transition-all group">
            <div className="w-12 h-12 rounded-2xl bg-slate-500/10 flex items-center justify-center text-slate-600 dark:text-slate-300 mb-6 group-hover:scale-110 transition-transform">
              <i className="fa-solid fa-laptop text-2xl"></i>
            </div>
            <h4 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight mb-2">macOS</h4>
            <p className="text-xs text-slate-500 font-bold mb-6">Apple Silicon & Intel</p>
            <button 
              onClick={() => handleDownload('macOS')}
              className="w-full py-3 bg-slate-100 dark:bg-white/5 hover:bg-slate-900 hover:text-white text-slate-600 dark:text-slate-300 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all"
            >
              Download DMG
            </button>
          </div>
        </section>

        {/* Developer Section */}
        <section className="animate-reveal" style={{ animationDelay: '0.2s' }}>
           <div className="flex items-center gap-3 mb-8">
              <i className="fa-solid fa-code text-slate-400"></i>
              <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">{t.forDevs}</h3>
           </div>

           <div className="glass-panel rounded-[32px] border border-black/5 dark:border-white/5 overflow-hidden">
              <div className="bg-slate-100 dark:bg-white/5 p-4 border-b border-black/5 dark:border-white/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                 <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">Orin Search Integration</h4>
                    <p className="text-[10px] font-medium text-slate-500 mt-1">Add a search bar to your site that redirects users directly to Orin Chat.</p>
                 </div>
                 <div className="flex p-1 bg-white dark:bg-black/20 rounded-lg">
                    <button 
                      onClick={() => setActiveCodeTab('js')}
                      className={`px-4 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${activeCodeTab === 'js' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                    >
                      JavaScript
                    </button>
                    <button 
                      onClick={() => setActiveCodeTab('ts')}
                      className={`px-4 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${activeCodeTab === 'ts' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                    >
                      TypeScript
                    </button>
                    <button 
                      onClick={() => setActiveCodeTab('py')}
                      className={`px-4 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${activeCodeTab === 'py' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                    >
                      Python
                    </button>
                 </div>
              </div>
              <div className="bg-[#1e1e1e] p-6 md:p-8 overflow-x-auto custom-scrollbar">
                 <pre className="text-xs md:text-sm font-mono text-slate-300 leading-relaxed">
                    <code>{codeSnippets[activeCodeTab]}</code>
                 </pre>
              </div>
           </div>
        </section>

      </div>
    </div>
  );
};

export default DownloadsPage;
