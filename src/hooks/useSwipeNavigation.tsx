
import { useCallback, useRef, useState } from 'react';

type FilterType = 'hoje' | 'amanha' | 'semana' | 'mes';

interface SwipeNavigationOptions {
  filters: FilterType[];
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  threshold?: number;
}

export const useSwipeNavigation = (options: SwipeNavigationOptions) => {
  const [isSwipeGesturing, setIsSwipeGesturing] = useState(false);
  const [swipeProgress, setSwipeProgress] = useState(0);
  const startX = useRef(0);
  const currentX = useRef(0);
  const threshold = options.threshold || 80;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    setIsSwipeGesturing(true);
    setSwipeProgress(0);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isSwipeGesturing) return;
    
    currentX.current = e.touches[0].clientX;
    const diff = currentX.current - startX.current;
    
    // Calcular progresso do swipe (-1 a 1)
    const progress = Math.max(-1, Math.min(1, diff / threshold));
    setSwipeProgress(progress);
  }, [isSwipeGesturing, threshold]);

  const handleTouchEnd = useCallback(() => {
    if (!isSwipeGesturing) return;
    
    const diff = currentX.current - startX.current;
    const currentIndex = options.filters.indexOf(options.activeFilter);
    
    if (Math.abs(diff) > threshold) {
      if (diff > 0 && currentIndex > 0) {
        // Swipe direita - filtro anterior
        options.onFilterChange(options.filters[currentIndex - 1]);
      } else if (diff < 0 && currentIndex < options.filters.length - 1) {
        // Swipe esquerda - próximo filtro
        options.onFilterChange(options.filters[currentIndex + 1]);
      }
    }
    
    setIsSwipeGesturing(false);
    setSwipeProgress(0);
  }, [isSwipeGesturing, threshold, options]);

  return {
    isSwipeGesturing,
    swipeProgress,
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd
  };
};
