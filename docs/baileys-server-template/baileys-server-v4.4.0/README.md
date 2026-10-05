# Baileys Server v4.6.0

Servidor WhatsApp baseado na biblioteca Baileys para integração com o CRM WhatsApp do Lovable.

## 🆕 Mudanças na v4.6.0

- **Sync proativo de metadados**: Busca fotos e nomes de TODOS os chats imediatamente após conexão
- **Função syncAllMetadata**: Nova função que itera todos os chats e envia webhook `contact.metadata`
- **Histórico estendido**: Sincroniza mensagens das últimas **6 HORAS**
- **Suporte a stickers**: Download e armazenamento de figurinhas

## 🚀 Deploy no Railway

1. Crie um novo projeto no [Railway](https://railway.app)
2. Faça upload destes arquivos (index.js e package.json)
3. Configure as variáveis de ambiente:
   - `SUPABASE_WEBHOOK_URL`: URL da Edge Function (whatsapp-webhook)
   - `SUPABASE_URL`: URL do seu projeto Supabase
   - `SUPABASE_SERVICE_ROLE_KEY`: Chave de serviço do Supabase

## 📡 Endpoints

### Saúde
- `GET /api/health` - Status do servidor (inclui `historyHours: 6`)

### Instâncias
- `POST /api/instance/create` - Criar nova sessão
- `GET /api/instance/:instanceName/qr` - Obter QR Code
- `GET /api/instance/:instanceName/status` - Status da sessão
- `GET /api/instance/list` - Listar todas as sessões
- `DELETE /api/instance/:instanceName` - Remover sessão

### Contatos
- `GET /api/contacts/:sessionId` - Listar contatos sincronizados
- `POST /api/sync/contacts` - Sync paginado de contatos
- `POST /api/sync/chats` - Sync paginado de chats

### Mensagens
- `POST /api/message/send` - Enviar mensagem de texto
- `POST /api/message/send-media` - Enviar mídia
- `POST /api/message/send-voice` - Enviar áudio PTT
- `POST /api/message/read` - Marcar como lido

## ⚡ Recursos

- ✅ **6 horas de histórico** (novo!)
- ✅ Heartbeat automático (20s)
- ✅ Reconexão com backoff exponencial
- ✅ Sincronização completa de contatos
- ✅ Upload de mídia para Supabase Storage
- ✅ Cache de grupos e fotos de perfil
- ✅ Suporte a grupos e mensagens individuais

## 📊 Comparação de versões

| Recurso | v4.3.0 | v4.4.0 |
|---------|--------|--------|
| Histórico de mensagens | 1 hora | **6 horas** |
| Batch size mensagens | 15 | 20 |
| Sync de contatos | Completo | Completo |
| Sync de perfil | Básico | **Melhorado** |
