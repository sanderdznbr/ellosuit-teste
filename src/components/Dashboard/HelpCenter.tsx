import React, { useState } from 'react';
import { 
  Search, Book, Video, MessageCircle, FileText, ChevronRight, 
  Play, Clock, Star, ArrowRight, HelpCircle, Lightbulb, Zap,
  Mail, Calendar, Users, BarChart3, Link2, Bot
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const HelpCenter = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories = [
    { id: 'getting-started', label: 'Primeiros Passos', icon: Lightbulb, color: '#0EA5E9', count: 8 },
    { id: 'email', label: 'Email Marketing', icon: Mail, color: '#E34800', count: 12 },
    { id: 'calendar', label: 'Agenda & Reuniões', icon: Calendar, color: '#007DE3', count: 10 },
    { id: 'crm', label: 'CRM & Clientes', icon: Users, color: '#8B5CF6', count: 15 },
    { id: 'tracking', label: 'Rastreamento', icon: Link2, color: '#2ECC71', count: 9 },
    { id: 'ai', label: 'Agentes de IA', icon: Bot, color: '#EC4899', count: 6 },
  ];

  const tutorials = [
    {
      id: 1,
      title: 'Como começar no Ellosuit',
      description: 'Aprenda os fundamentos da plataforma em poucos minutos',
      duration: '5 min',
      category: 'getting-started',
      isNew: true,
      thumbnail: '🚀'
    },
    {
      id: 2,
      title: 'Criando sua primeira campanha de email',
      description: 'Passo a passo completo para criar e enviar emails',
      duration: '8 min',
      category: 'email',
      isNew: true,
      thumbnail: '📧'
    },
    {
      id: 3,
      title: 'Configurando a Agenda Online',
      description: 'Permita que clientes agendem reuniões automaticamente',
      duration: '6 min',
      category: 'calendar',
      isNew: false,
      thumbnail: '📅'
    },
    {
      id: 4,
      title: 'Importando contatos para o CRM',
      description: 'Organize sua base de clientes de forma eficiente',
      duration: '4 min',
      category: 'crm',
      isNew: false,
      thumbnail: '👥'
    },
    {
      id: 5,
      title: 'Rastreando documentos enviados',
      description: 'Saiba quando seus PDFs são visualizados',
      duration: '5 min',
      category: 'tracking',
      isNew: false,
      thumbnail: '📄'
    },
    {
      id: 6,
      title: 'Criando um Agente de IA',
      description: 'Configure chatbots inteligentes para atendimento',
      duration: '10 min',
      category: 'ai',
      isNew: true,
      thumbnail: '🤖'
    },
  ];

  const faqs = [
    {
      category: 'Conta & Assinatura',
      questions: [
        {
          q: 'Como alterar minha senha?',
          a: 'Acesse Configurações > Segurança > Alterar Senha. Você precisará informar sua senha atual e criar uma nova senha com pelo menos 8 caracteres.'
        },
        {
          q: 'Posso cancelar minha assinatura a qualquer momento?',
          a: 'Sim! Você pode cancelar sua assinatura em Configurações > Assinatura. O acesso continua até o final do período pago.'
        },
        {
          q: 'Como fazer upgrade do meu plano?',
          a: 'Vá em Configurações > Assinatura e clique em "Fazer Upgrade". Você terá acesso imediato aos novos recursos.'
        },
      ]
    },
    {
      category: 'Email Marketing',
      questions: [
        {
          q: 'Quantos emails posso enviar por mês?',
          a: 'O limite depende do seu plano. No plano Starter são 1.000 emails/mês, no Pro são 10.000 e no Enterprise é ilimitado.'
        },
        {
          q: 'Como sei se meus emails foram abertos?',
          a: 'Acesse Track > Emails para ver estatísticas detalhadas de aberturas, cliques e engajamento de cada campanha.'
        },
        {
          q: 'Posso usar meu próprio domínio para envio?',
          a: 'Sim! Configure seu domínio em Configurações > Integrações > Email. Isso melhora a entregabilidade e fortalece sua marca.'
        },
      ]
    },
    {
      category: 'CRM & Contatos',
      questions: [
        {
          q: 'Como importar contatos de uma planilha?',
          a: 'Em Gestão > Cadastros, clique em "Importar" e faça upload do seu arquivo CSV ou Excel. Mapeie as colunas e confirme a importação.'
        },
        {
          q: 'Posso criar campos personalizados?',
          a: 'Sim! Acesse Configurações > CRM > Campos Personalizados para criar campos específicos para seu negócio.'
        },
        {
          q: 'Como organizar contatos por tags?',
          a: 'Selecione os contatos desejados e clique em "Adicionar Tag". Você pode criar novas tags ou usar as existentes.'
        },
      ]
    },
    {
      category: 'Reuniões & Agenda',
      questions: [
        {
          q: 'Como criar um link de agendamento?',
          a: 'Vá em Flow > Agenda Online e clique em "Criar Link". Defina duração, horários disponíveis e personalize a página.'
        },
        {
          q: 'Posso integrar com Google Calendar?',
          a: 'Sim! Em Configurações > Integrações, conecte sua conta Google para sincronizar eventos automaticamente.'
        },
        {
          q: 'Como gravar uma reunião?',
          a: 'Durante a reunião, clique no botão "Gravar" na barra de controles. A gravação ficará disponível em Flow > Gravações.'
        },
      ]
    },
  ];

  const filteredTutorials = selectedCategory 
    ? tutorials.filter(t => t.category === selectedCategory)
    : tutorials;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-[#2F428D] to-[#253573] text-white">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-4">Central de Ajuda</h1>
            <p className="text-xl text-[#DFE4FB] mb-8">
              Encontre tutoriais, guias e respostas para suas dúvidas
            </p>
            
            {/* Search Bar */}
            <div className="max-w-2xl mx-auto relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                placeholder="Buscar tutoriais, artigos, FAQs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 h-14 text-lg bg-white text-gray-900 border-0 shadow-lg"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Quick Links */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-12">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(isSelected ? null : cat.id)}
                className={`p-4 rounded-xl border-2 transition-all text-left ${
                  isSelected 
                    ? 'border-[#374DA4] bg-[#F0F2FE]' 
                    : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-md'
                }`}
              >
                <div 
                  className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
                  style={{ backgroundColor: `${cat.color}15` }}
                >
                  <Icon className="h-5 w-5" style={{ color: cat.color }} />
                </div>
                <p className="font-medium text-sm text-gray-900">{cat.label}</p>
                <p className="text-xs text-gray-500">{cat.count} artigos</p>
              </button>
            );
          })}
        </div>

        {/* Video Tutorials Section */}
        <section className="mb-16">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Tutoriais em Vídeo</h2>
              <p className="text-gray-500">Aprenda visualmente com nossos guias passo a passo</p>
            </div>
            <Button variant="outline" className="gap-2">
              Ver todos <ArrowRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTutorials.map((tutorial) => (
              <Card key={tutorial.id} className="group cursor-pointer hover:shadow-lg transition-all border-gray-100">
                <CardContent className="p-0">
                  <div className="aspect-video bg-gradient-to-br from-gray-100 to-gray-50 rounded-t-lg flex items-center justify-center relative overflow-hidden">
                    <span className="text-5xl">{tutorial.thumbnail}</span>
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                      <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all transform scale-75 group-hover:scale-100">
                        <Play className="h-6 w-6 text-[#2F428D] ml-1" />
                      </div>
                    </div>
                    {tutorial.isNew && (
                      <Badge className="absolute top-3 right-3 bg-green-500">Novo</Badge>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-[#2F428D] transition-colors">
                      {tutorial.title}
                    </h3>
                    <p className="text-sm text-gray-500 mb-3">{tutorial.description}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <Clock className="h-3.5 w-3.5" />
                      <span>{tutorial.duration}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* FAQ Section */}
        <section className="mb-16">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Perguntas Frequentes</h2>
            <p className="text-gray-500">Respostas rápidas para as dúvidas mais comuns</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {faqs.map((faqCategory, idx) => (
              <Card key={idx} className="border-gray-100">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">{faqCategory.category}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Accordion type="single" collapsible className="w-full">
                    {faqCategory.questions.map((faq, faqIdx) => (
                      <AccordionItem key={faqIdx} value={`item-${idx}-${faqIdx}`} className="border-gray-100">
                        <AccordionTrigger className="text-left text-sm hover:no-underline">
                          {faq.q}
                        </AccordionTrigger>
                        <AccordionContent className="text-sm text-gray-600">
                          {faq.a}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Contact Support */}
        <section>
          <Card className="bg-gradient-to-r from-[#2F428D] to-[#253573] border-0 text-white">
            <CardContent className="p-8">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div>
                  <h3 className="text-2xl font-bold mb-2">Não encontrou o que procurava?</h3>
                  <p className="text-[#DFE4FB]">
                    Nossa equipe de suporte está pronta para ajudar você
                  </p>
                </div>
                <div className="flex gap-4">
                  <Button variant="secondary" className="gap-2 bg-white text-[#2F428D] hover:bg-[#F0F2FE]">
                    <MessageCircle className="h-4 w-4" />
                    Chat ao Vivo
                  </Button>
                  <Button variant="outline" className="gap-2 border-white/30 text-white hover:bg-white/10">
                    <Mail className="h-4 w-4" />
                    Enviar Email
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
};

export default HelpCenter;
