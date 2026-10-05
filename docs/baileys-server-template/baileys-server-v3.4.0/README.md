# 🚀 Baileys Server v3.4.0 - Metadata de Grupos Completo

Servidor Baileys completo com suporte a **mídias**, **grupos** e **sincronização completa de histórico**.

## ✅ Novidades v3.4.0

### Melhorias:
- ✅ **Metadata de Grupos no History Sync** - Busca nomes dos grupos automaticamente durante sincronização de histórico
- ✅ **Cache de Metadados** - Performance otimizada (não busca metadata duplicado)
- ✅ **Melhor identificação de remetentes** - Em mensagens de grupo durante sync de histórico

## ✅ Funcionalidades v3.3.0

### Principais:
- ✅ **SYNC COMPLETO DE HISTÓRICO** - Sincroniza todas as conversas ao conectar
- ✅ **Handler messaging-history.set** - Recebe mensagens históricas
- ✅ **Handler chats.set** - Recebe lista de chats inicial
- ✅ **Processamento em batches** - Evita timeout com muitos dados
- ✅ **Nome do Grupo Correto** - Busca metadados do grupo para exibir nome real
- ✅ **Identificação de Remetentes** - Mostra quem enviou cada mensagem nos grupos
- ✅ **Suporte a Mídias** - Imagens, vídeos, áudios, documentos e stickers
- ✅ **Upload para Supabase Storage** - Mídias são salvas no bucket whatsapp-media

## 📁 Arquivos

- `package.json` - Dependências do projeto
- `index.js` - Código do servidor (arquivo único)

## 🔧 Instalação

### 1. Criar pasta e copiar arquivos

```bash
mkdir baileys-server
cd baileys-server
# Copie os arquivos package.json e index.js para esta pasta
```

### 2. Instalar dependências

```bash
npm install
```

### 3. Configurar variáveis de ambiente

Crie um arquivo `.env`:

```env
# Webhook do Supabase (Edge Function)
SUPABASE_WEBHOOK_URL=https://jwddiyuezqrpuakazvgg.supabase.co/functions/v1/whatsapp-webhook

# Supabase Storage (para upload de mídias)
SUPABASE_URL=https://jwddiyuezqrpuakazvgg.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key_aqui
```

**Onde pegar a SUPABASE_SERVICE_ROLE_KEY:**
1. Acesse o Dashboard do Supabase
2. Vá em Settings > API
3. Copie a "service_role key" (NÃO a anon key!)

### 4. Iniciar o servidor

```bash
npm start
```

Você deve ver:
```
============================================
🚀 Baileys Server v3.4.0 running on port XXXX
============================================
📡 Webhook URL: https://...
📸 Media Support: ✅ Enabled
📜 History Sync: ✅ Enabled
============================================
```

## 🚀 Deploy no Railway

### 1. Crie um repositório GitHub
Faça upload dos arquivos (`package.json` e `index.js`)

**IMPORTANTE:** Se já tem o servidor, substitua TODOS os arquivos e delete a pasta `sessions/`

### 2. No Railway
1. New Project > Deploy from GitHub repo
2. Selecione seu repositório
3. Configure as variáveis de ambiente:

| Variável | Valor |
|----------|-------|
| `SUPABASE_WEBHOOK_URL` | `https://jwddiyuezqrpuakazvgg.supabase.co/functions/v1/whatsapp-webhook` |
| `SUPABASE_URL` | `https://jwddiyuezqrpuakazvgg.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Sua service role key |

**⚠️ NÃO defina PORT** - Railway configura automaticamente!

### 3. Deploy
Clique em "Deploy" e aguarde. Você verá a URL do seu servidor nos logs.

### 4. Atualizar no CRM
Copie a URL do Railway (ex: `https://baileys-server-xxx.up.railway.app`) e atualize no CRM WhatsApp.

## 📋 Funcionalidades

### ✅ Sincronização Completa de Histórico
- `chats.set` - Lista inicial de conversas ao conectar
- `messaging-history.set` - Mensagens históricas com metadata de grupos
- Processamento em batches para evitar timeout
- Cache de metadados de grupos para performance

### ✅ Suporte Completo a Grupos
- Nome do remetente extraído automaticamente
- Telefone do remetente para mensagens de grupo
- Busca metadados do grupo para nome correto
- **v3.4.0: Metadata também para histórico**

### ✅ Suporte a Mídias
| Tipo | Extensão | Upload automático |
|------|----------|-------------------|
| Imagem | jpg | ✅ |
| Vídeo | mp4 | ✅ |
| Áudio | mp3 | ✅ |
| PTT (voz) | ogg | ✅ |
| Documento | pdf, doc, etc | ✅ |
| Sticker | webp | ✅ |

## 🔗 API Endpoints

### Health Check
```
GET /api/health
```

### Criar Sessão
```
POST /api/instance/create
Body: { sessionId, instanceName, webhookSecret }
```

### Obter QR Code
```
GET /api/instance/:sessionId/qr
```

### Status da Sessão
```
GET /api/instance/:sessionId/status
```

### Enviar Mensagem de Texto
```
POST /api/message/send-text
Body: { sessionId, phone, message }
```

### Enviar Mídia
```
POST /api/message/send-media
Body: { sessionId, phone, mediaUrl, mediaType, caption, fileName }
mediaType: 'image' | 'video' | 'audio' | 'ptt' | 'document'
```

## ❓ Troubleshooting

### Grupos mostram ID numérico ao invés de nome
1. Atualize para v3.4.0 (busca metadata durante history sync)
2. Delete a pasta `sessions/` no Railway
3. Reconecte o WhatsApp

### Conversas não sincronizam ao conectar
1. Verifique os logs: deve mostrar `[CHATS.SET]` e `[HISTORY SYNC]`
2. Se não aparecer, atualize para v3.4.0
3. Delete a pasta `sessions/` no Railway e reconecte

### Mídias não aparecem no CRM
1. Verifique se `SUPABASE_SERVICE_ROLE_KEY` está configurada
2. Verifique os logs: deve mostrar "Media Support: ✅ Enabled"
3. Confirme que o bucket `whatsapp-media` existe e é público no Supabase

### Grupos mostram remetente vazio
- A v3.4.0 inclui metadata completo nos grupos
- Verifique os logs: deve mostrar `👥 Group:` e `👤 Sender:`

### QR Code não aparece
- Verifique os logs do servidor
- Certifique-se de que `SUPABASE_WEBHOOK_URL` está correta

### Servidor não conecta
- Verifique se a porta não está em uso
- No Railway, NÃO defina a variável PORT manualmente
