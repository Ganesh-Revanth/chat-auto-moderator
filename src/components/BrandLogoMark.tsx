import React from 'react';

interface BrandLogoMarkProps {
  size?: number;
  className?: string;
}

/**
 * Single unified minimal black-and-white geometric logo mark for Moderation Studio
 * Used consistently across every theme (Landing Gate, Top Header, Hero Sentinel Card, Footer).
 */
export const BrandLogoMark: React.FC<BrandLogoMarkProps> = ({ size = 40, className = '' }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Moderation Studio Minimal Logo"
      role="img"
      style={{
        display: 'block',
        borderRadius: Math.max(6, Math.round(size * 0.22)),
        flexShrink: 0,
        boxShadow: '0 0 0 1.5px rgba(255, 255, 255, 0.9)',
      }}
    >
      {/* Pure Matte Black Base */}
      <rect width="64" height="64" rx="14" fill="#050505" />

      {/* Crisp Inner Hairline Frame */}
      <rect
        x="4.5"
        y="4.5"
        width="55"
        height="55"
        rx="10"
        stroke="#FFFFFF"
        strokeOpacity="0.22"
        strokeWidth="1.2"
      />

      {/* Minimalist Geometric Sentinel Shield + "M" Monogram in Pure White */}
      <path
        d="M32 10L50 17.5V31.5C50 43.2 42.3 51.8 32 55C21.7 51.8 14 43.2 14 31.5V17.5L32 10Z"
        stroke="#FFFFFF"
        strokeWidth="3.2"
        strokeLinejoin="round"
      />

      {/* Geometric "M" + Sentinel Core Pillar */}
      <path
        d="M21.5 39V24L32 33.5L42.5 24V39"
        stroke="#FFFFFF"
        strokeWidth="3.4"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />

      {/* Minimalist Center Diamond Point */}
      <rect
        x="32"
        y="17.5"
        width="4.2"
        height="4.2"
        transform="rotate(45 32 17.5)"
        fill="#FFFFFF"
      />
    </svg>
  );
};

export default BrandLogoMark;
