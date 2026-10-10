import React, { useEffect, useState } from 'react';

interface NestySplashOverlayProps {
  onFinished: () => void;
}

export const NestySplashOverlay: React.FC<NestySplashOverlayProps> = ({ onFinished }) => {
  const [stage, setStage] = useState<number>(0);

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      setStage(2);
      const t = setTimeout(onFinished, 450);
      return () => clearTimeout(t);
    }

    setStage(1);
    const tLogo = setTimeout(() => setStage(2), 1050);
    const tDone = setTimeout(() => onFinished(), 1850);

    return () => {
      clearTimeout(tLogo);
      clearTimeout(tDone);
    };
  }, [onFinished]);

  return (
    <div
      onClick={onFinished}
      data-testid="splash_animation_overlay"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6 cursor-pointer select-none"
      style={{
        background: 'radial-gradient(circle, #FFFBF5 0%, #FAF3E8 60%, #F3E6D0 100%)',
      }}
    >
      {/* Emerging NESTY Wordmark from the Bowl */}
      <div className="h-20 flex items-end justify-center mb-3">
        <div className="flex items-center gap-1.5 opacity-0 animate-word-emerge">
          {'NESTY'.split('').map((ch, idx) => (
            <div
              key={idx}
              className="bg-nesty-burgundy text-nesty-cream border-2 border-nesty-gold rounded-xl px-3 py-1.5 shadow-md font-extrabold text-2xl sm:text-3xl tracking-wider"
            >
              {ch}
            </div>
          ))}
        </div>
      </div>

      {/* Center Stage: Smiling Chef tossing golden bowl upward -> Official Nesty Logo Reveal */}
      <div className="relative w-56 h-56 flex items-center justify-center">
        {stage < 2 ? (
          <div className="relative w-full h-full flex items-center justify-center">
            {/* Friendly Smiling Chef Illustration at Base */}
            <img
              src="/images/chef-mascot.jpg"
              alt="Friendly Nesty Chef smiling and tossing bowl"
              className="w-44 h-44 rounded-full object-cover border-4 border-nesty-gold shadow-lg self-end"
            />
            {/* Tossed Golden & Burgundy Bowl moving naturally upward with subtle rotation */}
            <div className="absolute top-6 animate-bowl-toss">
              <svg width="86" height="86" viewBox="0 0 100 100" fill="none">
                <circle cx="32" cy="18" r="5" fill="#D7A85B" />
                <circle cx="52" cy="10" r="4" fill="#701F2B" />
                <circle cx="68" cy="20" r="5" fill="#B38336" />
                <path
                  d="M12 42 H88 C86 78 68 88 50 88 C32 88 14 78 12 42 Z"
                  fill="#701F2B"
                  stroke="#D7A85B"
                  strokeWidth="5"
                />
                <rect x="10" y="37" width="80" height="8" rx="4" fill="#D7A85B" />
                <rect x="35" y="86" width="30" height="7" rx="3.5" fill="#B38336" />
              </svg>
            </div>
          </div>
        ) : (
          <div className="w-48 h-48 rounded-[32px] bg-nesty-cream border-[2.5px] border-nesty-gold shadow-2xl p-2.5 transition-all duration-300 scale-100">
            <img
              src="/images/nesty-logo.jpg"
              alt="Official Nesty Logo"
              className="w-full h-full object-contain rounded-3xl"
            />
          </div>
        )}
      </div>

      <h1 className="mt-5 text-3xl font-extrabold tracking-[0.18em] text-nesty-burgundy">
        NESTY
      </h1>
      <p className="mt-1 text-sm font-semibold text-nesty-textSecondary text-center">
        Smart Campus Food Ordering • CVR Canteen
      </p>
      <span className="mt-4 text-xs font-bold uppercase tracking-wider text-nesty-goldDark">
        Tap anywhere to skip
      </span>
    </div>
  );
};
