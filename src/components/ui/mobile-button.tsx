
import React from 'react';
import { cn } from '@/lib/utils';

interface MobileButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}

const MobileButton: React.FC<MobileButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  disabled = false,
  onClick,
  className
}) => {
  const variants = {
    primary: 'mobile-button-primary',
    secondary: 'mobile-button-secondary',
    ghost: 'hover:bg-gray-100 active:bg-gray-200 text-gray-900',
    danger: 'bg-red-500 text-white hover:bg-red-600 active:bg-red-700'
  };

  const sizes = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-3 text-base',
    lg: 'px-6 py-4 text-lg'
  };

  return (
    <button
      className={cn(
        'mobile-button',
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
};

export default MobileButton;
