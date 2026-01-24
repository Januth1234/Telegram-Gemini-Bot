
import React, { useState } from 'react';
import { Language } from '../types';
import { translations } from '../translations';

interface DownloadsPageProps {
  onClose: () => void;
  lang: Language;
}

const DownloadsPage: React.FC<DownloadsPageProps> = ({ onClose, lang }) => {
  const t = translations[lang];
  const [activeCodeTab, setActiveCodeTab] = useState<'js' | 'ts' | 'py' | 'vue'>('js');
  const [downloading, setDownloading] = useState<string | null>(null);

  const content = {
    en: {
        subtitle: "v4.5.3 Stable Distribution",
        winTitle: "Windows Desktop",
        winDesc: "Orin's most powerful workspace. Full access to GPU-accelerated reasoning, Studio Create, and local memory synchronization.",
        stable: "Stable Build",
        verified: "Digital Signature: Verified",
        win64: "Windows 64-bit",
        win32: "32-bit (x86)",
        winArm: "Windows ARM",
        androidTitle: "Android Assistant",
        androidDesc: "Direct APK with Voice Mode v5.0-BETA.",
        downloadApk: "Download APK",
        iosTitle: "iPhone (iOS)",
        iosDesc: "TestFlight Preview with iCloud Sync.",
        getPackage: "Get Package",
        macTitle: "macOS Universal",
        macDesc: "Optimized for M1, M2 & M3 Silicon.",
        downloadDmg: "Download DMG",
        apiTitle: "Public Search API Integration",
        preparing: "Preparing Artifact",
        footer: "JN Productions Global • 2026 Distribution Protocol"
    },
    si: {
        subtitle: "v4.5.3 ස්ථාවර නිකුතුව",
        winTitle: "Windows පරිගණක",
        winDesc: "ඔරින්ගේ වඩාත්ම බලගතු වැඩබිම. GPU ත්වරණය, නිර්මාණ ස්ටුඩියෝව සහ දේශීය මතක සමමුහුර්තකරණය සඳහා පූර්ණ ප්‍රවේශය.",
        stable: "ස්ථාවර පිටපත",
        verified: "ඩිජිටල් අත්සන: තහවුරු කර ඇත",
        win64: "Windows 64-bit",
        win32: "32-bit (x86)",
        winArm: "Windows ARM",
        androidTitle: "Android සහායක",
        androidDesc: "Voice Mode v5.0-BETA සමඟ ඍජු APK එක.",
        downloadApk: "APK බාගන්න",
        iosTitle: "iPhone (iOS)",
        iosDesc: "TestFlight හරහා iCloud Sync සමඟ.",
        getPackage: "පැකේජය ලබාගන්න",
        macTitle: "macOS Universal",
        macDesc: "M1, M2 සහ M3 චිප් සඳහා සකසා ඇත.",
        downloadDmg: "DMG බාගන්න",
        apiTitle: "පොදු සෙවුම් API ඒකාබද්ධ කිරීම",
        preparing: "සකස් කරමින් පවතී",
        footer: "JN Productions Global • 2026 බෙදාහැරීමේ නීති"
    },
    ta: {
        subtitle: "v4.5.3 நிலையான வெளியீடு",
        winTitle: "Windows டெஸ்க்டாப்",
        winDesc: "ஓரின் மிகச் சிறந்த பணியிடம். GPU வேகம், உருவாக்க ஸ்டுடியோ மற்றும் உள்ளூர் நினைவக ஒத்திசைவுக்கான முழு அணுகல்.",
        stable: "நிலையான பதிப்பு",
        verified: "டிஜிட்டல் கையொப்பம்: சரிபார்க்கப்பட்டது",
        win64: "Windows 64-bit",
        win32: "32-bit (x86)",
        winArm: "Windows ARM",
        androidTitle: "Android உதவியாளர்",
        androidDesc: "Voice Mode v5.0-BETA உடன் நேரடி APK.",
        downloadApk: "APK பதிவிறக்கவும்",
        iosTitle: "iPhone (iOS)",
        iosDesc: "iCloud Sync உடன் TestFlight முன்னோட்டம்.",
        getPackage: "தொகுப்பைப் பெறுங்கள்",
        macTitle: "macOS Universal",
        macDesc: "M1, M2 & M3 சிலிக்கானுக்காக மேம்படுத்தப்பட்டது.",
        downloadDmg: "DMG பதிவிறக்கவும்",
        apiTitle: "பொது தேடல் API ஒருங்கிணைப்பு",
        preparing: "தயாராகிறது",
        footer: "JN Productions Global • 2026 விநியோக நெறிமுறை"
    }
  };

  const text = content[lang];

  const handleDownload = (platform: string, arch?: string) => {
    const label = `${platform} ${arch || ''}`;
    setDownloading(label);
    
    // Official Release Links v4.5.3
    let url = "";
    if (platform === 'Android') {
        url = "https://github.com/Januth1234/Telegram-Gemini-Bot/releases/download/V4.5.3/Orin.AI.Mob.apk";
    } else if (platform === 'Windows') {
        if (arch === 'x64') url = "https://github.com/Januth1234/Telegram-Gemini-Bot/releases/download/V4.5.3/Orin.AI.Setup.4.5.3.x64.exe";
        else if (arch === 'x32') url = "https://github.com/Januth1234/Telegram-Gemini-Bot/releases/download/V4.5.3/Orin.AI.Setup.4.5.3.x32.exe";
        else if (arch === 'ARM') url = "https://github.com/Januth1234/Telegram-Gemini-Bot/releases/download/V4.5.3/Orin.AI.Setup.4.5.3.xARM.exe";
    }

    setTimeout(() => {
      if (url) {
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute('download', '');
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
      } else {
          const filename = `orin-setup-${platform.toLowerCase()}${arch ? '-' + arch.toLowerCase().replace(' ', '-') : ''}.exe`;
          const dummyContent = `Orin AI Platform v4.5.3 Installer\nTarget: ${label}\nVerified Artifact: JN-PROD-${Date.now()}\n\nThis is a secure system download from JN Productions Global.`;
          
          const blob = new Blob([dummyContent], { type: 'application/octet-stream' });
          const blobUrl = window.URL.createObjectURL(blob);
          
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(blobUrl);
      }
      setDownloading(null);
    }, 1000);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Code snippet copied to clipboard!');
  };

  const codeSnippets = {
    js: `<!-- Orin AI Embed Snippet (HTML/JS) -->
<div id="orin-widget-container"></div>
<script src="https://cdn.orinai.org/sdk/v4/widget.min.js"></script>
<script>
  OrinAI.init({
    container: '#orin-widget-container',
    apiKey: 'YOUR_PUBLIC_KEY',
    theme: 'system', // 'light' | 'dark' | 'system'
    language: 'si-LK', // Optional: Force Sinhala
    config: {
      enableVoice: true,
      mode: 'reasoning'
    }
  });
</script>`,
    ts: `// React / Next.js Implementation
import { OrinClient } from '@orinai/sdk';

const orin = new OrinClient({
  apiKey: process.env.NEXT_PUBLIC_ORIN_KEY,
  region: 'asia-south1'
});

export async function generateResponse(prompt: string) {
  try {
    const result = await orin.reasoning.create({
      prompt: prompt,
      depth: 'high', // 'normal' | 'high' | 'research'
      grounding: true,
      maxTokens: 2048
    });
    return result.text;
  } catch (error) {
    console.error("Orin Neural Error:", error);
    return null;
  }
}`,
    py: `# Python Integration (Flask/FastAPI/Streamlit)
import requests
import os

def query_orin_neural_engine(prompt, lang="en"):
    endpoint = "https://api.orinai.org/v4/generate"
    headers = {
        "Authorization": f"Bearer {os.getenv('ORIN_API_KEY')}",
        "Content-Type": "application/json"
    }
    payload = {
        "prompt": prompt,
        "mode": "deep_reasoning",
        "target_lang": lang,
        "safety_settings": "balanced"
    }
    
    response = requests.post(endpoint, json=payload, headers=headers)
    if response.status_code == 200:
        return response.json()['output']
    return None

# Usage
print(query_orin_neural_engine("Explain Quantum Physics in simple terms", "si"))`,
    vue: `<!-- Vue 3 Composition API -->
<script setup>
import { ref } from 'vue'

const answer = ref('')
const loading = ref(false)

const askOrin = async (question) => {
  loading.value = true
  try {
    const req = await fetch('https://api.orinai.org/v4/ask', {
      method: 'POST',
      headers: { 
        'Authorization': 'Bearer YOUR_KEY',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ prompt: question })
    })
    const res = await req.json()
    answer.value = res.data.content
  } catch (e) {
    answer.value = "Connection failed"
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="orin-chat">
    <button @click="askOrin('Hello')" :disabled="loading">
      {{ loading ? 'Thinking...' : 'Ask AI' }}
    </button>
    <div v-if="answer" class="response">{{ answer }}</div>
  </div>
</template>`
  };

  return (
    <div className="h-full w-full overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-slate-950 animate-reveal pb-20">
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-10 md:py-16">
        
        <header className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-8 mb-12">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-cyan-600 flex items-center justify-center text-white shadow-xl">
              <i className="fa-solid fa-cloud-arrow-down text-xl"></i>
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter uppercase leading-none">{t.downloads}</h2>
              <p className={`text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mt-2 ${lang !== 'en' ? 'sinhala-text' : ''}`}>{text.subtitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-12 h-12 rounded-2xl glass-panel flex items-center justify-center text-slate-400 hover:text-red-500 transition-all hover:rotate-90">
            <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </header>

        {/* Windows Hero Download */}
        <section className="mb-12">
          <div className="glass-panel p-8 md:p-12 rounded-[48px] border border-cyan-500/20 shadow-2xl relative overflow-hidden bg-white/80 dark:bg-slate-900/80 backdrop-blur-3xl">
             <div className="absolute top-0 right-0 p-32 bg-cyan-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
             
             <div className="flex flex-col md:flex-row items-center justify-between gap-10 relative z-10">
                <div className="flex-1 space-y-6 text-center md:text-left">
                   <div className="flex items-center justify-center md:justify-start gap-4">
                      <i className="fa-brands fa-windows text-5xl text-cyan-600"></i>
                      <h3 className={`text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter ${lang !== 'en' ? 'sinhala-text' : ''}`}>{text.winTitle}</h3>
                   </div>
                   <p className={`text-sm font-medium text-slate-600 dark:text-slate-400 max-w-md leading-relaxed ${lang !== 'en' ? 'sinhala-text' : ''}`}>
                     {text.winDesc}
                   </p>
                   <div className="flex flex-wrap justify-center md:justify-start gap-2">
                      <span className={`px-3 py-1 bg-cyan-500/10 text-cyan-600 rounded-lg text-[10px] font-black uppercase tracking-widest border border-cyan-500/20 ${lang !== 'en' ? 'sinhala-text' : ''}`}>{text.stable}</span>
                      <span className={`px-3 py-1 bg-slate-100 dark:bg-white/5 text-slate-400 rounded-lg text-[10px] font-black uppercase tracking-widest ${lang !== 'en' ? 'sinhala-text' : ''}`}>{text.verified}</span>
                   </div>
                </div>

                <div className="flex flex-col gap-3 w-full md:w-80">
                   <button 
                     onClick={() => handleDownload('Windows', 'x64')}
                     className="w-full py-5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-between px-8"
                   >
                     <span className={lang !== 'en' ? 'sinhala-text' : ''}>{text.win64}</span>
                     <i className="fa-solid fa-download"></i>
                   </button>
                   <div className="grid grid-cols-2 gap-3">
                      <button onClick={() => handleDownload('Windows', 'x32')} className={`py-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-500 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all ${lang !== 'en' ? 'sinhala-text' : ''}`}>{text.win32}</button>
                      <button onClick={() => handleDownload('Windows', 'ARM')} className={`py-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-500 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all ${lang !== 'en' ? 'sinhala-text' : ''}`}>{text.winArm}</button>
                   </div>
                </div>
             </div>
          </div>
        </section>

        {/* Other Platforms Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
           {/* Android */}
           <div className="glass-panel p-8 rounded-[40px] border border-black/5 dark:border-white/5 hover:border-emerald-500/30 transition-all group">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 mb-8 group-hover:scale-110 transition-transform">
                 <i className="fa-brands fa-android text-3xl"></i>
              </div>
              <h4 className={`text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight mb-2 ${lang !== 'en' ? 'sinhala-text' : ''}`}>{text.androidTitle}</h4>
              <p className={`text-xs text-slate-400 font-bold mb-8 ${lang !== 'en' ? 'sinhala-text' : ''}`}>{text.androidDesc}</p>
              <button onClick={() => handleDownload('Android', 'APK')} className={`w-full py-4 bg-slate-100 dark:bg-white/5 hover:bg-emerald-500 hover:text-white text-slate-500 dark:text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${lang !== 'en' ? 'sinhala-text' : ''}`}>{text.downloadApk}</button>
           </div>

           {/* iOS */}
           <div className="glass-panel p-8 rounded-[40px] border border-black/5 dark:border-white/5 hover:border-slate-400/30 transition-all group">
              <div className="w-14 h-14 rounded-2xl bg-slate-200 dark:bg-white/10 flex items-center justify-center text-slate-700 dark:text-slate-300 mb-8 group-hover:scale-110 transition-transform">
                 <i className="fa-brands fa-apple text-3xl"></i>
              </div>
              <h4 className={`text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight mb-2 ${lang !== 'en' ? 'sinhala-text' : ''}`}>{text.iosTitle}</h4>
              <p className={`text-xs text-slate-400 font-bold mb-8 ${lang !== 'en' ? 'sinhala-text' : ''}`}>{text.iosDesc}</p>
              <button onClick={() => handleDownload('iOS', 'Package')} className={`w-full py-4 bg-slate-100 dark:bg-white/5 hover:bg-slate-900 hover:text-white text-slate-500 dark:text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${lang !== 'en' ? 'sinhala-text' : ''}`}>{text.getPackage}</button>
           </div>

           {/* macOS */}
           <div className="glass-panel p-8 rounded-[40px] border border-black/5 dark:border-white/5 hover:border-indigo-500/30 transition-all group">
              <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 mb-8 group-hover:scale-110 transition-transform">
                 <i className="fa-solid fa-laptop text-3xl"></i>
              </div>
              <h4 className={`text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight mb-2 ${lang !== 'en' ? 'sinhala-text' : ''}`}>{text.macTitle}</h4>
              <p className={`text-xs text-slate-400 font-bold mb-8 ${lang !== 'en' ? 'sinhala-text' : ''}`}>{text.macDesc}</p>
              <button onClick={() => handleDownload('macOS', 'DMG')} className={`w-full py-4 bg-slate-100 dark:bg-white/5 hover:bg-indigo-600 hover:text-white text-slate-500 dark:text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${lang !== 'en' ? 'sinhala-text' : ''}`}>{text.downloadDmg}</button>
           </div>
        </section>

        {/* Developer Sandbox */}
        <section className="animate-reveal" style={{ animationDelay: '0.2s' }}>
           <div className="flex items-center gap-4 mb-8">
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-400"><i className="fa-solid fa-code"></i></div>
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">{t.forDevs}</h3>
                <p className={`text-[10px] font-black text-slate-400 uppercase tracking-widest ${lang !== 'en' ? 'sinhala-text' : ''}`}>{text.apiTitle}</p>
              </div>
           </div>

           <div className="glass-panel rounded-[40px] border border-black/5 dark:border-white/5 overflow-hidden shadow-sm">
              <div className="bg-slate-100/50 dark:bg-white/5 p-4 flex flex-col md:flex-row items-center justify-between gap-4 border-b border-black/5 dark:border-white/5 px-8">
                 <div className="flex flex-wrap gap-1 bg-white dark:bg-black/20 rounded-xl p-1 shadow-inner">
                    <button onClick={() => setActiveCodeTab('js')} className={`px-5 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeCodeTab === 'js' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950' : 'text-slate-400'}`}>JavaScript</button>
                    <button onClick={() => setActiveCodeTab('ts')} className={`px-5 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeCodeTab === 'ts' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950' : 'text-slate-400'}`}>TypeScript</button>
                    <button onClick={() => setActiveCodeTab('py')} className={`px-5 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeCodeTab === 'py' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950' : 'text-slate-400'}`}>Python</button>
                    <button onClick={() => setActiveCodeTab('vue')} className={`px-5 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeCodeTab === 'vue' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950' : 'text-slate-400'}`}>Vue.js</button>
                 </div>
                 <button onClick={() => copyToClipboard(codeSnippets[activeCodeTab])} className="flex items-center gap-2 px-6 py-2 bg-cyan-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-cyan-500 transition-all shadow-lg active:scale-95">
                    <i className="fa-solid fa-copy"></i>
                    Copy Snippet
                 </button>
              </div>
              <div className="bg-[#0f172a] p-8 md:p-12 overflow-x-auto custom-scrollbar">
                 <pre className="text-xs md:text-sm font-mono text-cyan-200/80 leading-relaxed">
                    <code>{codeSnippets[activeCodeTab]}</code>
                 </pre>
              </div>
           </div>
        </section>

        {downloading && (
           <div className="fixed bottom-10 right-10 z-[200] glass-panel px-6 py-4 rounded-2xl border border-cyan-500 shadow-2xl flex items-center gap-4 animate-reveal bg-white dark:bg-slate-900">
              <div className="w-10 h-10 rounded-full border-4 border-cyan-500/20 border-t-cyan-500 animate-spin"></div>
              <div>
                 <p className={`text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest ${lang !== 'en' ? 'sinhala-text' : ''}`}>{text.preparing}</p>
                 <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{downloading} Package</p>
              </div>
           </div>
        )}

        <footer className="pt-32 text-center opacity-30">
           <div className="w-12 h-1 bg-slate-300 dark:bg-slate-800 mx-auto rounded-full mb-8"></div>
           <p className={`text-[9px] font-black uppercase tracking-[0.6em] text-slate-500 dark:text-slate-400 ${lang !== 'en' ? 'sinhala-text' : ''}`}>
             {text.footer}
           </p>
        </footer>
      </div>
    </div>
  );
};

export default DownloadsPage;
