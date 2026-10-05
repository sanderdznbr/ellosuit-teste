import React from 'react';
import { useTheme } from '@/hooks/useTheme';

export default function MiniCrmPreview() {
  const { theme } = useTheme();
  // Inverted: dark theme shows light preview, light theme shows dark preview
  const isLight = theme === 'dark';

  const bg = isLight ? '#f8f9fa' : '#0f1419';
  const sidebarBorder = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.10)';
  const searchBg = isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)';
  const searchDot = isLight ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.20)';
  const searchLine = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.10)';
  const pillInactive = isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)';
  const pillText = isLight ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.30)';
  const convActive = isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.05)';
  const nameColor = isLight ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.60)';
  const timeColor = isLight ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.20)';
  const msgColor = isLight ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.20)';
  const headerName = isLight ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.60)';
  const headerIcon = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.10)';
  const bubbleReceived = isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.08)';
  const bubbleRecText = isLight ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.40)';
  const bubbleRecSub = isLight ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.25)';
  const inputBg = isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.05)';
  const inputIcon = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.10)';

  const convs = [
    { active: true, unread: true, name: 65, msg: 45 },
    { active: false, unread: false, name: 50, msg: 55 },
    { active: false, unread: true, name: 40, msg: 35 },
    { active: false, unread: false, name: 55, msg: 50 },
    { active: false, unread: false, name: 45, msg: 40 },
    { active: false, unread: true, name: 35, msg: 48 },
    { active: false, unread: false, name: 50, msg: 30 },
  ];

  return (
    <div
      className="w-full h-full flex overflow-hidden select-none pointer-events-none"
      style={{ fontSize: '5px', backgroundColor: bg }}
    >
      {/* Keyframes */}
      <style>{`
        @keyframes mcpPulse { 0%,100%{opacity:.6} 50%{opacity:1} }
        @keyframes mcpSlideUp { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
        @keyframes mcpTyping { 0%,80%,100%{transform:scale(.7);opacity:.4} 40%{transform:scale(1);opacity:1} }
      `}</style>

      {/* Sidebar */}
      <div className="w-[35%] flex flex-col" style={{ borderRight: `1px solid ${sidebarBorder}` }}>
        <div className="px-2 py-1.5">
          <div className="rounded-full h-[10px] flex items-center px-1.5" style={{ backgroundColor: searchBg }}>
            <div className="w-[4px] h-[4px] rounded-full" style={{ backgroundColor: searchDot }} />
            <div className="ml-1 w-[60%] h-[3px] rounded-full" style={{ backgroundColor: searchLine }} />
          </div>
        </div>
        <div className="flex gap-0.5 px-2 pb-1">
          <div className="h-[8px] px-1.5 rounded-full bg-[#FF4500] flex items-center">
            <div className="w-[12px] h-[2px] rounded-full bg-white/90" />
          </div>
          {[10, 8].map((w, i) => (
            <div key={i} className="h-[8px] px-1.5 rounded-full flex items-center" style={{ backgroundColor: pillInactive }}>
              <div className="h-[2px] rounded-full" style={{ width: `${w}px`, backgroundColor: pillText }} />
            </div>
          ))}
        </div>
        <div className="flex-1 overflow-hidden space-y-[1px]">
          {convs.map((conv, i) => (
            <div
              key={i}
              className="flex items-center gap-1 px-2 py-[4px]"
              style={{
                backgroundColor: conv.active ? convActive : 'transparent',
                animation: `mcpSlideUp 0.4s ${i * 0.06}s both ease-out`,
              }}
            >
              <div className="w-[14px] h-[14px] rounded-full bg-gradient-to-br from-orange-400 to-orange-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div className="h-[3px] rounded-full" style={{ width: `${conv.name}%`, backgroundColor: nameColor }} />
                  <div className="h-[2px] w-[14px] rounded-full" style={{ backgroundColor: timeColor }} />
                </div>
                <div className="h-[2.5px] rounded-full mt-[2px]" style={{ width: `${conv.msg}%`, backgroundColor: msgColor }} />
              </div>
              {conv.unread && (
                <div
                  className="w-[6px] h-[6px] rounded-full bg-[#FF4500] shrink-0"
                  style={{ animation: 'mcpPulse 2s infinite ease-in-out' }}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        <div className="h-[16px] flex items-center px-2 gap-1.5" style={{ borderBottom: `1px solid ${sidebarBorder}` }}>
          <div className="w-[10px] h-[10px] rounded-full bg-gradient-to-br from-green-400 to-green-600" />
          <div className="h-[3px] w-[40px] rounded-full" style={{ backgroundColor: headerName }} />
          <div className="ml-auto flex gap-1">
            <div className="w-[6px] h-[6px] rounded" style={{ backgroundColor: headerIcon }} />
            <div className="w-[6px] h-[6px] rounded" style={{ backgroundColor: headerIcon }} />
          </div>
        </div>

        <div className="flex-1 p-2 space-y-[6px] flex flex-col justify-end">
          {/* Received */}
          <div className="self-start max-w-[65%]" style={{ animation: 'mcpSlideUp 0.4s 0.1s both ease-out' }}>
            <div className="rounded-lg rounded-tl-sm px-1.5 py-1" style={{ backgroundColor: bubbleReceived }}>
              <div className="h-[2.5px] w-[50px] rounded-full" style={{ backgroundColor: bubbleRecText }} />
              <div className="h-[2.5px] w-[35px] rounded-full mt-[2px]" style={{ backgroundColor: bubbleRecSub }} />
            </div>
          </div>
          {/* Sent */}
          <div className="self-end max-w-[65%]" style={{ animation: 'mcpSlideUp 0.4s 0.2s both ease-out' }}>
            <div className="rounded-lg rounded-tr-sm px-1.5 py-1 bg-[#FF4500]/20">
              <div className="h-[2.5px] w-[55px] rounded-full bg-[#FF4500]/60" />
              <div className="h-[2.5px] w-[30px] rounded-full bg-[#FF4500]/40 mt-[2px]" />
            </div>
          </div>
          {/* Received */}
          <div className="self-start max-w-[65%]" style={{ animation: 'mcpSlideUp 0.4s 0.3s both ease-out' }}>
            <div className="rounded-lg rounded-tl-sm px-1.5 py-1" style={{ backgroundColor: bubbleReceived }}>
              <div className="h-[2.5px] w-[45px] rounded-full" style={{ backgroundColor: bubbleRecText }} />
            </div>
          </div>
          {/* Sent */}
          <div className="self-end max-w-[65%]" style={{ animation: 'mcpSlideUp 0.4s 0.4s both ease-out' }}>
            <div className="rounded-lg rounded-tr-sm px-1.5 py-1 bg-[#FF4500]/20">
              <div className="h-[2.5px] w-[40px] rounded-full bg-[#FF4500]/60" />
              <div className="h-[2.5px] w-[48px] rounded-full bg-[#FF4500]/40 mt-[2px]" />
              <div className="h-[2.5px] w-[20px] rounded-full bg-[#FF4500]/30 mt-[2px]" />
            </div>
          </div>
          {/* Typing indicator */}
          <div className="self-start max-w-[65%]" style={{ animation: 'mcpSlideUp 0.3s 0.5s both ease-out' }}>
            <div className="rounded-lg rounded-tl-sm px-2 py-[5px] flex gap-[3px] items-center" style={{ backgroundColor: bubbleReceived }}>
              {[0, 0.15, 0.3].map((d, i) => (
                <div key={i} className="w-[3px] h-[3px] rounded-full bg-[#FF4500]/50" style={{ animation: `mcpTyping 1.2s ${d}s infinite ease-in-out` }} />
              ))}
            </div>
          </div>
        </div>

        <div className="h-[14px] flex items-center px-2 gap-1" style={{ borderTop: `1px solid ${sidebarBorder}` }}>
          <div className="w-[6px] h-[6px] rounded-full" style={{ backgroundColor: inputIcon }} />
          <div className="flex-1 h-[8px] rounded-full" style={{ backgroundColor: inputBg }} />
          <div className="w-[6px] h-[6px] rounded-full bg-[#FF4500]/60" />
        </div>
      </div>
    </div>
  );
}
