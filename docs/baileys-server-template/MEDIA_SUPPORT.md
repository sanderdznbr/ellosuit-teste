# 📸 Suporte a Mídia no Servidor Baileys

Este guia explica como adicionar suporte completo a mídia (imagens, áudios, vídeos, documentos) no servidor Baileys para o CRM WhatsApp.

## 📋 Visão Geral

Por padrão, o Baileys recebe mensagens de mídia mas **não baixa automaticamente** o conteúdo. Para exibir imagens e reproduzir áudios no CRM, você precisa:

1. Baixar a mídia usando o Baileys
2. Fazer upload para o Supabase Storage
3. Enviar a URL no webhook

## 🔧 Configuração do Supabase Storage

Primeiro, crie um bucket no Supabase para armazenar as mídias:

```sql
-- Execute no SQL Editor do Supabase
INSERT INTO storage.buckets (id, name, public)
VALUES ('whatsapp-media', 'whatsapp-media', true);

-- Política para permitir leitura pública
CREATE POLICY "Public read access for whatsapp-media"
ON storage.objects FOR SELECT
USING (bucket_id = 'whatsapp-media');

-- Política para upload via service role (edge functions)
CREATE POLICY "Service role can upload to whatsapp-media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'whatsapp-media');
```

## 📦 Dependências Adicionais

Adicione ao seu `package.json`:

```bash
npm install @supabase/supabase-js mime-types
```

## 🔑 Variáveis de Ambiente

Adicione ao seu `.env`:

```env
SUPABASE_URL=https://jwddiyuezqrpuakazvgg.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key_aqui
```

## 📝 Código para Download e Upload de Mídia

### Crie o arquivo `src/mediaHandler.ts`:

```typescript
import { downloadMediaMessage, WAMessage, WASocket } from '@whiskeysockets/baileys';
import { createClient } from '@supabase/supabase-js';
import mime from 'mime-types';
import crypto from 'crypto';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface MediaResult {
  url: string;
  mimeType: string;
  fileName: string;
}

/**
 * Downloads media from a WhatsApp message and uploads to Supabase Storage
 */
export async function processMediaMessage(
  socket: WASocket,
  msg: WAMessage,
  sessionId: string
): Promise<MediaResult | null> {
  try {
    const message = msg.message;
    if (!message) return null;

    // Determine media type and get message content
    let mediaType: string | null = null;
    let mediaMessage: any = null;
    let extension = '';

    if (message.imageMessage) {
      mediaType = 'image';
      mediaMessage = message.imageMessage;
      extension = 'jpg';
    } else if (message.videoMessage) {
      mediaType = 'video';
      mediaMessage = message.videoMessage;
      extension = 'mp4';
    } else if (message.audioMessage) {
      mediaType = 'audio';
      mediaMessage = message.audioMessage;
      extension = message.audioMessage.ptt ? 'ogg' : 'mp3';
    } else if (message.documentMessage) {
      mediaType = 'document';
      mediaMessage = message.documentMessage;
      extension = mediaMessage.fileName?.split('.').pop() || 'bin';
    } else if (message.stickerMessage) {
      mediaType = 'sticker';
      mediaMessage = message.stickerMessage;
      extension = 'webp';
    }

    if (!mediaType || !mediaMessage) {
      return null;
    }

    console.log(`📥 Downloading ${mediaType} media...`);

    // Download the media buffer
    const buffer = await downloadMediaMessage(
      msg,
      'buffer',
      {},
      {
        logger: console,
        reuploadRequest: socket.updateMediaMessage
      }
    );

    if (!buffer) {
      console.error('Failed to download media buffer');
      return null;
    }

    // Generate unique filename
    const timestamp = Date.now();
    const hash = crypto.randomBytes(8).toString('hex');
    const fileName = `${sessionId}/${mediaType}/${timestamp}-${hash}.${extension}`;

    // Get MIME type
    const mimeType = mediaMessage.mimetype || mime.lookup(extension) || 'application/octet-stream';

    console.log(`📤 Uploading to Supabase Storage: ${fileName}`);

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('whatsapp-media')
      .upload(fileName, buffer, {
        contentType: mimeType,
        upsert: false
      });

    if (error) {
      console.error('Supabase upload error:', error);
      return null;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('whatsapp-media')
      .getPublicUrl(fileName);

    console.log(`✅ Media uploaded: ${urlData.publicUrl}`);

    return {
      url: urlData.publicUrl,
      mimeType,
      fileName
    };

  } catch (error) {
    console.error('Error processing media:', error);
    return null;
  }
}

/**
 * Check if a message contains media
 */
export function hasMedia(msg: WAMessage): boolean {
  const message = msg.message;
  if (!message) return false;

  return !!(
    message.imageMessage ||
    message.videoMessage ||
    message.audioMessage ||
    message.documentMessage ||
    message.stickerMessage
  );
}
```

## 🔄 Atualize o Handler de Mensagens

No arquivo `src/whatsapp.ts`, atualize o handler `messages.upsert`:

```typescript
import { processMediaMessage, hasMedia } from './mediaHandler';

// ... dentro do createSession ...

// Handle incoming messages
socket.ev.on('messages.upsert', async ({ messages, type }) => {
  if (type !== 'notify') return;

  for (const msg of messages) {
    // Skip status messages
    if (msg.key.remoteJid === 'status@broadcast') continue;
    
    // Process media if present
    let mediaUrl: string | null = null;
    let mediaMimeType: string | null = null;
    
    if (hasMedia(msg)) {
      console.log(`📨 Media message from ${msg.key.remoteJid}`);
      
      const mediaResult = await processMediaMessage(socket, msg, sessionId);
      if (mediaResult) {
        mediaUrl = mediaResult.url;
        mediaMimeType = mediaResult.mimeType;
      }
    } else {
      console.log(`📨 Text message from ${msg.key.remoteJid}: ${msg.message?.conversation || '[empty]'}`);
    }
    
    await sendWebhook({
      event: 'messages.upsert',
      sessionId,
      instanceName,
      data: {
        messages: [{
          key: msg.key,
          message: msg.message,
          messageTimestamp: msg.messageTimestamp,
          pushName: msg.pushName,
          // 👇 Novos campos para mídia
          mediaUrl,
          mediaMimeType
        }]
      }
    });
  }
});
```

## 🔄 Atualize o Webhook (Edge Function)

O webhook do Supabase já está preparado para receber `media_url`. Você só precisa garantir que os campos `mediaUrl` e `mediaMimeType` sejam enviados pelo servidor Baileys.

No webhook (`supabase/functions/whatsapp-webhook/index.ts`), a linha que extrai a URL já existe:

```typescript
// Já implementado no webhook
let mediaUrl = msg.mediaUrl || '';  // ← Receberá a URL do servidor Baileys
```

## 📋 Tipos de Mídia Suportados

| Tipo | Extensão | Descrição |
|------|----------|-----------|
| `image` | jpg, png, gif | Fotos e imagens |
| `video` | mp4 | Vídeos |
| `audio` | ogg, mp3 | Mensagens de voz (PTT) e áudios |
| `document` | pdf, doc, etc | Documentos |
| `sticker` | webp | Figurinhas |

## ⚠️ Considerações Importantes

### Tamanho dos Arquivos
- WhatsApp limita imagens a ~16MB e vídeos a ~64MB
- Supabase Storage tem limite padrão de 50MB por arquivo
- Para arquivos maiores, considere compressão ou streaming

### Cleanup de Mídia Antiga
Para evitar uso excessivo de storage, implemente uma rotina de limpeza:

```typescript
// Exemplo: Deletar mídias com mais de 30 dias
async function cleanupOldMedia() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const { data, error } = await supabase.storage
    .from('whatsapp-media')
    .list('', { 
      limit: 1000,
      sortBy: { column: 'created_at', order: 'asc' }
    });
  
  // Filter and delete old files...
}
```

### Rate Limiting
O download de mídia consome banda. Para alto volume:
- Implemente fila de processamento (Bull, BullMQ)
- Processe mídia em background
- Considere CDN para servir arquivos

## 🧪 Testando

1. Envie uma imagem para o número conectado
2. Verifique os logs do servidor Baileys
3. Confirme que a URL aparece no console
4. Verifique no Supabase Storage se o arquivo foi criado
5. Abra o CRM e veja se a imagem é exibida

## 🐛 Troubleshooting

### Mídia não baixa
```
Error: Could not download media
```
- Verifique se a sessão ainda está conectada
- A mídia pode ter expirado (WhatsApp remove após ~30 dias)
- Tente reconectar a sessão

### Upload falha
```
Supabase upload error: { statusCode: 403 }
```
- Verifique a `SUPABASE_SERVICE_ROLE_KEY`
- Confirme que o bucket `whatsapp-media` existe
- Verifique as políticas RLS

### URL não aparece no CRM
- Confirme que o webhook está recebendo `mediaUrl`
- Verifique os logs da Edge Function
- Confirme que o campo `media_url` está sendo salvo no banco

## 📚 Referências

- [Baileys Media Download](https://github.com/WhiskeySockets/Baileys#downloading-media)
- [Supabase Storage](https://supabase.com/docs/guides/storage)
- [WhatsApp Media Types](https://developers.facebook.com/docs/whatsapp/on-premises/reference/media)
