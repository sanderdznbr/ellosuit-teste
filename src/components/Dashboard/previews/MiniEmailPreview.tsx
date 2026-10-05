import React from 'react';
import { useTheme } from '@/hooks/useTheme';

/** Miniature Email Marketing preview */
export default function MiniEmailPreview() {
  const { theme } = useTheme();
  const isLight = theme === 'dark';

  const bg = isLight ? '#f8f9fa' : '#0f1419';
  const border = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.10)';
  const dim = isLight ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.08)';
  const mid = isLight ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.22)';
  const strong = isLight ? 'rgba(0,0,0,0.50)' : 'rgba(255,255,255,0.50)';
  const cardBg = isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.04)';

  return (
    <div className="w-full h-full flex overflow-hidden select-none pointer-events-none" style={{ fontSize: '5px', backgroundColor: bg }}>
      <style>{`
        @keyframes emSlide { from{opacity:0;transform:translateX(-4px)} to{opacity:1;transform:translateX(0)} }
      `}</style>

      {/* Sidebar email list */}
      <div className="w-[38%] flex flex-col" style={{ borderRight: `1px solid ${border}` }}>
        <div className="h-[14px] flex items-center px-2 gap-1" style={{ borderBottom: `1px solid ${border}` }}>
          <div className="w-[8px] h-[8px] rounded bg-[#FF4500]/20 flex items-center justify-center">
            <div className="w-[4px] h-[4px] rounded-sm bg-[#FF4500]" />
          </div>
          <div className="h-[3px] w-[24px] rounded-full" style={{ backgroundColor: strong }} />
        </div>
        <div className="flex-1 overflow-hidden space-y-[1px] py-1">
          {[
            { active: true, w1: 55, w2: 70 },
            { active: false, w1: 40, w2: 60 },
            { active: false, w1: 50, w2: 45 },
            { active: false, w1: 35, w2: 55 },
            { active: false, w1: 48, w2: 50 },
          ].map((row, i) => (
            <div key={i} className="flex items-start gap-1 px-2 py-[3px]" style={{
              backgroundColor: row.active ? cardBg : 'transparent',
              animation: `emSlide 0.3s ${i * 0.07}s both ease-out`,
            }}>
              <div className="w-[10px] h-[10px] rounded-full bg-gradient-to-br from-orange-400 to-orange-600 shrink-0 mt-[1px]" />
              <div className="flex-1 min-w-0">
                <div className="h-[2.5px] rounded-full" style={{ width: `${row.w1}%`, backgroundColor: strong }} />
                <div className="h-[2px] rounded-full mt-[2px]" style={{ width: `${row.w2}%`, backgroundColor: mid }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Email preview pane */}
      <div className="flex-1 flex flex-col">
        <div className="h-[14px] flex items-center px-2 gap-1" style={{ borderBottom: `1px solid ${border}` }}>
          <div className="h-[3px] w-[40px] rounded-full" style={{ backgroundColor: strong }} />
          <div className="ml-auto flex gap-[3px]">
            <div className="w-[5px] h-[5px] rounded" style={{ backgroundColor: dim }} />
            <div className="w-[5px] h-[5px] rounded" style={{ backgroundColor: dim }} />
          </div>
        </div>
        <div className="flex-1 p-2 overflow-hidden" style={{ animation: 'emSlide 0.4s 0.2s both ease-out' }}>
          {/* Email header */}
          <div className="flex items-center gap-1 mb-2">
            <div className="w-[12px] h-[12px] rounded-full bg-gradient-to-br from-orange-400 to-orange-600" />
            <div>
              <div className="h-[2.5px] w-[30px] rounded-full" style={{ backgroundColor: strong }} />
              <div className="h-[2px] w-[22px] rounded-full mt-[2px]" style={{ backgroundColor: mid }} />
            </div>
          </div>
          {/* Email body lines */}
          <div className="space-y-[3px]">
            <div className="h-[3px] w-[90%] rounded-full" style={{ backgroundColor: mid }} />
            <div className="h-[2.5px] w-[75%] rounded-full" style={{ backgroundColor: dim }} />
            <div className="h-[2.5px] w-[85%] rounded-full" style={{ backgroundColor: dim }} />
            <div className="mt-2 h-[14px] w-[70%] rounded-md" style={{ backgroundColor: cardBg }} />
            <div className="h-[2.5px] w-[60%] rounded-full mt-2" style={{ backgroundColor: dim }} />
            <div className="h-[2.5px] w-[80%] rounded-full" style={{ backgroundColor: dim }} />
          </div>
          {/* CTA button */}
          <div className="mt-2 h-[8px] w-[40px] rounded-full bg-[#FF4500]/50 flex items-center justify-center">
            <div className="h-[2px] w-[20px] rounded-full bg-white/70" />
          </div>
        </div>
      </div>
    </div>
  );
}
