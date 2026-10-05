import React from 'react';
import { motion } from 'framer-motion';
import { Clock, MessagesSquare, UserX, FileSearch } from 'lucide-react';

export const ProblemSection = () => {
  const problems = [
    {
      title: 'Lead que chega às 22h fica sem resposta',
      description: 'Quando você vê, o concorrente já respondeu — e ganhou a venda.',
      icon: Clock,
    },
    {
      title: 'Cada atendente fala em um WhatsApp diferente',
      description: 'Histórico se perde quando alguém sai e ninguém sabe o que foi prometido.',
      icon: MessagesSquare,
    },
    {
      title: 'CRM em planilha que ninguém atualiza',
      description: 'Leads esfriam, follow-ups esquecidos, comissão vai pro ralo.',
      icon: FileSearch,
    },
    {
      title: 'Você não sabe quem está perto de comprar',
      description: 'Sem rastreio de propostas e mensagens, vende quem grita mais alto.',
      icon: UserX,
    },
  ];

  return (
    <section className="py-24 bg-[#f4f2ec]">
      <div className="container max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-semibold text-[#1f1e1d] mb-6">
            Seu time vende pelo WhatsApp. E está perdendo dinheiro nele.
          </h2>
          <p className="text-lg text-[#6b6862] max-w-2xl mx-auto">
            7 em cada 10 leads de WhatsApp são perdidos por demora na resposta ou falta de follow-up. A Ellosuit resolve isso com IA.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {problems.map((problem, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="bg-white p-8 rounded-3xl border border-[#e7e3da] shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center text-red-500 mb-6">
                <problem.icon size={24} />
              </div>
              <h3 className="text-xl font-semibold text-[#1f1e1d] mb-3">{problem.title}</h3>
              <p className="text-[#6b6862] leading-relaxed">{problem.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
