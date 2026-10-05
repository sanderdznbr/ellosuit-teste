import React from 'react';
import { motion } from 'framer-motion';
import { Users, Building2, Layout, Megaphone } from 'lucide-react';

export const TargetAudience = () => {
  const targets = [
    {
      title: 'Times Comerciais',
      description: 'Feche mais negócios com IA qualificando leads e rastreando propostas em tempo real.',
      icon: Users,
    },
    {
      title: 'Atendimento & Suporte',
      description: 'Escale seu suporte com agentes de IA que resolvem 80% das chamadas sozinhos.',
      icon: Megaphone,
    },
    {
      title: 'Gestores & CEOs',
      description: 'Tenha visão total da operação com relatórios de IA e dashboards centralizados.',
      icon: Building2,
    },
    {
      title: 'Agências & Serviços',
      description: 'Profissionalize sua entrega com drive, contratos e reuniões inteligentes.',
      icon: Layout,
    },
  ];

  return (
    <section id="target" className="py-24 bg-[#faf9f7]">
      <div className="container max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-semibold text-[#1f1e1d] mb-6">Feito para empresas que pensam grande.</h2>
          <p className="text-lg text-[#6b6862] max-w-2xl mx-auto">
            A Ellosuit adapta sua inteligência para diferentes áreas, criando uma rede de colaboração fluida e automatizada.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {targets.map((target, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="p-8 rounded-[24px] border border-[#e7e3da] bg-white hover:border-primary/20 hover:shadow-sm hover:shadow-primary/5 transition-all group"
            >
              <div className="w-16 h-16 rounded-[20px] bg-[#f4f2ec] flex items-center justify-center text-[#a8a49c] mb-8 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                <target.icon size={28} />
              </div>
              <h3 className="text-xl font-semibold text-[#1f1e1d] mb-4">{target.title}</h3>
              <p className="text-[#6b6862] leading-relaxed text-sm">
                {target.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
