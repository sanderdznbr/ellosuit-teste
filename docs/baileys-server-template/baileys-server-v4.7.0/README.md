# Baileys Server v4.7.0

Servidor WhatsApp baseado na biblioteca Baileys para integração com o CRM WhatsApp do Lovable.

## 🆕 Novidades v4.7.0

- **🔍 Validação de número antes do envio**: Endpoint `/api/number/check` usa `onWhatsApp()` para resolver o JID correto
- **🇧🇷 Correção automática do 9º dígito brasileiro**: Se o número não for encontrado, tenta variações com/sem o 9º dígito
- **✅ Garantia de entrega**: Mensagens só são enviadas para números confirmados no WhatsApp
- Todas as funcionalidades do v4.6.0 mantidas (sync proativo, stickers, cache de nomes, etc.)

## 🚀 Deploy no Railway

1. Crie um novo projeto no [Railway](https://railway.app)
2. Faça upload destes arquivos (index.js e package.json)
3. Configure as variáveis de ambiente:
   - `SUPABASE_WEBHOOK_URL`: URL da Edge Function (whatsapp-webhook)
   - `SUPABASE_URL`: URL do seu projeto Supabase
   - `SUPABASE_SERVICE_ROLE_KEY`: Chave de serviço do Supabase

## ⚠️ IMPORTANTE: Conexão Limpa

**Delete a pasta `sessions/`** no Railway para uma nova conexão.
O `syncFullHistory` e `syncAllMetadata` só funcionam em conexões novas!

## 📡 Endpoints

### Saúde
- `GET /api/health` - Status do servidor

### Instâncias
- `POST /api/instance/create` - Criar nova sessão
- `GET /api/instance/:instanceName/qr` - Obter QR Code
- `GET /api/instance/:instanceName/status` - Status da sessão
- `GET /api/instance/list` - Listar todas as sessões
- `DELETE /api/instance/:instanceName` - Remover sessão

### 🆕 Validação de Número
- `POST /api/number/check` - **Verificar se número existe no WhatsApp e obter JID correto**

### Contatos e Chats
- `POST /api/sync/contacts` - Sync paginado de contatos com fotos
- `POST /api/sync/chats` - Sync paginado de chats com metadados

### Mensagens
- `POST /api/message/send` - Enviar mensagem de texto
- `POST /api/message/send-media` - Enviar mídia
- `POST /api/message/send-voice` - Enviar áudio PTT
- `POST /api/message/read` - Marcar como lido

## 🔍 Como funciona a validação de número

```
POST /api/number/check
Body: { "instanceName": "minha-instancia", "phone": "5541996875461" }

Resposta (encontrado):
{ "exists": true, "jid": "554196875461@s.whatsapp.net" }

Resposta (não encontrado):
{ "exists": false, "jid": null }
```

A Edge Function `whatsapp-public-api` usa este endpoint automaticamente para:
1. Verificar se o número existe no WhatsApp
2. Se não encontrar e for brasileiro (55), tentar com/sem o 9º dígito
3. Usar o JID correto retornado para enviar a mensagem

## 📊 Comparação de versões

| Recurso | v4.6.0 | v4.7.0 |
|---------|--------|--------|
| Histórico | 6 horas | 6 horas |
| Sync proativo | ✅ | ✅ |
| Cache de nomes | ✅ | ✅ |
| Stickers | ✅ | ✅ |
| Validação de número | ❌ | **✅ /api/number/check** |
| Correção 9º dígito BR | ❌ | **✅ Automática** |

## 📦 Arquivos incluídos

- `package.json` - Baileys v6.7.17
- `index.js` - Servidor v4.7.0 com validação de número
- `.env.example` - Variáveis de ambiente
- `README.md` - Esta documentação