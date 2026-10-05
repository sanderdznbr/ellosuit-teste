import React from 'react';
import { useNavigate } from 'react-router-dom';

export const Footer = () => {
  const navigate = useNavigate();
  const year = new Date().getFullYear();

  return (
    <footer className="py-20 bg-[#374DA4] text-white">
      <div className="container max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-12 mb-20">
          <div className="col-span-2">
            <div className="flex items-center mb-6">
              <img 
                src="/images/ellosuit-logo.png" 
                alt="Ellosuit" 
                className="h-10 w-auto brightness-0 invert" 
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = '/favicon.png';
                  target.className = "h-10 w-auto brightness-0 invert";
                }} 
              />
            </div>
            <p className="text-white max-w-xs leading-relaxed mb-6">
              A inteligência operacional que escala empresas B2B através de IA integrada e módulos especializados.
            </p>
          </div>

          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-widest mb-6">Plataforma</h4>
            <ul className="space-y-4">
              {['Conversas', 'Agenda & Tarefas', 'Reuniões', 'Rastreamento', 'IA Integrada'].map((item) => (
                <li key={item}><a href="#modules" className="text-sm font-medium text-white hover:text-white/80 transition-colors">{item}</a></li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-widest mb-6">Recursos</h4>
            <ul className="space-y-4">
              {['Blog', 'Documentação', 'API Docs', 'Status'].map((item) => (
                <li key={item}><a href="#" className="text-sm font-medium text-white hover:text-white/80 transition-colors">{item}</a></li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-widest mb-6">Empresa</h4>
            <ul className="space-y-4">
              {['Sobre nós', 'Carreiras', 'Contatos'].map((item) => (
                <li key={item}><a href="#" className="text-sm font-medium text-white hover:text-white/80 transition-colors">{item}</a></li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-widest mb-6">Legal</h4>
            <ul className="space-y-4">
              {['Privacidade', 'Termos', 'Segurança'].map((item) => (
                <li key={item}><a href="#" className="text-sm font-medium text-white hover:text-white/80 transition-colors">{item}</a></li>
              ))}
            </ul>
          </div>
        </div>

        <div className="pt-10 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-6">
          <p className="text-xs text-white font-medium">
            © {year} Ellosuit. Todos os direitos reservados.
          </p>
          <div className="flex items-center gap-8">
            <a href="#" className="text-xs font-bold text-white hover:text-white/80 transition-colors">LinkedIn</a>
            <a href="#" className="text-xs font-bold text-white hover:text-white/80 transition-colors">Instagram</a>
            <a href="#" className="text-xs font-bold text-white hover:text-white/80 transition-colors">X (Twitter)</a>
          </div>
        </div>
      </div>
    </footer>
  );
};
