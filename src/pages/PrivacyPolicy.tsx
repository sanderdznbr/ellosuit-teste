
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronDown, Mail, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ellosuitLogo from '@/assets/ellosuit-logo.png';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const PrivacyPolicy = () => {
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
        <h1 className="text-5xl md:text-6xl font-semibold tracking-tight mb-6">Política de Privacidade</h1>
        <p className="text-lg text-slate-500">Última atualização: {new Date().toLocaleDateString('pt-BR')}. Entenda como cuidamos dos seus dados com transparência e segurança.</p>
      </header>

      {/* Content */}
      <main className="container mx-auto px-6 py-16 max-w-3xl">
        <div className="space-y-12">
          <section className="space-y-8">
            <div>
              <h2 className="text-2xl font-semibold mb-6">1. Informações que Coletamos</h2>
              <p className="text-slate-600 leading-relaxed mb-4">A Ellosuit coleta informações essenciais para o funcionamento da plataforma, divididas em:</p>
              <ul className="space-y-2 text-slate-600 list-disc pl-5">
                <li><strong>Dados Cadastrais:</strong> Nome, CPF/CNPJ, e-mail, telefone e endereço comercial, conforme exigido pela LGPD para execução de contrato.</li>
                <li><strong>Dados de Integração:</strong> Acesso a tokens e metadados de e-mails (Gmail/Outlook) e calendários, utilizados exclusivamente para as funções de rastreamento e agendamento.</li>
                <li><strong>Dados de Uso:</strong> Endereço IP, tipo de navegador, logs de acesso e interações com a plataforma para fins de segurança e melhoria contínua (Legítimo Interesse).</li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-semibold mb-6">2. Uso de Dados por Funcionalidade</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                  <h3 className="font-semibold mb-2">E-mail & CRM</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">Rastreamos aberturas e cliques para fornecer métricas de vendas. Os dados são processados conforme as políticas da API do Google/Microsoft.</p>
                </div>
                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                  <h3 className="font-semibold mb-2">Agendamentos (Booking)</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">Sincronizamos sua agenda para evitar conflitos. Dados de terceiros (seus clientes) são armazenados apenas para a finalidade da reunião.</p>
                </div>
                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                  <h3 className="font-semibold mb-2">WhatsApp API</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">Atuamos como operador de dados. O conteúdo das mensagens é de responsabilidade do controlador (você), conforme a Lei 13.709/18.</p>
                </div>
                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                  <h3 className="font-semibold mb-2">Pagamentos & Assinaturas</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">Dados de cartão de crédito não são armazenados em nossos servidores, sendo processados diretamente por gateways certificados (PCI DSS).</p>
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-semibold mb-6">3. Conformidade Legal (LGPD & GDPR)</h2>
              <p className="text-slate-600 leading-relaxed mb-4">A Ellosuit segue os princípios da Lei Geral de Proteção de Dados (Brasil) e as diretrizes do GDPR (Europa):</p>
              <ul className="space-y-4 text-slate-600">
                <li className="flex gap-4">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#DFE4FB] text-[#2F428D] flex items-center justify-center text-xs font-bold">1</div>
                  <p><strong>Minimização:</strong> Coletamos apenas o mínimo necessário para cada funcionalidade.</p>
                </li>
                <li className="flex gap-4">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#DFE4FB] text-[#2F428D] flex items-center justify-center text-xs font-bold">2</div>
                  <p><strong>Transparência:</strong> Você tem direito a saber exatamente quais dados processamos e por quê.</p>
                </li>
                <li className="flex gap-4">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#DFE4FB] text-[#2F428D] flex items-center justify-center text-xs font-bold">3</div>
                  <p><strong>Direito ao Esquecimento:</strong> Você pode solicitar a exclusão total da sua conta e dados a qualquer momento.</p>
                </li>
              </ul>
            </div>
          </section>

          {/* FAQ Section */}
          <section className="bg-slate-50 p-8 rounded-3xl">
            <h2 className="text-2xl font-semibold mb-6">Dúvidas Frequentes</h2>
            <Accordion type="single" collapsible className="space-y-4">
              <AccordionItem value="item-1" className="bg-white px-6 rounded-2xl border-none">
                <AccordionTrigger>Como meus dados são protegidos?</AccordionTrigger>
                <AccordionContent className="text-slate-600">Utilizamos criptografia de ponta a ponta e protocolos de segurança rigorosos para garantir que seus dados permaneçam privados e seguros.</AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-2" className="bg-white px-6 rounded-2xl border-none">
                <AccordionTrigger>Vocês compartilham meus dados?</AccordionTrigger>
                <AccordionContent className="text-slate-600">Não vendemos suas informações. Compartilhamos apenas com parceiros essenciais para operar o serviço e sob estrito sigilo.</AccordionContent>
              </AccordionItem>
            </Accordion>
          </section>
        </div>

        {/* Support Section */}
        <section className="mt-24 pt-16 border-t text-center">
          <h2 className="text-2xl font-semibold mb-8">Precisa de ajuda?</h2>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button className="rounded-full h-12 px-8 bg-black hover:bg-slate-800 text-white" asChild>
              <a href="mailto:privacy@ellosuit.com"><Mail className="mr-2 h-4 w-4" /> E-mail de Suporte</a>
            </Button>
            <Button variant="outline" className="rounded-full h-12 px-8">
              <MessageSquare className="mr-2 h-4 w-4" /> FAQ Completo
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
};

export default PrivacyPolicy;
