
export const isMobileDevice = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

export const isIOS = () => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
};

export const isAndroid = () => {
  return /Android/.test(navigator.userAgent);
};

export const hasNotch = () => {
  return CSS.supports('padding-top: env(safe-area-inset-top)');
};

export const vibrate = (pattern: number | number[] = 50) => {
  if (navigator.vibrate) {
    navigator.vibrate(pattern);
  }
};

export const formatDateMobile = (date: Date | string) => {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (d.toDateString() === today.toDateString()) {
    return 'Hoje';
  } else if (d.toDateString() === yesterday.toDateString()) {
    return 'Ontem';
  } else {
    return d.toLocaleDateString('pt-BR', {
      day: 'numeric',
      month: 'short'
    });
  }
};

export const formatTimeMobile = (date: Date | string) => {
  return new Date(date).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const getStatusBarHeight = () => {
  if (isIOS()) {
    return 'env(safe-area-inset-top)';
  }
  return '0px';
};

export const scrollToTop = (smooth: boolean = true) => {
  window.scrollTo({
    top: 0,
    behavior: smooth ? 'smooth' : 'auto'
  });
};

export const preventScroll = (prevent: boolean) => {
  if (prevent) {
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = 'auto';
  }
};
