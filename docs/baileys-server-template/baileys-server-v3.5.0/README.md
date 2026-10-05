# 🚀 Baileys Server v3.5.0 - Correção Completa de Grupos

## ✅ Novidades v3.5.0

### Principais Correções:
- ✅ **NOMES DE GRUPOS CORRETOS** - Busca groupMetadata para TODOS os grupos
- ✅ **REMETENTES EM GRUPOS** - Extrai sender_phone e sender_name corretamente
- ✅ **CACHE DE METADADOS** - Performance otimizada com cache de 5 minutos
- ✅ **HISTORY SYNC COMPLETO** - Sincroniza todas conversas com nomes corretos
- ✅ **SUPORTE A MÍDIAS** - Imagens, vídeos, áudios, documentos e stickers

### Campos Enviados para o Webhook:
- `groupName` - Nome do grupo
- `groupSubject` - Alias para compatibilidade
- `isGroup` - Indica se é grupo
- `senderPhone` - Telefone do remetente (em grupos)
- `senderName` - Nome do remetente (pushName)
- `mediaUrl` - URL da mídia no Supabase Storage
- `mediaType` - Tipo: image, video, audio, ptt, document, sticker

## Deploy no Railway

### 1. Suba para o GitHub
- Substitua **TODOS** os arquivos (especialmente index.js!)
- **IMPORTANTE:** Delete a pasta `sessions/` para forçar reconexão

### 2. No Railway
1. New Project → Deploy from GitHub
2. Selecione seu repositório
3. Em **Variables**, adicione:
   - `SUPABASE_WEBHOOK_URL` = `https://jwddiyuezqrpuakazvgg.supabase.co/functions/v1/whatsapp-webhook`
   - `SUPABASE_URL` = `https://jwddiyuezqrpuakazvgg.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY` = `sua_service_role_key` (pegar no Dashboard Supabase > Settings > API)

**NÃO** defina PORT - Railway define automaticamente!

### 3. Reconecte o WhatsApp
1. Delete a pasta `sessions/` no Railway (via shell ou redeploy limpo)
2. Escaneie o QR Code novamente
3. Aguarde a sincronização completa (pode levar alguns minutos)

## Resultado Esperado

Após atualizar para v3.5.0:
- ✅ Todos os grupos aparecerão com seus nomes reais
- ✅ Mensagens de grupo mostrarão quem enviou
- ✅ Novas mensagens aparecerão instantaneamente
- ✅ Conversas consolidadas sem duplicatas
