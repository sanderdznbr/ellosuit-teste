# Baileys Server v3.6.0 - SEM Histórico

Servidor WhatsApp usando Baileys **SEM sincronização de histórico**.
Apenas mensagens novas em tempo real serão processadas.

## ✨ O que há de novo na v3.6.0

- **🚫 Histórico desabilitado**: Não sincroniza conversas antigas
- **📨 Apenas tempo real**: Só processa mensagens novas após conexão
- **👥 Nomes de grupos**: Busca groupMetadata para nomes corretos
- **📸 Fotos de perfil**: Inclui fotos de contatos e grupos
- **👤 Remetentes em grupos**: Identifica quem enviou cada mensagem

## Configuração

### Variáveis de Ambiente

```bash
# OBRIGATÓRIO - Webhook para enviar eventos
SUPABASE_WEBHOOK_URL=https://jwddiyuezqrpuakazvgg.supabase.co/functions/v1/whatsapp-webhook

# OPCIONAL - Para upload de mídia
SUPABASE_URL=https://jwddiyuezqrpuakazvgg.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key

# Porta (padrão: 3000)
PORT=3000
```

## Deploy no Railway

1. Crie um novo projeto no Railway
2. Conecte ao repositório ou faça upload dos arquivos
3. Configure as variáveis de ambiente
4. Deploy automático

## Comportamento

### O que SERÁ processado:
- ✅ Mensagens novas recebidas após conexão
- ✅ Mensagens enviadas por você
- ✅ Novos grupos que você é adicionado
- ✅ Contatos que enviam mensagem pela primeira vez

### O que NÃO será processado:
- ❌ Histórico de conversas antigas
- ❌ Mensagens anteriores à conexão
- ❌ Grupos antigos (só aparecem quando houver nova mensagem)

## API Endpoints

### Criar Instância
```
POST /api/instance/create
{
  "sessionId": "uuid-da-sessao",
  "instanceName": "whatsapp-1234",
  "webhookSecret": "opcional"
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
  "message": "Olá!",
  "isGroup": false
}
```

### Health Check
```
GET /api/health
```

## Logs

O servidor mostra claramente quando ignora dados históricos:

```
🚫 [CHATS.SET] Ignoring 150 historical chats (history sync disabled)
🚫 [HISTORY SYNC] Ignoring 500 messages (history sync disabled)
📨 Processing 1 REAL-TIME messages
👥 Group: "Meu Grupo" (120363419890086250@g.us)
👤 Sender: "João" (5511999999999)
```
