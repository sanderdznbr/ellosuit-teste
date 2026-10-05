import React from 'react';
import { motion } from 'framer-motion';
import { Zap, Play, Settings, RefreshCw, Layers } from 'lucide-react';

export const AutomationsSection = () => {
  const automations = [
    {
      title: 'Fluxos de Vendas',
      desc: 'Move o lead automaticamente baseado em ações no WhatsApp ou Tracking.',
      icon: Zap
    },
    {
      title: 'Sincronização 360°',
      desc: 'Dados do Meet, Omni e Suite sempre atualizados sem esforço manual.',
      icon: RefreshCw
    },
    {
      title: 'Workflows de Gestão',
      desc: 'Contratos e recibos gerados e enviados após aprovação do projeto.',
      icon: Layers
    }
  ];

  return (
    <section className="py-24 bg-[#faf9f7] overflow-hidden">
      <div className="container max-w-7xl mx-auto px-6">
        <div className="bg-primary/5 rounded-[28px] p-8 md:p-20 border border-primary/10 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/10 blur-[100px] -z-10 rounded-full translate-x-1/2 -translate-y-1/2" />
          
          <div className="max-w-3xl mb-16">
            <h2 className="text-3xl md:text-5xl font-semibold text-[#1f1e1d] mb-6 leading-tight">
              Automações que realmente funcionam.
            </h2>
            <p className="text-lg text-[#6b6862] leading-relaxed">
              Não perca tempo configurando ferramentas complexas. Nossas automações são desenhadas para o mundo real das empresas B2B.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {automations.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-white p-8 rounded-3xl shadow-sm border border-[#e7e3da] hover:shadow-sm hover:shadow-primary/5 transition-all"
              >
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-6">
                  <item.icon size={24} />
                </div>
                <h3 className="text-xl font-semibold text-[#1f1e1d] mb-3">{item.title}</h3>
                <p className="text-[#8a867e] text-sm leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>

          {/* Visual of automation builder mockup */}
          <div className="mt-16 pt-16 border-t border-[#e7e3da] flex flex-col md:flex-row items-center justify-between gap-12">
            <div className="flex -space-x-4">
              {[
                "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=100&auto=format&fit=crop",
                "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=100&auto=format&fit=crop",
                "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=100&auto=format&fit=crop",
                "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=100&auto=format&fit=crop"
              ].map((url, i) => (
                <div key={i} className="w-12 h-12 rounded-full border-2 border-white bg-gray-200 flex items-center justify-center overflow-hidden">
                  <img src={url} alt={`User ${i + 1}`} className="w-full h-full object-cover" />
                </div>
              ))}
              <div className="w-12 h-12 rounded-full border-2 border-white bg-primary text-white flex items-center justify-center text-xs font-semibold">
                +2k
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
