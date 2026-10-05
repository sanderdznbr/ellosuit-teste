
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, BookOpen, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ellosuitLogo from '@/assets/ellosuit-logo.png';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const TermsOfService = () => {
  return (
    <div className="min-h-screen bg-white font-sans text-slate-900">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-md border-b border-slate-100 z-50">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={ellosuitLogo} alt="Ellosuit" className="h-6 w-auto" />
          </Link>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/">Voltar</Link>
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <header className="pt-32 pb-16 container mx-auto px-6 text-center max-w-2xl">
        <h1 className="text-5xl md:text-6xl font-semibold tracking-tight mb-6">Termos de Uso</h1>
        <p className="text-lg text-slate-500">Última atualização: {new Date().toLocaleDateString('pt-BR')}. Nossas diretrizes para garantir a melhor experiência para você.</p>
      </header>

      {/* Content */}
      <main className="container mx-auto px-6 py-16 max-w-3xl">
        <div className="space-y-12">
          <section>
            <h2 className="text-2xl font-semibold mb-6">1. Aceitação dos Termos</h2>
            <p className="text-slate-600 leading-relaxed">Ao acessar a plataforma Ellosuit, você concorda integralmente com estes termos. Nossa missão é oferecer ferramentas de produtividade com ética e segurança.</p>
          </section>

          <section className="bg-slate-50 p-8 rounded-3xl">
            <h2 className="text-2xl font-semibold mb-6">Informações Importantes</h2>
            <Accordion type="single" collapsible className="space-y-4">
              <AccordionItem value="item-1" className="bg-white px-6 rounded-2xl border-none">
                <AccordionTrigger>Como funcionam os pagamentos?</AccordionTrigger>
                <AccordionContent className="text-slate-600">Assinaturas são processadas de forma segura. Você pode cancelar a qualquer momento diretamente no seu painel de configurações.</AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-2" className="bg-white px-6 rounded-2xl border-none">
                <AccordionTrigger>Qual o uso aceitável do sistema?</AccordionTrigger>
                <AccordionContent className="text-slate-600">O uso para fins ilícitos, spam ou qualquer atividade que comprometa a segurança de outros usuários resultará em suspensão imediata da conta.</AccordionContent>
              </AccordionItem>
            </Accordion>
          </section>
        </div>

        {/* Support Section */}
        <section className="mt-24 pt-16 border-t text-center">
          <h2 className="text-2xl font-semibold mb-8">Dúvidas Jurídicas?</h2>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button className="rounded-full h-12 px-8 bg-black hover:bg-slate-800 text-white" asChild>
              <a href="mailto:legal@ellosuit.com"><BookOpen className="mr-2 h-4 w-4" /> Setor Jurídico</a>
            </Button>
            <Button variant="outline" className="rounded-full h-12 px-8">
              <MessageCircle className="mr-2 h-4 w-4" /> Falar com Suporte
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
};

export default TermsOfService;
