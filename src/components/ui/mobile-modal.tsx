
import React, { useRef, useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  showCloseButton?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'full';
}

const MobileModal: React.FC<MobileModalProps> = ({
  isOpen,
  onClose,
  children,
  title,
  showCloseButton = true,
  size = 'md'
}) => {
  const [startY, setStartY] = useState(0);
  const [currentY, setCurrentY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    setStartY(e.touches[0].clientY);
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    
    const diff = e.touches[0].clientY - startY;
    if (diff > 0) {
      setCurrentY(diff);
    }
  };

  const handleTouchEnd = () => {
    if (currentY > 150) {
      onClose();
    }
    setCurrentY(0);
    setIsDragging(false);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const sizeClasses = {
    sm: 'max-h-[50vh]',
    md: 'max-h-[75vh]',
    lg: 'max-h-[90vh]',
    full: 'h-full rounded-t-none'
  };

  if (!isOpen) return null;

  return (
    <div 
      className={cn(
        "fixed inset-0 bg-black/50 z-50 flex items-end md:items-center md:justify-center transition-all duration-300",
        isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
      )}
      onClick={handleBackdropClick}
    >
      <div 
        ref={modalRef}
        className={cn(
          'bg-white w-full flex flex-col rounded-t-3xl md:rounded-2xl shadow-2xl transition-all duration-300 ease-out',
          sizeClasses[size],
          'md:max-w-md md:mx-auto md:max-h-[80vh]'
        )}
        style={{ 
          transform: `translateY(${currentY}px)`,
          transition: isDragging ? 'none' : 'transform 0.3s ease-out'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle */}
        <div className="flex justify-center py-3 md:hidden">
          <div className="w-10 h-1 bg-gray-300 rounded-full"></div>
        </div>

        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between px-6 pb-4 pt-2">
            {showCloseButton && (
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="h-5 w-5 text-gray-600" />
              </button>
            )}
            
            <h2 className="text-xl font-semibold text-gray-900 flex-1 text-center">
              {title || ''}
            </h2>
            
            <div className="w-9 h-9"></div> {/* Spacer for centering */}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
};

export default MobileModal;
