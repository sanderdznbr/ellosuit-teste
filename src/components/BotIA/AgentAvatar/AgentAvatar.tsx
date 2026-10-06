import React, { useEffect, useRef } from 'react';
import { PastelAgent } from './pastelAgentCore';
import { getAgentStyle } from './agentStyles';
import '@/styles/pastel-agent.css';

export type AgentAvatarState = 'idle' | 'loading' | 'success' | 'failure';

interface AgentAvatarProps {
  /** Id de um estilo de `agentStyles.ts`. */
  styleId?: string | null;
  /** Lado do quadro SVG em px. O corpo ocupa aproximadamente 53% da largura. */
  size?: number;
  /** Estado da animacao. `loading` vira os aneis; o resultado vira check ou X. */
  state?: AgentAvatarState;
  /** Volta aos olhos sozinho depois de mostrar o resultado. Padrao: true. */
  autoReset?: boolean;
  /** Congela a animacao (util para itens fora de vista em um carrossel). */
  paused?: boolean;
  className?: string;
}

/**
 * Avatar animado do agente de IA.
 *
 * Envolve o componente sem dependencias `PastelAgent` em um elemento React.
 * Trocar o `styleId` recria a instancia porque paleta e geometria sao
 * aplicadas na montagem do SVG.
 */
const AgentAvatar: React.FC<AgentAvatarProps> = ({
  styleId,
  size = 240,
  state = 'idle',
  autoReset = true,
  paused = false,
  className,
}) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const agentRef = useRef<PastelAgent | null>(null);
  const style = getAgentStyle(styleId);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const agent = new PastelAgent(host, { palette: style.palette, shape: style.shape });
    agentRef.current = agent;
    return () => {
      agent.destroy();
      agentRef.current = null;
    };
  }, [style]);

  useEffect(() => {
    const agent = agentRef.current;
    if (!agent) return;
    if (state === 'idle') agent.idle();
    else if (state === 'loading') agent.startLoading();
    else if (state === 'success') agent.success({ autoReset });
    else agent.fail({ autoReset });
  }, [state, autoReset, style]);

  useEffect(() => {
    const agent = agentRef.current;
    if (!agent) return;
    if (paused) agent.pause();
    else agent.resume();
  }, [paused, style]);

  return (
    <div
      ref={hostRef}
      className={className}
      style={{ '--agent-size': `${size}px` } as React.CSSProperties}
    />
  );
};

export default AgentAvatar;
