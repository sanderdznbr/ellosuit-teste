# Baileys Server v4.3.0

Servidor WhatsApp com **sincronização COMPLETA** de contatos e chats.

## Correções v4.3.0

- ✅ **Sincronização COMPLETA de contatos** - não apenas os recentes
- ✅ **Paginação para grandes listas** - evita timeout com muitos contatos
- ✅ **Endpoints dedicados para sync incremental** - `/api/sync/contacts` e `/api/sync/chats`
- ✅ **Cache de contatos por sessão** - mantém todos os contatos em memória
- ✅ **syncFullHistory habilitado** - busca histórico completo do WhatsApp
- ✅ **Batching de webhooks** - envia contatos em lotes de 50 para evitar sobrecarga
- ✅ **Sync bidirecional de lidas** - via `message-receipt.update`
- ✅ **Melhor tratamento de áudio/mídia**

## Instalação

```bash
npm install
npm start
```

## Variáveis de Ambiente

```env
PORT=3333
SUPABASE_WEBHOOK_URL=https://seu-projeto.supabase.co/functions/v1/whatsapp-webhook
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
```

## Novos Endpoints

### Sync Paginado de Contatos
```bash
POST /api/sync/contacts
{
  "instanceName": "sua-instancia",
  "page": 1,
  "pageSize": 50
}
```

Resposta:
```json
{
  "success": true,
  "page": 1,
  "pageSize": 50,
  "totalPages": 10,
  "totalContacts": 500,
  "contacts": [...],
  "hasMore": true
}
```

### Sync Paginado de Chats
```bash
POST /api/sync/chats
{
  "instanceName": "sua-instancia",
  "page": 1,
  "pageSize": 30
}
```

### Status com Contagem
```bash
GET /api/instance/:instanceName/status
```

Resposta inclui:
```json
{
  "status": "connected",
  "isConnected": true,
  "phoneNumber": "5511999999999",
  "contactsCount": 500,
  "chatsCount": 150
}
```

## Todos os Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/health` | Health check (retorna versão 4.3.0) |
| POST | `/api/instance/create` | Criar instância |
| GET | `/api/instance/:name/qr` | Obter QR Code |
| GET | `/api/instance/:name/status` | Status da conexão (inclui contagem) |
| POST | `/api/instance/:name/logout` | Desconectar |
| DELETE | `/api/instance/:name/delete` | Remover instância |
| POST | `/api/sync/contacts` | **NOVO** - Sync paginado de contatos |
| POST | `/api/sync/chats` | **NOVO** - Sync paginado de chats |
| POST | `/api/message/send` | Enviar texto |
| POST | `/api/message/send-media` | Enviar mídia |
| POST | `/api/message/send-voice` | Enviar áudio PTT |
| POST | `/api/message/read` | Marcar como lido |

## Como Usar no Railway

1. Faça deploy do novo código no Railway
2. Aguarde o servidor iniciar
3. O sync automático de contatos ocorrerá quando conectar
4. Use os endpoints `/api/sync/contacts` e `/api/sync/chats` para buscar contatos que não vieram no sync inicial

## Diferenças da v4.2.0

| Feature | v4.2.0 | v4.3.0 |
|---------|--------|--------|
| Sync de contatos | Apenas recentes | **TODOS** |
| Paginação | ❌ | ✅ |
| Cache em memória | ❌ | ✅ |
| Sync incremental | ❌ | ✅ |
| syncFullHistory | ❌ | ✅ |
| Batching de webhooks | ❌ | ✅ (50 por lote) |
