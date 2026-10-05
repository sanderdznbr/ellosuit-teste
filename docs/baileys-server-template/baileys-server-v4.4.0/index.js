/**
 * Baileys Server v4.6.0 - Proactive Metadata Sync
 * 
 * CORREÇÕES v4.6.0:
 * - SYNC PROATIVO de metadados após conexão (fotos + nomes)
 * - Função syncAllMetadata busca foto e nome de TODOS os chats
 * - Melhor cache de nomes de contatos
 * - Download de STICKERS para storage
 * - Histórico de 6 horas mantido
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

// ===== v4.6.0: SYNC PROATIVO DE METADADOS =====
// Busca fotos de perfil e nomes para TODOS os chats logo após conexão
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
          
          // Determinar nome
          let contactName = null;
          if (isGroup) {
            contactName = metadata.groupSubject || chat.subject || chat.name || null;
          } else {
            contactName = contactNamesCache.get(jid) || chat.name || chat.notify || null;
          }
          
          // Enviar webhook com metadados enriquecidos
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
        } catch (e) {
          // Silenciar erros individuais
        }
      }
      
      // Delay entre batches para não sobrecarregar
      if (i + BATCH_SIZE < chats.length) {
        await delay(300);
      }
    }
    
    console.log(`✅ Metadados sincronizados: ${processed}/${chats.length} chats`);
  } catch (e) {
    console.error('Erro sync metadados:', e.message);
  }
}

// Upload mídia para Supabase storage
async function uploadMediaToStorage(buffer, sessionId, messageId, mediaType) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !buffer) return null;
  
  try {
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
      return `${SUPABASE_URL}/storage/v1/object/public/whatsapp-media/${fileName}`;
    }
  } catch (e) {
    console.error('Erro upload mídia:', e.message);
  }
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
      
      // ===== v4.6.0: SYNC PROATIVO DE METADADOS APÓS CONEXÃO =====
      // Aguardar 3s para estabilizar, depois buscar fotos e nomes para TODOS os chats
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
      }
    }
  });

  // ===== SYNC COMPLETO DE CONTATOS =====
  socket.ev.on('contacts.set', async ({ contacts }) => {
    console.log(`📇 contacts.set: ${contacts.length} contatos recebidos`);
    
    // Armazena no cache da sessão e no cache global de nomes
    for (const contact of contacts) {
      const jid = contact.id || contact.jid;
      if (jid) {
        session.allContacts.set(jid, contact);
        // Cache nome para uso em mensagens
        const name = contact.name || contact.notify || contact.pushName || contact.verifiedName;
        if (name) {
          contactNamesCache.set(jid, name);
        }
      }
    }
    
    // Envia em batches para evitar timeout
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

  // ===== SYNC COMPLETO DE CHATS =====
  socket.ev.on('chats.set', async ({ chats }) => {
    console.log(`💬 chats.set: ${chats.length} chats recebidos`);
    
    for (const chat of chats) {
      const jid = chat.id || chat.jid;
      if (jid) {
        session.allChats.set(jid, chat);
      }
    }
    
    // Enriquece chats em batches
    const BATCH_SIZE = 30;
    const enrichedChats = [];
    
    for (let i = 0; i < chats.length; i++) {
      const chat = chats[i];
      try {
        const jid = chat?.id || chat?.jid;
        if (!jid || jid === 'status@broadcast') continue;

        const meta = await fetchContactMetadata(socket, jid);
        const isGroup = jid.endsWith('@g.us');

        // ===== v4.5.0: Melhor extração de nomes =====
        let contactName = null;
        if (isGroup) {
          // Grupos: prioridade para metadados do grupo
          contactName = meta.groupSubject || chat.subject || chat.groupSubject || chat.name || null;
        } else {
          // Contatos individuais: buscar do cache ou chat
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

  // ===== HISTÓRICO DE MENSAGENS - 6 HORAS =====
  socket.ev.on('messaging-history.set', async ({ chats = [], contacts = [], messages = [], isLatest }) => {
    try {
      console.log(`📥 History set: chats=${chats.length} contacts=${contacts.length} messages=${messages.length} latest=${isLatest}`);

      // Processa contatos adicionais do histórico
      if (contacts && contacts.length > 0) {
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
            data: { contacts: batch }
          }, webhookUrl, webhookSecret);
          await delay(100);
        }
      }

      // ===== Processa mensagens das últimas 6 HORAS =====
      const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
      const cutoff = Date.now() - SIX_HOURS_MS;

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

      const recent = (messages || []).filter((m) => {
        const ms = toMs(m?.messageTimestamp);
        return ms && ms >= cutoff;
      });

      console.log(`📨 Processando ${recent.length} mensagens recentes (últimas 6h)`);

      const BATCH = 20;
      for (let i = 0; i < recent.length; i += BATCH) {
        const slice = recent.slice(i, i + BATCH);

        const mapped = [];
        for (const m of slice) {
          const jid = m?.key?.remoteJid;
          if (!jid || jid === 'status@broadcast') continue;

          const isGroup = jid.endsWith('@g.us');
          const participant = m?.key?.participant;

          // ===== v4.5.0: Melhor extração de remetente em grupos =====
          let senderPhone = null;
          let senderName = null;
          
          if (isGroup && participant) {
            senderPhone = participant.split('@')[0].replace(/\D/g, '');
            // Buscar nome do cache primeiro, depois pushName
            senderName = contactNamesCache.get(participant) || m?.pushName || null;
          }
          
          // Para contatos individuais incoming, usar pushName
          if (!isGroup && !m?.key?.fromMe) {
            senderName = contactNamesCache.get(jid) || m?.pushName || null;
          }

          // ===== v4.5.0: Detectar tipo de mídia incluindo sticker =====
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

          // ===== v4.5.0: Download de stickers e outras mídias do histórico =====
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
      
      // Buscar metadados
      const metadata = await fetchContactMetadata(socket, jid);
      
      // ===== v4.5.0: Detectar mídia incluindo sticker =====
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

      // ===== v4.5.0: Download de TODAS as mídias incluindo stickers =====
      if (mediaType && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
        try {
          await acquireDownload();
          const buffer = await downloadMediaMessage(msg, 'buffer', {});
          
          if (buffer) {
            mediaUrl = await uploadMediaToStorage(buffer, sessionId, msg.key.id, mediaType);
            console.log(`📎 Mídia ${mediaType} salva: ${mediaUrl ? 'OK' : 'FALHOU'}`);
          }
        } catch (e) {
          console.error('Erro download mídia:', e.message);
        } finally {
          releaseDownload();
        }
      }

      // Dados de grupo
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

      // Nome do grupo
      const groupName = isGroup ? (metadata.groupSubject || null) : null;

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
            senderPhone,
            senderName,
            groupName,
            contactMetadata: metadata
          }]
        }
      }, webhookUrl, webhookSecret);
    }
  });

  // ===== ATUALIZAÇÃO DE STATUS (LIDAS) =====
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
    version: '4.5.0',
    sessions: sessions.size,
    timestamp: new Date().toISOString(),
    historyHours: 6,
    features: ['sticker-download', 'contact-name-cache', 'group-sender-names']
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
    profilePicture: session.profilePicture,
    contactsCount: session.allContacts?.size || 0,
    chatsCount: session.allChats?.size || 0
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
    pushName: s.pushName,
    contactsCount: s.allContacts?.size || 0,
    chatsCount: s.allChats?.size || 0
  }));
  
  res.json({ sessions: sessionList });
});

// ===== ENDPOINT PARA SYNC COMPLETO DE CONTATOS =====
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
    
    // Enriquece com metadados
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

// ===== ENDPOINT PARA SYNC COMPLETO DE CHATS =====
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
    
    // Enriquece com metadados
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
  console.log(`🚀 Baileys Server v4.5.0 rodando na porta ${PORT}`);
  console.log(`📡 Webhook: ${SUPABASE_WEBHOOK_URL || 'não configurado'}`);
  console.log(`🔄 Sync completo de contatos habilitado`);
  console.log(`⏰ Histórico de mensagens: últimas 6 horas`);
  console.log(`🎨 Stickers: download habilitado`);
});
