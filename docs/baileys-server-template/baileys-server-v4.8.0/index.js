/**
 * Baileys Server v4.8.0 - Media Download Endpoint & Message Cache
 * 
 * NOVIDADES v4.8.0:
 * - ENDPOINT /api/media/download para download de mídia sob demanda
 * - Cache de mensagens recentes (últimas 500 por sessão) para re-download
 * - Upload de mídia com retry (3 tentativas)
 * - Melhor logging de erros de mídia
 * 
 * Mantém tudo do v4.7.0:
 * - ENDPOINT /api/number/check para validar números via onWhatsApp()
 * - SYNC PROATIVO de metadados após conexão
 * - Cache global de nomes de contatos por JID
 * - Download de STICKERS para storage
 * - Histórico de mensagens: últimas 6 horas
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

// Cache de nomes de contatos por JID (para enriquecer mensagens)
const contactNamesCache = new Map();

// v4.8.0: Cache de mensagens recentes por sessão (para re-download de mídia)
// Map<sessionId, Map<messageId, WAMessage>>
const messageCache = new Map();
const MAX_CACHED_MESSAGES = 500;

function cacheMessage(sessionId, msg) {
  if (!messageCache.has(sessionId)) {
    messageCache.set(sessionId, new Map());
  }
  const cache = messageCache.get(sessionId);
  cache.set(msg.key.id, msg);
  
  // Limpar mensagens antigas se exceder o limite
  if (cache.size > MAX_CACHED_MESSAGES) {
    const keys = Array.from(cache.keys());
    for (let i = 0; i < keys.length - MAX_CACHED_MESSAGES; i++) {
      cache.delete(keys[i]);
    }
  }
}

// Controle de concorrência para downloads
const downloadSemaphore = {
  current: 0,
  max: 5,
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

// Helper para delay
const delay = (ms) => new Promise(r => setTimeout(r, ms));

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

// SYNC PROATIVO DE METADADOS
async function syncAllMetadata(socket, session, webhookUrl, webhookSecret, sessionId, instanceName) {
  try {
    const chats = Array.from(session.allChats.values());
    console.log(`📸 Sincronizando metadados para ${chats.length} chats...`);
    
    let processed = 0;
    const BATCH_SIZE = 10;
    
    for (let i = 0; i < chats.length; i += BATCH_SIZE) {
      const batch = chats.slice(i, i + BATCH_SIZE);
      
      for (const chat of batch) {
        const jid = chat.id || chat.jid;
        if (!jid || jid === 'status@broadcast') continue;
        
        try {
          const metadata = await fetchContactMetadata(socket, jid);
          const isGroup = jid.endsWith('@g.us');
          
          let contactName = null;
          if (isGroup) {
            contactName = metadata.groupSubject || chat.subject || chat.name || null;
          } else {
            contactName = contactNamesCache.get(jid) || chat.name || chat.notify || null;
          }
          
          if (metadata.profilePicture || contactName) {
            await sendWebhook({
              event: 'contact.metadata',
              sessionId,
              instanceName,
              data: {
                jid,
                phone: jid.split('@')[0].replace(/\D/g, ''),
                name: contactName,
                profilePicture: metadata.profilePicture,
                isGroup,
                groupSubject: isGroup ? contactName : null,
                groupDescription: metadata.groupDescription,
                groupParticipants: metadata.groupParticipants
              }
            }, webhookUrl, webhookSecret);
          }
          
          processed++;
        } catch (e) {}
      }
      
      if (i + BATCH_SIZE < chats.length) {
        await delay(300);
      }
    }
    
    console.log(`✅ Metadados sincronizados: ${processed}/${chats.length} chats`);
  } catch (e) {
    console.error('Erro sync metadados:', e.message);
  }
}

// Upload mídia para Supabase storage com retry
async function uploadMediaToStorage(buffer, sessionId, messageId, mediaType, retries = 3) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !buffer) return null;
  
  const extMap = {
    'image': 'jpg',
    'video': 'mp4',
    'audio': 'ogg',
    'ptt': 'ogg',
    'document': 'pdf',
    'sticker': 'webp'
  };
  const ext = extMap[mediaType] || 'bin';
  const fileName = `${sessionId}/${Date.now()}_${messageId}.${ext}`;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
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
        const url = `${SUPABASE_URL}/storage/v1/object/public/whatsapp-media/${fileName}`;
        console.log(`📤 Mídia ${mediaType} uploaded (attempt ${attempt}): ${url.substring(0, 80)}`);
        return url;
      } else {
        const errText = await uploadResponse.text();
        console.error(`📤 Upload attempt ${attempt} failed (${uploadResponse.status}): ${errText}`);
      }
    } catch (e) {
      console.error(`📤 Upload attempt ${attempt} error:`, e.message);
    }
    
    if (attempt < retries) {
      await delay(1000 * attempt);
    }
  }
  
  console.error(`📤 ❌ All ${retries} upload attempts failed for ${mediaType} ${messageId}`);
  return null;
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

// v4.8.0: Download de mídia a partir do cache de mensagens
async function downloadMediaFromCache(sessionId, messageId) {
  const cache = messageCache.get(sessionId);
  if (!cache) {
    console.log(`🎙️ [MEDIA-DL] No message cache for session ${sessionId}`);
    return null;
  }
  
  const msg = cache.get(messageId);
  if (!msg) {
    console.log(`🎙️ [MEDIA-DL] Message ${messageId} not found in cache (${cache.size} cached)`);
    return null;
  }
  
  const session = Array.from(sessions.values()).find(s => s.sessionId === sessionId);
  if (!session || !session.socket || !session.isConnected) {
    console.log(`🎙️ [MEDIA-DL] Session not connected for ${sessionId}`);
    return null;
  }
  
  try {
    await acquireDownload();
    console.log(`🎙️ [MEDIA-DL] Downloading media for message ${messageId}...`);
    const buffer = await downloadMediaMessage(msg, 'buffer', {});
    
    if (buffer && buffer.length > 0) {
      console.log(`🎙️ [MEDIA-DL] Downloaded ${buffer.length} bytes for ${messageId}`);
      return buffer;
    } else {
      console.log(`🎙️ [MEDIA-DL] Empty buffer for ${messageId}`);
      return null;
    }
  } catch (e) {
    console.error(`🎙️ [MEDIA-DL] Download error for ${messageId}:`, e.message);
    return null;
  } finally {
    releaseDownload();
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
    maxReconnectAttempts: 10,
    allContacts: new Map(),
    allChats: new Map()
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
    keepAliveIntervalMs: 20000,
    syncFullHistory: true
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
      
      // Sync proativo de metadados após conexão
      setTimeout(async () => {
        console.log(`📸 Iniciando sync proativo de metadados para ${instanceName}...`);
        await syncAllMetadata(socket, session, webhookUrl, webhookSecret, sessionId, instanceName);
      }, 3000);
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
        const reconnectDelay = Math.min(5000 * Math.pow(1.5, session.reconnectAttempts - 1), 60000);
        console.log(`🔄 Reconectando em ${reconnectDelay/1000}s`);
        
        setTimeout(() => {
          sessions.delete(sessionId);
          createSession(config);
        }, reconnectDelay);
      } else if (statusCode === DisconnectReason.loggedOut) {
        sessions.delete(sessionId);
        // Limpar cache de mensagens da sessão
        messageCache.delete(sessionId);
      }
    }
  });

  // SYNC COMPLETO DE CONTATOS
  socket.ev.on('contacts.set', async ({ contacts }) => {
    console.log(`📇 contacts.set: ${contacts.length} contatos recebidos`);
    
    for (const contact of contacts) {
      const jid = contact.id || contact.jid;
      if (jid) {
        session.allContacts.set(jid, contact);
        const name = contact.name || contact.notify || contact.pushName || contact.verifiedName;
        if (name) {
          contactNamesCache.set(jid, name);
        }
      }
    }
    
    const BATCH_SIZE = 50;
    for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
      const batch = contacts.slice(i, i + BATCH_SIZE);
      
      await sendWebhook({
        event: 'contacts.set',
        sessionId,
        instanceName,
        data: { 
          contacts: batch,
          batch: Math.floor(i / BATCH_SIZE) + 1,
          totalBatches: Math.ceil(contacts.length / BATCH_SIZE),
          totalContacts: contacts.length
        }
      }, webhookUrl, webhookSecret);
      
      if (i + BATCH_SIZE < contacts.length) {
        await delay(200);
      }
    }
    
    console.log(`✅ Todos os ${contacts.length} contatos enviados`);
  });

  socket.ev.on('contacts.upsert', async (contacts) => {
    console.log(`📇 contacts.upsert: ${contacts.length} contatos`);
    
    for (const contact of contacts) {
      const jid = contact.id || contact.jid;
      if (jid) {
        session.allContacts.set(jid, contact);
        const name = contact.name || contact.notify || contact.pushName || contact.verifiedName;
        if (name) {
          contactNamesCache.set(jid, name);
        }
      }
    }
    
    await sendWebhook({
      event: 'contacts.upsert',
      sessionId,
      instanceName,
      data: { contacts }
    }, webhookUrl, webhookSecret);
  });

  // SYNC COMPLETO DE CHATS
  socket.ev.on('chats.set', async ({ chats }) => {
    console.log(`💬 chats.set: ${chats.length} chats recebidos`);
    
    for (const chat of chats) {
      const jid = chat.id || chat.jid;
      if (jid) {
        session.allChats.set(jid, chat);
      }
    }
    
    const BATCH_SIZE = 30;
    const enrichedChats = [];
    
    for (let i = 0; i < chats.length; i++) {
      const chat = chats[i];
      try {
        const jid = chat?.id || chat?.jid;
        if (!jid || jid === 'status@broadcast') continue;

        const meta = await fetchContactMetadata(socket, jid);
        const isGroup = jid.endsWith('@g.us');

        let contactName = null;
        if (isGroup) {
          contactName = meta.groupSubject || chat.subject || chat.groupSubject || chat.name || null;
        } else {
          contactName = contactNamesCache.get(jid) || chat.name || chat.notify || chat.pushName || chat.verifiedName || null;
        }

        const enriched = {
          ...chat,
          id: jid,
          jid,
          name: contactName,
          contactName,
          profilePicture: meta.profilePicture || chat.profilePicture || chat.imgUrl || null,
        };

        if (isGroup) {
          enriched.groupSubject = contactName;
          enriched.metadata = {
            ...(chat.metadata || {}),
            subject: contactName,
            desc: meta.groupDescription || null,
            participants: meta.groupParticipants || null,
          };
        }

        enrichedChats.push(enriched);
        
        if (i % 10 === 0 && i > 0) {
          await delay(100);
        }
      } catch (e) {
        console.log('Erro ao enriquecer chat:', e?.message || e);
      }
      
      if (enrichedChats.length >= BATCH_SIZE || i === chats.length - 1) {
        if (enrichedChats.length > 0) {
          await sendWebhook({
            event: 'chats.set',
            sessionId,
            instanceName,
            data: { 
              chats: [...enrichedChats],
              batch: Math.floor(i / BATCH_SIZE) + 1,
              totalChats: chats.length
            }
          }, webhookUrl, webhookSecret);
          
          enrichedChats.length = 0;
          await delay(150);
        }
      }
    }
    
    console.log(`✅ Todos os ${chats.length} chats processados`);
  });

  socket.ev.on('chats.upsert', async (chats) => {
    console.log(`💬 chats.upsert: ${chats.length} chats`);
    
    for (const chat of chats) {
      const jid = chat.id || chat.jid;
      if (jid) {
        session.allChats.set(jid, chat);
      }
    }
    
    await sendWebhook({
      event: 'chats.upsert',
      sessionId,
      instanceName,
      data: { chats }
    }, webhookUrl, webhookSecret);
  });

  // ===== SYNC INICIAL - HISTÓRICO DE MENSAGENS =====
  socket.ev.on('messaging-history.set', async ({ messages: allMessages }) => {
    console.log(`📜 messaging-history.set: ${allMessages?.length || 0} mensagens`);
    
    try {
      const cutoff = Date.now() / 1000 - (6 * 60 * 60);
      const recent = (allMessages || []).filter(m => {
        const ts = typeof m.messageTimestamp === 'number' ? m.messageTimestamp : parseInt(m.messageTimestamp || '0');
        return ts > cutoff;
      });

      console.log(`📜 Processando ${recent.length} mensagens das últimas 6h`);

      const BATCH = 20;
      for (let i = 0; i < recent.length; i += BATCH) {
        const batch = recent.slice(i, i + BATCH);
        const mapped = [];

        for (const m of batch) {
          if (!m?.key?.remoteJid || m.key.remoteJid === 'status@broadcast') continue;

          // v4.8.0: Cache the message for later re-download
          cacheMessage(sessionId, m);

          const jid = m.key.remoteJid;
          const isGroup = jid.endsWith('@g.us');
          
          let senderPhone = null;
          let senderName = null;
          
          if (isGroup && m.key.participant) {
            senderPhone = m.key.participant.split('@')[0].replace(/\D/g, '');
            senderName = contactNamesCache.get(m.key.participant) || m.pushName || null;
          }
          
          if (!isGroup && !m?.key?.fromMe) {
            senderName = contactNamesCache.get(jid) || m?.pushName || null;
          }

          let mediaType = null;
          let mediaUrl = null;
          const msgContent = m.message;
          
          if (msgContent) {
            if (msgContent.imageMessage) mediaType = 'image';
            else if (msgContent.videoMessage) mediaType = 'video';
            else if (msgContent.audioMessage) {
              mediaType = msgContent.audioMessage.ptt ? 'ptt' : 'audio';
            }
            else if (msgContent.documentMessage) mediaType = 'document';
            else if (msgContent.stickerMessage) mediaType = 'sticker';
          }

          if (mediaType && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
            try {
              await acquireDownload();
              const buffer = await downloadMediaMessage(m, 'buffer', {});
              if (buffer) {
                mediaUrl = await uploadMediaToStorage(buffer, sessionId, m.key.id, mediaType);
              }
            } catch (e) {
              console.error(`Erro download mídia (${mediaType}):`, e.message);
            } finally {
              releaseDownload();
            }
          }

          mapped.push({
            key: m.key,
            message: m.message,
            messageTimestamp: m.messageTimestamp,
            pushName: m.pushName,
            senderPhone,
            senderName,
            mediaUrl,
            mediaType,
          });
        }

        if (mapped.length > 0) {
          await sendWebhook({
            event: 'messages.upsert',
            sessionId,
            instanceName,
            data: { messages: mapped }
          }, webhookUrl, webhookSecret);
          await delay(100);
        }
      }

      console.log(`✅ Sync inicial concluído (${recent.length} mensagens das últimas 6h)`);
    } catch (e) {
      console.log('❌ Erro no sync inicial:', e?.message || e);
    }
  });

  // ===== MENSAGENS RECEBIDAS EM TEMPO REAL =====
  socket.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      if (msg.key.remoteJid === 'status@broadcast') continue;
      
      const jid = msg.key.remoteJid;
      console.log(`📨 Mensagem de ${jid}`);

      // v4.8.0: Cache the message for later re-download
      cacheMessage(sessionId, msg);
      
      const metadata = await fetchContactMetadata(socket, jid);
      
      let mediaUrl = null;
      let mediaType = null;
      const msgContent = msg.message;
      
      if (msgContent) {
        if (msgContent.imageMessage) mediaType = 'image';
        else if (msgContent.videoMessage) mediaType = 'video';
        else if (msgContent.audioMessage) {
          mediaType = msgContent.audioMessage.ptt ? 'ptt' : 'audio';
        }
        else if (msgContent.documentMessage) mediaType = 'document';
        else if (msgContent.stickerMessage) mediaType = 'sticker';
      }

      if (mediaType && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
        try {
          await acquireDownload();
          const buffer = await downloadMediaMessage(msg, 'buffer', {});
          
          if (buffer) {
            mediaUrl = await uploadMediaToStorage(buffer, sessionId, msg.key.id, mediaType);
            console.log(`📎 Mídia ${mediaType} salva: ${mediaUrl ? 'OK' : 'FALHOU'}`);
          } else {
            console.error(`📎 ❌ Buffer vazio para ${mediaType} de ${jid} (msgId: ${msg.key.id})`);
          }
        } catch (e) {
          console.error(`📎 ❌ Erro download mídia ${mediaType}:`, e.message);
        } finally {
          releaseDownload();
        }
      }

      const isGroup = jid.endsWith('@g.us');
      const participant = msg.key?.participant;
      
      let senderPhone = null;
      let senderName = null;
      
      if (isGroup && participant) {
        senderPhone = participant.split('@')[0].replace(/\D/g, '');
        senderName = contactNamesCache.get(participant) || msg.pushName || null;
      }
      
      if (!isGroup && !msg.key.fromMe) {
        senderName = contactNamesCache.get(jid) || msg.pushName || null;
      }

      const groupName = isGroup ? (metadata.groupSubject || null) : null;

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
            senderPhone,
            senderName,
            groupName,
            contactMetadata: metadata
          }]
        }
      }, webhookUrl, webhookSecret);
    }
  });

  // ATUALIZAÇÃO DE STATUS (LIDAS)
  socket.ev.on('messages.update', async (updates) => {
    console.log(`📋 messages.update: ${updates.length} atualizações`);
    
    await sendWebhook({
      event: 'messages.update',
      sessionId,
      instanceName,
      data: { updates }
    }, webhookUrl, webhookSecret);
  });

  // Recibos de leitura
  socket.ev.on('message-receipt.update', async (updates) => {
    console.log(`✅ message-receipt.update: ${updates.length} recibos`);
    
    await sendWebhook({
      event: 'message-receipt.update',
      sessionId,
      instanceName,
      data: { updates }
    }, webhookUrl, webhookSecret);
  });

  return session;
}

// ============ ROTAS ============

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    version: '4.8.0',
    sessions: sessions.size,
    timestamp: new Date().toISOString(),
    historyHours: 6,
    features: [
      'proactive-metadata-sync', 
      'sticker-download', 
      'contact-name-cache', 
      'group-sender-names',
      'number-check',
      'brazilian-9th-digit-fix',
      'media-download-endpoint',
      'message-cache'
    ]
  });
});

// ===== v4.8.0: ENDPOINT PARA DOWNLOAD DE MÍDIA =====
app.post('/api/media/download', async (req, res) => {
  try {
    const { instanceName, messageId, remoteJid } = req.body;

    if (!messageId) {
      return res.status(400).json({ error: 'messageId is required' });
    }

    // Encontrar sessão pelo instanceName
    const session = Array.from(sessions.values()).find(s => s.instanceName === instanceName);
    if (!session || !session.socket || !session.isConnected) {
      return res.status(404).json({ error: 'Instance not found or not connected' });
    }

    console.log(`🎙️ [MEDIA-DL] Request: messageId=${messageId}, instance=${instanceName}`);

    // Tentar baixar do cache de mensagens
    const buffer = await downloadMediaFromCache(session.sessionId, messageId);
    
    if (!buffer) {
      console.log(`🎙️ [MEDIA-DL] ❌ Could not download media for ${messageId}`);
      return res.status(404).json({ error: 'Media not available - message not in cache or download failed' });
    }

    // Upload para Supabase Storage
    const mediaUrl = await uploadMediaToStorage(buffer, session.sessionId, messageId, 'ptt');
    
    if (mediaUrl) {
      console.log(`🎙️ [MEDIA-DL] ✅ Uploaded: ${mediaUrl.substring(0, 80)}`);
      return res.json({ 
        success: true, 
        url: mediaUrl,
        base64: buffer.toString('base64'),
        size: buffer.length
      });
    }

    // Se upload falhar, retornar base64 diretamente
    console.log(`🎙️ [MEDIA-DL] Upload failed, returning base64 (${buffer.length} bytes)`);
    return res.json({ 
      success: true, 
      base64: buffer.toString('base64'),
      size: buffer.length
    });

  } catch (error) {
    console.error('🎙️ [MEDIA-DL] Error:', error);
    return res.status(500).json({ error: 'Failed to download media', details: error.message });
  }
});

// Validação de número via onWhatsApp()
app.post('/api/number/check', async (req, res) => {
  try {
    const { instanceName, phone } = req.body;

    if (!phone) {
      return res.status(400).json({ error: 'phone is required' });
    }

    const session = Array.from(sessions.values()).find(s => s.instanceName === instanceName);
    if (!session || !session.socket || !session.isConnected) {
      return res.status(404).json({ error: 'Instance not found or not connected' });
    }

    const socket = session.socket;
    const cleanPhone = phone.replace(/\D/g, '');

    console.log(`🔍 Verificando número: ${cleanPhone} (instância: ${instanceName})`);

    const [result] = await socket.onWhatsApp(cleanPhone);

    if (result && result.exists) {
      console.log(`✅ Número ${cleanPhone} encontrado: ${result.jid}`);
      return res.json({ exists: true, jid: result.jid });
    } else {
      console.log(`❌ Número ${cleanPhone} NÃO encontrado no WhatsApp`);
      return res.json({ exists: false, jid: null });
    }
  } catch (error) {
    console.error('Erro checking number:', error);
    return res.status(500).json({ error: 'Failed to check number', details: error.message });
  }
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
    profilePicture: session.profilePicture,
    contactsCount: session.allContacts?.size || 0,
    chatsCount: session.allChats?.size || 0,
    cachedMessages: messageCache.get(session.sessionId)?.size || 0
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
    messageCache.delete(session.sessionId);
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
    messageCache.delete(session.sessionId);
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
    pushName: s.pushName,
    contactsCount: s.allContacts?.size || 0,
    chatsCount: s.allChats?.size || 0,
    cachedMessages: messageCache.get(s.sessionId)?.size || 0
  }));
  
  res.json({ sessions: sessionList });
});

// ENDPOINT PARA SYNC COMPLETO DE CONTATOS
app.post('/api/sync/contacts', async (req, res) => {
  try {
    const { instanceName, page = 1, pageSize = 50 } = req.body;
    
    const session = Array.from(sessions.values()).find(s => s.instanceName === instanceName);
    if (!session || !session.socket || !session.isConnected) {
      return res.status(404).json({ error: 'Sessão não encontrada ou desconectada' });
    }
    
    const allContacts = Array.from(session.allContacts.values());
    const totalContacts = allContacts.length;
    const totalPages = Math.ceil(totalContacts / pageSize);
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    
    const contacts = allContacts.slice(startIndex, endIndex);
    
    const enrichedContacts = [];
    for (const contact of contacts) {
      const jid = contact.id || contact.jid;
      if (!jid || jid === 'status@broadcast') continue;
      
      try {
        const meta = await fetchContactMetadata(session.socket, jid);
        enrichedContacts.push({
          ...contact,
          jid,
          profilePicture: meta.profilePicture,
          status: meta.status,
          groupSubject: meta.groupSubject,
          groupDescription: meta.groupDescription
        });
        await delay(50);
      } catch (e) {
        enrichedContacts.push({ ...contact, jid });
      }
    }
    
    res.json({
      success: true,
      page,
      pageSize,
      totalPages,
      totalContacts,
      contacts: enrichedContacts,
      hasMore: page < totalPages
    });
  } catch (error) {
    console.error('Erro sync contatos:', error);
    res.status(500).json({ error: 'Falha no sync de contatos' });
  }
});

// ENDPOINT PARA SYNC COMPLETO DE CHATS
app.post('/api/sync/chats', async (req, res) => {
  try {
    const { instanceName, page = 1, pageSize = 30 } = req.body;
    
    const session = Array.from(sessions.values()).find(s => s.instanceName === instanceName);
    if (!session || !session.socket || !session.isConnected) {
      return res.status(404).json({ error: 'Sessão não encontrada ou desconectada' });
    }
    
    const allChats = Array.from(session.allChats.values());
    const totalChats = allChats.length;
    const totalPages = Math.ceil(totalChats / pageSize);
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    
    const chats = allChats.slice(startIndex, endIndex);
    
    const enrichedChats = [];
    for (const chat of chats) {
      const jid = chat.id || chat.jid;
      if (!jid || jid === 'status@broadcast') continue;
      
      try {
        const meta = await fetchContactMetadata(session.socket, jid);
        const isGroup = jid.endsWith('@g.us');
        
        const enriched = {
          ...chat,
          jid,
          profilePicture: meta.profilePicture
        };
        
        if (isGroup) {
          enriched.groupSubject = meta.groupSubject || chat.name;
          enriched.groupDescription = meta.groupDescription;
          enriched.groupParticipants = meta.groupParticipants;
        }
        
        enrichedChats.push(enriched);
        await delay(50);
      } catch (e) {
        enrichedChats.push({ ...chat, jid });
      }
    }
    
    res.json({
      success: true,
      page,
      pageSize,
      totalPages,
      totalChats,
      chats: enrichedChats,
      hasMore: page < totalPages
    });
  } catch (error) {
    console.error('Erro sync chats:', error);
    res.status(500).json({ error: 'Falha no sync de chats' });
  }
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
    res.json({ success: true, messageId: result.key.id, key: result.key });
  } catch (error) {
    res.status(500).json({ error: 'Falha ao enviar mídia' });
  }
});

// Enviar voz (PTT)
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
    
    res.json({ success: true, messageId: result.key.id, key: result.key });
  } catch (error) {
    console.error('Erro enviar voz:', error);
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
    console.error('Erro marcar como lido:', error);
    res.status(500).json({ error: 'Falha ao marcar como lido' });
  }
});

// Iniciar servidor
server.listen(PORT, () => {
  console.log(`🚀 Baileys Server v4.8.0 rodando na porta ${PORT}`);
  console.log(`📡 Webhook: ${SUPABASE_WEBHOOK_URL || 'não configurado'}`);
  console.log(`📸 Sync proativo de metadados habilitado`);
  console.log(`🔄 Sync completo de contatos habilitado`);
  console.log(`⏰ Histórico de mensagens: últimas 6 horas`);
  console.log(`🎨 Stickers: download habilitado`);
  console.log(`🔍 Validação de número (onWhatsApp) habilitada`);
  console.log(`🎙️ Endpoint /api/media/download habilitado`);
  console.log(`📦 Cache de mensagens: até ${MAX_CACHED_MESSAGES} por sessão`);
});
