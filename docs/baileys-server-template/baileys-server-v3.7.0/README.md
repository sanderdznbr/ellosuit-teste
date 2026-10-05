# 🚀 Baileys Server v3.7.0 - Estável e Completo

## ✨ Novidades v3.7.0

### 🔄 Estabilidade Melhorada
- **Heartbeat automático** - Ping a cada 25s mantém conexão ativa
- **Reconexão inteligente** - Backoff exponencial (1s → 2s → 4s → 8s...)
- **Tratamento de erros** - Melhor handling de desconexões
- **Timeout configurável** - 90s para conexão inicial

### 👥 Sincronização de Contatos
- **Todos os contatos** - Carrega lista completa ao conectar
- **Nomes atualizados** - pushName e notify sincronizados
- **Fotos de perfil** - Busca automática em batch

### 📨 Mensagens em Tempo Real
- **Apenas novas mensagens** - Sem histórico antigo
- **Grupos completos** - Nome, participantes, fotos
- **Remetentes identificados** - Quem enviou em cada grupo

### 📸 Mídia Completa
- **Upload automático** - Supabase Storage
- **Retry inteligente** - 5 tentativas com delay progressivo
- **Todos os tipos** - Imagens, vídeos, áudios, documentos, stickers
- **PTT (áudio de voz)** - Gravações de voz do WhatsApp

## Deploy no Railway

### 1. Suba para o GitHub
- Substitua **TODOS** os arquivos
- **IMPORTANTE:** Delete a pasta `sessions/` para uma nova conexão

### 2. No Railway
1. New Project → Deploy from GitHub
2. Selecione seu repositório
3. Em **Variables**, adicione:

```
SUPABASE_WEBHOOK_URL=https://jwddiyuezqrpuakazvgg.supabase.co/functions/v1/whatsapp-webhook
SUPABASE_URL=https://jwddiyuezqrpuakazvgg.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key
```

**NÃO** defina PORT - Railway define automaticamente!

## Comportamento

### ✅ O que SERÁ sincronizado:
- Todos os seus contatos (ao conectar)
- Mensagens novas recebidas após conexão
- Mensagens enviadas por você
- Novos grupos que você é adicionado
- Todas as mídias (imagens, áudios, vídeos)

### ❌ O que NÃO será sincronizado:
- Histórico de conversas antigas
- Mensagens anteriores à conexão

## API Endpoints

### Criar Instância
```
POST /api/instance/create
{
  "sessionId": "uuid-da-sessao",
  "instanceName": "whatsapp-1234"
}
```

### Obter QR Code
```
GET /api/instance/:sessionId/qr
```

### Status da Sessão
```
GET /api/instance/:sessionId/status
```

### Enviar Mensagem
```
POST /api/message/send
{
  "sessionId": "uuid",
  "phone": "5511999999999",
  "message": "Olá!"
}
```

### Enviar Mídia
```
POST /api/message/media
{
  "sessionId": "uuid",
  "phone": "5511999999999",
  "mediaUrl": "https://...",
  "mediaType": "image",
  "caption": "Legenda opcional"
}
```

### Buscar Contatos
```
GET /api/contacts/:sessionId
```

### Health Check
```
GET /api/health
```

## Logs

```
🚀 Baileys Server v3.7.0 running on port 3000
💓 Heartbeat: ENABLED (25s interval)
📨 Processing REAL-TIME messages only
👥 Contacts sync: ENABLED
☁️ Supabase media: Enabled

✅ whatsapp-1234 connected! Phone: 5511999999999
👥 Loaded 150 contacts
📨 Processing 1 REAL-TIME messages
📤 Sending message to 5511999999999@s.whatsapp.net
```

## Troubleshooting

### Conexão cai frequentemente
- Verifique se o servidor tem memória suficiente (mínimo 512MB)
- O heartbeat deve manter a conexão ativa

### Contatos não aparecem
- Os contatos são enviados no evento `contacts.set` ao conectar
- Verifique os logs do webhook

### Mídia não salva
- Verifique se `SUPABASE_SERVICE_ROLE_KEY` está configurada
- Verifique se o bucket `whatsapp-media` existe e é público
