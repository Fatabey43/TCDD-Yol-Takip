import React from 'react';

interface TrainLoadingAnimationProps {
  message?: string;
  subMessage?: string;
}

export const TrainLoadingAnimation: React.FC<TrainLoadingAnimationProps> = ({
  message = 'Demiryolu KM Sistemi Yükleniyor...',
  subMessage = '712 Şefliği Saha Koordinasyon Portalı',
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-6 text-center select-none">
      {/* Animated Train on Rail Scene */}
      <div className="relative w-72 h-36 flex flex-col items-center justify-end overflow-hidden mb-4">
        {/* Sky / Horizon Glow */}
        <div className="absolute top-2 w-48 h-16 bg-sky-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Smoke / Steam particles puffing out */}
        <div className="absolute top-4 left-24 flex items-center gap-1.5 opacity-80 pointer-events-none">
          <span className="w-2.5 h-2.5 rounded-full bg-slate-300 animate-ping opacity-60" style={{ animationDuration: '1.2s' }} />
          <span className="w-3.5 h-3.5 rounded-full bg-slate-200 animate-ping opacity-40 ml-1" style={{ animationDuration: '1.6s' }} />
          <span className="w-5 h-5 rounded-full bg-slate-400 animate-ping opacity-20 ml-2" style={{ animationDuration: '2.1s' }} />
        </div>

        {/* Modern Locomotive SVG Body */}
        <div className="relative z-10 flex items-end animate-bounce" style={{ animationDuration: '1.4s' }}>
          {/* Locomotive Body */}
          <div className="relative">
            {/* Front Headlight Beam */}
            <div className="absolute -right-16 top-7 w-20 h-10 bg-gradient-to-r from-amber-200/50 via-amber-300/20 to-transparent clip-path-polygon pointer-events-none" />

            {/* Locomotive Silhouette */}
            <svg
              className="w-44 h-24 text-slate-100 drop-shadow-[0_8px_16px_rgba(220,38,38,0.4)]"
              viewBox="0 0 160 80"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Main Locomotive Body (Red & Navy TCDD Theme) */}
              <path
                d="M10 58 L25 24 C28 20 33 18 38 18 L120 18 C128 18 135 22 140 28 L152 46 C155 50 155 54 152 58 Z"
                fill="#dc2626"
              />
              {/* Lower Chassis Navy */}
              <rect x="5" y="55" width="150" height="12" rx="3" fill="#0f172a" />
              <rect x="8" y="52" width="144" height="4" fill="#1e293b" />

              {/* Cabin Windows */}
              <rect x="36" y="24" width="22" height="15" rx="3" fill="#38bdf8" fillOpacity="0.85" />
              <rect x="64" y="24" width="22" height="15" rx="3" fill="#38bdf8" fillOpacity="0.85" />
              <rect x="92" y="24" width="22" height="15" rx="3" fill="#38bdf8" fillOpacity="0.85" />
              {/* Front windshield angled */}
              <path d="M120 24 L138 28 L136 40 L120 40 Z" fill="#7dd3fc" fillOpacity="0.9" />

              {/* TCDD White Speed Stripe */}
              <path d="M12 44 L148 44 L145 49 L10 49 Z" fill="#ffffff" />
              <text x="50" y="48" fill="#dc2626" fontSize="5" fontWeight="900" letterSpacing="0.8">TCDD 712</text>

              {/* Headlight lamp */}
              <circle cx="150" cy="50" r="3.5" fill="#fef08a" />
              <circle cx="150" cy="50" r="1.5" fill="#ffffff" />

              {/* Locomotive Exhaust / Roof Equipment */}
              <rect x="42" y="14" width="10" height="4" rx="1" fill="#475569" />
              <rect x="75" y="13" width="20" height="5" rx="1.5" fill="#334155" />
              <rect x="105" y="15" width="8" height="3" rx="1" fill="#475569" />

              {/* Wheels */}
              <g className="animate-spin origin-center">
                <circle cx="28" cy="67" r="7" fill="#334155" stroke="#94a3b8" strokeWidth="2" />
                <circle cx="28" cy="67" r="2.5" fill="#cbd5e1" />
              </g>
              <g className="animate-spin origin-center">
                <circle cx="50" cy="67" r="7" fill="#334155" stroke="#94a3b8" strokeWidth="2" />
                <circle cx="50" cy="67" r="2.5" fill="#cbd5e1" />
              </g>
              <g className="animate-spin origin-center">
                <circle cx="108" cy="67" r="7" fill="#334155" stroke="#94a3b8" strokeWidth="2" />
                <circle cx="108" cy="67" r="2.5" fill="#cbd5e1" />
              </g>
              <g className="animate-spin origin-center">
                <circle cx="130" cy="67" r="7" fill="#334155" stroke="#94a3b8" strokeWidth="2" />
                <circle cx="130" cy="67" r="2.5" fill="#cbd5e1" />
              </g>

              {/* Cowcatcher / Front Plow */}
              <polygon points="152,58 158,66 148,66" fill="#1e293b" />
            </svg>
          </div>
        </div>

        {/* Railway Track (Rails & Animated Moving Sleepers) */}
        <div className="w-full relative z-0 mt-[-4px]">
          {/* Top Rail Steel Line */}
          <div className="w-full h-[3px] bg-slate-400 shadow-[0_1px_3px_rgba(255,255,255,0.4)]" />

          {/* Wooden Sleepers (Traversler) Moving Fast */}
          <div className="w-full h-3 overflow-hidden relative bg-amber-950/60 flex items-center">
            <div className="flex space-x-3 w-[200%] animate-track-move">
              {Array.from({ length: 30 }).map((_, idx) => (
                <div
                  key={idx}
                  className="w-1.5 h-3 bg-amber-800 border-l border-r border-amber-950/80 shrink-0"
                />
              ))}
            </div>
          </div>

          {/* Bottom Rail Steel Line & Ballast Stone Ground */}
          <div className="w-full h-[2px] bg-slate-500" />
          <div className="w-full h-2 bg-gradient-to-b from-slate-700 to-slate-900 opacity-90" />
        </div>
      </div>

      {/* Loading Texts */}
      <h3 className="text-base font-bold text-white tracking-wide flex items-center justify-center gap-2">
        <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
        {message}
      </h3>
      <p className="text-xs text-slate-400 mt-1 font-medium tracking-wider uppercase">
        {subMessage}
      </p>

      {/* Subtle Progress Bar */}
      <div className="w-48 h-1.5 bg-slate-800 rounded-full mt-4 overflow-hidden border border-slate-700/60">
        <div className="h-full bg-gradient-to-r from-red-600 via-amber-400 to-red-600 rounded-full w-2/3 animate-pulse" />
      </div>
    </div>
  );
};
