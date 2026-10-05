# 🚀 Baileys Server v4.0.0 - Reidratação de Mensagens

## ✨ Novidades v4.0.0

### 🔄 Reidratação de 1 Hora
- **Ao reconectar**: Busca mensagens da última 1 hora do banco e reenvia ao webhook
- **Preservação de dados**: Nunca sobrescreve nomes/fotos existentes
- **Sincronização inteligente**: Marca mensagens como `syncType: 'rehydration'`

### 🔐 Preservação de Contatos
- **Nomes persistentes**: Contato salvo nunca perde o nome
- **Fotos de perfil**: Mantém foto mesmo após reconexão
- **Fallback inteligente**: Usa dados do banco quando WhatsApp não retorna

### 🔧 Estabilidade
- **Heartbeat 20s**: Mantém conexão ativa
- **Backoff exponencial**: Reconexão inteligente
- **Proteção anti-flood**: Limita downloads de mídia

## Deploy no Railway

1. New Project → Deploy from GitHub
2. Em **Variables**, adicione:
   - `SUPABASE_WEBHOOK_URL` = URL do seu webhook
   - `SUPABASE_URL` = URL do Supabase
   - `SUPABASE_SERVICE_ROLE_KEY` = Service role key

**NÃO** defina PORT - Railway define automaticamente!

## Como Funciona a Reidratação

1. Servidor conecta ao WhatsApp
2. Busca mensagens da última 1h no banco de dados
3. Para cada conversa com mensagens recentes:
   - Reenvia as mensagens ao webhook como `messages.upsert`
   - Webhook deduplicada por `wa_message_id`
   - Interface atualiza em tempo real

## Comportamento

### ✅ O que SERÁ sincronizado:
- Mensagens da última 1 hora (ao reconectar)
- Todos os contatos com nomes/fotos preservados
- Mensagens novas em tempo real
- Todas as mídias

### ❌ O que NÃO será perdido:
- Nomes de contatos salvos
- Fotos de perfil existentes
- Histórico de conversas no banco

## Migração da v3.x

1. Baixe o novo servidor v4.0.0
2. No Railway: substitua arquivos
3. NÃO delete a pasta `sessions/` (mantém login)
4. Reinicie o serviço

Seus contatos e fotos continuarão intactos!
