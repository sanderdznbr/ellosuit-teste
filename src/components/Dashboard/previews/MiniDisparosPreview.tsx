import React from 'react';
import { useTheme } from '@/hooks/useTheme';

/** Miniature Disparos em Massa preview */
export default function MiniDisparosPreview() {
  const { theme } = useTheme();
  const isLight = theme === 'dark';

  const bg = isLight ? '#f8f9fa' : '#0f1419';
  const border = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.10)';
  const dim = isLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.12)';
  const mid = isLight ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.25)';
  const strong = isLight ? 'rgba(0,0,0,0.50)' : 'rgba(255,255,255,0.50)';
  const cardBg = isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.04)';

  return (
    <div className="w-full h-full flex flex-col overflow-hidden select-none pointer-events-none" style={{ fontSize: '5px', backgroundColor: bg }}>
      <style>{`
        @keyframes mdSlide { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
        @keyframes mdSend { 0%{transform:translateX(0);opacity:1} 100%{transform:translateX(12px);opacity:0} }
      `}</style>

      {/* Header */}
      <div className="h-[14px] flex items-center px-2 gap-1.5" style={{ borderBottom: `1px solid ${border}` }}>
        <div className="w-[8px] h-[8px] rounded bg-[#FF4500]/20 flex items-center justify-center">
          <div className="w-[4px] h-[4px] rounded-sm bg-[#FF4500]" />
        </div>
        <div className="h-[3px] w-[35px] rounded-full" style={{ backgroundColor: strong }} />
      </div>

      {/* Progress bar */}
      <div className="px-2 pt-1.5">
        <div className="h-[4px] rounded-full overflow-hidden" style={{ backgroundColor: dim }}>
          <div className="h-full rounded-full bg-[#FF4500]/70" style={{ width: '68%', animation: 'mdSlide 0.6s ease-out both' }} />
        </div>
        <div className="flex justify-between mt-[2px]">
          <div className="h-[2px] w-[20px] rounded-full" style={{ backgroundColor: mid }} />
          <div className="h-[2px] w-[14px] rounded-full" style={{ backgroundColor: mid }} />
        </div>
      </div>

      {/* Contact rows sending */}
      <div className="flex-1 px-2 py-1.5 space-y-[3px] overflow-hidden">
        {[
          { w: 55, status: 'sent', delay: 0.1 },
          { w: 42, status: 'sent', delay: 0.18 },
          { w: 60, status: 'sent', delay: 0.26 },
          { w: 38, status: 'sending', delay: 0.34 },
          { w: 48, status: 'pending', delay: 0.42 },
          { w: 52, status: 'pending', delay: 0.50 },
        ].map((row, i) => (
          <div key={i} className="flex items-center gap-1 rounded-md px-1 py-[3px]" style={{ backgroundColor: cardBg, animation: `mdSlide 0.3s ${row.delay}s both ease-out` }}>
            <div className="w-[10px] h-[10px] rounded-full bg-gradient-to-br from-orange-400 to-orange-600 shrink-0" />
            <div className="h-[2.5px] rounded-full" style={{ width: `${row.w}%`, backgroundColor: mid }} />
            <div className="ml-auto">
              {row.status === 'sent' && <div className="w-[5px] h-[5px] rounded-full bg-green-500/50" />}
              {row.status === 'sending' && (
                <div className="w-[5px] h-[5px] rounded-full bg-[#FF4500]/60" style={{ animation: 'mdSend 1s infinite' }} />
              )}
              {row.status === 'pending' && <div className="w-[5px] h-[5px] rounded-full" style={{ backgroundColor: dim }} />}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="h-[12px] flex items-center px-2 gap-1" style={{ borderTop: `1px solid ${border}` }}>
        <div className="h-[6px] px-2 rounded-full bg-[#FF4500]/60 flex items-center">
          <div className="h-[2px] w-[16px] rounded-full bg-white/80" />
        </div>
      </div>
    </div>
  );
}
