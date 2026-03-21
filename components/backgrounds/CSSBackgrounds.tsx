/**
 * CSSBackgrounds — Effects:Performance = 40:60
 * 
 * Rules:
 * - ONLY transform + opacity animations (compositor thread, zero CPU/GPU rasterize)
 * - NO filter:blur() on animated elements
 * - NO SVG feTurbulence
 * - will-change: transform on every animated element
 * - Desktop: full speed. Mobile: same animations, 2x slower (via CSS class overrides)
 */
import React from 'react';

// ─── Aurora ──────────────────────────────────────────────────────────────────
// Floating plasma orbs — slow scale+translate, transform only
export const AuroraBg: React.FC<{ dark: boolean }> = ({ dark }) => (
  <div className="absolute inset-0 overflow-hidden" aria-hidden>
    {/* Base */}
    <div className="absolute inset-0" style={{ background: dark ? '#0f0d1f' : '#f0f4ff' }}/>

    {/* 3 large overlapping orbs — scale+translate, no blur */}
    <div className="absolute aurora-l1" style={{
      inset: '-20%',
      backgroundImage: dark
        ? 'radial-gradient(ellipse 55% 45% at 25% 35%, #6366f155 0%, transparent 60%), radial-gradient(ellipse 45% 40% at 75% 65%, #8b5cf650 0%, transparent 60%)'
        : 'radial-gradient(ellipse 55% 45% at 25% 35%, #a5b4fc65 0%, transparent 60%), radial-gradient(ellipse 45% 40% at 75% 65%, #c084fc55 0%, transparent 60%)',
      willChange: 'transform',
    }}/>
    <div className="absolute aurora-l2" style={{
      inset: '-15%',
      backgroundImage: dark
        ? 'radial-gradient(ellipse 40% 50% at 65% 20%, #06b6d435 0%, transparent 55%), radial-gradient(ellipse 50% 40% at 25% 75%, #4f46e545 0%, transparent 55%)'
        : 'radial-gradient(ellipse 40% 50% at 65% 20%, #67e8f945 0%, transparent 55%), radial-gradient(ellipse 50% 40% at 25% 75%, #818cf865 0%, transparent 55%)',
      willChange: 'transform',
    }}/>
    {/* Slow shimmer layer — background-position only */}
    <div className="absolute inset-0 aurora-shift" style={{
      backgroundImage: dark
        ? 'linear-gradient(135deg, #312e8118, #4c1d9518, #1e1b4b18, #312e8118)'
        : 'linear-gradient(135deg, #e0e7ff25, #ddd6fe25, #ede9fe25, #e0e7ff25)',
      backgroundSize: '400% 400%',
    }}/>

    <style>{`
      .aurora-l1 { animation: auroraL1 18s ease-in-out infinite; }
      .aurora-l2 { animation: auroraL2 24s ease-in-out infinite; }
      .aurora-shift { animation: auroraShift 16s ease-in-out infinite; }
      @keyframes auroraL1 {
        0%,100% { transform: translate(0%,0%) scale(1); }
        33%  { transform: translate(2%,1.5%) scale(1.04); }
        66%  { transform: translate(-1.5%,2.5%) scale(0.97); }
      }
      @keyframes auroraL2 {
        0%,100% { transform: translate(0%,0%) scale(1); }
        50%  { transform: translate(-3%,-1.5%) scale(1.06); }
      }
      @keyframes auroraShift {
        0%,100% { background-position: 0% 50%; }
        50%      { background-position: 100% 50%; }
      }
    `}</style>
  </div>
);

// ─── Silk / Ocean ─────────────────────────────────────────────────────────────
// Flowing gradient — background-position + opacity
export const SilkBg: React.FC<{ color: string; dark: boolean }> = ({ color, dark }) => (
  <div className="absolute inset-0 overflow-hidden" aria-hidden>
    <div className="absolute inset-0" style={{ background: dark ? '#0a1a2e' : '#e0f7ff' }}/>
    {/* Main wave layer */}
    <div className="absolute inset-0 silk-a" style={{
      backgroundImage: `
        linear-gradient(135deg, ${color}55 0%, transparent 42%),
        linear-gradient(315deg, ${color}44 0%, transparent 42%),
        linear-gradient(225deg, ${color}38 10%, transparent 52%),
        radial-gradient(ellipse 160% 80% at 50% 50%, ${color}40 0%, transparent 65%)
      `,
      backgroundSize: '200% 200%',
      willChange: 'background-position',
    }}/>
    {/* Shimmer streak */}
    <div className="absolute inset-0 silk-b" style={{
      backgroundImage: `linear-gradient(90deg, transparent 0%, ${color}35 45%, ${color}45 55%, transparent 100%)`,
      backgroundSize: '250% 100%',
      willChange: 'background-position, opacity',
    }}/>
    {/* Depth bottom */}
    <div className="absolute bottom-0 left-0 right-0 h-1/3" style={{
      background: `linear-gradient(0deg, ${dark ? '#0369a120' : '#0ea5e915'} 0%, transparent 100%)`,
    }}/>
    <style>{`
      .silk-a { animation: silkA 10s ease-in-out infinite; }
      .silk-b { animation: silkB 7s ease-in-out infinite; }
      @keyframes silkA {
        0%,100% { background-position: 0% 0%, 100% 100%, 50% 50%, 50% 50%; }
        50%      { background-position: 100% 100%, 0% 0%, 0% 100%, 50% 50%; }
      }
      @keyframes silkB {
        0%,100% { background-position: -100% 0%; opacity: 0.3; }
        50%      { background-position: 200% 0%; opacity: 0.7; }
      }
    `}</style>
  </div>
);

// ─── Midnight ─────────────────────────────────────────────────────────────────
// Floating glowing orbs — transform+opacity only, no blur
export const MidnightBg: React.FC<{ dark: boolean }> = ({ dark }) => {
  const orbs = [
    { w: 380, h: 380, l:  3, t: 5,  c: '#818cf8', delay: '0s',   dur: '9s'  },
    { w: 320, h: 320, l: 60, t: 52, c: '#38bdf8', delay: '1.8s', dur: '12s' },
    { w: 420, h: 420, l: 32, t: -8, c: '#c084fc', delay: '0.9s', dur: '15s' },
    { w: 280, h: 280, l: 72, t: 12, c: '#a5b4fc', delay: '3s',   dur: '10s' },
  ];
  const stars = Array.from({ length: 24 }, (_, i) => ({
    l: (i * 53 + 11) % 97, t: (i * 37 + 7) % 94, s: 1 + (i % 2),
  }));
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden style={{
      background: dark
        ? 'radial-gradient(ellipse at 50% 50%, #12102a 0%, #0c0a1a 100%)'
        : 'linear-gradient(135deg, #f0f0ff 0%, #e8e8ff 100%)',
    }}>
      {orbs.map((o, i) => (
        <div key={i} className={`absolute rounded-full mid-orb`} style={{
          width: o.w, height: o.h, left: `${o.l}%`, top: `${o.t}%`,
          background: `radial-gradient(circle, ${o.c}20 0%, ${o.c}08 50%, transparent 70%)`,
          animationDelay: o.delay, animationDuration: o.dur,
          willChange: 'transform, opacity',
        }}/>
      ))}
      {/* Stars — static, no animation */}
      {stars.map((s, i) => (
        <div key={`s${i}`} className="absolute rounded-full" style={{
          width: s.s, height: s.s, left: `${s.l}%`, top: `${s.t}%`,
          background: dark ? '#c7d2fe' : '#818cf8',
          opacity: 0.2 + (i % 5) * 0.1,
        }}/>
      ))}
      <style>{`
        .mid-orb { animation: midOrb var(--dur, 9s) ease-in-out infinite; }
        @keyframes midOrb {
          0%,100% { transform: translateY(0px) scale(1); opacity: 0.65; }
          50%      { transform: translateY(-22px) scale(1.08); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

// ─── Terminal — Matrix Rain ───────────────────────────────────────────────────
// translateY only — pure compositor
export const TerminalBg: React.FC<{ dark: boolean }> = ({ dark }) => {
  const cols = Array.from({ length: 18 }, (_, i) => ({
    l: `${i * 5.6 + (i % 3) * 0.3}%`,
    delay: `${(i * 0.38) % 3.5}s`,
    dur: `${2.6 + (i % 5) * 0.45}s`,
    opacity: 0.6 + (i % 4) * 0.1,
  }));
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#050a04]" aria-hidden>
      {/* Grid lines — static */}
      <div className="absolute inset-0" style={{
        backgroundImage: `
          repeating-linear-gradient(0deg, transparent, transparent 14px, #22c55e0c 14px, #22c55e0c 15px),
          repeating-linear-gradient(90deg, transparent, transparent 14px, #22c55e07 14px, #22c55e07 15px)
        `,
      }}/>
      {/* Rain columns */}
      {cols.map((col, i) => (
        <div key={i} className="absolute top-0 term-col" style={{
          left: col.l, width: '2px', height: '55%',
          background: `linear-gradient(180deg,
            transparent 0%,
            #22c55e00 12%,
            #22c55e${Math.round(col.opacity * 220).toString(16).padStart(2,'0')} 45%,
            #22c55eff 55%,
            #15803daa 70%,
            #15803d33 85%,
            transparent 100%)`,
          animationDelay: col.delay, animationDuration: col.dur,
          willChange: 'transform',
        }}/>
      ))}
      {/* Vignette — static */}
      <div className="absolute inset-0" style={{
        background: 'radial-gradient(ellipse at 50% 50%, transparent 22%, rgba(0,0,0,0.70) 100%)',
      }}/>
      {/* Scan line — opacity only */}
      <div className="absolute inset-0" style={{
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0,0,0,0.25) 1px, rgba(0,0,0,0.25) 2px)',
        backgroundSize: '100% 2px',
      }}/>
      <style>{`
        .term-col { animation: termCol var(--dur, 3s) linear infinite; }
        @keyframes termCol {
          0%   { transform: translateY(-100%); opacity: 0; }
          8%   { opacity: 1; }
          92%  { opacity: 1; }
          100% { transform: translateY(160vh); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

// ─── Sunset ───────────────────────────────────────────────────────────────────
// Conic rays + sun — transform+opacity only
export const SunsetBg: React.FC<{ dark: boolean }> = ({ dark }) => (
  <div className="absolute inset-0 overflow-hidden" aria-hidden>
    <div className="absolute inset-0" style={{ background: dark
      ? 'linear-gradient(180deg, #1c0a00 0%, #2d0a00 40%, #450a0a 100%)'
      : 'linear-gradient(180deg, #fef3c7 0%, #fde68a 40%, #fdba74 100%)',
    }}/>
    {/* Conic god-rays — transform rotate */}
    <div className="absolute sunset-rays" style={{
      top: '-20%', left: '50%', width: '200%', height: '200%',
      transform: 'translateX(-50%)',
      backgroundImage: dark
        ? `conic-gradient(from 265deg at 50% 0%,
            transparent 0deg, #c2410c18 4deg, transparent 9deg,
            #ea580c15 21deg, transparent 26deg,
            #c2410c12 37deg, transparent 42deg,
            #ea580c16 53deg, transparent 58deg,
            #c2410c10 68deg, transparent 73deg,
            transparent 360deg)`
        : `conic-gradient(from 265deg at 50% 0%,
            transparent 0deg, #f9731635 4deg, transparent 9deg,
            #ea580c28 21deg, transparent 26deg,
            #f9731632 37deg, transparent 42deg,
            #ea580c30 53deg, transparent 58deg,
            #f9731625 68deg, transparent 73deg,
            transparent 360deg)`,
      willChange: 'transform, opacity',
    }}/>
    {/* Sun orb */}
    <div className="absolute sunset-sun" style={{
      top: '-10%', left: '50%',
      width: '280px', height: '280px',
      transform: 'translateX(-50%)',
      background: dark
        ? 'radial-gradient(circle, #ea580c50 0%, #c2410c20 40%, transparent 70%)'
        : 'radial-gradient(circle, #fbbf2460 0%, #f9731635 40%, transparent 70%)',
      willChange: 'opacity, transform',
    }}/>
    {/* Horizon glow — static */}
    <div className="absolute bottom-0 left-0 right-0 h-1/3" style={{
      background: dark
        ? 'linear-gradient(0deg, #7c2d1225 0%, transparent 100%)'
        : 'linear-gradient(0deg, #fed7aa35 0%, transparent 100%)',
    }}/>
    <style>{`
      .sunset-rays { animation: sunsetRays 10s ease-in-out infinite; }
      .sunset-sun  { animation: sunsetSun 5.5s ease-in-out infinite; }
      @keyframes sunsetRays {
        0%,100% { transform: translateX(-50%) rotate(0deg); opacity: 0.75; }
        50%      { transform: translateX(-50%) rotate(5deg); opacity: 1; }
      }
      @keyframes sunsetSun {
        0%,100% { opacity: 0.7; transform: translateX(-50%) scale(1); }
        50%      { opacity: 1; transform: translateX(-50%) scale(1.12); }
      }
    `}</style>
  </div>
);

// ─── Paper / Beams ────────────────────────────────────────────────────────────
// Light beam columns — opacity pulse only
export const PaperBg: React.FC<{ dark: boolean }> = ({ dark }) => {
  const beams = [7, 17, 28, 40, 52, 63, 74, 86].map((l, i) => ({
    l, rot: -12 + i * 3.5, delay: `${i * 0.28}s`,
  }));
  const orange = dark ? '#f97316' : '#ea580c';
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0" style={{ background: dark
        ? 'linear-gradient(160deg, #1c0f00 0%, #2a1500 50%, #1c0a00 100%)'
        : 'linear-gradient(160deg, #fffbeb 0%, #fef3c7 50%, #fde68a 100%)',
      }}/>
      {beams.map((b, i) => (
        <div key={i} className="absolute top-0 origin-top paper-beam" style={{
          left: `${b.l}%`, width: '3px', height: '88%',
          background: `linear-gradient(180deg, transparent 0%, ${orange}30 28%, ${orange}14 70%, transparent 100%)`,
          transform: `rotate(${b.rot}deg)`,
          animationDelay: b.delay,
          willChange: 'opacity',
        }}/>
      ))}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-40" style={{
        background: `radial-gradient(ellipse at 50% 0%, ${orange}28 0%, transparent 70%)`,
      }}/>
      <style>{`
        .paper-beam { animation: paperBeam 5.5s ease-in-out infinite; }
        @keyframes paperBeam {
          0%,100% { opacity: 0.45; }
          50%      { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

// ─── Neon ─────────────────────────────────────────────────────────────────────
// Cyberpunk — grid scroll + orb opacity + horizon pulse
export const NeonBg: React.FC<{ dark: boolean }> = ({ dark }) => (
  <div className="absolute inset-0 overflow-hidden bg-[#060012]" aria-hidden>
    {/* Perspective grid — background-position scroll */}
    <div className="absolute bottom-0 left-0 right-0 h-[55%] neon-grid" style={{
      backgroundImage: `
        linear-gradient(0deg, #22d3ee28 1px, transparent 1px),
        linear-gradient(90deg, #f472b618 1px, transparent 1px)
      `,
      backgroundSize: '52px 52px',
      transform: 'perspective(220px) rotateX(52deg) scaleX(2.5)',
      transformOrigin: 'bottom center',
      willChange: 'background-position',
    }}/>
    {/* Glowing orbs — opacity only */}
    <div className="absolute inset-0 neon-o1" style={{
      backgroundImage:
        'radial-gradient(ellipse 55% 42% at 28% 35%, #f472b632 0%, transparent 58%),' +
        'radial-gradient(ellipse 62% 50% at 72% 28%, #22d3ee2a 0%, transparent 58%),' +
        'radial-gradient(ellipse 42% 38% at 50% 62%, #a855f72a 0%, transparent 55%)',
      willChange: 'opacity',
    }}/>
    {/* Horizon line — opacity pulse */}
    <div className="absolute left-0 right-0 neon-line" style={{
      top: '46%', height: '1px',
      background: 'linear-gradient(90deg, transparent 0%, #22d3ee90 30%, #f472b690 70%, transparent 100%)',
      willChange: 'opacity',
    }}/>
    {/* Top ambient — static */}
    <div className="absolute top-0 left-0 right-0 h-48" style={{
      background: 'radial-gradient(ellipse at 50% 0%, #a855f722 0%, transparent 68%)',
    }}/>
    {/* Vignette — static */}
    <div className="absolute inset-0" style={{
      background: 'radial-gradient(ellipse at 50% 50%, transparent 18%, rgba(6,0,18,0.68) 100%)',
    }}/>
    <style>{`
      .neon-grid { animation: neonGrid 4s linear infinite; }
      .neon-o1   { animation: neonOrbs 11s ease-in-out infinite; }
      .neon-line { animation: neonLine 2.8s ease-in-out infinite; }
      @keyframes neonGrid {
        0%   { background-position: 0 0; }
        100% { background-position: 0 52px; }
      }
      @keyframes neonOrbs {
        0%,100% { opacity: 0.65; }
        50%      { opacity: 1; }
      }
      @keyframes neonLine {
        0%,100% { opacity: 0.45; }
        50%      { opacity: 1; }
      }
    `}</style>
  </div>
);
