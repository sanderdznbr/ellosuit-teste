
import { useCallback, useRef, useState } from 'react';

interface SwipeGestureOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  threshold?: number;
}

export const useSwipeGesture = (options: SwipeGestureOptions) => {
  const [isGesturing, setIsGesturing] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const currentX = useRef(0);
  const currentY = useRef(0);
  const threshold = options.threshold || 50;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    setIsGesturing(true);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isGesturing) return;
    
    currentX.current = e.touches[0].clientX;
    currentY.current = e.touches[0].clientY;
  }, [isGesturing]);

  const handleTouchEnd = useCallback(() => {
    if (!isGesturing) return;
    
    const diffX = currentX.current - startX.current;
    const diffY = currentY.current - startY.current;
    
    if (Math.abs(diffX) > Math.abs(diffY)) {
      // Horizontal swipe
      if (Math.abs(diffX) > threshold) {
        if (diffX > 0) {
          options.onSwipeRight?.();
        } else {
          options.onSwipeLeft?.();
        }
      }
    } else {
      // Vertical swipe
      if (Math.abs(diffY) > threshold) {
        if (diffY > 0) {
          options.onSwipeDown?.();
        } else {
          options.onSwipeUp?.();
        }
      }
    }
    
    setIsGesturing(false);
  }, [isGesturing, threshold, options]);

  return {
    isGesturing,
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd
  };
};

interface PullToRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number;
}

export const usePullToRefresh = (options: PullToRefreshOptions) => {
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef(0);
  const threshold = options.threshold || 80;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const currentY = e.touches[0].clientY;
    const diff = currentY - startY.current;
    
    if (diff > 0 && window.scrollY === 0) {
      setIsPulling(true);
      setPullDistance(Math.min(diff, threshold * 1.5));
    }
  }, [threshold]);

  const handleTouchEnd = useCallback(async () => {
    if (isPulling && pullDistance > threshold) {
      setIsRefreshing(true);
      await options.onRefresh();
      setIsRefreshing(false);
    }
    
    setIsPulling(false);
    setPullDistance(0);
  }, [isPulling, pullDistance, threshold, options]);

  return {
    isPulling,
    isRefreshing,
    pullDistance,
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd
  };
};
