import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Workflow, Target, Video, LayoutDashboard, Check } from 'lucide-react';
import { useLandingAssets } from '@/hooks/useLandingAssets';
import heroDashboard from '@/assets/landing-hero-dashboard.jpg';
import meetingImg from '@/assets/landing-meeting.jpg';
import aiNetwork from '@/assets/landing-ai-network.jpg';

export const ModulesSection = () => {
  const [activeModule, setActiveModule] = useState(0);
  const { assets } = useLandingAssets();

  const fallbackImages: Record<string, string> = {
    omni: heroDashboard,
    flow: aiNetwork,
    meet: meetingImg,
    track: heroDashboard,
  };

  const modules = [
    {
      id: 'omni',
      name: 'Conversas',
      icon: MessageSquare,
      color: '#374DA4',
      title: 'CRM WhatsApp com IA que atende e vende 24/7',
      description: 'Centralize todas as conversas do WhatsApp em um CRM visual. Agentes de IA qualificam leads, respondem dúvidas e movem clientes no funil enquanto sua equipe foca em fechar.',
      features: ['Multi-atendentes no mesmo número', 'API Oficial WhatsApp', 'Agentes de IA treináveis', 'Kanban de vendas integrado'],
    },
    {
      id: 'flow',
      name: 'Agenda & Tarefas',
      icon: Workflow,
      color: '#374DA4',
      title: 'Agenda, tarefas e fluxos que rodam sozinhos',
      description: 'Organize a rotina do time com agenda inteligente, lembretes automáticos via WhatsApp e fluxos visuais que movem processos sem ninguém precisar lembrar.',
      features: ['Agenda colaborativa', 'Lembretes via WhatsApp', 'Fluxos visuais (Kanban)', 'Automações sem código'],
    },
    {
      id: 'meet',
      name: 'Reuniões',
      icon: Video,
      color: '#374DA4',
      title: 'Reuniões com gravação, transcrição e resumo por IA',
      description: 'Sala de vídeo própria, gravação em nuvem e IA que transcreve, resume e extrai próximos passos automaticamente para o CRM.',
      features: ['Sala HD própria', 'Gravação em nuvem', 'Transcrição automática', 'Resumo e ações por IA'],
    },
    {
      id: 'track',
      name: 'Rastreamento',
      icon: Target,
      color: '#374DA4',
      title: 'Saiba quando o cliente abre sua proposta',
      description: 'Rastreie documentos, links e vídeos enviados. Receba notificação no segundo em que o lead engaja — e ataque na hora certa.',
      features: ['Rastreio de documentos', 'Encurtador com analytics', 'Notificação em tempo real', 'Histórico por contato'],
    },
  ];

  return (
    <section id="modules" className="py-24 bg-[#faf9f7]">
      <div className="container max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-semibold text-[#1f1e1d] mb-6">Tudo que sua operação comercial precisa.</h2>
          <p className="text-lg text-[#6b6862] max-w-2xl mx-auto">
            CRM no WhatsApp, agenda, reuniões e rastreamento — conectados pela mesma IA, no mesmo lugar.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-4 mb-12">
          {modules.map((mod, index) => (
            <button
              key={mod.id}
              onClick={() => setActiveModule(index)}
              className={`flex items-center gap-3 px-6 py-3 rounded-full font-semibold transition-all ${
                activeModule === index 
                  ? 'bg-gray-900 text-white shadow-lg' 
                  : 'bg-[#f4f2ec] text-[#8a867e] hover:bg-[#ece8e0]'
              }`}
            >
              <mod.icon size={18} style={{ color: activeModule === index ? '#fff' : mod.color }} />
              {mod.name}
            </button>
          ))}
        </div>

        <div className="relative bg-[#f4f2ec] rounded-[28px] p-8 md:p-16 overflow-hidden min-h-[500px] flex items-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeModule}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.4 }}
              className="grid lg:grid-cols-2 gap-12 items-center w-full"
            >
              <div>
                <div 
                  className="w-16 h-16 rounded-3xl flex items-center justify-center mb-8 shadow-inner"
                  style={{ backgroundColor: `${modules[activeModule].color}15` }}
                >
                  {React.createElement(modules[activeModule].icon, { 
                    size: 32, 
                    style: { color: modules[activeModule].color } 
                  })}
                </div>
                <h3 className="text-3xl md:text-4xl font-semibold text-[#1f1e1d] mb-6 leading-tight">
                  {modules[activeModule].title}
                </h3>
                <p className="text-lg text-[#6b6862] mb-8 leading-relaxed">
                  {modules[activeModule].description}
                </p>
                <div className="grid sm:grid-cols-2 gap-4">
                  {modules[activeModule].features.map((feature, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center shadow-sm">
                        <Check size={12} className="text-primary font-semibold" />
                      </div>
                      <span className="text-sm font-semibold text-gray-700">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="relative">
                <div 
                  className="aspect-video rounded-3xl bg-white shadow-sm border border-[#e7e3da] flex items-center justify-center overflow-hidden"
                >
                  <img 
                    src={assets[`${modules[activeModule].id}_image`] || fallbackImages[modules[activeModule].id]} 
                    alt={modules[activeModule].name}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                </div>
                
                {/* Float elements for "premium" look */}
                <div className="absolute -bottom-6 -right-6 bg-white p-4 rounded-2xl shadow-sm border border-[#e7e3da] max-w-[200px] animate-float">
                  <p className="text-[10px] font-semibold text-[#a8a49c] uppercase tracking-widest mb-1">Módulo {modules[activeModule].name}</p>
                  <p className="text-sm font-semibold text-[#1f1e1d]">Operação Integrada</p>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
};
