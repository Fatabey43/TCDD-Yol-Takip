import React, { useEffect } from 'react';

interface TrainTransitionOverlayProps {
  isActive: boolean;
  onAnimationComplete?: () => void;
}

export const TrainTransitionOverlay: React.FC<TrainTransitionOverlayProps> = ({
  isActive,
  onAnimationComplete,
}) => {
  useEffect(() => {
    if (isActive) {
      const timer = setTimeout(() => {
        onAnimationComplete?.();
      }, 1900);
      return () => clearTimeout(timer);
    }
  }, [isActive, onAnimationComplete]);

  if (!isActive) return null;

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none overflow-hidden flex items-center justify-center">
      {/* Cinematic Flash & Track Line */}
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px] animate-in fade-in duration-200" />

      {/* Diagonal Railway Track Guide */}
      <div
        className="absolute w-[200vw] h-1.5 bg-gradient-to-r from-transparent via-red-500/60 to-transparent pointer-events-none"
        style={{ transform: 'rotate(-22deg)' }}
      />
      <div
        className="absolute w-[200vw] h-1 bg-gradient-to-r from-transparent via-amber-300/40 to-transparent pointer-events-none mt-6"
        style={{ transform: 'rotate(-22deg)' }}
      />

      {/* Massive Diagonal Speed Locomotive Crossing the Screen */}
      <div className="absolute w-[700px] h-[350px] animate-train-diagonal pointer-events-none flex items-center justify-center">
        {/* Speed Wind & Light Blur Rays */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-96 h-36 bg-gradient-to-r from-red-600/30 via-amber-400/20 to-transparent blur-xl pointer-events-none" />

        {/* Diagonal Locomotive Graphic */}
        <svg
          className="w-full h-full drop-shadow-[0_20px_35px_rgba(220,38,38,0.7)]"
          viewBox="0 0 400 200"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Headlight Powerful Cone */}
          <polygon
            points="380,105 520,30 520,180"
            fill="url(#headlightBeam)"
            opacity="0.85"
          />

          {/* Locomotive Body Aero Front */}
          <path
            d="M30 140 L80 60 C90 48 105 45 125 45 L310 45 C335 45 355 55 370 75 L395 118 C402 128 398 138 385 140 Z"
            fill="#b91c1c"
          />

          {/* Aerodynamic High Speed Nose */}
          <path
            d="M310 45 L350 45 C380 55 395 90 395 120 L385 140 L310 140 Z"
            fill="#dc2626"
          />

          {/* Lower Frame & Bogie Shield (Navy Blue) */}
          <rect x="25" y="135" width="370" height="25" rx="6" fill="#0f172a" />
          <rect x="30" y="130" width="360" height="8" rx="2" fill="#1e293b" />

          {/* TCDD Speed Ribbon Band */}
          <path
            d="M30 110 L385 110 L380 122 L30 122 Z"
            fill="#ffffff"
          />
          <text
            x="170"
            y="120"
            fill="#b91c1c"
            fontSize="11"
            fontWeight="900"
            letterSpacing="2"
          >
            TCDD 712 ŞEFLİĞİ
          </text>

          {/* Cabin Tinted Glass Windows */}
          <polygon points="100,60 150,60 148,95 98,95" fill="#38bdf8" fillOpacity="0.9" />
          <polygon points="160,60 215,60 213,95 158,95" fill="#38bdf8" fillOpacity="0.9" />
          <polygon points="225,60 280,60 278,95 223,95" fill="#38bdf8" fillOpacity="0.9" />
          {/* Driver Cockpit Front Wrap Windshield */}
          <path
            d="M290 60 L350 68 C365 72 375 84 372 98 L368 98 L288 95 Z"
            fill="#7dd3fc"
            fillOpacity="0.95"
          />

          {/* Glowing Xenon Headlights */}
          <circle cx="388" cy="115" r="7" fill="#fef08a" />
          <circle cx="388" cy="115" r="3.5" fill="#ffffff" />
          <circle cx="360" cy="132" r="5" fill="#fef08a" />
          <circle cx="360" cy="132" r="2.5" fill="#ffffff" />

          {/* Spinning Wheels Bogies */}
          <g>
            <circle cx="75" cy="160" r="14" fill="#334155" stroke="#94a3b8" strokeWidth="4" />
            <circle cx="120" cy="160" r="14" fill="#334155" stroke="#94a3b8" strokeWidth="4" />
            <circle cx="280" cy="160" r="14" fill="#334155" stroke="#94a3b8" strokeWidth="4" />
            <circle cx="330" cy="160" r="14" fill="#334155" stroke="#94a3b8" strokeWidth="4" />
          </g>

          {/* Gradients */}
          <defs>
            <linearGradient id="headlightBeam" x1="0%" y1="50%" x2="100%" y2="50%">
              <stop offset="0%" stopColor="#fef08a" stopOpacity="0.8" />
              <stop offset="60%" stopColor="#fef08a" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#fef08a" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  );
};
