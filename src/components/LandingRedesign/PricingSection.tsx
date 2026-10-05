import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Plan = {
  id: string;
  name: string;
  tagline: string;
  monthly: number | null;
  yearly: number | null;
  highlight?: boolean;
  cta: string;
  features: string[];
};

const PLANS: Plan[] = [
  {
    id: 'start',
    name: 'Start',
    tagline: 'Para começar a vender pelo WhatsApp com IA.',
    monthly: 197,
    yearly: 1970,
    cta: 'Iniciar teste grátis',
    features: [
      '1 número de WhatsApp conectado',
      'CRM Kanban de vendas',
      '2 agentes de IA treináveis',
      'Disparos e templates',
      'Agenda + lembretes via WhatsApp',
      '2 usuários incluídos',
    ],
  },
  {
    id: 'business',
    name: 'Business',
    tagline: 'A operação completa para times comerciais.',
    monthly: 297,
    yearly: 2970,
    highlight: true,
    cta: 'Começar 7 dias grátis',
    features: [
      '3 números de WhatsApp',
      'CRM, agenda, tarefas e fluxos',
      'Reuniões com gravação + IA',
      'Rastreamento de documentos e links',
      '5 agentes de IA + chatbot builder',
      '10 usuários incluídos',
      'Suporte prioritário',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    tagline: 'Para operações que exigem escala e SLA.',
    monthly: null,
    yearly: null,
    cta: 'Falar com vendas',
    features: [
      'Números e usuários ilimitados',
      'API Oficial WhatsApp (Meta)',
      'IA dedicada e treinamento custom',
      'Onboarding assistido',
      'SLA 99,9% e suporte dedicado',
      'Integrações sob demanda',
    ],
  },
];

export const PricingSection = () => {
  const navigate = useNavigate();
  const [yearly, setYearly] = useState(true);

  const format = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

  return (
    <section id="pricing" className="py-24 md:py-32 bg-[#faf9f7]">
      <div className="container max-w-7xl mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <h2 className="text-3xl md:text-5xl font-semibold tracking-tight text-[#1f1e1d] mb-5 leading-[1.1]">
            Preços claros. Sem surpresa no boleto.
          </h2>
          <p className="text-lg text-[#6b6862]">
            7 dias grátis em todos os planos. Cancele quando quiser.
          </p>

          <div className="mt-8 inline-flex items-center gap-3 p-1 rounded-full bg-[#ece8e0]">
            <button
              onClick={() => setYearly(false)}
              className={`px-5 py-2 text-sm font-semibold rounded-full transition-all ${
                !yearly ? 'bg-white text-[#1f1e1d] shadow-sm' : 'text-[#8a867e]'
              }`}
            >
              Mensal
            </button>
            <button
              onClick={() => setYearly(true)}
              className={`px-5 py-2 text-sm font-semibold rounded-full transition-all flex items-center gap-2 ${
                yearly ? 'bg-white text-[#1f1e1d] shadow-sm' : 'text-[#8a867e]'
              }`}
            >
              Anual
              <span className="text-emerald-600 text-xs font-semibold">-17%</span>
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {PLANS.map((plan, i) => {
            const price = plan.monthly === null
              ? null
              : yearly
                ? Math.round(plan.yearly! / 12)
                : plan.monthly;

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className={`relative rounded-3xl p-8 flex flex-col ${
                  plan.highlight
                    ? 'bg-[#374DA4] text-white shadow-sm shadow-[#374DA4]/20 md:-mt-4 md:mb-[-1rem]'
                    : 'bg-white border border-[#ddd8cd] text-[#1f1e1d]'
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-white text-[#374DA4] text-[11px] font-semibold uppercase tracking-wider">
                    Mais escolhido
                  </div>
                )}

                <h3 className="text-2xl font-semibold mb-2">{plan.name}</h3>
                <p className={`text-sm mb-6 ${plan.highlight ? 'text-white/80' : 'text-[#8a867e]'}`}>
                  {plan.tagline}
                </p>

                <div className="mb-6 min-h-[72px]">
                  {price === null ? (
                    <div className="text-3xl font-semibold">Sob consulta</div>
                  ) : (
                    <>
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl md:text-5xl font-semibold tracking-tight">{format(price)}</span>
                        <span className={`text-sm font-medium ${plan.highlight ? 'text-white/80' : 'text-[#8a867e]'}`}>
                          /mês
                        </span>
                      </div>
                      {yearly && plan.yearly && (
                        <p className={`text-xs mt-1 ${plan.highlight ? 'text-white/70' : 'text-[#8a867e]'}`}>
                          {format(plan.yearly)} cobrados anualmente
                        </p>
                      )}
                    </>
                  )}
                </div>

                <Button
                  size="lg"
                  onClick={() => navigate(plan.id === 'enterprise' ? '/contato' : '/register')}
                  className={`w-full rounded-full font-semibold mb-8 ${
                    plan.highlight
                      ? 'bg-white text-[#374DA4] hover:bg-white/90'
                      : 'bg-gray-950 text-white hover:bg-gray-800'
                  }`}
                >
                  {plan.cta}
                </Button>

                <ul className="space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-3 text-sm">
                      <Check
                        className={`h-4 w-4 mt-0.5 flex-shrink-0 ${
                          plan.highlight ? 'text-white' : 'text-[#374DA4]'
                        }`}
                      />
                      <span className={plan.highlight ? 'text-white/95' : 'text-gray-700'}>{f}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            );
          })}
        </div>

        <p className="text-center text-sm text-[#8a867e] mt-10">
          Todos os planos incluem IA, atualizações contínuas e suporte humano em português.
        </p>
      </div>
    </section>
  );
};