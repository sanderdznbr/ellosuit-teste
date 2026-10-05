import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, ArrowRight } from 'lucide-react';

export const TransformationSection = () => {
  return (
    <section className="py-24">
      <div className="container max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-3xl md:text-5xl font-semibold text-[#1f1e1d] mb-8 leading-tight">
              Antes da Ellosuit × Depois da Ellosuit.
            </h2>
            <p className="text-lg text-[#6b6862] mb-10 leading-relaxed">
              Mesmo time, mesmo WhatsApp — só que com IA respondendo na hora, CRM se preenchendo sozinho e follow-up que nunca esquece.
            </p>
            
            <div className="space-y-6">
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-[#F0F2FE] border border-[#DFE4FB]">
                <div className="w-10 h-10 rounded-full bg-[#374DA4] flex items-center justify-center text-white shrink-0">
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <p className="font-semibold text-[#1f1e1d]">Resposta em segundos, 24h por dia</p>
                  <p className="text-sm text-[#6b6862]">Agente de IA qualifica o lead antes do humano atender.</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-primary/5 border border-primary/10">
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white shrink-0">
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <p className="font-semibold text-[#1f1e1d]">CRM que se preenche sozinho</p>
                  <p className="text-sm text-[#6b6862]">Cada conversa vira card no funil, com etiqueta e próxima ação.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6">
            <div className="p-8 rounded-[24px] border border-[#e7e3da] bg-[#f4f2ec]">
              <p className="text-xs font-semibold text-[#a8a49c] uppercase tracking-widest mb-6">Sem Ellosuit</p>
              <ul className="space-y-4">
                {[
                  'Lead espera 4h por resposta',
                  'Atendente esquece de dar follow-up',
                  'Histórico some quando alguém sai',
                  'Você não sabe quem abriu sua proposta'
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-[#8a867e] line-through decoration-red-500/30">
                    <XCircle size={18} className="text-red-400 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-8 rounded-[24px] border border-primary/20 bg-white shadow-sm shadow-primary/5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl -z-10" />
              <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-6">Com Ellosuit</p>
              <ul className="space-y-4">
                {[
                  'IA responde em menos de 30s',
                  'Follow-up automático no WhatsApp',
                  'Tudo registrado, mesmo se trocar de time',
                  'Notificação quando o lead abre a proposta'
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-[#1f1e1d] font-medium">
                    <CheckCircle2 size={18} className="text-primary shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
