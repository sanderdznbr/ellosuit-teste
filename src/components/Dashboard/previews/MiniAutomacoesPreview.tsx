import React from 'react';
import { useTheme } from '@/hooks/useTheme';

/** Miniature Automações preview — workflow/zap aesthetic */
export default function MiniAutomacoesPreview() {
  const { theme } = useTheme();
  const isLight = theme === 'dark';

  const bg = isLight ? '#f8f9fa' : '#0f1419';
  const border = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.10)';
  const dim = isLight ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.08)';
  const mid = isLight ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.22)';
  const strong = isLight ? 'rgba(0,0,0,0.50)' : 'rgba(255,255,255,0.50)';
  const cardBg = isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.04)';
  const lineBg = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)';

  return (
    <div className="w-full h-full flex flex-col overflow-hidden select-none pointer-events-none" style={{ fontSize: '5px', backgroundColor: bg }}>
      <style>{`
        @keyframes auSlide { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
        @keyframes auFlow { 0%{background-position:0 0} 100%{background-position:20px 0} }
        @keyframes auZap { 0%,100%{opacity:.4;transform:scale(.9)} 50%{opacity:1;transform:scale(1.1)} }
      `}</style>

      {/* Header */}
      <div className="h-[14px] flex items-center px-2 gap-1.5" style={{ borderBottom: `1px solid ${border}` }}>
        <div className="w-[8px] h-[8px] rounded bg-[#FF4500]/20 flex items-center justify-center">
          <div className="w-[4px] h-[4px] rounded-sm bg-[#FF4500]" />
        </div>
        <div className="h-[3px] w-[30px] rounded-full" style={{ backgroundColor: strong }} />
        <div className="ml-auto h-[6px] px-1.5 rounded-full bg-[#FF4500]/50 flex items-center">
          <div className="h-[2px] w-[10px] rounded-full bg-white/70" />
        </div>
      </div>

      {/* Automation list */}
      <div className="flex-1 p-2 space-y-[4px] overflow-hidden">
        {[
          { name: 50, steps: 3, active: true, delay: 0.1 },
          { name: 40, steps: 5, active: true, delay: 0.2 },
          { name: 55, steps: 2, active: false, delay: 0.3 },
          { name: 35, steps: 4, active: true, delay: 0.4 },
        ].map((auto, i) => (
          <div key={i} className="rounded-lg p-1.5" style={{
            backgroundColor: cardBg,
            border: `1px solid ${border}`,
            animation: `auSlide 0.3s ${auto.delay}s both ease-out`,
          }}>
            <div className="flex items-center justify-between mb-[3px]">
              <div className="flex items-center gap-1">
                <div className="w-[4px] h-[4px] rounded-full" style={{
                  backgroundColor: auto.active ? '#22c55e' : mid,
                  animation: auto.active ? 'auZap 2s infinite' : 'none',
                }} />
                <div className="h-[2.5px] rounded-full" style={{ width: `${auto.name}%`, backgroundColor: strong }} />
              </div>
              <div className="h-[2px] w-[10px] rounded-full" style={{ backgroundColor: dim }} />
            </div>
            {/* Step flow */}
            <div className="flex items-center gap-[2px]">
              {Array.from({ length: auto.steps }).map((_, j) => (
                <React.Fragment key={j}>
                  <div className="w-[8px] h-[6px] rounded-sm" style={{
                    backgroundColor: j === 0 ? '#FF4500' : j === auto.steps - 1 ? '#22c55e' : `${mid}`,
                    opacity: j === 0 || j === auto.steps - 1 ? 0.6 : 0.4,
                  }} />
                  {j < auto.steps - 1 && (
                    <div className="w-[4px] h-[1px]" style={{ backgroundColor: lineBg }} />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
