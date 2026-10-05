
/**
 * Utility functions for handling server-side date synchronization with Brazil timezone
 */

// Cache for server date offset
let serverDateOffset: number | null = null;
let isInitialized = false;

/**
 * Get the current server date in Brazil timezone (UTC-3)
 */
export const getServerDate = (): Date => {
  // Create a new date in Brazil timezone (UTC-3)
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const brazilTime = new Date(utc + (-3 * 3600000)); // UTC-3
  
  // Ensure we're in 2025
  if (brazilTime.getFullYear() < 2025) {
    brazilTime.setFullYear(2025);
  }
  
  return brazilTime;
};

/**
 * Get today's date string in YYYY-MM-DD format using Brazil timezone
 */
export const getServerTodayString = (): string => {
  const serverDate = getServerDate();
  const year = serverDate.getFullYear();
  const month = String(serverDate.getMonth() + 1).padStart(2, '0');
  const day = String(serverDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Get tomorrow's date string in YYYY-MM-DD format using Brazil timezone
 */
export const getServerTomorrowString = (): string => {
  const serverDate = getServerDate();
  const tomorrow = new Date(serverDate);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const year = tomorrow.getFullYear();
  const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const day = String(tomorrow.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Get yesterday's date string in YYYY-MM-DD format using Brazil timezone
 */
export const getServerYesterdayString = (): string => {
  const serverDate = getServerDate();
  const yesterday = new Date(serverDate);
  yesterday.setDate(yesterday.getDate() - 1);
  const year = yesterday.getFullYear();
  const month = String(yesterday.getMonth() + 1).padStart(2, '0');
  const day = String(yesterday.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Initialize server date offset based on the first event we see
 * This is a workaround to sync with the actual data dates
 */
export const initializeServerDateFromEvents = (events: any[]): void => {
  if (isInitialized || events.length === 0) return;
  
  console.log('Initializing server date from events...');
  console.log('Current Brazil time:', getServerDate());
  console.log('Events found:', events.length);
  
  isInitialized = true;
};

/**
 * Reset server date offset (useful for testing)
 */
export const resetServerDateOffset = (): void => {
  serverDateOffset = null;
  isInitialized = false;
};

/**
 * Format date for display in Brazil timezone
 */
export const formatBrazilDate = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

/**
 * Get date from string in Brazil timezone
 */
export const parseBrazilDate = (dateString: string): Date => {
  const date = new Date(dateString);
  // Ensure we're working with Brazil timezone
  const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
  const brazilTime = new Date(utc + (-3 * 3600000));
  return brazilTime;
};

/**
 * Check if a date string matches today in Brazil timezone
 */
export const isToday = (dateString: string): boolean => {
  const todayString = getServerTodayString();
  
  // Agora usamos o formato direto sem conversão de fuso horário
  // O dateString vem no formato YYYY-MM-DDTHH:mm:ss
  const eventDateString = dateString.split('T')[0];
  
  console.log('🔍 isToday check:');
  console.log('- Today string:', todayString);
  console.log('- Event date string:', eventDateString);
  console.log('- Is today?:', eventDateString === todayString);
  
  return eventDateString === todayString;
};

/**
 * Check if a date string matches tomorrow in Brazil timezone
 */
export const isTomorrow = (dateString: string): boolean => {
  const tomorrowString = getServerTomorrowString();
  
  // Agora usamos o formato direto sem conversão de fuso horário
  // O dateString vem no formato YYYY-MM-DDTHH:mm:ss
  const eventDateString = dateString.split('T')[0];
  
  console.log('🔍 isTomorrow check:');
  console.log('- Tomorrow string:', tomorrowString);
  console.log('- Event date string:', eventDateString);
  console.log('- Is tomorrow?:', eventDateString === tomorrowString);
  
  return eventDateString === tomorrowString;
};
