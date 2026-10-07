import React from 'react';

interface TcddLogoBadgeProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  alt?: string;
}

const SIZE_MAP = {
  sm: 'w-7 h-7',
  md: 'w-8 h-8',
  lg: 'w-10 h-10',
  xl: 'w-14 h-14',
};

export const TcddLogoBadge: React.FC<TcddLogoBadgeProps> = ({
  className = '',
  size = 'md',
  alt = 'TCDD Takip 712 Kısım Şefliği Logo',
}) => {
  const sizeClass = SIZE_MAP[size] || size;

  return (
    <img
      src="/tcdd_logo_badge.svg"
      alt={alt}
      className={`rounded-full object-contain shrink-0 shadow-xs select-none ${sizeClass} ${className}`}
      loading="eager"
      decoding="async"
    />
  );
};
