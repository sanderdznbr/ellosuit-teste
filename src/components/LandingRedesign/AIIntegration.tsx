import React from 'react';
import { motion } from 'framer-motion';
import { Zap, BrainCircuit, MessageCircle, BarChart } from 'lucide-react';

export const AIIntegration = () => {
  const aiFeatures = [
    {
      title: 'Agentes de Atendimento',
      description: 'IA treinada com os dados da sua empresa para atender no WhatsApp como se fosse você.',
      icon: MessageCircle,
    },
    {
      title: 'Skills Operacionais',
      description: 'Configure tarefas específicas que a IA deve executar dentro dos seus fluxos de trabalho.',
      icon: BrainCircuit,
    },
    {
      title: 'Automação Preditiva',
      description: 'A plataforma aprende seus processos e automatiza ações repetitivas proativamente.',
      icon: Zap,
    },
    {
      title: 'Insights de IA',
      description: 'Relatórios automáticos que explicam o que está acontecendo na sua operação.',
      icon: BarChart,
    },
  ];

  return (
    <section id="ai" className="py-24 md:py-32 bg-[#1f1e1d] text-white overflow-hidden relative">
      {/* Soft ambient glow */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[900px] bg-[#374DA4]/15 blur-[180px] rounded-full" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.04]"
           style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />

      <div className="container max-w-7xl mx-auto px-6 relative">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="text-center mb-20 max-w-4xl mx-auto"
        >
          <h2 className="text-4xl md:text-6xl font-semibold mb-6 text-white tracking-tight leading-[1.05]">
            Não é um plugin.{' '}
            <span className="block md:inline text-[#a8b3e8]">
              É o cérebro.
            </span>
          </h2>

          <p className="text-lg md:text-xl text-white/70 max-w-2xl mx-auto leading-relaxed">
            A IA da Ellosuit está presente em cada interação, tarefa e reunião — transformando dados brutos em inteligência operacional real.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          {aiFeatures.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: index * 0.08, ease: 'easeOut' }}
              className="p-7 rounded-3xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] hover:border-white/20 transition-colors duration-300 group relative overflow-hidden"
            >
              <div className="w-12 h-12 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center text-[#a8b3e8] mb-6 group-hover:text-white group-hover:bg-[#374DA4] group-hover:border-[#374DA4] transition-colors duration-300">
                <feature.icon size={22} strokeWidth={1.75} />
              </div>

              <h3 className="text-base font-semibold mb-2 text-white">{feature.title}</h3>

              <p className="text-white/60 leading-relaxed text-sm">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="mt-20 p-10 md:p-16 rounded-[24px] bg-white/[0.03] border border-white/10 relative overflow-hidden"
        >
          <div className="absolute -top-32 -right-32 w-96 h-96 bg-[#374DA4]/25 blur-[120px] rounded-full pointer-events-none" />

          <div className="relative z-10 max-w-3xl mx-auto text-center">
            <h3 className="text-3xl md:text-4xl font-semibold mb-5 text-white tracking-tight">
              IA que realmente trabalha por você.
            </h3>

            <p className="text-base md:text-lg text-white/70 mb-10 leading-relaxed">
              Chega de prompts complicados. Nossos agentes operam diretamente nos seus dados — enviando emails, atualizando o CRM e agendando reuniões sozinhos.
            </p>

            <div className="flex flex-wrap justify-center gap-2.5">
              {['Atendimento', 'Agendamento', 'Vendas', 'Gestão'].map((tag) => (
                <span key={tag} className="px-5 py-2 rounded-full bg-white/[0.05] border border-white/10 text-[11px] font-semibold tracking-[0.12em] uppercase text-white/85 hover:bg-[#374DA4] hover:border-[#374DA4] hover:text-white transition-colors cursor-default">
                  Agente de {tag}
                </span>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
