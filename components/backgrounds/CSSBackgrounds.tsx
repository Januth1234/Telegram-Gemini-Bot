/**
 * CSSBackgrounds — GPU-free visual effects.
 * 
 * Rules enforced:
 * - NO filter:blur() — forces GPU rasterization every frame
 * - NO SVG feTurbulence — creates compositing layer + CPU noise calculation
 * - NO backdrop-filter — forces GPU composite of everything behind it
 * - ONLY transform + opacity animations — run on compositor thread, 0% CPU/GPU
 * - On touch devices (@media hover:none): static gradients, zero animation
 */
import React from 'react';

// ─── Aurora ─────────────────────────────────────────────────────────────────
export const AuroraBg: React.FC<{ dark: boolean }> = ({ dark }) => (
  <div className="absolute inset-0 overflow-hidden" aria-hidden>
    <div className="absolute inset-0" style={{ background: dark
      ? '#0f0d1f'
      : '#f0f4ff'
    }}/>
    {/* Layer 1 – slow morph */}
    <div className="absolute inset-0 aurora-l1" style={{ backgroundImage: dark
      ? 'radial-gradient(ellipse 130% 90% at 20% 30%, #6366f150 0%, transparent 55%), radial-gradient(ellipse 100% 70% at 80% 70%, #8b5cf648 0%, transparent 55%)'
      : 'radial-gradient(ellipse 130% 90% at 20% 30%, #a5b4fc60 0%, transparent 55%), radial-gradient(ellipse 100% 70% at 80% 70%, #c084fc50 0%, transparent 55%)'
    }}/>
    {/* Layer 2 – counter drift */}
    <div className="absolute inset-0 aurora-l2" style={{ backgroundImage: dark
      ? 'radial-gradient(ellipse 90% 60% at 60% 20%, #06b6d430 0%, transparent 50%), radial-gradient(ellipse 110% 50% at 30% 80%, #4f46e540 0%, transparent 50%)'
      : 'radial-gradient(ellipse 90% 60% at 60% 20%, #67e8f940 0%, transparent 50%), radial-gradient(ellipse 110% 50% at 30% 80%, #818cf860 0%, transparent 50%)'
    }}/>
    {/* Gradient overlay for shimmer */}
    <div className="absolute inset-0 aurora-shift" style={{ backgroundImage: dark
      ? 'linear-gradient(135deg, #312e8120, #4c1d9520, #1e1b4b20)'
      : 'linear-gradient(135deg, #e0e7ff30, #ddd6fe30, #ede9fe30)',
      backgroundSize: '300% 300%',
    }}/>
    <style>{`
      .aurora-l1 { animation: auroraL1 18s ease-in-out infinite; }
      .aurora-l2 { animation: auroraL2 24s ease-in-out infinite; }
      .aurora-shift { animation: auroraShift 14s ease-in-out infinite; }
      @keyframes auroraL1 {
        0%,100% { transform: translate(0,0) scale(1); opacity: 0.8; }
        33% { transform: translate(3%,2%) scale(1.04); opacity: 1; }
        66% { transform: translate(-2%,3%) scale(0.97); opacity: 0.7; }
      }
      @keyframes auroraL2 {
        0%,100% { transform: translate(0,0) scale(1); opacity: 0.6; }
        50% { transform: translate(-4%,-2%) scale(1.06); opacity: 0.9; }
      }
      @keyframes auroraShift {
        0%,100% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
      }
      @media (hover: none) {
        .aurora-l1, .aurora-l2, .aurora-shift { animation: none !important; }
      }
    `}</style>
  </div>
);

// ─── Silk / Ocean ────────────────────────────────────────────────────────────
export const SilkBg: React.FC<{ color: string; dark: boolean }> = ({ color, dark }) => (
  <div className="absolute inset-0 overflow-hidden" aria-hidden>
    <div className="absolute inset-0" style={{ background: dark ? '#0c2440' : '#e0f7ff' }}/>
    <div className="absolute inset-0 silk-a" style={{ backgroundImage:
      `linear-gradient(135deg, ${color}55 0%, transparent 40%),
       linear-gradient(315deg, ${color}44 0%, transparent 40%),
       radial-gradient(ellipse 140% 80% at 50% 50%, ${color}33 0%, transparent 65%)`,
      backgroundSize: '200% 200%',
    }}/>
    <div className="absolute inset-0 silk-b" style={{ backgroundImage:
      `linear-gradient(90deg, transparent 0%, ${color}30 50%, transparent 100%)`,
      backgroundSize: '200% 100%',
    }}/>
    <style>{`
      .silk-a { animation: silkA 10s ease-in-out infinite; }
      .silk-b { animation: silkB 7s ease-in-out infinite; }
      @keyframes silkA {
        0%,100% { background-position: 0% 0%, 100% 100%, 50% 50%; }
        50% { background-position: 100% 100%, 0% 0%, 50% 50%; }
      }
      @keyframes silkB {
        0%,100% { background-position: -100% 0%; opacity: 0.4; }
        50% { background-position: 200% 0%; opacity: 0.7; }
      }
      @media (hover: none) {
        .silk-a, .silk-b { animation: none !important; }
      }
    `}</style>
  </div>
);

// ─── Midnight ────────────────────────────────────────────────────────────────
export const MidnightBg: React.FC<{ dark: boolean }> = ({ dark }) => {
  // Only 4 orbs (not 8) — no blur, use opacity fade instead
  const orbs = [
    { w:300, h:300, l:5,  t:10, c:'#818cf8', d:0,   dur:8  },
    { w:250, h:250, l:60, t:55, c:'#38bdf8', d:1.5, dur:11 },
    { w:280, h:280, l:35, t:5,  c:'#c084fc', d:0.8, dur:13 },
    { w:220, h:220, l:70, t:15, c:'#a5b4fc', d:2.2, dur:9  },
  ];
  // 20 stars (not 40), no animation on star themselves
  const stars = Array.from({length:20},(_,i)=>({
    l: (i * 53 + 11) % 98,
    t: (i * 37 + 7) % 95,
    s: 1 + (i % 3),
  }));
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden
      style={{ background: dark ? 'radial-gradient(ellipse at 50% 50%, #12102a 0%, #0c0a1a 100%)' : '#f0f0ff' }}>
      {orbs.map((o, i) => (
        <div key={i} className={`absolute rounded-full mid-orb mid-orb-${i}`} style={{
          width: o.w, height: o.h, left: `${o.l}%`, top: `${o.t}%`,
          // Use radial-gradient opacity change via animation instead of blur
          background: `radial-gradient(circle, ${o.c}18 0%, transparent 70%)`,
          animationDelay: `${o.d}s`,
          animationDuration: `${o.dur}s`,
          transform: 'translateZ(0)',
        }}/>
      ))}
      {stars.map((s, i) => (
        <div key={`s${i}`} className="absolute rounded-full" style={{
          width: s.s, height: s.s,
          left: `${s.l}%`, top: `${s.t}%`,
          background: dark ? '#c7d2fe' : '#818cf8',
          opacity: 0.25 + (i % 5) * 0.1,
        }}/>
      ))}
      <style>{`
        .mid-orb { animation: midOrb var(--dur, 8s) ease-in-out infinite; }
        @keyframes midOrb {
          0%,100% { transform: translateY(0) scale(1); opacity: 0.7; }
          50% { transform: translateY(-18px) scale(1.07); opacity: 1; }
        }
        @media (hover: none) {
          .mid-orb { animation: none !important; }
        }
      `}</style>
    </div>
  );
};

// ─── Terminal – Matrix Rain ───────────────────────────────────────────────────
export const TerminalBg: React.FC<{ dark: boolean }> = ({ dark }) => {
  const cols = Array.from({length:16},(_,i)=>({
    l: `${i*6.2+(i%3)*0.4}%`,
    delay: `${(i*0.4)%3.2}s`,
    dur: `${2.8+(i%4)*0.5}s`,
  }));
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#050a04]" aria-hidden>
      {/* Grid */}
      <div className="absolute inset-0" style={{
        backgroundImage: `
          repeating-linear-gradient(0deg,transparent,transparent 14px,#22c55e0c 14px,#22c55e0c 15px),
          repeating-linear-gradient(90deg,transparent,transparent 14px,#22c55e06 14px,#22c55e06 15px)
        `,
      }}/>
      {/* Rain columns – transform-only animation */}
      {cols.map((col,i)=>(
        <div key={i} className={`absolute top-0 term-col term-col-${i}`} style={{
          left: col.l, width:'2px', height:'60%',
          background:'linear-gradient(180deg,transparent 0%,#22c55e00 15%,#22c55ecc 55%,#22c55eff 58%,#15803d88 72%,transparent 100%)',
          animationDelay: col.delay, animationDuration: col.dur,
        }}/>
      ))}
      {/* Vignette – static, no repaint */}
      <div className="absolute inset-0" style={{
        background:'radial-gradient(ellipse at 50% 50%,transparent 25%,rgba(0,0,0,0.72) 100%)',
      }}/>
      <style>{`
        .term-col { animation: termCol var(--dur,3s) linear infinite; }
        @keyframes termCol {
          0% { transform: translateY(-100%); opacity: 0; }
          8% { opacity: 1; }
          92% { opacity: 1; }
          100% { transform: translateY(160vh); opacity: 0; }
        }
        @media (hover: none) {
          .term-col { animation: none !important; opacity: 0.5; transform: none !important; }
        }
      `}</style>
    </div>
  );
};

// ─── Sunset ───────────────────────────────────────────────────────────────────
export const SunsetBg: React.FC<{ dark: boolean }> = ({ dark }) => (
  <div className="absolute inset-0 overflow-hidden" aria-hidden>
    <div className="absolute inset-0" style={{ background: dark
      ? 'linear-gradient(180deg,#1c0a00 0%,#2d0a00 40%,#450a0a 100%)'
      : 'linear-gradient(180deg,#fef3c7 0%,#fde68a 40%,#fdba74 100%)'
    }}/>
    {/* Conic god rays — no blur, use opacity */}
    <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[200%] h-[200%] sunset-rays" style={{
      backgroundImage: dark
        ? 'conic-gradient(from 265deg at 50% 0%,transparent 0deg,#c2410c15 5deg,transparent 10deg,#ea580c12 22deg,transparent 27deg,#c2410c10 38deg,transparent 43deg,#ea580c14 54deg,transparent 59deg,transparent 360deg)'
        : 'conic-gradient(from 265deg at 50% 0%,transparent 0deg,#f9731628 5deg,transparent 10deg,#ea580c22 22deg,transparent 27deg,#f9731625 38deg,transparent 43deg,#ea580c28 54deg,transparent 59deg,transparent 360deg)',
    }}/>
    {/* Sun — opacity pulse only, no blur */}
    <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full sunset-sun" style={{
      background: dark
        ? 'radial-gradient(circle,#ea580c40 0%,#c2410c15 40%,transparent 70%)'
        : 'radial-gradient(circle,#fbbf2455 0%,#f9731630 40%,transparent 70%)',
    }}/>
    <style>{`
      .sunset-rays { animation: sunsetRays 9s ease-in-out infinite; }
      .sunset-sun { animation: sunsetSun 5s ease-in-out infinite; }
      @keyframes sunsetRays {
        0%,100% { transform: translateX(-50%) rotate(0deg); opacity: 0.75; }
        50% { transform: translateX(-50%) rotate(4deg); opacity: 1; }
      }
      @keyframes sunsetSun {
        0%,100% { opacity: 0.7; transform: translateX(-50%) scale(1); }
        50% { opacity: 1; transform: translateX(-50%) scale(1.1); }
      }
      @media (hover: none) {
        .sunset-rays, .sunset-sun { animation: none !important; }
      }
    `}</style>
  </div>
);

// ─── Paper ────────────────────────────────────────────────────────────────────
export const PaperBg: React.FC<{ dark: boolean }> = ({ dark }) => {
  const beams = [8,19,30,42,54,65,76,87].map((l,i)=>({ l, rot:-12+i*3.5, d:i*0.25 }));
  const orange = dark ? '#f97316' : '#ea580c';
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0" style={{ background: dark
        ? 'linear-gradient(160deg,#1c0f00 0%,#2a1500 50%,#1c0a00 100%)'
        : 'linear-gradient(160deg,#fffbeb 0%,#fef3c7 50%,#fde68a 100%)'
      }}/>
      {beams.map((b,i)=>(
        <div key={i} className={`absolute top-0 origin-top paper-beam`} style={{
          left:`${b.l}%`, width:'3px', height:'100%',
          background:`linear-gradient(180deg,transparent 0%,${orange}25 30%,${orange}12 70%,transparent 100%)`,
          transform:`rotate(${b.rot}deg)`,
          animationDelay:`${b.d}s`,
        }}/>
      ))}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-32" style={{
        background:`radial-gradient(ellipse at 50% 0%,${orange}25 0%,transparent 70%)`,
      }}/>
      <style>{`
        .paper-beam { animation: paperBeam 5s ease-in-out infinite; }
        @keyframes paperBeam {
          0%,100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        @media (hover: none) {
          .paper-beam { animation: none !important; }
        }
      `}</style>
    </div>
  );
};

// ─── Neon ─────────────────────────────────────────────────────────────────────
export const NeonBg: React.FC<{ dark: boolean }> = ({ dark }) => (
  <div className="absolute inset-0 overflow-hidden bg-[#060012]" aria-hidden>
    {/* Perspective grid — transform-only scroll */}
    <div className="absolute bottom-0 left-0 right-0 h-1/2 neon-grid" style={{
      backgroundImage:`linear-gradient(0deg,#22d3ee22 1px,transparent 1px),linear-gradient(90deg,#f472b618 1px,transparent 1px)`,
      backgroundSize:'50px 50px',
      transform:'perspective(250px) rotateX(55deg) scale(2.2)',
      transformOrigin:'bottom center',
    }}/>
    {/* Orbs — transform+opacity only */}
    <div className="absolute inset-0 neon-o1" style={{ backgroundImage:
      'radial-gradient(ellipse 50% 40% at 30% 35%,#f472b630 0%,transparent 60%),' +
      'radial-gradient(ellipse 60% 50% at 70% 30%,#22d3ee28 0%,transparent 60%),' +
      'radial-gradient(ellipse 40% 35% at 50% 60%,#a855f725 0%,transparent 55%)'
    }}/>
    {/* Horizon line */}
    <div className="absolute left-0 right-0 neon-line" style={{
      top:'50%',height:'1px',
      background:'linear-gradient(90deg,transparent 0%,#22d3ee88 30%,#f472b688 70%,transparent 100%)',
    }}/>
    {/* Top ambient */}
    <div className="absolute top-0 left-0 right-0 h-48" style={{
      background:'radial-gradient(ellipse at 50% 0%,#a855f720 0%,transparent 70%)',
    }}/>
    {/* Vignette */}
    <div className="absolute inset-0" style={{
      background:'radial-gradient(ellipse at 50% 50%,transparent 20%,rgba(6,0,18,0.65) 100%)',
    }}/>
    <style>{`
      .neon-grid { animation: neonGrid 4s linear infinite; }
      .neon-o1 { animation: neonOrbs 10s ease-in-out infinite; }
      .neon-line { animation: neonLine 2.5s ease-in-out infinite; }
      @keyframes neonGrid {
        0% { background-position: 0 0; }
        100% { background-position: 0 50px; }
      }
      @keyframes neonOrbs {
        0%,100% { opacity: 0.7; transform: scale(1); }
        50% { opacity: 1; transform: scale(1.04); }
      }
      @keyframes neonLine {
        0%,100% { opacity: 0.5; }
        50% { opacity: 1; }
      }
      @media (hover: none) {
        .neon-grid, .neon-o1, .neon-line { animation: none !important; }
      }
    `}</style>
  </div>
);
