import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, ChevronDown, Globe, ArrowRight, MessageSquarePlus, HandHelping } from 'lucide-react';
import { EllosuitMark } from '../shared/EllosuitMark';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export const Navbar = () => {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [lang, setLang] = useState<'PT' | 'EN' | 'ES'>('PT');

  const languages: { code: 'PT' | 'EN' | 'ES'; label: string }[] = [
    { code: 'PT', label: 'Português' },
    { code: 'EN', label: 'English' },
    { code: 'ES', label: 'Español' },
  ];

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Produto', href: '#modules', hasDropdown: true },
    { name: 'Recursos', href: '#ai', hasDropdown: true },
    { name: 'Preços', href: '#pricing', hasDropdown: false },
  ];

  // Lock scroll while mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

  return (
    <>
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-[#faf9f7]/90 backdrop-blur border-b border-[#ddd8cd]/70 py-2.5 shadow-[0_4px_20px_-12px_rgba(11,11,59,0.15)]' : 'bg-[#faf9f7]/80 backdrop-blur-sm py-3'
      }`}
    >
      <div className="container max-w-7xl mx-auto px-6 lg:px-10 flex items-center justify-between">
        {/* Left cluster: logo + nav */}
        <div className="flex items-center gap-10">
          <div
            className="flex items-center gap-2 cursor-pointer shrink-0"
            onClick={() => navigate('/')}
          >
            <EllosuitMark className="h-8 w-8 text-[#374DA4]" />
            <span className="text-xl font-bold tracking-tight text-[#374DA4]">
              Ellosuit
            </span>
          </div>

          <div className="hidden lg:flex items-center gap-7">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="group flex items-center gap-1 text-[15px] font-medium text-[#1f1e1d] hover:text-[#374DA4] transition-colors"
              >
                {link.name}
                {link.hasDropdown && (
                  <ChevronDown size={14} className="opacity-70 transition-transform group-hover:rotate-180" />
                )}
              </a>
            ))}
          </div>
        </div>

        {/* Right cluster */}
        <div className="hidden lg:flex items-center gap-5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="Idioma"
                className="text-[#1f1e1d] hover:text-[#374DA4] transition-colors focus:outline-none"
              >
                <Globe size={18} strokeWidth={1.75} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              {languages.map((l) => (
                <DropdownMenuItem
                  key={l.code}
                  onSelect={() => setLang(l.code)}
                  className={`cursor-pointer ${lang === l.code ? 'font-semibold text-[#374DA4]' : ''}`}
                >
                  <span className="mr-2 text-xs opacity-60">{l.code}</span>
                  {l.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <span className="h-5 w-px bg-gray-300" />
          <button
            onClick={() => navigate('/register')}
            className="text-[15px] font-medium text-[#1f1e1d] hover:text-[#374DA4] transition-colors"
          >
            Agendar demo
          </button>
          <Button
            variant="outline"
            onClick={() => navigate('/auth')}
            className="rounded-full h-10 px-5 border-[1.5px] border-[#ddd8cd] bg-transparent text-[#1f1e1d] hover:bg-[#1f1e1d] hover:text-white text-[14px] font-semibold transition-all"
          >
            Iniciar sessão
          </Button>
          <Button
            onClick={() => navigate('/register')}
            className="rounded-full h-10 px-5 bg-[#374DA4] hover:bg-[#2e4290] text-white text-[14px] font-semibold transition-all"
          >
            Registre-se
          </Button>
        </div>

        {/* Mobile toggle */}
        <button
          className="lg:hidden text-[#1f1e1d] p-2 -mr-2"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
        >
          {mobileMenuOpen ? <X size={26} strokeWidth={2.2} /> : <Menu size={26} strokeWidth={2.2} />}
        </button>
      </div>
    </nav>

    {/* Mobile Fullscreen Menu — rendered via portal so backdrop-blur on <nav>
        doesn't turn the nav into the containing block for this fixed overlay. */}
    {typeof document !== 'undefined' && createPortal(
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="lg:hidden fixed inset-0 top-[64px] bg-[#faf9f7] z-40 overflow-y-auto"
          >
            <div className="px-6 py-6 flex flex-col">
              {/* Accordion links */}
              {navLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-between py-5 border-b border-[#e7e3da] text-[#1f1e1d] text-lg font-semibold"
                >
                  {link.name}
                  {link.hasDropdown && <ChevronDown size={18} className="opacity-60" />}
                </a>
              ))}

              {/* Promo card */}
              <button
                onClick={() => { setMobileMenuOpen(false); navigate('/register'); }}
                className="mt-6 flex items-center justify-between rounded-2xl bg-[#f0efe9] px-5 py-4 text-left"
              >
                <span className="text-[#1f1e1d] font-semibold text-[15px]">Ver preços Ellosuit</span>
                <ArrowRight size={18} className="text-[#1f1e1d]" />
              </button>

              {/* Secondary links */}
              <div className="mt-6 border-t border-[#e7e3da] pt-4 flex flex-col gap-1">
                <a href="#contact" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 py-3 text-[#1f1e1d] text-[15px] font-semibold">
                  <MessageSquarePlus size={18} className="text-[#1f1e1d]" />
                  Contatar o suporte
                </a>
                <a href="#partners" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 py-3 text-[#1f1e1d] text-[15px] font-semibold">
                  <HandHelping size={18} className="text-[#1f1e1d]" />
                  Contrate um parceiro especialista
                </a>
                <button className="flex items-center gap-3 py-3 text-[#1f1e1d] text-[15px] font-semibold">
                  <Globe size={18} className="text-[#1f1e1d]" />
                  PT
                </button>
              </div>

              {/* CTA buttons */}
              <div className="mt-6 flex flex-col gap-3">
                <Button
                  onClick={() => { setMobileMenuOpen(false); navigate('/register'); }}
                  className="w-full h-14 rounded-full bg-[#374DA4] hover:bg-[#2e4290] text-white text-base font-semibold"
                >
                  Registre-se
                </Button>
                <Button
                  variant="outline"
                  onClick={() => { setMobileMenuOpen(false); navigate('/auth'); }}
                  className="w-full h-14 rounded-full border-[1.5px] border-[#ddd8cd] text-[#1f1e1d] hover:bg-[#1f1e1d] hover:text-white text-base font-semibold"
                >
                  Iniciar sessão
                </Button>
                <button
                  onClick={() => { setMobileMenuOpen(false); navigate('/register'); }}
                  className="w-full py-3 text-[#1f1e1d] text-base font-semibold"
                >
                  Agendar demo
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body,
    )}
    </>
  );
};
