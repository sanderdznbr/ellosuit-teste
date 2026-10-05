import React from 'react';
import { useTheme } from '@/hooks/useTheme';

/** Miniature ChatBot Builder preview — flow/node aesthetic */
export default function MiniChatbotPreview() {
  const { theme } = useTheme();
  const isLight = theme === 'dark';

  const bg = isLight ? '#f8f9fa' : '#0f1419';
  const border = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.10)';
  const dim = isLight ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.08)';
  const mid = isLight ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.22)';
  const strong = isLight ? 'rgba(0,0,0,0.50)' : 'rgba(255,255,255,0.50)';
  const nodeBg = isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.05)';
  const lineColor = isLight ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.10)';

  return (
    <div className="w-full h-full flex flex-col overflow-hidden select-none pointer-events-none relative" style={{ fontSize: '5px', backgroundColor: bg }}>
      <style>{`
        @keyframes cbPop { from{opacity:0;transform:scale(.85)} to{opacity:1;transform:scale(1)} }
        @keyframes cbDraw { from{stroke-dashoffset:40} to{stroke-dashoffset:0} }
      `}</style>

      {/* Header */}
      <div className="h-[14px] flex items-center px-2 gap-1.5 z-10" style={{ borderBottom: `1px solid ${border}` }}>
        <div className="w-[8px] h-[8px] rounded bg-[#FF4500]/20 flex items-center justify-center">
          <div className="w-[4px] h-[4px] rounded-sm bg-[#FF4500]" />
        </div>
        <div className="h-[3px] w-[32px] rounded-full" style={{ backgroundColor: strong }} />
      </div>

      {/* Flow canvas */}
      <div className="flex-1 relative overflow-hidden">
        {/* Grid dots */}
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle, ${dim} 1px, transparent 1px)`,
          backgroundSize: '8px 8px',
        }} />

        {/* SVG connections */}
        <svg className="absolute inset-0 w-full h-full" style={{ overflow: 'visible' }}>
          <path d="M 35 22 C 50 22, 50 42, 65 42" fill="none" stroke={lineColor} strokeWidth="1" strokeDasharray="40" style={{ animation: 'cbDraw 0.8s 0.3s both ease-out' }} />
          <path d="M 35 22 C 50 22, 50 62, 65 62" fill="none" stroke={lineColor} strokeWidth="1" strokeDasharray="40" style={{ animation: 'cbDraw 0.8s 0.5s both ease-out' }} />
          <path d="M 90 42 C 105 42, 105 52, 115 52" fill="none" stroke={lineColor} strokeWidth="1" strokeDasharray="40" style={{ animation: 'cbDraw 0.8s 0.7s both ease-out' }} />
          <path d="M 90 62 C 105 62, 105 52, 115 52" fill="none" stroke={lineColor} strokeWidth="1" strokeDasharray="40" style={{ animation: 'cbDraw 0.8s 0.7s both ease-out' }} />
        </svg>

        {/* Nodes */}
        {/* Trigger */}
        <div className="absolute rounded-md px-1.5 py-1 border" style={{
          left: '12px', top: '16px', backgroundColor: nodeBg, borderColor: '#FF4500',
          animation: 'cbPop 0.3s 0.1s both ease-out',
        }}>
          <div className="w-[4px] h-[4px] rounded-full bg-[#FF4500] mb-[2px]" />
          <div className="h-[2px] w-[16px] rounded-full" style={{ backgroundColor: mid }} />
        </div>

        {/* Message node */}
        <div className="absolute rounded-md px-1.5 py-1" style={{
          left: '58px', top: '36px', backgroundColor: nodeBg, border: `1px solid ${border}`,
          animation: 'cbPop 0.3s 0.3s both ease-out',
        }}>
          <div className="h-[2px] w-[20px] rounded-full mb-[2px]" style={{ backgroundColor: mid }} />
          <div className="h-[2px] w-[14px] rounded-full" style={{ backgroundColor: dim }} />
        </div>

        {/* Condition node */}
        <div className="absolute rounded-md px-1.5 py-1" style={{
          left: '58px', top: '56px', backgroundColor: nodeBg, border: `1px solid ${border}`,
          animation: 'cbPop 0.3s 0.4s both ease-out',
        }}>
          <div className="flex gap-[2px] mb-[2px]">
            <div className="w-[3px] h-[3px] rounded-sm bg-yellow-500/60" />
            <div className="h-[2px] w-[14px] rounded-full self-center" style={{ backgroundColor: mid }} />
          </div>
          <div className="h-[2px] w-[10px] rounded-full" style={{ backgroundColor: dim }} />
        </div>

        {/* Action node */}
        <div className="absolute rounded-md px-1.5 py-1" style={{
          left: '108px', top: '46px', backgroundColor: nodeBg, border: `1px solid ${border}`,
          animation: 'cbPop 0.3s 0.6s both ease-out',
        }}>
          <div className="flex gap-[2px] mb-[2px]">
            <div className="w-[3px] h-[3px] rounded-sm bg-green-500/60" />
            <div className="h-[2px] w-[12px] rounded-full self-center" style={{ backgroundColor: mid }} />
          </div>
        </div>
      </div>
    </div>
  );
}
