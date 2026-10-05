/**
 * ============================================
 * BAILEYS SERVER v3.8.0
 * ============================================
 * Servidor WhatsApp estável e completo
 * 
 * MELHORIAS v3.8.0:
 * - CORREÇÃO: Endpoint /api/message/send funcional
 * - Heartbeat automático (25s) para manter conexão
 * - Reconexão com backoff exponencial
 * - Sincronização completa de contatos
 * - Upload de mídia com retry inteligente
 * - Cache otimizado para grupos e fotos
 * - Melhor tratamento de erros
 * 
 * Para WhatsApp CRM - Lovable
 * ============================================
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Dynamic imports for ESM modules
let makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, downloadMediaMessage, Browsers;
let QRCode, pino, mime, supabase;

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Store sessions in memory
const sessions = new Map();

// Cache for group metadata (10 min TTL)
const groupMetadataCache = new Map();
const GROUP_CACHE_TTL = 10 * 60 * 1000;

// Cache for profile pictures (30 min TTL)
const profilePicCache = new Map();
const PROFILE_PIC_CACHE_TTL = 30 * 60 * 1000;

// Environment variables
const WEBHOOK_URL = process.env.SUPABASE_WEBHOOK_URL || '';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Sessions directory
const SESSIONS_DIR = path.join(__dirname, 'sessions');
if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

// ============== HELPERS ==============

function extractPhoneFromJid(jid) {
  if (!jid) return null;
  
  // Skip LIDs (Linked Device IDs) - not real phone numbers
  if (jid.includes('@lid')) return null;
  
  const parts = jid.split('@');
  if (parts.length < 1) return null;
  
  const digits = parts[0].replace(/\D/g, '');
  if (digits.length < 8) return null;
  
  return digits;
}

function isGroupJid(jid) {
  return jid?.includes('@g.us') || false;
}

function formatJidForSend(phone, isGroup = false) {
  let jid = phone.replace(/\D/g, '');
  
  if (isGroup || phone.includes('@g.us')) {
    if (!jid.includes('@')) jid = jid + '@g.us';
  } else {
    if (!jid.includes('@')) jid = jid + '@s.whatsapp.net';
  }
  
  return jid;
}

// ============== CACHING ==============

async function getGroupMetadata(socket, groupJid) {
  // Check cache
  const cached = groupMetadataCache.get(groupJid);
  if (cached && Date.now() - cached.timestamp < GROUP_CACHE_TTL) {
    return cached.data;
  }
  
  try {
    const metadata = await socket.groupMetadata(groupJid);
    if (metadata) {
      groupMetadataCache.set(groupJid, {
        data: metadata,
        timestamp: Date.now()
      });
      return metadata;
    }
  } catch (e) {
    console.log(`⚠️ Could not fetch group metadata for ${groupJid}: ${e.message}`);
  }
  
  return null;
}

async function getProfilePicture(socket, jid) {
  // Check cache
  const cacheKey = jid;
  const cached = profilePicCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < PROFILE_PIC_CACHE_TTL) {
    return cached.url;
  }
  
  try {
    const url = await socket.profilePictureUrl(jid, 'image');
    profilePicCache.set(cacheKey, { url, timestamp: Date.now() });
    return url;
  } catch (e) {
    profilePicCache.set(cacheKey, { url: null, timestamp: Date.now() });
    return null;
  }
}

// ============== SUPABASE STORAGE ==============

async function uploadMediaToSupabase(buffer, sessionId, mediaType, extension) {
  if (!supabase || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.log('⚠️ Supabase not configured for media upload');
    return null;
  }

  try {
    const timestamp = Date.now();
    const hash = crypto.randomBytes(8).toString('hex');
    const fileName = `${sessionId}/${mediaType}/${timestamp}-${hash}.${extension}`;
    const mimeType = mime.lookup(extension) || 'application/octet-stream';

    console.log(`📤 Uploading ${mediaType} to Supabase: ${fileName}`);

    const { data, error } = await supabase.storage
      .from('whatsapp-media')
      .upload(fileName, buffer, {
        contentType: mimeType,
        upsert: false
      });

    if (error) {
      console.error('❌ Supabase upload error:', error.message);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from('whatsapp-media')
      .getPublicUrl(fileName);

    console.log(`✅ Media uploaded: ${urlData.publicUrl}`);
    return { url: urlData.publicUrl, mimeType };
  } catch (error) {
    console.error('❌ Upload error:', error.message);
    return null;
  }
}

// ============== MEDIA PROCESSING ==============

async function processMediaMessage(socket, msg, sessionId) {
  try {
    const message = msg.message;
    if (!message) return null;

    let mediaType = null;
    let mediaMessage = null;
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
      mediaType = message.audioMessage.ptt ? 'ptt' : 'audio';
      mediaMessage = message.audioMessage;
      extension = message.audioMessage.ptt ? 'ogg' : 'mp3';
    } else if (message.documentMessage) {
      mediaType = 'document';
      mediaMessage = message.documentMessage;
      const fileName = mediaMessage.fileName || '';
      extension = fileName.split('.').pop() || 'pdf';
    } else if (message.stickerMessage) {
      mediaType = 'sticker';
      mediaMessage = message.stickerMessage;
      extension = 'webp';
    }

    if (!mediaType || !mediaMessage) return null;

    console.log(`📥 Downloading ${mediaType}...`);

    // Download with intelligent retry (5 attempts with progressive delay)
    let buffer = null;
    const maxRetries = 5;
    
    for (let attempt = 1; attempt <= maxRetries && !buffer; attempt++) {
      try {
        buffer = await downloadMediaMessage(
          msg,
          'buffer',
          {},
          {
            logger: console,
            reuploadRequest: socket.updateMediaMessage
          }
        );
      } catch (downloadError) {
        const delay = attempt * 1000; // 1s, 2s, 3s, 4s, 5s
        console.log(`⚠️ Download attempt ${attempt}/${maxRetries} failed. Waiting ${delay}ms...`);
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    if (!buffer) {
      console.error('❌ Failed to download media after all retries');
      return { mediaType };
    }

    console.log(`✅ Downloaded: ${buffer.length} bytes`);

    // Upload to Supabase
    const uploadResult = await uploadMediaToSupabase(buffer, sessionId, mediaType, extension);
    
    if (uploadResult) {
      return {
        mediaUrl: uploadResult.url,
        mediaMimeType: uploadResult.mimeType,
        mediaType
      };
    }

    return { mediaType };
  } catch (error) {
    console.error('❌ Media processing error:', error.message);
    return null;
  }
}

function hasMedia(msg) {
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

function getMediaCaption(msg) {
  const message = msg.message;
  if (!message) return '';
  return message.imageMessage?.caption ||
         message.videoMessage?.caption ||
         message.documentMessage?.caption ||
         message.documentMessage?.fileName ||
         '';
}

function getTextContent(msg) {
  const message = msg.message;
  if (!message) return '';
  return message.conversation ||
         message.extendedTextMessage?.text ||
         '';
}

// ============== WEBHOOK ==============

async function sendWebhook(payload) {
  if (!WEBHOOK_URL) {
    console.log('⚠️ No webhook URL configured');
    return false;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-webhook-secret': payload.webhookSecret || ''
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    
    clearTimeout(timeout);
    
    if (response.ok) {
      console.log(`📤 Webhook OK: ${payload.event}`);
      return true;
    } else {
      console.log(`⚠️ Webhook ${response.status}: ${payload.event}`);
      return false;
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('❌ Webhook timeout');
    } else {
      console.error('❌ Webhook error:', error.message);
    }
    return false;
  }
}

// ============== WHATSAPP SESSION ==============

async function createWhatsAppSession(sessionId, instanceName, webhookSecret, reconnectAttempt = 0) {
  // Prevent duplicate sessions
  if (sessions.has(sessionId)) {
    const existing = sessions.get(sessionId);
    if (existing.isConnected) {
      console.log(`ℹ️ Session ${instanceName} already connected`);
      return existing;
    }
  }

  const sessionPath = path.join(SESSIONS_DIR, instanceName);
  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
  const { version } = await fetchLatestBaileysVersion();

  console.log(`📱 Creating session: ${instanceName} (Baileys v${version.join('.')})`);
  console.log(`💓 Heartbeat: ENABLED (25s interval)`);
  console.log(`📨 Processing REAL-TIME messages only`);

  const session = {
    sessionId,
    instanceName,
    socket: null,
    webhookSecret,
    qrCode: null,
    isConnected: false,
    phoneNumber: null,
    pushName: null,
    profilePicture: null,
    heartbeatInterval: null,
    contacts: new Map()
  };

  sessions.set(sessionId, session);

  const logger = pino({ level: 'silent' });

  const socket = makeWASocket({
    version,
    logger,
    printQRInTerminal: true,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger)
    },
    browser: Browsers.macOS('Desktop'),
    connectTimeoutMs: 90000,
    qrTimeout: 60000,
    keepAliveIntervalMs: 25000, // Heartbeat every 25 seconds
    // Disable history sync - only real-time messages
    syncFullHistory: false,
    shouldSyncHistoryMessage: () => false,
    fireInitQueries: true, // Enable initial queries for contacts
    generateHighQualityLinkPreview: false,
    markOnlineOnConnect: true
  });

  session.socket = socket;

  // Save credentials
  socket.ev.on('creds.update', saveCreds);

  // Connection updates
  socket.ev.on('connection.update', async (update) => {
    const { qr, connection, lastDisconnect } = update;

    if (qr) {
      session.qrCode = await QRCode.toDataURL(qr);
      console.log(`📱 QR Code generated for ${instanceName}`);

      await sendWebhook({
        event: 'qr.update',
        sessionId,
        instanceName,
        webhookSecret,
        data: { qrCode: session.qrCode }
      });
    }

    if (connection === 'open') {
      session.isConnected = true;
      session.qrCode = null;
      reconnectAttempt = 0; // Reset on successful connection

      const user = socket.user;
      if (user) {
        session.phoneNumber = user.id.split(':')[0].replace('@s.whatsapp.net', '');
        session.pushName = user.name || user.notify || null;
        session.profilePicture = await getProfilePicture(socket, user.id);
      }

      console.log(`✅ ${instanceName} connected! Phone: ${session.phoneNumber}`);

      await sendWebhook({
        event: 'connection.update',
        sessionId,
        instanceName,
        webhookSecret,
        data: {
          connection: 'open',
          isConnected: true,
          phoneNumber: session.phoneNumber,
          pushName: session.pushName,
          profilePicture: session.profilePicture
        }
      });
    }

    if (connection === 'close') {
      session.isConnected = false;
      
      // Clear heartbeat
      if (session.heartbeatInterval) {
        clearInterval(session.heartbeatInterval);
        session.heartbeatInterval = null;
      }

      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason?.loggedOut;

      console.log(`❌ ${instanceName} disconnected. Code: ${statusCode}`);

      await sendWebhook({
        event: 'connection.update',
        sessionId,
        instanceName,
        webhookSecret,
        data: { connection: 'close', isConnected: false, statusCode }
      });

      if (shouldReconnect) {
        sessions.delete(sessionId);
        
        // Exponential backoff: 1s, 2s, 4s, 8s, 16s, max 30s
        const delay = Math.min(Math.pow(2, reconnectAttempt) * 1000, 30000);
        console.log(`🔄 Reconnecting in ${delay}ms (attempt ${reconnectAttempt + 1})...`);
        
        setTimeout(() => {
          createWhatsAppSession(sessionId, instanceName, webhookSecret, reconnectAttempt + 1);
        }, delay);
      } else {
        console.log(`🚪 Logged out - not reconnecting`);
        sessions.delete(sessionId);
      }
    }
  });

  // ============== CONTACTS SYNC ==============
  socket.ev.on('contacts.set', async ({ contacts }) => {
    console.log(`👥 Received ${contacts?.length || 0} contacts`);
    
    if (!contacts || contacts.length === 0) return;
    
    // Store contacts in session
    const enrichedContacts = [];
    
    for (const contact of contacts) {
      const phone = extractPhoneFromJid(contact.id);
      if (!phone) continue;
      
      const enriched = {
        id: contact.id,
        phone,
        name: contact.name || contact.notify || contact.verifiedName || null,
        pushName: contact.notify || null,
        verifiedName: contact.verifiedName || null,
        isGroup: isGroupJid(contact.id)
      };
      
      session.contacts.set(phone, enriched);
      enrichedContacts.push(enriched);
    }
    
    console.log(`👥 Processed ${enrichedContacts.length} valid contacts`);
    
    // Send to webhook in batches of 100
    const batchSize = 100;
    for (let i = 0; i < enrichedContacts.length; i += batchSize) {
      const batch = enrichedContacts.slice(i, i + batchSize);
      await sendWebhook({
        event: 'contacts.set',
        sessionId,
        instanceName,
        webhookSecret,
        data: { 
          contacts: batch,
          total: enrichedContacts.length,
          batch: Math.floor(i / batchSize) + 1,
          totalBatches: Math.ceil(enrichedContacts.length / batchSize)
        }
      });
    }
  });

  socket.ev.on('contacts.update', async (updates) => {
    console.log(`👥 Contacts updated: ${updates?.length || 0}`);
    
    const enrichedUpdates = [];
    for (const contact of updates || []) {
      const phone = extractPhoneFromJid(contact.id);
      if (!phone) continue;
      
      const existing = session.contacts.get(phone) || {};
      const enriched = {
        ...existing,
        id: contact.id,
        phone,
        name: contact.name || contact.notify || existing.name || null,
        pushName: contact.notify || existing.pushName || null
      };
      
      session.contacts.set(phone, enriched);
      enrichedUpdates.push(enriched);
    }
    
    if (enrichedUpdates.length > 0) {
      await sendWebhook({
        event: 'contacts.update',
        sessionId,
        instanceName,
        webhookSecret,
        data: { contacts: enrichedUpdates }
      });
    }
  });

  // ============== REAL-TIME MESSAGES ==============
  socket.ev.on('messages.upsert', async ({ messages, type }) => {
    // CRITICAL: Only process 'notify' (real-time messages)
    if (type !== 'notify') {
      console.log(`⏭️ Skipping ${messages.length} messages (type: ${type})`);
      return;
    }
    
    console.log(`📨 Processing ${messages.length} REAL-TIME messages`);

    for (const msg of messages) {
      // Skip status broadcast and protocol messages
      if (msg.key.remoteJid === 'status@broadcast') continue;
      if (msg.message?.protocolMessage) continue;
      if (msg.message?.reactionMessage) continue; // Skip reactions for now

      const remoteJid = msg.key.remoteJid;
      const fromMe = msg.key.fromMe || false;
      const isGroup = isGroupJid(remoteJid);

      // Skip LID messages
      if (remoteJid?.includes('@lid')) {
        console.log(`⏭️ Skipping LID message: ${remoteJid}`);
        continue;
      }

      let senderPhone = '';
      let senderName = '';
      let groupName = '';
      let groupProfilePic = null;
      let contactProfilePic = null;
      
      if (isGroup) {
        // Get group metadata
        const groupMetadata = await getGroupMetadata(socket, remoteJid);
        if (groupMetadata) {
          groupName = groupMetadata.subject || '';
          console.log(`👥 Group: "${groupName}"`);
        }
        
        groupProfilePic = await getProfilePicture(socket, remoteJid);
        
        // Get sender info for incoming group messages
        if (!fromMe && msg.key.participant) {
          senderPhone = extractPhoneFromJid(msg.key.participant) || '';
          senderName = msg.pushName || '';
          console.log(`👤 Sender: "${senderName}" (${senderPhone})`);
        }
      } else {
        // Individual chat
        if (!fromMe) {
          senderPhone = extractPhoneFromJid(remoteJid) || '';
          senderName = msg.pushName || '';
        }
        contactProfilePic = await getProfilePicture(socket, remoteJid);
      }

      // Process media
      let mediaUrl = null;
      let mediaMimeType = null;
      let mediaType = null;
      const mediaCaption = getMediaCaption(msg);

      if (hasMedia(msg)) {
        console.log(`📎 Processing media from ${isGroup ? groupName : senderPhone}...`);
        const mediaResult = await processMediaMessage(socket, msg, sessionId);
        if (mediaResult) {
          mediaUrl = mediaResult.mediaUrl || null;
          mediaMimeType = mediaResult.mediaMimeType || null;
          mediaType = mediaResult.mediaType || null;
        }
      }

      // Log text messages
      const textContent = getTextContent(msg);
      if (textContent && !hasMedia(msg)) {
        console.log(`💬 "${textContent.substring(0, 50)}..."`);
      }

      // Send webhook
      await sendWebhook({
        event: 'messages.upsert',
        sessionId,
        instanceName,
        webhookSecret,
        data: {
          messages: [{
            key: msg.key,
            message: msg.message,
            messageTimestamp: msg.messageTimestamp,
            pushName: msg.pushName,
            // Group fields
            groupName,
            groupSubject: groupName,
            groupProfilePic,
            isGroup,
            // Sender info
            senderPhone,
            senderName,
            // Media
            mediaUrl,
            mediaMimeType,
            mediaType,
            mediaCaption,
            // Profile
            senderProfilePic: contactProfilePic,
            // Metadata
            syncType: 'realtime'
          }]
        }
      });
    }
  });

  // Message status updates
  socket.ev.on('messages.update', async (updates) => {
    await sendWebhook({
      event: 'messages.update',
      sessionId,
      instanceName,
      webhookSecret,
      data: { updates }
    });
  });

  // Chat updates (for new conversations)
  socket.ev.on('chats.upsert', async (chats) => {
    console.log(`📋 ${chats.length} chats updated`);
    
    const enrichedChats = [];
    for (const chat of chats) {
      const jid = chat.id;
      const isGroup = isGroupJid(jid);
      
      let enrichedChat = { ...chat };
      
      if (isGroup) {
        const metadata = await getGroupMetadata(socket, jid);
        if (metadata) {
          enrichedChat.groupSubject = metadata.subject;
          enrichedChat.name = metadata.subject;
          enrichedChat.profilePicture = await getProfilePicture(socket, jid);
        }
      } else {
        enrichedChat.profilePicture = await getProfilePicture(socket, jid);
      }
      
      enrichedChats.push(enrichedChat);
    }
    
    await sendWebhook({
      event: 'chats.upsert',
      sessionId,
      instanceName,
      webhookSecret,
      data: { chats: enrichedChats }
    });
  });

  // Ignore history sync events
  socket.ev.on('chats.set', async ({ chats }) => {
    console.log(`🚫 Ignoring ${chats?.length || 0} historical chats`);
  });

  socket.ev.on('messaging-history.set', async ({ chats, messages }) => {
    console.log(`🚫 Ignoring history sync (${chats?.length || 0} chats, ${messages?.length || 0} msgs)`);
  });

  return session;
}

// ============== API ROUTES ==============

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '3.8.0',
    features: {
      historySync: false,
      contactsSync: true,
      mediaUpload: !!(SUPABASE_URL && SUPABASE_SERVICE_KEY),
      heartbeat: true
    },
    sessions: sessions.size,
    caches: {
      groups: groupMetadataCache.size,
      profiles: profilePicCache.size
    },
    timestamp: new Date().toISOString()
  });
});

app.post('/api/instance/create', async (req, res) => {
  try {
    const { sessionId, instanceName, webhookSecret } = req.body;

    if (!sessionId || !instanceName) {
      return res.status(400).json({ error: 'sessionId and instanceName required' });
    }

    const session = await createWhatsAppSession(sessionId, instanceName, webhookSecret || '');

    res.json({
      success: true,
      sessionId: session.sessionId,
      instanceName: session.instanceName,
      isConnected: session.isConnected
    });
  } catch (error) {
    console.error('❌ Create instance error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/instance/:sessionId/qr', (req, res) => {
  const session = sessions.get(req.params.sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  res.json({
    qrCode: session.qrCode,
    isConnected: session.isConnected,
    phoneNumber: session.phoneNumber,
    pushName: session.pushName,
    profilePicture: session.profilePicture
  });
});

app.get('/api/instance/:sessionId/status', (req, res) => {
  const session = sessions.get(req.params.sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Session not found', status: 'not_found' });
  }

  res.json({
    status: session.isConnected ? 'connected' : (session.qrCode ? 'waiting_qr' : 'connecting'),
    isConnected: session.isConnected,
    phoneNumber: session.phoneNumber,
    pushName: session.pushName,
    profilePicture: session.profilePicture,
    contactsCount: session.contacts.size
  });
});

app.get('/api/instance/list', (req, res) => {
  const list = [];
  for (const [id, session] of sessions) {
    list.push({
      sessionId: id,
      instanceName: session.instanceName,
      isConnected: session.isConnected,
      phoneNumber: session.phoneNumber,
      contactsCount: session.contacts.size
    });
  }
  res.json({ sessions: list });
});

app.delete('/api/instance/:sessionId', async (req, res) => {
  const session = sessions.get(req.params.sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  try {
    if (session.heartbeatInterval) {
      clearInterval(session.heartbeatInterval);
    }
    if (session.socket) {
      await session.socket.logout();
    }
  } catch (e) {
    console.log('Logout error:', e.message);
  }

  const sessionPath = path.join(SESSIONS_DIR, session.instanceName);
  if (fs.existsSync(sessionPath)) {
    fs.rmSync(sessionPath, { recursive: true });
  }

  sessions.delete(req.params.sessionId);
  res.json({ success: true });
});

// Get contacts
app.get('/api/contacts/:sessionId', (req, res) => {
  const session = sessions.get(req.params.sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const contacts = Array.from(session.contacts.values());
  res.json({ 
    success: true, 
    count: contacts.length,
    contacts 
  });
});

// Send text message - v3.8.0 FIXED
app.post('/api/message/send', async (req, res) => {
  try {
    const { sessionId, phone, message, isGroup } = req.body;

    console.log(`📤 Send request: session=${sessionId}, phone=${phone}, isGroup=${isGroup}`);

    const session = sessions.get(sessionId);
    if (!session) {
      console.error(`❌ Session not found: ${sessionId}`);
      return res.status(400).json({ error: 'Session not found' });
    }
    
    if (!session.socket) {
      console.error(`❌ Socket not available for session: ${sessionId}`);
      return res.status(400).json({ error: 'Socket not available' });
    }
    
    if (!session.isConnected) {
      console.error(`❌ Session not connected: ${sessionId}`);
      return res.status(400).json({ error: 'Session not connected' });
    }

    const jid = formatJidForSend(phone, isGroup);
    console.log(`📤 Sending to ${jid}: "${message.substring(0, 30)}..."`);

    const result = await session.socket.sendMessage(jid, { text: message });

    console.log(`✅ Message sent: ${result?.key?.id}`);
    res.json({ success: true, jid, messageId: result?.key?.id });
  } catch (error) {
    console.error('❌ Send error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Send media
app.post('/api/message/media', async (req, res) => {
  try {
    const { sessionId, phone, mediaUrl, mediaType, caption, isGroup, fileName } = req.body;

    const session = sessions.get(sessionId);
    if (!session || !session.socket || !session.isConnected) {
      return res.status(400).json({ error: 'Session not connected' });
    }

    const jid = formatJidForSend(phone, isGroup);
    
    let messageContent = {};
    
    switch (mediaType) {
      case 'image':
        messageContent = { image: { url: mediaUrl }, caption: caption || '' };
        break;
      case 'video':
        messageContent = { video: { url: mediaUrl }, caption: caption || '' };
        break;
      case 'audio':
        messageContent = { audio: { url: mediaUrl }, mimetype: 'audio/mpeg' };
        break;
      case 'ptt':
        messageContent = { audio: { url: mediaUrl }, mimetype: 'audio/ogg; codecs=opus', ptt: true };
        break;
      case 'document':
        messageContent = { document: { url: mediaUrl }, fileName: fileName || caption || 'document' };
        break;
      default:
        return res.status(400).json({ error: 'Invalid mediaType' });
    }

    console.log(`📤 Sending ${mediaType} to ${jid}`);
    const result = await session.socket.sendMessage(jid, messageContent);

    res.json({ success: true, jid, messageId: result?.key?.id });
  } catch (error) {
    console.error('❌ Send media error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get group metadata
app.get('/api/group/:sessionId/:groupId', async (req, res) => {
  try {
    const session = sessions.get(req.params.sessionId);
    if (!session || !session.socket) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const groupJid = req.params.groupId.includes('@') 
      ? req.params.groupId 
      : `${req.params.groupId}@g.us`;
    
    const metadata = await getGroupMetadata(session.socket, groupJid);
    
    if (metadata) {
      res.json({ success: true, metadata });
    } else {
      res.status(404).json({ error: 'Group not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get profile picture
app.get('/api/profile/:sessionId/:jid', async (req, res) => {
  try {
    const session = sessions.get(req.params.sessionId);
    if (!session || !session.socket) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const jid = req.params.jid.includes('@') 
      ? req.params.jid 
      : `${req.params.jid}@s.whatsapp.net`;
    
    const url = await getProfilePicture(session.socket, jid);
    res.json({ success: true, url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============== INITIALIZATION ==============

async function init() {
  // Load ESM modules
  const baileys = await import('@whiskeysockets/baileys');
  makeWASocket = baileys.default;
  useMultiFileAuthState = baileys.useMultiFileAuthState;
  DisconnectReason = baileys.DisconnectReason;
  fetchLatestBaileysVersion = baileys.fetchLatestBaileysVersion;
  makeCacheableSignalKeyStore = baileys.makeCacheableSignalKeyStore;
  downloadMediaMessage = baileys.downloadMediaMessage;
  Browsers = baileys.Browsers;

  const qrModule = await import('qrcode');
  QRCode = qrModule.default;

  const pinoModule = await import('pino');
  pino = pinoModule.default;

  const mimeModule = await import('mime-types');
  mime = mimeModule.default;

  // Initialize Supabase
  if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    const { createClient } = await import('@supabase/supabase-js');
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    console.log('✅ Supabase client initialized');
  } else {
    console.log('⚠️ Supabase not configured - media will not be uploaded');
  }

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`\n🚀 Baileys Server v3.8.0 running on port ${PORT}`);
    console.log(`💓 Heartbeat: ENABLED (25s interval)`);
    console.log(`👥 Contacts sync: ENABLED`);
    console.log(`📨 Only real-time messages`);
    console.log(`🔗 Webhook: ${WEBHOOK_URL || 'Not configured'}`);
    console.log(`☁️ Media upload: ${supabase ? 'Enabled' : 'Disabled'}\n`);
  });
}

init().catch(console.error);
