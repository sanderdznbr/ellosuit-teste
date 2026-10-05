import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import ellosuitLogo from '@/assets/ellosuit-logo.png';
import { useEffect, useState } from 'react';

export const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
      scrolled ? 'bg-white/80 backdrop-blur-xl border-b border-gray-100/50 py-3' : 'bg-transparent py-6'
    }`}>
      <div className="container max-w-7xl mx-auto px-6 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <img src={ellosuitLogo} alt="ELLOsuit" className="h-7 w-auto transition-transform duration-300 group-hover:scale-105" />
        </Link>
        
        <div className="hidden md:flex items-center gap-10">
          <a href="#features" className="text-[13px] font-bold text-gray-500 hover:text-primary transition-colors tracking-tight">Recursos</a>
          <a href="#solutions" className="text-[13px] font-bold text-gray-500 hover:text-primary transition-colors tracking-tight">Soluções</a>
          <a href="#pricing" className="text-[13px] font-bold text-gray-500 hover:text-primary transition-colors tracking-tight">Preços</a>
        </div>

        <div className="flex items-center gap-6">
          <Link to="/auth" className="text-[13px] font-bold text-gray-500 hover:text-primary transition-colors tracking-tight">Entrar</Link>
          <Link to="/register">
            <Button className="rounded-full px-6 h-9 text-[13px] font-bold shadow-sm hover:shadow-md transition-all">Começar Grátis</Button>
          </Link>
        </div>
      </div>
    </nav>
  );
};
