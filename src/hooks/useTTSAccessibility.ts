import { useState, useEffect, useCallback } from 'react';

const TTS_STORAGE_KEY = 'ellosuit_tts_enabled';

export function useTTSAccessibility() {
  const [ttsEnabled, setTtsEnabled] = useState(() => {
    try {
      return localStorage.getItem(TTS_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(TTS_STORAGE_KEY, String(ttsEnabled));
    } catch {}
  }, [ttsEnabled]);

  const toggleTTS = useCallback(() => {
    setTtsEnabled(prev => !prev);
  }, []);

  return { ttsEnabled, toggleTTS, setTtsEnabled };
}
