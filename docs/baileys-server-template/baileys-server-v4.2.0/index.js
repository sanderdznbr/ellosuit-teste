/**
 * Baileys Server v4.2.0 - Estável e Simplificado
 * 
 * CORREÇÕES v4.2.0:
 * - Removida dependência do @supabase/supabase-js (usa fetch puro)
 * - QR Code gerado corretamente
 * - Metadados de grupos e contatos
 * - Reconexão automática com backoff
 */

const express = require('express');
const cors = require('cors');
const http = require('http');
const { 
  default: makeWASocket, 
  useMultiFileAuthState, 
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  downloadMediaMessage
} = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const pino = require('pino');
const fs = require('fs');
const path = require('path');

// Configuração
const PORT = process.env.PORT || 3333;
const SUPABASE_WEBHOOK_URL = process.env.SUPABASE_WEBHOOK_URL;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const logger = pino({ level: 'silent' });

// Express app
const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Armazena sessões ativas
const sessions = new Map();

// Controle de concorrência para downloads
const downloadSemaphore = {
  current: 0,
  max: 2,
  queue: []
};

async function acquireDownload() {
  if (downloadSemaphore.current < downloadSemaphore.max) {
    downloadSemaphore.current++;
    return true;
  }
  return new Promise(resolve => {
    downloadSemaphore.queue.push(resolve);
  });
}

function releaseDownload() {
  downloadSemaphore.current--;
  if (downloadSemaphore.queue.length > 0) {
    const next = downloadSemaphore.queue.shift();
    downloadSemaphore.current++;
    next(true);
  }
}

// Função para buscar metadados de contato/grupo
async function fetchContactMetadata(socket, jid) {
  const metadata = {
    profilePicture: null,
    status: null,
    groupSubject: null,
    groupDescription: null,
    groupParticipants: null
  };

  const isGroup = jid.endsWith('@g.us');

  try {
    // Foto de perfil
    try {
      metadata.profilePicture = await socket.profilePictureUrl(jid, 'image');
    } catch (e) {}

    if (isGroup) {
      try {
        const groupMeta = await socket.groupMetadata(jid);
        metadata.groupSubject = groupMeta.subject || null;
        metadata.groupDescription = groupMeta.desc || null;
        metadata.groupParticipants = groupMeta.participants?.map(p => ({
          jid: p.id,
          isAdmin: p.admin === 'admin' || p.admin === 'superadmin',
          isSuperAdmin: p.admin === 'superadmin'
        })) || [];
      } catch (e) {
        console.log(`Erro metadados grupo ${jid}:`, e.message);
      }
    } else {
      try {
        const statusResult = await socket.fetchStatus(jid);
        if (statusResult?.status) {
          metadata.status = statusResult.status;
        }
      } catch (e) {}
    }
  } catch (e) {
    console.error(`Erro metadados ${jid}:`, e.message);
  }

  return metadata;
}

// Enviar webhook via fetch puro
async function sendWebhook(payload, webhookUrl, webhookSecret) {
  if (!webhookUrl) return;

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': webhookSecret || ''
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      console.error('Webhook error:', response.status);
    }
  } catch (error) {
    console.error('Webhook fetch error:', error.message);
  }
}

// Criar sessão WhatsApp
async function createSession(config) {
  const { sessionId, instanceName, webhookUrl, webhookSecret } = config;
  
  if (sessions.has(sessionId)) {
    console.log(`Sessão ${instanceName} já existe`);
    return sessions.get(sessionId);
  }

  const sessionPath = path.join(__dirname, 'sessions', instanceName);
  
  if (!fs.existsSync(path.join(__dirname, 'sessions'))) {
    fs.mkdirSync(path.join(__dirname, 'sessions'), { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
  const { version } = await fetchLatestBaileysVersion();
  
  console.log(`📱 Criando sessão: ${instanceName} (Baileys v${version.join('.')})`);

  const session = {
    sessionId,
    instanceName,
    socket: null,
    webhookUrl,
    webhookSecret,
    qrCode: null,
    isConnected: false,
    phoneNumber: null,
    pushName: null,
    profilePicture: null,
    reconnectAttempts: 0,
    maxReconnectAttempts: 10
  };

  sessions.set(sessionId, session);

  const socket = makeWASocket({
    version,
    logger,
    printQRInTerminal: true,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger)
    },
    browser: ['Lovable CRM', 'Chrome', '120.0.0'],
    connectTimeoutMs: 60000,
    qrTimeout: 60000,
    defaultQueryTimeoutMs: 60000,
    keepAliveIntervalMs: 20000
  });

  session.socket = socket;

  // Salvar credenciais
  socket.ev.on('creds.update', saveCreds);

  // Atualizações de conexão
  socket.ev.on('connection.update', async (update) => {
    const { qr, connection, lastDisconnect } = update;

    if (qr) {
      try {
        const qrDataUrl = await QRCode.toDataURL(qr);
        session.qrCode = qrDataUrl;
        
        await sendWebhook({
          event: 'qr.update',
          sessionId,
          instanceName,
          data: { qrCode: qrDataUrl }
        }, webhookUrl, webhookSecret);
        
        console.log(`📱 QR Code gerado para ${instanceName}`);
      } catch (qrError) {
        console.error('Erro ao gerar QR Code:', qrError.message);
      }
    }

    if (connection === 'open') {
      session.isConnected = true;
      session.qrCode = null;
      session.reconnectAttempts = 0;
      
      const user = socket.user;
      if (user) {
        session.phoneNumber = user.id.split(':')[0].replace('@s.whatsapp.net', '');
        session.pushName = user.name || user.notify || null;
        
        try {
          session.profilePicture = await socket.profilePictureUrl(user.id, 'image');
        } catch (e) {}
      }
      
      await sendWebhook({
        event: 'connection.update',
        sessionId,
        instanceName,
        data: {
          connection: 'open',
          isConnected: true,
          phoneNumber: session.phoneNumber,
          pushName: session.pushName,
          profilePicture: session.profilePicture
        }
      }, webhookUrl, webhookSecret);
      
      console.log(`✅ ${instanceName} conectado!`);
    }

    if (connection === 'close') {
      session.isConnected = false;
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      
      console.log(`❌ ${instanceName} desconectado. Código: ${statusCode}`);
      
      await sendWebhook({
        event: 'connection.update',
        sessionId,
        instanceName,
        data: {
          connection: 'close',
          isConnected: false,
          statusCode,
          shouldReconnect
        }
      }, webhookUrl, webhookSecret);

      if (shouldReconnect && session.reconnectAttempts < session.maxReconnectAttempts) {
        session.reconnectAttempts++;
        const delay = Math.min(5000 * Math.pow(1.5, session.reconnectAttempts - 1), 60000);
        console.log(`🔄 Reconectando em ${delay/1000}s`);
        
        setTimeout(() => {
          sessions.delete(sessionId);
          createSession(config);
        }, delay);
      } else if (statusCode === DisconnectReason.loggedOut) {
        sessions.delete(sessionId);
      }
    }
  });

  // Sync inicial: chats, contatos e histórico (última 1h)
  socket.ev.on('messaging-history.set', async ({ chats = [], contacts = [], messages = [], isLatest }) => {
    try {
      console.log(`📥 History set: chats=${chats.length} contacts=${contacts.length} messages=${messages.length} latest=${isLatest}`);

      if (contacts && contacts.length > 0) {
        await sendWebhook({
          event: 'contacts.set',
          sessionId,
          instanceName,
          data: { contacts }
        }, webhookUrl, webhookSecret);
      }

      const MAX_CHAT_ENRICH = 120;
      const enrichedChats = [];
      for (const chat of (chats || []).slice(0, MAX_CHAT_ENRICH)) {
        try {
          const jid = chat?.id || chat?.jid;
          if (!jid || jid === 'status@broadcast') continue;

          const meta = await fetchContactMetadata(socket, jid);
          const isGroup = jid.endsWith('@g.us');

          const enriched = {
            ...chat,
            id: jid,
            jid,
            profilePicture: meta.profilePicture || chat.profilePicture || chat.imgUrl || null,
          };

          if (isGroup) {
            enriched.groupSubject = meta.groupSubject || chat.groupSubject || chat.subject || chat.name || null;
            enriched.metadata = {
              ...(chat.metadata || {}),
              subject: meta.groupSubject || chat.groupSubject || chat.subject || chat.name || null,
              desc: meta.groupDescription || null,
              participants: meta.groupParticipants || null,
            };
          }

          enrichedChats.push(enriched);
        } catch (e) {
          console.log('Erro ao enriquecer chat:', e?.message || e);
        }
      }

      if (enrichedChats.length > 0) {
        await sendWebhook({
          event: 'chats.set',
          sessionId,
          instanceName,
          data: { chats: enrichedChats }
        }, webhookUrl, webhookSecret);
      }

      const ONE_HOUR_MS = 60 * 60 * 1000;
      const cutoff = Date.now() - ONE_HOUR_MS;

      const toMs = (ts) => {
        try {
          if (!ts) return null;
          if (typeof ts === 'number') return ts > 4102444800 ? ts : ts * 1000;
          if (typeof ts === 'string') {
            const n = parseInt(ts, 10);
            if (!isNaN(n)) return n > 4102444800 ? n : n * 1000;
          }
          if (typeof ts === 'object' && ts !== null) {
            if (typeof ts.low === 'number') return ts.low * 1000;
            if (typeof ts.toNumber === 'function') return ts.toNumber() * 1000;
          }
          return null;
        } catch {
          return null;
        }
      };

      const metadataCache = new Map();
      const groupNameCache = new Map();
      for (const c of enrichedChats) {
        if (c?.id && c?.groupSubject) groupNameCache.set(c.id, c.groupSubject);
      }

      const recent = (messages || []).filter((m) => {
        const ms = toMs(m?.messageTimestamp);
        return ms && ms >= cutoff;
      });

      const BATCH = 10;
      for (let i = 0; i < recent.length; i += BATCH) {
        const slice = recent.slice(i, i + BATCH);

        const mapped = [];
        for (const m of slice) {
          const jid = m?.key?.remoteJid;
          if (!jid || jid === 'status@broadcast') continue;

          let meta = metadataCache.get(jid);
          if (!meta) {
            meta = await fetchContactMetadata(socket, jid);
            metadataCache.set(jid, meta);
          }

          const isGroup = jid.endsWith('@g.us');
          const participant = m?.key?.participant;

          const senderPhone = isGroup && participant ? participant.split('@')[0].replace(/\D/g, '') : undefined;
          const senderName = isGroup ? (m?.pushName || null) : undefined;
          const groupName = isGroup ? (groupNameCache.get(jid) || meta.groupSubject || null) : undefined;

          mapped.push({
            key: m.key,
            message: m.message,
            messageTimestamp: m.messageTimestamp,
            pushName: m.pushName,
            senderPhone,
            senderName,
            groupName,
            mediaUrl: null,
            mediaType: null,
            contactMetadata: meta,
          });
        }

        if (mapped.length > 0) {
          await sendWebhook({
            event: 'messages.upsert',
            sessionId,
            instanceName,
            data: { messages: mapped }
          }, webhookUrl, webhookSecret);
        }
      }

      console.log(`✅ Sync inicial concluído: chats=${enrichedChats.length} msgs_1h=${recent.length}`);
    } catch (e) {
      console.log('❌ Erro no sync inicial:', e?.message || e);
    }
  });

  // Mensagens recebidas
  socket.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      if (msg.key.remoteJid === 'status@broadcast') continue;
      
      const jid = msg.key.remoteJid;
      console.log(`📨 Mensagem de ${jid}`);
      
      // Buscar metadados
      const metadata = await fetchContactMetadata(socket, jid);
      
      // Detectar mídia
      let mediaUrl = null;
      let mediaType = null;
      const msgContent = msg.message;
      
      if (msgContent) {
        if (msgContent.imageMessage) mediaType = 'image';
        else if (msgContent.videoMessage) mediaType = 'video';
        else if (msgContent.audioMessage) mediaType = 'audio';
        else if (msgContent.documentMessage) mediaType = 'document';
        else if (msgContent.stickerMessage) mediaType = 'sticker';
      }

      // Download de mídia
      if (mediaType && !msg.key.fromMe && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
        try {
          await acquireDownload();
          const buffer = await downloadMediaMessage(msg, 'buffer', {});
          
          if (buffer) {
            const ext = mediaType === 'audio' ? 'ogg' : mediaType === 'video' ? 'mp4' : 'jpg';
            const fileName = `${sessionId}/${Date.now()}_${msg.key.id}.${ext}`;
            
            const uploadResponse = await fetch(
              `${SUPABASE_URL}/storage/v1/object/whatsapp-media/${fileName}`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                  'Content-Type': 'application/octet-stream'
                },
                body: buffer
              }
            );

            if (uploadResponse.ok) {
              mediaUrl = `${SUPABASE_URL}/storage/v1/object/public/whatsapp-media/${fileName}`;
            }
          }
        } catch (e) {
          console.error('Erro download mídia:', e.message);
        } finally {
          releaseDownload();
        }
      }

      // Enviar webhook
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
            mediaUrl,
            mediaType,
            contactMetadata: metadata
          }]
        }
      }, webhookUrl, webhookSecret);
    }
  });

  // Atualização de status
  socket.ev.on('messages.update', async (updates) => {
    await sendWebhook({
      event: 'messages.update',
      sessionId,
      instanceName,
      data: { updates }
    }, webhookUrl, webhookSecret);
  });

  // Contatos
  socket.ev.on('contacts.set', async ({ contacts }) => {
    console.log(`📇 ${contacts.length} contatos recebidos`);
    await sendWebhook({
      event: 'contacts.set',
      sessionId,
      instanceName,
      data: { contacts }
    }, webhookUrl, webhookSecret);
  });

  socket.ev.on('contacts.upsert', async (contacts) => {
    await sendWebhook({
      event: 'contacts.upsert',
      sessionId,
      instanceName,
      data: { contacts }
    }, webhookUrl, webhookSecret);
  });

  return session;
}

// ============ ROTAS ============

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    version: '4.2.0',
    sessions: sessions.size,
    timestamp: new Date().toISOString()
  });
});

// Criar instância
app.post('/api/instance/create', async (req, res) => {
  try {
    const { sessionId, instanceName, webhookUrl, webhookSecret } = req.body;
    
    if (!sessionId || !instanceName) {
      return res.status(400).json({ error: 'sessionId e instanceName são obrigatórios' });
    }
    
    const session = await createSession({
      sessionId,
      instanceName,
      webhookUrl: webhookUrl || SUPABASE_WEBHOOK_URL,
      webhookSecret: webhookSecret || ''
    });
    
    res.json({
      success: true,
      sessionId: session?.sessionId,
      instanceName: session?.instanceName,
      qrCode: session?.qrCode
    });
  } catch (error) {
    console.error('Erro criar instância:', error);
    res.status(500).json({ error: 'Falha ao criar instância' });
  }
});

// Obter QR Code
app.get('/api/instance/:instanceName/qr', (req, res) => {
  const session = Array.from(sessions.values()).find(s => s.instanceName === req.params.instanceName);
  
  if (!session) {
    return res.status(404).json({ error: 'Sessão não encontrada' });
  }
  
  res.json({
    qrCode: session.qrCode,
    isConnected: session.isConnected
  });
});

// Status da instância
app.get('/api/instance/:instanceName/status', (req, res) => {
  const session = Array.from(sessions.values()).find(s => s.instanceName === req.params.instanceName);
  
  if (!session) {
    return res.status(404).json({ error: 'Sessão não encontrada' });
  }
  
  res.json({
    status: session.isConnected ? 'connected' : 'disconnected',
    isConnected: session.isConnected,
    phoneNumber: session.phoneNumber,
    pushName: session.pushName,
    profilePicture: session.profilePicture
  });
});

// Logout
app.post('/api/instance/:instanceName/logout', async (req, res) => {
  const session = Array.from(sessions.values()).find(s => s.instanceName === req.params.instanceName);
  
  if (!session) {
    return res.status(404).json({ error: 'Sessão não encontrada' });
  }
  
  try {
    if (session.socket) {
      await session.socket.logout();
    }
    sessions.delete(session.sessionId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Deletar instância
app.delete('/api/instance/:instanceName/delete', async (req, res) => {
  const session = Array.from(sessions.values()).find(s => s.instanceName === req.params.instanceName);
  
  if (!session) {
    return res.status(404).json({ error: 'Sessão não encontrada' });
  }
  
  try {
    if (session.socket) {
      await session.socket.logout();
    }
    
    const sessionPath = path.join(__dirname, 'sessions', session.instanceName);
    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true });
    }
    
    sessions.delete(session.sessionId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Listar instâncias
app.get('/api/instance/list', (req, res) => {
  const sessionList = Array.from(sessions.values()).map(s => ({
    sessionId: s.sessionId,
    instanceName: s.instanceName,
    isConnected: s.isConnected,
    phoneNumber: s.phoneNumber,
    pushName: s.pushName
  }));
  
  res.json({ sessions: sessionList });
});

// Enviar mensagem
app.post('/api/message/send', async (req, res) => {
  try {
    const { instanceName, jid, message } = req.body;
    
    const session = Array.from(sessions.values()).find(s => s.instanceName === instanceName);
    if (!session || !session.socket || !session.isConnected) {
      return res.status(404).json({ error: 'Sessão não encontrada ou desconectada' });
    }
    
    const result = await session.socket.sendMessage(jid, message);
    
    res.json({
      success: true,
      messageId: result.key.id,
      key: result.key
    });
  } catch (error) {
    console.error('Erro enviar:', error);
    res.status(500).json({ error: 'Falha ao enviar' });
  }
});

// Enviar mídia
app.post('/api/message/send-media', async (req, res) => {
  try {
    const { instanceName, jid, mediaUrl, mediaType, caption } = req.body;
    
    const session = Array.from(sessions.values()).find(s => s.instanceName === instanceName);
    if (!session || !session.socket || !session.isConnected) {
      return res.status(404).json({ error: 'Sessão não encontrada' });
    }
    
    let messageContent;
    switch (mediaType) {
      case 'image':
        messageContent = { image: { url: mediaUrl }, caption };
        break;
      case 'video':
        messageContent = { video: { url: mediaUrl }, caption };
        break;
      case 'audio':
        messageContent = { audio: { url: mediaUrl }, mimetype: 'audio/mp4', ptt: false };
        break;
      case 'document':
        messageContent = { document: { url: mediaUrl }, fileName: caption || 'document' };
        break;
      default:
        messageContent = { image: { url: mediaUrl }, caption };
    }
    
    const result = await session.socket.sendMessage(jid, messageContent);
    res.json({ success: true, messageId: result.key.id });
  } catch (error) {
    res.status(500).json({ error: 'Falha ao enviar mídia' });
  }
});

// Enviar voz
app.post('/api/message/send-voice', async (req, res) => {
  try {
    const { instanceName, jid, audioUrl } = req.body;
    
    const session = Array.from(sessions.values()).find(s => s.instanceName === instanceName);
    if (!session || !session.socket || !session.isConnected) {
      return res.status(404).json({ error: 'Sessão não encontrada' });
    }
    
    const result = await session.socket.sendMessage(jid, {
      audio: { url: audioUrl },
      mimetype: 'audio/ogg; codecs=opus',
      ptt: true
    });
    
    res.json({ success: true, messageId: result.key.id });
  } catch (error) {
    res.status(500).json({ error: 'Falha ao enviar voz' });
  }
});

// Marcar como lido
app.post('/api/message/read', async (req, res) => {
  try {
    const { instanceName, keys } = req.body;
    
    const session = Array.from(sessions.values()).find(s => s.instanceName === instanceName);
    if (!session || !session.socket || !session.isConnected) {
      return res.status(404).json({ error: 'Sessão não encontrada' });
    }
    
    await session.socket.readMessages(keys);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Falha ao marcar como lido' });
  }
});

// Sincronizar dados manualmente (fotos, contatos, mensagens recentes)
app.post('/api/sync', async (req, res) => {
  try {
    const { sessionId, instanceName } = req.body;
    
    let session;
    if (sessionId) {
      session = sessions.get(sessionId);
    } else if (instanceName) {
      session = Array.from(sessions.values()).find(s => s.instanceName === instanceName);
    }
    
    if (!session || !session.socket || !session.isConnected) {
      return res.status(404).json({ error: 'Sessão não conectada' });
    }
    
    console.log('🔄 Iniciando sincronização manual...');
    
    const synced = { contacts: 0, groups: 0, messages: 0 };
    
    // 1. Sincronizar contatos e fotos
    try {
      const store = session.socket.store || {};
      const chats = store.chats?.all() || [];
      
      for (const chat of chats.slice(0, 100)) {
        const jid = chat.id;
        if (!jid || jid === 'status@broadcast') continue;
        
        try {
          const metadata = await fetchContactMetadata(session.socket, jid);
          const isGroup = jid.endsWith('@g.us');
          const phone = jid.split('@')[0];
          
          // Enviar para webhook
          await sendToWebhook('sync.contact', {
            sessionId: session.sessionId,
            instanceName: session.instanceName,
            jid,
            phone,
            isGroup,
            name: metadata.groupSubject || chat.name || null,
            profilePicture: metadata.profilePicture,
            groupDescription: metadata.groupDescription,
            groupParticipants: metadata.groupParticipants
          });
          
          synced.contacts++;
          if (isGroup) synced.groups++;
          
          // Pequena pausa para não sobrecarregar
          await new Promise(r => setTimeout(r, 100));
        } catch (e) {
          console.log(`Erro sync ${jid}:`, e.message);
        }
      }
    } catch (e) {
      console.log('Erro ao sincronizar contatos:', e.message);
    }
    
    console.log(`✅ Sync concluído: ${synced.contacts} contatos, ${synced.groups} grupos`);
    res.json({ success: true, synced });
    
  } catch (error) {
    console.error('Erro na sincronização:', error);
    res.status(500).json({ error: 'Falha na sincronização' });
  }
});

// Iniciar servidor
server.listen(PORT, () => {
  console.log(`🚀 Baileys Server v4.2.0 rodando na porta ${PORT}`);
  console.log(`📡 Webhook: ${SUPABASE_WEBHOOK_URL || 'não configurado'}`);
});
