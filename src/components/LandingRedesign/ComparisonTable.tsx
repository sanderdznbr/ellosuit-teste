import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, Zap, ShieldAlert } from 'lucide-react';

export const ComparisonTable = () => {
  const items = [
    { label: 'Atendimento a Leads', trad: 'Manual (lento)', ello: 'IA Instantânea' },
    { label: 'CRM & Histórico', trad: 'Descentralizado', ello: 'Automático' },
    { label: 'Reuniões & Atas', trad: 'Perdidas / Manuais', ello: 'Inteligentes' },
    { label: 'Gestão de Tarefas', trad: 'Estática / Reativa', ello: 'Proativa com IA' },
    { label: 'Rastreamento', trad: 'Nenhum / Às cegas', ello: 'Real-time Analytics' },
    { label: 'Custo Operacional', trad: 'Alto (Equipe gigante)', ello: 'Otimizado' },
  ];

  return (
    <section id="comparison" className="py-24 bg-[#f4f2ec]">
      <div className="container max-w-5xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-semibold text-[#1f1e1d] mb-6">Operação Tradicional vs Ellosuit</h2>
          <p className="text-lg text-[#6b6862]">Por que as empresas líderes estão migrando para a IA operacional.</p>
        </div>

        {/* Desktop View */}
        <div className="hidden md:block bg-white rounded-[24px] border border-[#e7e3da] shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[#efece5]">
                <th className="px-8 py-10 font-semibold text-[#a8a49c] uppercase tracking-widest text-xs">Característica</th>
                <th className="px-8 py-10 font-semibold text-red-400 uppercase tracking-widest text-xs text-center bg-red-50/30">Tradicional</th>
                <th className="px-8 py-10 font-semibold text-primary uppercase tracking-widest text-xs text-center bg-primary/5">Ellosuit IA</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i} className="border-b border-[#efece5] last:border-0 hover:bg-[#f4f2ec] transition-colors">
                  <td className="px-8 py-6 font-semibold text-[#1f1e1d]">{item.label}</td>
                  <td className="px-8 py-6 text-center text-[#8a867e] bg-red-50/30">
                    <div className="flex items-center justify-center gap-2">
                      <XCircle size={16} className="text-red-300" />
                      <span>{item.trad}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-center text-primary font-semibold bg-primary/5">
                    <div className="flex items-center justify-center gap-2">
                      <CheckCircle2 size={16} className="text-primary" />
                      <span>{item.ello}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile View - Card based layout */}
        <div className="md:hidden space-y-6">
          {items.map((item, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="bg-white rounded-3xl border border-[#e7e3da] shadow-sm overflow-hidden"
            >
              <div className="px-6 py-4 bg-[#f4f2ec] border-b border-[#e7e3da]">
                <h3 className="font-semibold text-[#1f1e1d] text-center text-sm">{item.label}</h3>
              </div>
              <div className="grid grid-cols-2">
                <div className="p-4 text-center border-r border-[#efece5] bg-red-50/5">
                  <div className="flex flex-col items-center gap-2">
                    <ShieldAlert size={16} className="text-red-400" />
                    <span className="text-[9px] font-semibold text-red-400 uppercase tracking-widest">Tradicional</span>
                    <p className="text-xs text-[#8a867e] font-medium leading-tight">{item.trad}</p>
                  </div>
                </div>
                <div className="p-4 text-center bg-primary/5">
                  <div className="flex flex-col items-center gap-2">
                    <Zap size={16} className="text-primary" />
                    <span className="text-[9px] font-semibold text-primary uppercase tracking-widest">Ellosuit</span>
                    <p className="text-xs text-primary font-semibold leading-tight">{item.ello}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-12 text-center px-6">
          <p className="text-sm font-semibold text-[#a8a49c] uppercase tracking-widest leading-relaxed">
            Economize até <span className="text-primary">40 horas mensais</span> <br className="md:hidden" /> por colaborador.
          </p>
        </div>
      </div>
    </section>
  );
};
