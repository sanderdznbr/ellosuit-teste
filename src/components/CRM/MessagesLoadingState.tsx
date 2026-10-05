import React from 'react';
import RadialGlowOrb from '@/components/ChatBot/RadialGlowOrb';

/**
 * Shown inside a conversation while messages are still being fetched,
 * so the user never sees "Nenhuma mensagem" for a chat that has history.
 */
const MessagesLoadingState: React.FC = () => {
  const skeletons = [
    { me: false, w: 'w-40' },
    { me: true, w: 'w-52' },
    { me: false, w: 'w-32' },
    { me: true, w: 'w-44' },
    { me: false, w: 'w-48' },
  ];

  return (
    <div className="flex flex-col h-full py-6">
      <style>{`
        @keyframes msgShimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes msgFade { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes msgDot { 0%,80%,100%{transform:scale(.6);opacity:.4} 40%{transform:scale(1);opacity:1} }
      `}</style>

      <div className="flex flex-col items-center justify-center gap-3 mb-8">
        <RadialGlowOrb size={40} />
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">Puxando mensagens</span>
          <span className="flex gap-1">
            {[0, 0.15, 0.3].map((d) => (
              <span
                key={d}
                className="h-1.5 w-1.5 rounded-full bg-[#374DA4]"
                style={{ animation: `msgDot 1.2s ${d}s infinite ease-in-out` }}
              />
            ))}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">Sincronizando o histórico desta conversa…</p>
      </div>

      <div className="flex flex-col gap-3">
        {skeletons.map((s, i) => (
          <div
            key={i}
            className={s.me ? 'self-end' : 'self-start'}
            style={{ animation: `msgFade .4s ${i * 0.08}s both ease-out` }}
          >
            <div
              className={`h-10 ${s.w} rounded-2xl ${s.me ? 'rounded-br-md' : 'rounded-bl-md'}`}
              style={{
                background:
                  'linear-gradient(90deg, hsl(var(--muted)) 25%, hsl(var(--muted-foreground)/0.12) 37%, hsl(var(--muted)) 63%)',
                backgroundSize: '200% 100%',
                animation: 'msgShimmer 1.4s linear infinite',
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default MessagesLoadingState;
