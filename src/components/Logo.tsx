import React from 'react';

interface LogoProps {
  size?: number;
  className?: string;
}

export default function Logo({ size = 32, className = "" }: LogoProps) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 40 40" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className="drop-shadow-sm"
      >
        {/* Background Circle with Gradient */}
        <defs>
          <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10B981" />
            <stop offset="50%" stopColor="#059669" />
            <stop offset="100%" stopColor="#047857" />
          </linearGradient>
          <linearGradient id="coinGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FCD34D" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>
        </defs>
        
        {/* Main Background Circle */}
        <circle 
          cx="20" 
          cy="20" 
          r="18" 
          fill="url(#logoGradient)"
          stroke="#065F46"
          strokeWidth="1"
        />
        
        {/* Dollar Sign */}
        <text 
          x="20" 
          y="26" 
          fontSize="20" 
          fontWeight="bold" 
          fill="white" 
          textAnchor="middle"
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          $
        </text>
        
        {/* Decorative Coins */}
        <circle cx="8" cy="12" r="3" fill="url(#coinGradient)" opacity="0.9" />
        <circle cx="32" cy="12" r="3" fill="url(#coinGradient)" opacity="0.9" />
        <circle cx="8" cy="28" r="3" fill="url(#coinGradient)" opacity="0.9" />
        <circle cx="32" cy="28" r="3" fill="url(#coinGradient)" opacity="0.9" />
        
        {/* Small Dollar Signs on Coins */}
        <text x="8" y="14" fontSize="4" fontWeight="bold" fill="#92400E" textAnchor="middle">$</text>
        <text x="32" y="14" fontSize="4" fontWeight="bold" fill="#92400E" textAnchor="middle">$</text>
        <text x="8" y="30" fontSize="4" fontWeight="bold" fill="#92400E" textAnchor="middle">$</text>
        <text x="32" y="30" fontSize="4" fontWeight="bold" fill="#92400E" textAnchor="middle">$</text>
        
        {/* Chart Lines for Financial Growth */}
        <path 
          d="M6 22 L12 18 L18 20 L24 16 L30 12 L34 14" 
          stroke="white" 
          strokeWidth="1.5" 
          fill="none" 
          opacity="0.7"
        />
        
        {/* Chart Points */}
        <circle cx="12" cy="18" r="1" fill="white" opacity="0.8" />
        <circle cx="18" cy="20" r="1" fill="white" opacity="0.8" />
        <circle cx="24" cy="16" r="1" fill="white" opacity="0.8" />
        <circle cx="30" cy="12" r="1" fill="white" opacity="0.8" />
      </svg>
    </div>
  );
}