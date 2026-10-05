# 🎠 ellocontent.com — Guia de Remix

Este documento lista todos os arquivos, edge functions, tabelas e assets necessários para criar o projeto separado **ellocontent.com** a partir deste repositório.

---

## 📁 Arquivos do Frontend

### Páginas
- `src/pages/PublicCarouselGenerator.tsx` — Página principal (entry point)

### Componentes Carousel (copiar pasta inteira)
```
src/components/Carousel/
├── CarouselGenerator.tsx          ← Componente principal (wizard + editor)
├── CarouselTour.tsx               ← Tour/onboarding
├── GeneratingAnimation.tsx        ← Animação de geração
├── SocialPublishDialog.tsx        ← Dialog de publicação
├── StyleTemplateManager.tsx       ← Gerenciador de templates de estilo
├── WelcomeScreen.tsx              ← Tela inicial com input de prompt
├── editor/
│   └── CarouselEditorSidebar.tsx  ← Sidebar de edição
└── wizard/
    ├── StepBrandRef.tsx           ← Referências de marca
    ├── StepBranding.tsx           ← Configuração de branding
    ├── StepCardCount.tsx          ← Quantidade de cards
    ├── StepColors.tsx             ← Paleta de cores
    ├── StepFaceRef.tsx            ← Referências de rosto
    ├── StepFonts.tsx              ← Tipografia
    ├── StepImageAdvanced.tsx      ← Config avançada de imagem
    ├── StepImageSettings.tsx      ← Config de imagem
    ├── StepProduct.tsx            ← Referência de produto
    ├── StepReferences.tsx         ← Referências gerais
    ├── StepStyle.tsx              ← Presets de estilo
    ├── StepTopic.tsx              ← Tema/tópico
    ├── StepWebImages.tsx          ← Busca de imagens web
    └── types.ts                   ← Tipos compartilhados
```

### Hooks
- `src/hooks/useCarouselVoice.ts` — Hook de voz (Ello)

### Estilos
- `src/styles/carousel-loader.css` — Animação do loader/orb

### Assets
- `src/assets/ellocontent_logo.png` — Logo do ellocontent

---

## ⚡ Edge Functions (Supabase)

Estas funções já existem no Supabase e serão **compartilhadas** se usar o mesmo banco:

| Função | Descrição |
|--------|-----------|
| `generate-carousel` | Geração de conteúdo com IA, enhance de prompt, busca web |
| `carousel-voice` | TTS para a voz "Ello" |
| `search-news` | Busca de notícias para contexto |

### Config (supabase/config.toml)
```toml
[functions.generate-carousel]
verify_jwt = false

[functions.search-news]
verify_jwt = false
```

> **Nota:** `carousel-voice` não está no config.toml atual — verificar se precisa ser adicionado.

---

## 🗄️ Tabelas do Banco (Supabase)

| Tabela | Uso |
|--------|-----|
| `carousel_style_templates` | Templates de estilo salvos pelo usuário |

---

## 🔑 Secrets Necessários

| Secret | Uso |
|--------|-----|
| `OPENAI_API_KEY` | Geração de conteúdo e imagens |
| `PEXELS_API_KEY` | Busca de imagens web |
| `BRAVE_SEARCH_API_KEY` | Busca de notícias |
| `ELEVENLABS_API_KEY` | Voz da Ello |
| `GOOGLE_CSE_API_KEY` | Busca de imagens Google |
| `GOOGLE_CSE_ID` | Custom Search Engine ID |

---

## 🛣️ Rotas

| Rota atual (ellosuit) | Rota no remix (ellocontent) |
|------------------------|----------------------------|
| `/gerador-de-carrosseis` | `/` (página principal) |

---

## 📋 Passos para o Remix

1. **Fazer remix** do projeto atual no Lovable
2. **Limpar** tudo que NÃO é relacionado ao carrossel (dashboard, CRM, WhatsApp, etc.)
3. **Conectar o mesmo Supabase** (`jwddiyuezqrpuakazvgg`) — as edge functions e tabelas já estarão disponíveis
4. **Ajustar rota principal** — `PublicCarouselGenerator` vira a rota `/`
5. **Conectar domínio** `ellocontent.com` no novo projeto
6. **Remover** componentes do ellosuit que não serão usados (EllosuitOmniLogo, dashboard, etc.)

---

## ⚠️ Atenção

- O `WelcomeScreen.tsx` já usa a marca **ellocontent** (logo + texto), está pronto para uso independente
- As edge functions são **compartilhadas** — qualquer alteração no `generate-carousel` afetará ambos os projetos
- Se no futuro quiser edge functions independentes, crie um novo projeto Supabase
