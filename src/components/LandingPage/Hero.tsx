import { Button } from '@/components/ui/button';
import { ArrowRight, Play } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Hero = () => {
  return (
    <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden bg-white">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-primary/[0.01] rounded-full blur-[140px]" />
        <div className="absolute bottom-[20%] right-[-10%] w-[40%] h-[40%] bg-[#5A74D1]/[0.01] rounded-full blur-[120px]" />
      </div>

      <div className="container max-w-7xl mx-auto px-6 text-center">
        <h1 className="text-[44px] sm:text-[68px] md:text-[84px] lg:text-[110px] tracking-[-0.05em] text-gray-950 mb-10 max-w-[1200px] mx-auto leading-[0.9] inline-block font-bold">
          Seu negócio no <span className="text-primary italic font-light">piloto automático</span>.
        </h1>
        
        <p className="text-lg md:text-xl text-gray-400 max-w-xl mx-auto mb-16 leading-relaxed tracking-tight font-medium">
          Ecossistema integrado de CRM e WhatsApp Oficial em uma interface minimalista de alta performance.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-28">
          <Link to="/register">
            <Button size="lg" className="rounded-full px-12 h-16 text-base font-bold shadow-2xl shadow-primary/10 group transition-all duration-500 hover:scale-[1.03] active:scale-95">
              Começar Agora
              <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
          <Button size="lg" variant="ghost" className="rounded-full px-12 h-16 text-base font-semibold text-gray-500 hover:bg-gray-50 transition-all duration-300">
            <Play className="mr-2 h-3 w-3 fill-current opacity-50" />
            Ver Vídeo
          </Button>
        </div>

        {/* Video Placeholder */}
        <div className="relative max-w-5xl mx-auto px-4 md:px-0 group cursor-pointer">
          <div className="absolute -inset-4 bg-gradient-to-b from-primary/[0.08] to-transparent rounded-[40px] blur-3xl opacity-30 -z-10 transition-opacity group-hover:opacity-50" />
          <div className="relative rounded-[32px] overflow-hidden shadow-[0_50px_100px_-30px_rgba(0,0,0,0.1)] border border-gray-100 bg-gray-50 aspect-video flex items-center justify-center transition-transform duration-700 group-hover:scale-[1.01]">
            <div className="absolute inset-0 bg-gradient-to-br from-gray-50/50 to-gray-100/50" />
            <div className="relative z-10 flex flex-col items-center gap-6">
              <div className="w-20 h-20 rounded-full bg-white shadow-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                <Play className="h-8 w-8 text-primary fill-primary ml-1" />
              </div>
              <p className="text-sm font-bold text-gray-400 tracking-widest uppercase">Assista a Demonstração</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
