# Baileys Server v3.8.0

Servidor WhatsApp baseado na biblioteca Baileys para integração com o CRM WhatsApp do Lovable.

## 🆕 Mudanças na v3.8.0

- **CORREÇÃO**: Endpoint `/api/message/send` agora funciona corretamente
- Logs detalhados no envio de mensagens para debug
- Validação melhorada de sessão antes do envio

## 🚀 Deploy no Railway

1. Crie um novo projeto no [Railway](https://railway.app)
2. Faça upload destes arquivos (index.js e package.json)
3. Configure as variáveis de ambiente:
   - `SUPABASE_WEBHOOK_URL`: URL da Edge Function (whatsapp-webhook)
   - `SUPABASE_URL`: URL do seu projeto Supabase
   - `SUPABASE_SERVICE_ROLE_KEY`: Chave de serviço do Supabase

## 📡 Endpoints

### Saúde
- `GET /api/health` - Status do servidor

### Instâncias
- `POST /api/instance/create` - Criar nova sessão
- `GET /api/instance/:sessionId/qr` - Obter QR Code
- `GET /api/instance/:sessionId/status` - Status da sessão
- `GET /api/instance/list` - Listar todas as sessões
- `DELETE /api/instance/:sessionId` - Remover sessão

### Contatos
- `GET /api/contacts/:sessionId` - Listar contatos sincronizados

### Mensagens
- `POST /api/message/send` - Enviar mensagem de texto ✅ CORRIGIDO
- `POST /api/message/media` - Enviar mídia (imagem, vídeo, áudio, documento)

### Grupos e Perfis
- `GET /api/group/:sessionId/:groupId` - Metadados do grupo
- `GET /api/profile/:sessionId/:jid` - Foto de perfil

## ⚡ Recursos

- ✅ Heartbeat automático (25s)
- ✅ Reconexão com backoff exponencial
- ✅ Sincronização completa de contatos
- ✅ Upload de mídia para Supabase Storage
- ✅ Cache de grupos e fotos de perfil
- ✅ Apenas mensagens em tempo real (sem histórico)
- ✅ Suporte a grupos e mensagens individuais
