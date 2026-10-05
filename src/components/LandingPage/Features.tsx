import { MessageSquare, Workflow, BarChart3, Database, Shield, Zap, Globe, Users } from 'lucide-react';
import { motion } from 'framer-motion';

const features = [
  {
    icon: MessageSquare,
    title: 'Omnichannel CRM',
    description: 'Centralize WhatsApp, E-mail e redes sociais em uma única caixa de entrada inteligente.',
    color: 'bg-[#374DA4]/5 text-[#2F428D]',
  },
  {
    icon: Zap,
    title: 'IA Conversacional',
    description: 'Agentes de IA que qualificam leads, agendam reuniões e fecham vendas 24/7.',
    color: 'bg-yellow-500/5 text-yellow-600',
  },
  {
    icon: Workflow,
    title: 'Fluxos Automáticos',
    description: 'Crie automações complexas sem código. Arraste e solte para definir o sucesso.',
    color: 'bg-purple-500/5 text-purple-600',
  },
  {
    icon: BarChart3,
    title: 'Analytics em Real-time',
    description: 'Visualize cada etapa do seu funil com dashboards detalhados e preditivos.',
    color: 'bg-emerald-500/5 text-emerald-600',
  },
  {
    icon: Database,
    title: 'Gestão de Ativos',
    description: 'Documentos, contratos e arquivos organizados automaticamente por projeto.',
    color: 'bg-[#2F428D]/5 text-[#253573]',
  },
  {
    icon: Shield,
    title: 'Segurança Enterprise',
    description: 'Criptografia de ponta a ponta e conformidade com LGPD garantida.',
    color: 'bg-red-500/5 text-red-600',
  },
  {
    icon: Globe,
    title: 'Escalabilidade Global',
    description: 'Infraestrutura robusta pronta para suportar de 10 a 10.000 usuários.',
    color: 'bg-cyan-500/5 text-cyan-600',
  },
  {
    icon: Users,
    title: 'Colaboração Fluida',
    description: 'Equipes integradas com tarefas, agenda e comunicação sincronizada.',
    color: 'bg-pink-500/5 text-pink-600',
  },
];

export const Features = () => {
  return (
    <section id="features" className="py-32 bg-white overflow-hidden">
      <div className="container max-w-7xl mx-auto px-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-2xl mx-auto mb-24"
        >
          <h2 className="text-[40px] md:text-[56px] font-bold mb-6 text-gray-950 tracking-tight leading-[1.1]">
            Tudo o que você precisa para <span className="text-primary italic font-light">escalar</span>.
          </h2>
          <p className="text-lg text-gray-500 tracking-tight font-medium">
            A Ellosuit é o sistema operacional completo para empresas que buscam eficiência máxima.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-x-10 gap-y-16">
          {features.map((feature, index) => (
            <motion.div 
              key={index} 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              whileHover={{ y: -5 }}
              className="group flex flex-col items-start"
            >
              <div className={`w-14 h-14 rounded-2xl ${feature.color} flex items-center justify-center mb-7 group-hover:shadow-lg group-hover:shadow-current/10 transition-all duration-500`}>
                <feature.icon className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-gray-900 tracking-tight">{feature.title}</h3>
              <p className="text-[15px] text-gray-500 leading-relaxed tracking-tight">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
