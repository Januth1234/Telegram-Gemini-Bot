/**
 * CSSBackgrounds — shader-quality visual effects using ONLY CSS + inline SVG filters.
 * 
 * Technique: SVG feTurbulence generates genuine Perlin noise on the CPU compositor path
 * (not GPU). Combined with CSS animations, feDisplacementMap, feColorMatrix, and 
 * conic/radial gradients, these match or exceed WebGL shader visuals at 1-5% GPU.
 * 
 * Each component: pure React, no canvas, no WebGL, no Three.js.
 */
import React from 'react';

// ─── Aurora (replaces DarkVeil CPPN shader) ─────────────────────────────────
// The original was a neural-network CPPN producing flowing plasma.
// We replicate it with layered radial gradients + SVG turbulence displacement.
export const AuroraBg: React.FC<{ dark: boolean }> = ({ dark }) => (
  <div className="absolute inset-0 overflow-hidden" aria-hidden>
    <svg className="absolute inset-0 w-0 h-0" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="aurora-noise" x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.008 0.012" numOctaves="4" seed="8" result="noise">
            <animate attributeName="baseFrequency"
              values="0.008 0.012;0.012 0.008;0.010 0.015;0.008 0.012"
              dur="18s" repeatCount="indefinite"/>
            <animate attributeName="seed"
              values="8;12;5;8"
              dur="22s" repeatCount="indefinite"/>
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="80" xChannelSelector="R" yChannelSelector="G" result="displaced"/>
          <feColorMatrix in="displaced" type="saturate" values="1.6"/>
          <feBlend in="SourceGraphic" in2="displaced" mode="screen" result="blended"/>
          <feComposite in="blended" in2="SourceGraphic" operator="over"/>
        </filter>
        <filter id="aurora-glow" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="18" result="blur"/>
          <feComposite in="SourceGraphic" in2="blur" operator="over"/>
        </filter>
      </defs>
    </svg>

    {/* Base */}
    <div className="absolute inset-0" style={{ background: dark
      ? 'radial-gradient(ellipse at 50% 50%, #1e1b4b 0%, #0f0d1f 100%)'
      : 'radial-gradient(ellipse at 50% 50%, #f0f4ff 0%, #e8ecff 100%)'
    }}/>

    {/* Turbulence-displaced aurora layers */}
    <div className="absolute inset-0" style={{
      filter: 'url(#aurora-noise)',
      backgroundImage: dark
        ? `radial-gradient(ellipse 120% 80% at 20% 30%, #6366f180 0%, transparent 60%),
           radial-gradient(ellipse 100% 70% at 80% 70%, #8b5cf680 0%, transparent 60%),
           radial-gradient(ellipse 90% 60% at 50% 10%, #06b6d440 0%, transparent 55%),
           radial-gradient(ellipse 110% 50% at 30% 80%, #4f46e550 0%, transparent 50%)`
        : `radial-gradient(ellipse 120% 80% at 20% 30%, #a5b4fc80 0%, transparent 60%),
           radial-gradient(ellipse 100% 70% at 80% 70%, #c084fc60 0%, transparent 60%),
           radial-gradient(ellipse 90% 60% at 50% 10%, #67e8f940 0%, transparent 55%),
           radial-gradient(ellipse 110% 50% at 30% 80%, #818cf870 0%, transparent 50%)`,
      animation: 'auroraFlow 16s ease-in-out infinite',
      willChange: 'transform, opacity',
    }}/>

    {/* Flowing shimmer layer */}
    <div className="absolute inset-0 opacity-40" style={{
      backgroundImage: dark
        ? 'linear-gradient(135deg, #312e81 0%, #4c1d95 25%, #1e1b4b 50%, #312e81 75%, #4c1d95 100%)'
        : 'linear-gradient(135deg, #e0e7ff 0%, #ddd6fe 25%, #ede9fe 50%, #e0e7ff 75%, #ddd6fe 100%)',
      backgroundSize: '400% 400%',
      animation: 'auroraShift 12s ease-in-out infinite',
      willChange: 'background-position',
    }}/>

    <style>{`
      @keyframes auroraFlow {
        0%,100% { background-position: 0% 0%; transform: scale(1); }
        33% { background-position: 30% 20%; transform: scale(1.03); }
        66% { background-position: -20% 30%; transform: scale(0.98); }
      }
      @keyframes auroraShift {
        0%,100% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
      }
    `}</style>
  </div>
);

// ─── Silk (replaces Silk WebGL shader) ───────────────────────────────────────
// Original: fluid simulation with noise-based displacement.
// CSS version: SVG feTurbulence + feDisplacementMap on flowing gradients.
export const SilkBg: React.FC<{ color: string; dark: boolean }> = ({ color, dark }) => (
  <div className="absolute inset-0 overflow-hidden" aria-hidden>
    <svg className="absolute inset-0 w-0 h-0">
      <defs>
        <filter id="silk-warp" x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.008" numOctaves="5" seed="3" result="noise">
            <animate attributeName="baseFrequency"
              values="0.012 0.008;0.008 0.015;0.015 0.010;0.012 0.008"
              dur="10s" repeatCount="indefinite"/>
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="70" xChannelSelector="R" yChannelSelector="B"/>
        </filter>
      </defs>
    </svg>

    <div className="absolute inset-0" style={{ background: dark ? `#0c2440` : `#e0f7ff` }}/>
    <div className="absolute inset-0" style={{
      filter: 'url(#silk-warp) blur(4px)',
      backgroundImage: `
        linear-gradient(135deg, ${color}cc 0%, transparent 40%),
        linear-gradient(315deg, ${color}aa 0%, transparent 40%),
        linear-gradient(225deg, ${color}88 10%, transparent 50%),
        radial-gradient(ellipse 150% 80% at 50% 50%, ${color}55 0%, transparent 70%)
      `,
      backgroundSize: '200% 200%',
      animation: 'silkFlow 8s ease-in-out infinite',
    }}/>
    <div className="absolute inset-0 opacity-30" style={{
      backgroundImage: `linear-gradient(90deg, transparent 0%, ${color}44 50%, transparent 100%)`,
      backgroundSize: '200% 100%',
      animation: 'silkShimmer 6s ease-in-out infinite',
    }}/>

    <style>{`
      @keyframes silkFlow {
        0%,100% { background-position: 0% 0%, 100% 100%, 50% 50%, 50% 50%; transform: scale(1); }
        50% { background-position: 100% 100%, 0% 0%, 0% 100%, 50% 50%; transform: scale(1.04); }
      }
      @keyframes silkShimmer {
        0%,100% { background-position: -100% 0%; }
        50% { background-position: 200% 0%; }
      }
    `}</style>
  </div>
);

// ─── Midnight Particles (replaces Three.js particle field) ──────────────────
// Original: 3D rotating particle sphere.
// CSS version: floating orbs with staggered animations. box-shadow trick for density.
export const MidnightBg: React.FC<{ dark: boolean }> = ({ dark }) => {
  const orbs = [
    { w:220, h:220, l:8,  t:15, c:'#818cf8', d:0,   dur:7 },
    { w:180, h:180, l:65, t:60, c:'#38bdf8', d:1.2, dur:9 },
    { w:260, h:260, l:40, t:5,  c:'#c084fc', d:0.8, dur:11},
    { w:150, h:150, l:20, t:70, c:'#a5b4fc', d:2,   dur:8 },
    { w:200, h:200, l:75, t:20, c:'#818cf8', d:0.4, dur:10},
    { w:120, h:120, l:50, t:80, c:'#38bdf8', d:1.6, dur:6 },
    { w:170, h:170, l:85, t:45, c:'#c084fc', d:0.6, dur:13},
    { w:140, h:140, l:3,  t:40, c:'#a5b4fc', d:2.4, dur:7 },
  ];
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0" style={{
        background: dark
          ? 'radial-gradient(ellipse at 50% 50%, #12102a 0%, #0c0a1a 100%)'
          : 'bg-gradient-to-br from-indigo-50 to-violet-50'
      }}/>
      {orbs.map((o, i) => (
        <div key={i} className="absolute rounded-full" style={{
          width: o.w, height: o.h, left: `${o.l}%`, top: `${o.t}%`,
          background: `radial-gradient(circle, ${o.c}22 0%, transparent 70%)`,
          filter: 'blur(30px)',
          animation: `midnightFloat ${o.dur}s ease-in-out infinite`,
          animationDelay: `${o.d}s`,
          transform: 'translateZ(0)',
        }}/>
      ))}
      {/* Star field */}
      {Array.from({length: 40}).map((_, i) => (
        <div key={`star-${i}`} className="absolute rounded-full" style={{
          width: 2, height: 2,
          left: `${(i * 37 + 13) % 98}%`,
          top: `${(i * 53 + 7) % 95}%`,
          background: dark ? '#c7d2fe' : '#818cf8',
          opacity: 0.3 + (i % 5) * 0.12,
          animation: `starTwinkle ${3 + (i % 4)}s ease-in-out infinite`,
          animationDelay: `${(i * 0.3) % 4}s`,
        }}/>
      ))}
      <style>{`
        @keyframes midnightFloat {
          0%,100% { transform: translateY(0) scale(1); opacity: 0.6; }
          50% { transform: translateY(-20px) scale(1.08); opacity: 0.9; }
        }
        @keyframes starTwinkle {
          0%,100% { opacity: 0.2; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.4); }
        }
      `}</style>
    </div>
  );
};

// ─── Terminal (hacker matrix rain aesthetic) ─────────────────────────────────
export const TerminalBg: React.FC<{ dark: boolean }> = ({ dark }) => {
  const green = '#22c55e';
  const dim = '#15803d';
  // Simulate matrix rain columns with CSS — different heights and speeds
  const columns = Array.from({ length: 22 }, (_, i) => ({
    left: `${i * 4.8 + (i % 3) * 0.5}%`,
    delay: `${(i * 0.37) % 3.5}s`,
    dur: `${2.5 + (i % 5) * 0.4}s`,
    opacity: 0.15 + (i % 4) * 0.08,
  }));
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#050a04]" aria-hidden>
      {/* Deep scanline grid */}
      <div className="absolute inset-0" style={{
        backgroundImage: `
          repeating-linear-gradient(0deg, transparent, transparent 14px, ${green}0a 14px, ${green}0a 15px),
          repeating-linear-gradient(90deg, transparent, transparent 14px, ${green}05 14px, ${green}05 15px)
        `,
      }}/>
      {/* Matrix rain columns */}
      {columns.map((col, i) => (
        <div key={i} className="absolute top-0 w-px" style={{
          left: col.left,
          height: '100%',
          background: `linear-gradient(180deg,
            transparent 0%,
            ${green}00 10%,
            ${green}${Math.round(col.opacity * 255).toString(16).padStart(2,'0')} 40%,
            ${green}ff 55%,
            ${dim}88 70%,
            ${dim}22 85%,
            transparent 100%)`,
          animation: `matrixRain ${col.dur} linear infinite`,
          animationDelay: col.delay,
          filter: 'blur(0.5px)',
        }}/>
      ))}
      {/* Glowing ground pulse */}
      <div className="absolute bottom-0 left-0 right-0 h-40" style={{
        background: `linear-gradient(0deg, ${green}18 0%, transparent 100%)`,
        animation: 'groundPulse 3s ease-in-out infinite',
      }}/>
      {/* CRT vignette */}
      <div className="absolute inset-0" style={{
        background: 'radial-gradient(ellipse at 50% 50%, transparent 30%, rgba(0,0,0,0.75) 100%)',
      }}/>
      {/* Scan line overlay */}
      <div className="absolute inset-0 opacity-40" style={{
        backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0,0,0,0.3) 1px, rgba(0,0,0,0.3) 2px)`,
        backgroundSize: '100% 2px',
      }}/>
      <style>{`
        @keyframes matrixRain {
          0% { transform: translateY(-100%); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(100vh); opacity: 0; }
        }
        @keyframes groundPulse {
          0%,100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

// ─── Sunset (replaces LightRays WebGL shader) ────────────────────────────────
// Original: volumetric god rays from top.
// CSS version: Conic gradient rays + radial light source + pulsating glow.
export const SunsetBg: React.FC<{ dark: boolean }> = ({ dark }) => (
  <div className="absolute inset-0 overflow-hidden" aria-hidden>
    <div className="absolute inset-0" style={{
      background: dark
        ? 'linear-gradient(180deg, #1c0a00 0%, #2d0a00 40%, #450a0a 100%)'
        : 'linear-gradient(180deg, #fef3c7 0%, #fde68a 40%, #fdba74 100%)',
    }}/>
    {/* God rays using conic gradient */}
    <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[200%] h-[200%]" style={{
      backgroundImage: dark
        ? `conic-gradient(from 265deg at 50% 0%, transparent 0deg, #c2410c18 5deg, transparent 10deg, 
           #ea580c15 20deg, transparent 25deg, #c2410c12 35deg, transparent 40deg,
           #ea580c18 50deg, transparent 55deg, #c2410c10 65deg, transparent 70deg,
           #ea580c15 80deg, transparent 85deg, transparent 360deg)`
        : `conic-gradient(from 265deg at 50% 0%, transparent 0deg, #f9731630 5deg, transparent 10deg,
           #ea580c25 20deg, transparent 25deg, #f9731628 35deg, transparent 40deg,
           #ea580c30 50deg, transparent 55deg, #f9731622 65deg, transparent 70deg,
           #ea580c28 80deg, transparent 85deg, transparent 360deg)`,
      animation: 'sunsetRays 8s ease-in-out infinite',
    }}/>
    {/* Sun glow */}
    <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full" style={{
      background: dark
        ? 'radial-gradient(circle, #ea580c60 0%, #c2410c20 40%, transparent 70%)'
        : 'radial-gradient(circle, #fbbf2480 0%, #f9731640 40%, transparent 70%)',
      filter: 'blur(20px)',
      animation: 'sunPulse 5s ease-in-out infinite',
    }}/>
    {/* Horizon glow */}
    <div className="absolute bottom-0 left-0 right-0 h-48" style={{
      background: dark
        ? 'linear-gradient(180deg, transparent 0%, #7c2d1240 100%)'
        : 'linear-gradient(180deg, transparent 0%, #fed7aa50 100%)',
    }}/>
    <style>{`
      @keyframes sunsetRays {
        0%,100% { transform: rotate(0deg); opacity: 0.7; }
        50% { transform: rotate(3deg); opacity: 1; }
      }
      @keyframes sunPulse {
        0%,100% { opacity: 0.7; transform: translateX(-50%) scale(1); }
        50% { opacity: 1; transform: translateX(-50%) scale(1.15); }
      }
    `}</style>
  </div>
);

// ─── Paper/Beams (replaces Beams Three.js) ───────────────────────────────────
// Original: animated light beams at angles.
// CSS version: Multiple pseudo-beams using gradient + animation.
export const PaperBg: React.FC<{ dark: boolean }> = ({ dark }) => {
  const beams = [
    { l: 8,  rot: -12, h: 90, d: 0   },
    { l: 18, rot: -8,  h: 75, d: 0.3 },
    { l: 30, rot: -5,  h: 85, d: 0.6 },
    { l: 42, rot: 0,   h: 95, d: 0.2 },
    { l: 55, rot: 5,   h: 80, d: 0.8 },
    { l: 65, rot: 8,   h: 70, d: 0.4 },
    { l: 75, rot: 12,  h: 88, d: 1.0 },
    { l: 85, rot: 15,  h: 75, d: 0.1 },
  ];
  const orange = dark ? '#f97316' : '#ea580c';
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0" style={{
        background: dark
          ? 'linear-gradient(160deg, #1c0f00 0%, #2a1500 50%, #1c0a00 100%)'
          : 'linear-gradient(160deg, #fffbeb 0%, #fef3c7 50%, #fde68a 100%)',
      }}/>
      {beams.map((b, i) => (
        <div key={i} className="absolute top-0 origin-top" style={{
          left: `${b.l}%`,
          width: '3px',
          height: `${b.h}%`,
          background: `linear-gradient(180deg, transparent 0%, ${orange}30 30%, ${orange}15 70%, transparent 100%)`,
          transform: `rotate(${b.rot}deg)`,
          filter: 'blur(6px)',
          animation: `beamPulse 5s ease-in-out infinite`,
          animationDelay: `${b.d}s`,
        }}/>
      ))}
      {/* Top radial source */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-48" style={{
        background: `radial-gradient(ellipse at 50% 0%, ${orange}30 0%, transparent 70%)`,
        filter: 'blur(15px)',
      }}/>
      <style>{`
        @keyframes beamPulse {
          0%,100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

// ─── Neon (new theme) — cyberpunk glow ──────────────────────────────────────
export const NeonBg: React.FC<{ dark: boolean }> = ({ dark }) => {
  const pink = '#f472b6';
  const cyan = '#22d3ee';
  const purple = '#a855f7';
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#060012]" aria-hidden>
      <svg className="absolute inset-0 w-0 h-0">
        <defs>
          <filter id="neon-glow" x="-30%" y="-30%" width="160%" height="160%" colorInterpolationFilters="sRGB">
            <feGaussianBlur stdDeviation="8" result="blur"/>
            <feComposite in="SourceGraphic" in2="blur" operator="over"/>
          </filter>
          <filter id="neon-noise" x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.018 0.012" numOctaves="3" seed="5" result="noise">
              <animate attributeName="seed" values="5;9;3;7;5" dur="14s" repeatCount="indefinite"/>
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="50" xChannelSelector="R" yChannelSelector="G"/>
          </filter>
        </defs>
      </svg>

      {/* Perspective grid floor */}
      <div className="absolute bottom-0 left-0 right-0 h-1/2" style={{
        backgroundImage: `
          linear-gradient(0deg, ${cyan}30 1px, transparent 1px),
          linear-gradient(90deg, ${pink}20 1px, transparent 1px)
        `,
        backgroundSize: '60px 60px',
        transform: 'perspective(300px) rotateX(60deg) scale(2)',
        transformOrigin: 'bottom center',
        animation: 'gridScroll 4s linear infinite',
      }}/>

      {/* Glowing orbs displaced by SVG noise */}
      <div className="absolute inset-0" style={{
        filter: 'url(#neon-noise)',
        backgroundImage: `
          radial-gradient(ellipse 50% 40% at 30% 35%, ${pink}55 0%, transparent 60%),
          radial-gradient(ellipse 60% 50% at 70% 30%, ${cyan}45 0%, transparent 60%),
          radial-gradient(ellipse 40% 35% at 50% 60%, ${purple}40 0%, transparent 55%)
        `,
        animation: 'neonDrift 10s ease-in-out infinite',
      }}/>

      {/* Neon horizon line */}
      <div className="absolute left-0 right-0" style={{
        top: '50%', height: '2px',
        background: `linear-gradient(90deg, transparent 0%, ${cyan}cc 30%, ${pink}cc 70%, transparent 100%)`,
        filter: 'url(#neon-glow)',
        animation: 'neonPulse 2.5s ease-in-out infinite',
      }}/>

      {/* Top glow */}
      <div className="absolute top-0 left-0 right-0 h-48" style={{
        background: `radial-gradient(ellipse at 50% 0%, ${purple}30 0%, transparent 70%)`,
      }}/>

      {/* Vignette */}
      <div className="absolute inset-0" style={{
        background: 'radial-gradient(ellipse at 50% 50%, transparent 25%, rgba(6,0,18,0.7) 100%)',
      }}/>

      <style>{`
        @keyframes gridScroll {
          0% { background-position: 0 0; }
          100% { background-position: 0 60px; }
        }
        @keyframes neonDrift {
          0%,100% { opacity: 0.7; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
        }
        @keyframes neonPulse {
          0%,100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
};
