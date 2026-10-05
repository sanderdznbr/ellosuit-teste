import { Link } from 'react-router-dom';
import ellosuitLogo from '@/assets/ellosuit-logo.png';
import { Github, Twitter, Linkedin, Instagram } from 'lucide-react';

export const Footer = () => {
  return (
    <footer className="bg-[#374DA4] pt-20 pb-10 text-white">
      <div className="container mx-auto px-6">
        <div className="grid md:grid-cols-4 gap-12 mb-16">
          <div className="col-span-1 md:col-span-1">
            <Link to="/" className="inline-block mb-6">
              <img src={ellosuitLogo} alt="ELLOsuit" className="h-8 w-auto brightness-0 invert" />
            </Link>
            <p className="text-white text-sm leading-relaxed mb-6">
              O ecossistema definitivo para gerir sua empresa com CRM, automações e IA de alto desempenho.
            </p>
            <div className="flex gap-4">
              <a href="#" className="text-white hover:text-white/80 transition-colors"><Instagram className="h-5 w-5" /></a>
              <a href="#" className="text-white hover:text-white/80 transition-colors"><Twitter className="h-5 w-5" /></a>
              <a href="#" className="text-white hover:text-white/80 transition-colors"><Linkedin className="h-5 w-5" /></a>
              <a href="#" className="text-white hover:text-white/80 transition-colors"><Github className="h-5 w-5" /></a>
            </div>
          </div>
          
          <div>
            <h4 className="font-bold mb-6 text-white">Produto</h4>
            <ul className="space-y-4 text-sm text-white">
              <li><a href="#" className="hover:text-white/80 transition-colors">Funcionalidades</a></li>
              <li><a href="#" className="hover:text-white/80 transition-colors">Omnichannel CRM</a></li>
              <li><a href="#" className="hover:text-white/80 transition-colors">IA Conversacional</a></li>
              <li><a href="#" className="hover:text-white/80 transition-colors">Planos e Preços</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold mb-6 text-white">Suporte</h4>
            <ul className="space-y-4 text-sm text-white">
              <li><a href="#" className="hover:text-white/80 transition-colors">Documentação</a></li>
              <li><a href="#" className="hover:text-white/80 transition-colors">Ajuda 24h</a></li>
              <li><a href="#" className="hover:text-white/80 transition-colors">Status do Servidor</a></li>
              <li><a href="#" className="hover:text-white/80 transition-colors">API Oficial</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold mb-6 text-white">Legal</h4>
            <ul className="space-y-4 text-sm text-white">
              <li><Link to="/privacy" className="hover:text-white/80 transition-colors">Privacidade</Link></li>
              <li><Link to="/terms" className="hover:text-white/80 transition-colors">Termos de Uso</Link></li>
              <li><a href="#" className="hover:text-white/80 transition-colors">Compliance LGPD</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-white">
          <p>© 2026 Ellosuit. Todos os direitos reservados.</p>
          <p>Desenvolvido com tecnologia de ponta para empresas do futuro.</p>
        </div>
      </div>
    </footer>
  );
};