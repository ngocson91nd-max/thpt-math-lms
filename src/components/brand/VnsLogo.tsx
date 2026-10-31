import React from 'react';

export interface VnsLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  showText?: boolean;
  className?: string;
  textClassName?: string;
  theme?: 'light' | 'dark';
}

export default function VnsLogo({
  size = 'md',
  showText = true,
  className = '',
  textClassName = '',
  theme = 'light',
}: VnsLogoProps) {
  let iconPx = 36;
  let textSize = 'text-lg';

  if (typeof size === 'number') {
    iconPx = size;
  } else {
    switch (size) {
      case 'xs':
        iconPx = 24;
        textSize = 'text-sm';
        break;
      case 'sm':
        iconPx = 30;
        textSize = 'text-base';
        break;
      case 'md':
        iconPx = 38;
        textSize = 'text-lg sm:text-xl';
        break;
      case 'lg':
        iconPx = 48;
        textSize = 'text-2xl';
        break;
      case 'xl':
        iconPx = 64;
        textSize = 'text-3xl';
        break;
    }
  }

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {/* Biểu tượng Monogram VNS Squircle */}
      <svg
        width={iconPx}
        height={iconPx}
        viewBox="0 0 512 512"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 transition-transform duration-200 hover:scale-105 drop-shadow-sm"
      >
        <defs>
          <linearGradient id="vns_logo_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1D4ED8" />
            <stop offset="50%" stopColor="#2563EB" />
            <stop offset="100%" stopColor="#4F46E5" />
          </linearGradient>
          <filter id="vns_logo_glow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="6" stdDeviation="10" floodColor="#0F172A" floodOpacity="0.35" />
          </filter>
        </defs>

        {/* Nền Squircle gradient */}
        <rect width="512" height="512" rx="128" fill="url(#vns_logo_bg)" />
        <rect
          x="12"
          y="12"
          width="488"
          height="488"
          rx="116"
          fill="none"
          stroke="rgba(255,255,255,0.22)"
          strokeWidth="6"
        />

        {/* Monogram V - N - S */}
        <g filter="url(#vns_logo_glow)">
          {/* V */}
          <path
            d="M 86 182 L 158 338 L 226 182"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="36"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* N */}
          <path
            d="M 242 338 L 242 182 L 320 338 L 320 182"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="36"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* S */}
          <path
            d="M 426 202 C 416 166 380 156 352 176 C 320 198 326 240 372 260 C 420 280 430 322 396 346 C 362 368 332 346 324 322"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="36"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>

        {/* Điểm tọa độ Cyan & Gold */}
        <circle cx="426" cy="154" r="16" fill="#38BDF8" />
        <circle cx="86" cy="154" r="14" fill="#FBBF24" />
      </svg>

      {/* Tên thương hiệu: VNS Math (không dòng định vị) */}
      {showText && (
        <div className={`flex items-baseline tracking-tight font-extrabold ${textSize} ${textClassName}`}>
          <span className={theme === 'dark' ? 'text-white' : 'text-slate-900'}>VNS</span>
          <span className="text-blue-600 ml-1">Math</span>
        </div>
      )}
    </div>
  );
}
