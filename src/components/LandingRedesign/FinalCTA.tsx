import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { ArrowRight, Zap } from 'lucide-react';

export const FinalCTA = () => {
  const navigate = useNavigate();

  return (
    <section className="py-24 relative overflow-hidden bg-[#faf9f7]">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10 pointer-events-none">
        <div className="absolute bottom-[-10%] left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-primary/5 blur-[120px] rounded-full" />
      </div>

      <div className="container max-w-7xl mx-auto px-6">
        <div className="bg-[#f4f2ec] border border-[#e7e3da] p-12 md:p-24 rounded-[28px] text-center text-[#1f1e1d] relative overflow-hidden">
          <div className="relative z-10 max-w-3xl mx-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="w-16 h-16 rounded-2xl bg-primary text-white flex items-center justify-center mx-auto mb-10 shadow-sm"
            >
              <Zap size={32} fill="currentColor" />
            </motion.div>
            
            <h2 className="text-4xl md:text-7xl font-semibold mb-8 tracking-tight text-[#1f1e1d]">
              Pronto para operar sua empresa com IA?
            </h2>
            <p className="text-lg md:text-xl text-[#6b6862] mb-14 max-w-2xl mx-auto leading-relaxed">
              Junte-se à nova era das empresas B2B inteligentes. Comece agora e transforme sua operação em uma máquina de eficiência.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
              <Button 
                size="lg"
                className="w-full sm:w-auto bg-primary text-white hover:bg-primary/90 rounded-full px-12 py-8 text-xl font-semibold transition-all shadow-sm hover:scale-105 active:scale-95 border-none"
                onClick={() => navigate('/register')}
              >
                Começar agora
                <ArrowRight className="ml-2 h-6 w-6" />
              </Button>
              <Button 
                size="lg"
                className="w-full sm:w-auto bg-white text-[#1f1e1d] hover:bg-[#f4f2ec] rounded-full px-12 py-8 text-xl font-semibold border border-[#ddd8cd] shadow-sm transition-all"
              >
                Falar com consultor
              </Button>
            </div>
            
          </div>
        </div>
      </div>
    </section>
  );
};
