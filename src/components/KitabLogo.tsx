import React from 'react';

interface KitabLogoProps {
  className?: string;
  variant?: 'colored' | 'white' | 'dark';
}

export default function KitabLogo({ className = 'w-9 h-9', variant = 'colored' }: KitabLogoProps) {
  // Color configuration depending on the variant
  // Colored uses olive-sage (#5A5A40), gold/amber (#D4AF37 / #E5A93B), and warm cream
  const colors = {
    colored: {
      bg: 'fill-[#5A5A40]',
      starOuter: 'stroke-[#D5B064]',
      starInner: 'fill-[#E2C280]',
      bookBase: 'fill-[#F5EFE2]',
      bookPages: 'stroke-[#5A5A40]',
      bookmark: 'fill-[#B85C38]',
      sparkle: 'fill-[#E5A93B]'
    },
    white: {
      bg: 'fill-white/10 backdrop-blur-sm',
      starOuter: 'stroke-white/80',
      starInner: 'fill-white/30',
      bookBase: 'fill-white',
      bookPages: 'stroke-[#5A5A40]',
      bookmark: 'fill-amber-400',
      sparkle: 'fill-amber-300'
    },
    dark: {
      bg: 'fill-[#181814]',
      starOuter: 'stroke-[#777266]',
      starInner: 'fill-[#5A5A40]',
      bookBase: 'fill-[#E5E1D8]',
      bookPages: 'stroke-[#181814]',
      bookmark: 'fill-[#9C4A2F]',
      sparkle: 'fill-[#C09640]'
    }
  }[variant];

  return (
    <svg 
      id="kitab-vector-logo"
      viewBox="0 0 100 100" 
      className={`${className} transition-all duration-300 select-none`}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Background Rounded Shield / Circle */}
      <rect 
        x="2" 
        y="2" 
        width="96" 
        height="96" 
        rx="22" 
        className={`${colors.bg}`}
      />

      {/* Decorative Star Medallion (Shamsah / Islamic Star Pattern) */}
      {/* Outer rotating Star (8-point star made of two overlapping squares) */}
      <path 
        d="M 50 15 L 61 29 L 76 24 L 71 39 L 85 50 L 71 61 L 76 76 L 61 71 L 50 85 L 39 71 L 24 76 L 29 61 L 15 50 L 29 39 L 24 24 L 39 29 Z" 
        fill="none" 
        className={`${colors.starOuter} opacity-40`}
        strokeWidth="1.5" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
      
      {/* Inner concentric octagonal design */}
      <polygon 
        points="50,22 59,31 69,27 65,37 75,45 65,53 69,63 59,59 50,68 41,59 31,63 35,53 25,45 35,37 31,27 41,31"
        className={`${colors.starInner} opacity-20`}
      />

      {/* Elegant Open Kitab (Book) Graphic */}
      <g transform="translate(0, 5)">
        {/* Shadow or outer backing of the open pages */}
        <path 
          d="M 50 63 C 44 61, 32 55, 20 57 C 18 57, 17 58, 17 60 L 17 38 C 17 36, 18 35, 20 35 C 32 33, 44 39, 50 41 C 56 39, 68 33, 80 35 C 82 35, 83 36, 83 38 L 83 60 C 83 58, 82 57, 80 57 C 68 55, 56 61, 50 63 Z" 
          className={`${colors.bookBase}`}
          filter="drop-shadow(0px 3px 4px rgba(0,0,0,0.15))"
        />

        {/* Highlight inner pages left side */}
        <path 
          d="M 50 62 C 43.5 60, 31.5 54, 21.5 55.5 L 21.5 37.5 C 31.5 36, 43.5 42, 50 44 Z" 
          fill="#FFFFFF" 
          opacity="0.85"
        />

        {/* Highlight inner pages right side */}
        <path 
          d="M 50 62 C 56.5 60, 68.5 54, 78.5 55.5 L 78.5 37.5 C 68.5 36, 56.5 42, 50 44 Z" 
          fill="#FCF9F2" 
          opacity="0.9"
        />

        {/* Book spine/center division marker */}
        <line 
          x1="50" 
          y1="42.5" 
          x2="50" 
          y2="63.5" 
          className={`${colors.bookPages}`}
          strokeWidth="1.5"
          strokeLinecap="round"
        />

        {/* Stylized text lines (writing indicators) */}
        {/* Left Page Lines */}
        <path 
          d="M 26 41 C 30 40, 38 43, 45 45 M 26 46 C 30 45, 38 48, 45 50 M 28 51 C 32 50, 38 53, 45 55" 
          className={`${colors.bookPages} opacity-40`}
          strokeWidth="1" 
          strokeLinecap="round"
          fill="none"
        />
        
        {/* Right Page Lines */}
        <path 
          d="M 55 45 C 62 43, 70 40, 74 41 M 55 50 C 62 48, 70 45, 74 46 M 55 55 C 62 53, 68 50, 72 51" 
          className={`${colors.bookPages} opacity-40`}
          strokeWidth="1" 
          strokeLinecap="round"
          fill="none"
        />

        {/* Elegant ribbon bookmark hanging from center bottom */}
        <path 
          d="M 49 61.5 L 49 71 L 52.5 68 L 56 71 L 56 61.5 Z" 
          className={`${colors.bookmark}`}
        />
      </g>

      {/* Sparkles of Knowledge / Enlightenment above the book */}
      <path 
        d="M 50 16.5 C 50 20.5, 49 21.5, 45 21.5 C 49 21.5, 50 22.5, 50 26.5 C 50 22.5, 51 21.5, 55 21.5 C 51 21.5, 50 20.5, 50 16.5 Z" 
        className={`${colors.sparkle}`}
      />
      <circle 
        cx="36" 
        cy="24" 
        r="1.5" 
        className={`${colors.sparkle} opacity-80`}
      />
      <circle 
        cx="64" 
        cy="22" 
        r="2" 
        className={`${colors.sparkle} opacity-90`}
      />
    </svg>
  );
}
