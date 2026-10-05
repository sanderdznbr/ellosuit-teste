
import React from 'react';
import { cn } from '@/lib/utils';

interface MobileCardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  onTouchStart?: (e: React.TouchEvent) => void;
  onTouchMove?: (e: React.TouchEvent) => void;
  onTouchEnd?: () => void;
  pressable?: boolean;
}

const MobileCard: React.FC<MobileCardProps> = ({
  children,
  className,
  style,
  onClick,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  pressable = false
}) => {
  return (
    <div
      className={cn(
        'mobile-card',
        pressable && 'mobile-touch-feedback cursor-pointer',
        className
      )}
      style={style}
      onClick={onClick}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {children}
    </div>
  );
};

export default MobileCard;
