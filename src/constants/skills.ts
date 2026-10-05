 import { Brain, Zap, Target, Heart, Briefcase, Shield, Check, Info, Sparkles, X, Clock, MessageSquare, LineChart, Users, Lightbulb, TrendingUp, Handshake, Globe, Microscope, Scale, Presentation, Coffee, HelpCircle } from 'lucide-react';
 import React from 'react';
 
 export interface Skill {
   id: string;
   name: string;
   description: string;
   icon: React.ElementType;
   category: 'strategy' | 'monitoring' | 'support' | 'productivity';
   details: string;
   color: string;
 }
 
 export const ALL_SKILLS: Skill[] = [
   {
     id: 'sales-agent',
     name: 'Agente de Vendas',
     description: 'Sugere gatilhos e estratégias de fechamento em tempo real.',
     icon: Target,
     category: 'strategy',
     color: '#3600FF',
     details: 'Analisa o discurso do cliente para identificar objeções e recomendar o melhor argumento de venda baseado em dados históricos.'
   },
   {
     id: 'strategic-planner',
     name: 'Planejador Estratégico',
     description: 'Cria roadmap e próximos passos automaticamente.',
     icon: Briefcase,
     category: 'strategy',
     color: '#00FF85',
     details: 'Consolida decisões tomadas na reunião em um plano de ação estruturado com responsáveis e prazos sugeridos.'
   },
   {
     id: 'negotiation-expert',
     name: 'Mestre da Negociação',
     description: 'Identifica o momento exato para fechamento ou oferta.',
     icon: Handshake,
     category: 'strategy',
     color: '#FFD700',
     details: 'Monitora concessões de ambos os lados e sugere o ponto ideal de equilíbrio para um acordo ganha-ganha.'
   },
   {
     id: 'competitor-analyst',
     name: 'Analista de Mercado',
     description: 'Traz dados de concorrentes quando citados na conversa.',
     icon: TrendingUp,
     category: 'strategy',
     color: '#00D1FF',
     details: 'Fornece comparativos rápidos de funcionalidades e preços assim que um concorrente é mencionado.'
   },
   {
     id: 'satisfaction-agent',
     name: 'Sentinela de Satisfação',
     description: 'Monitora o sentimento dos participantes pelo tom de voz.',
     icon: Heart,
     category: 'monitoring',
     color: '#FF005C',
     details: 'Detecta variações sutis no humor dos participantes e alerta o moderador sobre possíveis sinais de insatisfação ou dúvida.'
   },
   {
     id: 'legal-compliance',
     name: 'Compliance & Jurídico',
     description: 'Verifica conformidade legal e termos obrigatórios.',
     icon: Shield,
     category: 'monitoring',
     color: '#FFD700',
     details: 'Monitora a menção de cláusulas contratuais essenciais e garante que acordos verbais sigam as políticas da empresa.'
   },
   {
     id: 'ethics-monitor',
     name: 'Monitor de Ética & DE&I',
     description: 'Garante um ambiente de fala inclusivo e respeitoso.',
     icon: Scale,
     category: 'monitoring',
     color: '#A855F7',
     details: 'Analisa o tempo de fala e possíveis interrupções, sugerindo formas de dar voz a todos os participantes de forma equitativa.'
   },
   {
     id: 'inconsistency-detector',
     name: 'Detector de Riscos',
     description: 'Identifica possíveis contradições em dados ou promessas.',
     icon: Microscope,
     category: 'monitoring',
     color: '#F97316',
     details: 'Cruza informações ditas no início da reunião com falas posteriores para garantir a coerência do discurso.'
   },
   {
     id: 'tech-advisor',
     name: 'Consultor Técnico',
     description: 'Valida fatos e traz documentações técnicas na hora.',
     icon: Zap,
     category: 'support',
     color: '#00D1FF',
     details: 'Acessa rapidamente manuais e especificações técnicas para dirimir dúvidas complexas sem precisar pausar a reunião.'
   },
   {
     id: 'eq-expert',
     name: 'Especialista em EQ',
     description: 'Analisa empatia e dinâmica emocional do grupo.',
     icon: Users,
     category: 'support',
     color: '#A855F7',
     details: 'Fornece feedback sobre o equilíbrio da fala entre os participantes e sugere formas de melhorar o entrosamento da equipe.'
   },
   {
     id: 'communication-coach',
     name: 'Coach de Oratória',
     description: 'Dicas discretas para melhorar sua persuasão e clareza.',
     icon: MessageSquare,
     category: 'support',
     color: '#EC4899',
     details: 'Analisa ritmo, vícios de linguagem e tom de voz, sugerindo ajustes para uma comunicação mais impactante.'
   },
   {
     id: 'cultural-bridge',
     name: 'Ponte Cultural',
     description: 'Ajuda em reuniões internacionais com nuances culturais.',
     icon: Globe,
     category: 'support',
     color: '#3600FF',
     details: 'Explica expressões idiomáticas e etiqueta de negócios específica de diferentes regiões do mundo em tempo real.'
   },
   {
     id: 'transcription-pro',
     name: 'Transcrição Premium',
     description: 'Notas de alta fidelidade e tradução simultânea.',
     icon: MessageSquare,
     category: 'productivity',
     color: '#F97316',
     details: 'Gera uma ata detalhada com distinção precisa de falantes e traduz termos técnicos para múltiplos idiomas instantaneamente.'
   },
   {
     id: 'time-manager',
     name: 'Gestor de Tempo',
     description: 'Garante que a pauta seja seguida no tempo previsto.',
     icon: Clock,
     category: 'productivity',
     color: '#EC4899',
     details: 'Acompanha o cronograma da pauta e emite alertas discretos quando um tópico está tomando mais tempo que o planejado.'
   },
   {
     id: 'brainstorm-facilitator',
     name: 'Facilitador Criativo',
     description: 'Gera ideias e conexões novas baseadas na conversa.',
     icon: Lightbulb,
     category: 'productivity',
     color: '#00FF85',
     details: 'Sintetiza pontos de vista diferentes para criar soluções inovadoras e destravar processos criativos.'
   },
   {
     id: 'pitch-doctor',
     name: 'Pitch Doctor',
     description: 'Analisa a estrutura e impacto do seu pitch de vendas.',
     icon: Presentation,
     category: 'productivity',
     color: '#FFD700',
     details: 'Verifica se todos os pontos chave do pitch foram cobertos e sugere melhorias na narrativa para aumentar a conversão.'
   },
   {
     id: 'executive-summarizer',
     name: 'Resumo para CEO',
     description: 'Cria um boletim executivo focado em resultados.',
     icon: Briefcase,
     category: 'productivity',
     color: '#FFFFFF',
     details: 'Extrai apenas as decisões críticas e impactos financeiros da reunião, eliminando todo o ruído para uma leitura de 30 segundos.'
   },
   {
     id: 'follow-up-agent',
     name: 'Agente de Follow-up',
     description: 'Prepara e-mails de agradecimento e próximos passos.',
     icon: Coffee,
     category: 'productivity',
     color: '#F97316',
     details: 'Ao final da reunião, já deixa rascunhado o e-mail de resumo para todos os participantes com as tarefas atribuídas a cada um.'
   }
 ];