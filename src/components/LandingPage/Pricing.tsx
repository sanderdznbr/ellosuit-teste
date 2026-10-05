import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { Link } from 'react-router-dom';

const plans = [
  {
    name: 'Pro',
    monthlyPrice: 297,
    yearlyPrice: 2970,
    description: 'Ideal para profissionais e pequenas equipes.',
    features: [
      '5 usuários incluídos',
      'CRM WhatsApp Completo',
      'IA Básica de Resposta',
      'Agenda Online (2 links)',
      'Suporte via Email',
    ],
    highlight: false,
    cta: 'Começar agora',
  },
  {
    name: 'Business',
    monthlyPrice: 397,
    yearlyPrice: 3970,
    description: 'Para empresas que buscam automação real.',
    features: [
      '10 usuários incluídos',
      'IA Avançada 2.0',
      'Todos os Hubs integrados',
      'Automação de Fluxos ilimitada',
      'Suporte Prioritário',
    ],
    highlight: true,
    cta: 'Teste grátis 7 dias',
  },
  {
    name: 'Enterprise',
    monthlyPrice: 797,
    yearlyPrice: 7970,
    description: 'Escalabilidade e controle total para grandes operações.',
    features: [
      'Usuários ilimitados',
      'API de Integração',
      'Treinamento Dedicado',
      'Gestão Multi-sessão WhatsApp',
      'SLA de 99.9%',
    ],
    highlight: false,
    cta: 'Falar com especialista',
  },
];

export const Pricing = () => {
  const [isYearly, setIsYearly] = useState(false);

  return (
    <section id="pricing" className="py-32 bg-[#FAFAFA]">
      <div className="container max-w-7xl mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-20">
          <h2 className="text-[40px] md:text-[56px] font-bold mb-8 tracking-tight leading-tight">Escolha o seu plano</h2>
          
          <div className="flex items-center justify-center gap-5">
            <span className={`text-[13px] font-semibold transition-colors ${!isYearly ? 'text-gray-950' : 'text-gray-400'}`}>Mensal</span>
            <button 
              onClick={() => setIsYearly(!isYearly)}
              className="w-12 h-6 rounded-full bg-gray-200 p-1 relative transition-all duration-500 ease-in-out hover:bg-gray-300"
            >
              <div className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform duration-500 ${isYearly ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
            <span className={`text-[13px] font-semibold transition-colors ${isYearly ? 'text-gray-950' : 'text-gray-400'}`}>
              Anual <span className="text-emerald-600 ml-1 font-bold">(-20%)</span>
            </span>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-10 max-w-6xl mx-auto">
          {plans.map((plan, index) => (
            <div 
              key={index}
              className={`relative p-12 rounded-[40px] bg-white transition-all duration-500 hover:-translate-y-2 ${
                plan.highlight ? 'ring-1 ring-primary shadow-[0_30px_60px_-15px_rgba(0,0,0,0.08)] z-10' : 'border border-gray-100 shadow-sm'
              }`}
            >
              {plan.highlight && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-primary text-white text-[10px] font-black px-4 py-1 rounded-full tracking-widest uppercase shadow-xl shadow-primary/20">
                  Mais Popular
                </div>
              )}
              
              <h3 className="text-xl font-bold mb-3 text-gray-950 tracking-tight">{plan.name}</h3>
              <p className="text-gray-400 text-[13px] mb-8 leading-relaxed font-medium">{plan.description}</p>
              
              <div className="mb-10">
                <div className="flex items-baseline">
                  <span className="text-[40px] font-bold tracking-tighter text-gray-950">R$ {isYearly ? (plan.yearlyPrice / 12).toFixed(0) : plan.monthlyPrice}</span>
                  <span className="text-gray-400 text-sm ml-1 font-medium">/mês</span>
                </div>
              </div>

              <Link to="/register">
                <Button 
                  variant={plan.highlight ? 'default' : 'outline'} 
                  className={`w-full h-12 rounded-2xl mb-10 font-bold transition-all ${
                    plan.highlight ? 'shadow-xl shadow-primary/20' : 'border-gray-100 hover:bg-gray-50'
                  }`}
                >
                  {plan.cta}
                </Button>
              </Link>

              <div className="space-y-4">
                {plan.features.map((feature, fIndex) => (
                  <div key={fIndex} className="flex items-center gap-3 text-[14px] text-gray-500 font-medium">
                    <div className="bg-emerald-50 rounded-full p-1">
                      <Check className="h-2.5 w-2.5 text-emerald-600 stroke-[3px]" />
                    </div>
                    {feature}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
