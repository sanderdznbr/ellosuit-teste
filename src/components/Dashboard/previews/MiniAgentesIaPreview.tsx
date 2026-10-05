import React from 'react';
import { useTheme } from '@/hooks/useTheme';

/** Miniature Agentes de IA preview */
export default function MiniAgentesIaPreview() {
  const { theme } = useTheme();
  const isLight = theme === 'dark';

  const bg = isLight ? '#f8f9fa' : '#0f1419';
  const border = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.10)';
  const dim = isLight ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.08)';
  const mid = isLight ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.22)';
  const strong = isLight ? 'rgba(0,0,0,0.50)' : 'rgba(255,255,255,0.50)';
  const cardBg = isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.04)';

  return (
    <div className="w-full h-full flex flex-col overflow-hidden select-none pointer-events-none" style={{ fontSize: '5px', backgroundColor: bg }}>
      <style>{`
        @keyframes aiPop { from{opacity:0;transform:scale(.85)} to{opacity:1;transform:scale(1)} }
        @keyframes aiPulse { 0%,100%{opacity:.5} 50%{opacity:1} }
        @keyframes aiType { 0%,80%,100%{transform:scale(.6);opacity:.3} 40%{transform:scale(1);opacity:1} }
      `}</style>

      {/* Header */}
      <div className="h-[14px] flex items-center px-2 gap-1.5" style={{ borderBottom: `1px solid ${border}` }}>
        <div className="w-[8px] h-[8px] rounded bg-[#FF4500]/20 flex items-center justify-center">
          <div className="w-[4px] h-[4px] rounded-sm bg-[#FF4500]" />
        </div>
        <div className="h-[3px] w-[28px] rounded-full" style={{ backgroundColor: strong }} />
      </div>

      {/* Agent cards grid */}
      <div className="flex-1 p-2 overflow-hidden">
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { name: 30, desc: 22, color: '#FF4500', active: true },
            { name: 24, desc: 18, color: '#8b5cf6', active: true },
            { name: 28, desc: 20, color: '#22c55e', active: false },
            { name: 22, desc: 26, color: '#374DA4', active: true },
          ].map((agent, i) => (
            <div key={i} className="rounded-lg p-1.5 relative" style={{
              backgroundColor: cardBg,
              border: `1px solid ${border}`,
              animation: `aiPop 0.3s ${i * 0.1}s both ease-out`,
            }}>
              {/* Avatar */}
              <div className="w-[12px] h-[12px] rounded-full mb-[3px]" style={{
                background: `linear-gradient(135deg, ${agent.color}80, ${agent.color})`,
              }}>
                {agent.active && (
                  <div className="w-[3px] h-[3px] rounded-full bg-green-400 ml-auto mt-auto relative" style={{ top: '8px', left: '-1px', animation: 'aiPulse 2s infinite' }} />
                )}
              </div>
              <div className="h-[2.5px] rounded-full" style={{ width: `${agent.name}px`, backgroundColor: strong }} />
              <div className="h-[2px] rounded-full mt-[2px]" style={{ width: `${agent.desc}px`, backgroundColor: mid }} />
              {/* Mini brain icon */}
              <div className="absolute top-1 right-1 w-[5px] h-[5px] rounded-full" style={{ backgroundColor: `${agent.color}40` }} />
            </div>
          ))}
        </div>

        {/* Chat with agent */}
        <div className="mt-2 rounded-md p-1.5" style={{ backgroundColor: cardBg, animation: 'aiPop 0.3s 0.5s both ease-out' }}>
          <div className="flex items-center gap-1 mb-[3px]">
            <div className="w-[6px] h-[6px] rounded-full bg-[#FF4500]" />
            <div className="h-[2px] w-[18px] rounded-full" style={{ backgroundColor: strong }} />
          </div>
          <div className="h-[2px] w-[85%] rounded-full" style={{ backgroundColor: mid }} />
          <div className="h-[2px] w-[65%] rounded-full mt-[2px]" style={{ backgroundColor: dim }} />
          {/* Typing */}
          <div className="flex gap-[2px] mt-[3px]">
            {[0, 0.15, 0.3].map((d, i) => (
              <div key={i} className="w-[2.5px] h-[2.5px] rounded-full bg-[#FF4500]/50" style={{ animation: `aiType 1.2s ${d}s infinite` }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
