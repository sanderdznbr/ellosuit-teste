import React from 'react';
import { motion } from 'framer-motion';
import { Video, Mic, FileText, CheckSquare, Sparkles } from 'lucide-react';
import meetingImg from '@/assets/landing-meeting.jpg';

export const MeetingHighlight = () => {
  return (
    <section className="py-24 bg-[#faf9f7] overflow-hidden">
      <div className="container max-w-7xl mx-auto px-6">
        <div className="bg-[#f4f2ec] rounded-[28px] p-8 md:p-20 border border-[#e7e3da] relative">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="relative">
              <div className="absolute -top-6 -left-6 w-20 h-20 bg-primary/10 rounded-full blur-2xl animate-pulse" />
              <h2 className="text-4xl md:text-6xl font-semibold text-[#1f1e1d] mb-8 leading-[1.1]">
                Toda reunião vira <span className="text-primary">ação.</span>
              </h2>
              <p className="text-lg text-[#6b6862] mb-10 leading-relaxed max-w-md">
                No Meet Hub, suas reuniões não ficam no esquecimento. A IA ouve cada detalhe e organiza tudo para o seu time.
              </p>
              
              <div className="space-y-6">
                {[
                  { icon: Mic, label: 'Transcrição em tempo real', desc: 'Identificação de falantes e busca global.' },
                  { icon: FileText, label: 'Resumos executivos', desc: 'IA que extrai o essencial de cada call.' },
                  { icon: CheckSquare, label: 'Extração de Next Steps', desc: 'Criação automática de tarefas e lembretes.' }
                ].map((item, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-primary shrink-0">
                      <item.icon size={20} />
                    </div>
                    <div>
                      <p className="font-semibold text-[#1f1e1d]">{item.label}</p>
                      <p className="text-sm text-[#8a867e]">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                className="relative z-10 rounded-3xl bg-white p-3 shadow-sm border border-[#e7e3da]"
              >
                <img 
                  src={meetingImg} 
                  alt="Interface Meet Hub" 
                  loading="lazy"
                  width={1400}
                  height={1000}
                  className="rounded-2xl w-full h-auto block"
                />
              </motion.div>
              
              {/* Decorative circle */}
              <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-primary/5 rounded-full blur-[100px] -z-10" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
