# Baileys Server v4.6.0

Servidor WhatsApp baseado na biblioteca Baileys para integração com o CRM WhatsApp do Lovable.

## 🆕 Novidades v4.6.0

- **Sync proativo de metadados**: Busca fotos e nomes de TODOS os chats imediatamente após conexão
- **Função syncAllMetadata**: Nova função que itera todos os chats e envia webhook `contact.metadata`
- **Histórico estendido**: Sincroniza mensagens das últimas **6 HORAS**
- **Suporte a stickers**: Download e armazenamento de figurinhas
- **Cache de nomes**: Cache global de nomes de contatos por JID

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
- `GET /api/health` - Status do servidor (inclui `historyHours: 6`)

### Instâncias
- `POST /api/instance/create` - Criar nova sessão
- `GET /api/instance/:instanceName/qr` - Obter QR Code
- `GET /api/instance/:instanceName/status` - Status da sessão (inclui contagem)
- `GET /api/instance/list` - Listar todas as sessões
- `DELETE /api/instance/:instanceName` - Remover sessão

### Contatos e Chats
- `POST /api/sync/contacts` - Sync paginado de contatos com fotos
- `POST /api/sync/chats` - Sync paginado de chats com metadados

### Mensagens
- `POST /api/message/send` - Enviar mensagem de texto
- `POST /api/message/send-media` - Enviar mídia
- `POST /api/message/send-voice` - Enviar áudio PTT
- `POST /api/message/read` - Marcar como lido

## ⚡ Recursos

- ✅ **Sync proativo** - Busca fotos logo após conexão (novo!)
- ✅ **6 horas de histórico** - Mensagens antigas
- ✅ **Stickers** - Download e armazenamento
- ✅ **Cache de nomes** - Nomes de contatos sempre disponíveis
- ✅ Heartbeat automático (20s)
- ✅ Reconexão com backoff exponencial
- ✅ Upload de mídia para Supabase Storage

## 📊 Comparação de versões

| Recurso | v4.5.0 | v4.6.0 |
|---------|--------|--------|
| Histórico | 6 horas | 6 horas |
| Sync de fotos | No chats.set | **Proativo após conexão** |
| Webhook metadados | Não | **contact.metadata** |
| Cache de nomes | Básico | **Global por JID** |

## 🔄 Fluxo de Sincronização v4.6.0

1. Conexão estabelecida (`connection.open`)
2. Aguarda 3 segundos para estabilização
3. `syncAllMetadata()` é chamada automaticamente
4. Para cada chat no cache:
   - Busca `profilePictureUrl()`
   - Se grupo: busca `groupMetadata()`
   - Envia webhook `contact.metadata` com dados
5. Mensagens das últimas 6h são processadas em paralelo

## 📦 Arquivos incluídos

- `package.json` - Baileys v6.7.17
- `index.js` - Servidor v4.6.0 com sync proativo
- `.env.example` - Variáveis de ambiente
- `README.md` - Esta documentação
