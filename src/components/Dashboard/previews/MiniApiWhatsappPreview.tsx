import React from 'react';
import { useTheme } from '@/hooks/useTheme';

/** Miniature API WhatsApp preview — code/terminal aesthetic */
export default function MiniApiWhatsappPreview() {
  const { theme } = useTheme();
  const isLight = theme === 'dark';

  const bg = isLight ? '#f8f9fa' : '#0f1419';
  const border = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.10)';
  const dimText = isLight ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.15)';
  const midText = isLight ? 'rgba(0,0,0,0.30)' : 'rgba(255,255,255,0.30)';
  const strongText = isLight ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.55)';
  const cardBg = isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.04)';

  return (
    <div className="w-full h-full flex flex-col overflow-hidden select-none pointer-events-none" style={{ fontSize: '5px', backgroundColor: bg }}>
      <style>{`
        @keyframes maSlide { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
        @keyframes maBlink { 0%,100%{opacity:.3} 50%{opacity:1} }
      `}</style>

      {/* Header */}
      <div className="h-[14px] flex items-center px-2 gap-1.5" style={{ borderBottom: `1px solid ${border}` }}>
        <div className="w-[8px] h-[8px] rounded bg-[#FF4500]/20 flex items-center justify-center">
          <div className="w-[4px] h-[4px] rounded-sm bg-[#FF4500]" />
        </div>
        <div className="h-[3px] w-[30px] rounded-full" style={{ backgroundColor: strongText }} />
        <div className="ml-auto flex gap-1">
          <div className="h-[6px] px-1.5 rounded-full bg-green-500/20 flex items-center">
            <div className="w-[3px] h-[3px] rounded-full bg-green-500" style={{ animation: 'maBlink 2s infinite' }} />
          </div>
        </div>
      </div>

      {/* API Stats cards */}
      <div className="flex gap-1 px-2 py-1.5" style={{ animation: 'maSlide 0.4s ease-out both' }}>
        {[
          { label: 20, value: 28, color: '#FF4500' },
          { label: 16, value: 22, color: '#22c55e' },
          { label: 18, value: 18, color: '#374DA4' },
        ].map((s, i) => (
          <div key={i} className="flex-1 rounded-md p-1" style={{ backgroundColor: cardBg, animation: `maSlide 0.4s ${i * 0.08}s both ease-out` }}>
            <div className="h-[2px] rounded-full mb-[3px]" style={{ width: `${s.label}px`, backgroundColor: midText }} />
            <div className="h-[4px] rounded-full" style={{ width: `${s.value}px`, backgroundColor: s.color, opacity: 0.6 }} />
          </div>
        ))}
      </div>

      {/* Code / endpoint block */}
      <div className="mx-2 rounded-md p-1.5 flex-1 overflow-hidden" style={{ backgroundColor: cardBg }}>
        {[
          { method: 'POST', w: 45, delay: 0.15 },
          { method: 'GET', w: 38, delay: 0.22 },
          { method: 'POST', w: 50, delay: 0.29 },
          { method: 'GET', w: 32, delay: 0.36 },
          { method: 'DEL', w: 40, delay: 0.43 },
        ].map((line, i) => (
          <div key={i} className="flex items-center gap-1 mb-[3px]" style={{ animation: `maSlide 0.3s ${line.delay}s both ease-out` }}>
            <div className="h-[5px] px-1 rounded-sm flex items-center" style={{
              backgroundColor: line.method === 'POST' ? '#FF4500' : line.method === 'GET' ? '#22c55e' : '#ef4444',
              opacity: 0.7,
            }}>
              <div className="h-[2px] rounded-full bg-white/80" style={{ width: line.method === 'DEL' ? '6px' : '8px' }} />
            </div>
            <div className="h-[2.5px] rounded-full" style={{ width: `${line.w}%`, backgroundColor: midText }} />
            <div className="ml-auto h-[2px] w-[10px] rounded-full" style={{ backgroundColor: dimText }} />
          </div>
        ))}
      </div>

      {/* Bottom bar */}
      <div className="h-[12px] flex items-center px-2 gap-1 mt-1" style={{ borderTop: `1px solid ${border}` }}>
        <div className="w-[4px] h-[4px] rounded-full bg-green-500/60" />
        <div className="h-[2px] w-[25px] rounded-full" style={{ backgroundColor: dimText }} />
        <div className="ml-auto h-[2px] w-[18px] rounded-full" style={{ backgroundColor: dimText }} />
      </div>
    </div>
  );
}
