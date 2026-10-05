/**
 * ============================================
 * BAILEYS SERVER v4.0.0
 * ============================================
 * Servidor WhatsApp com reidratação de 1h
 * 
 * NOVIDADES v4.0.0:
 * - Reidratação: Ao reconectar, busca 1h de mensagens do banco
 * - Preservação: Nunca sobrescreve nome/foto com vazio
 * - Estabilidade: Heartbeat 20s, backoff inteligente
 * - Proteção: Limite de downloads concorrentes
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

// Rate limiting for media downloads
const mediaDownloadQueue = new Map();
const MAX_CONCURRENT_DOWNLOADS = 2;

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

    // Rate limiting: only 2 concurrent downloads
    const currentDownloads = mediaDownloadQueue.get(sessionId) || 0;
    if (currentDownloads >= MAX_CONCURRENT_DOWNLOADS) {
      console.log(`⏳ Too many downloads in progress, skipping media`);
      return { mediaType };
    }
    
    mediaDownloadQueue.set(sessionId, currentDownloads + 1);

    let buffer = null;
    const maxRetries = 3;
    
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
        const delay = attempt * 2000;
        console.log(`⚠️ Attempt ${attempt}/${maxRetries} failed. Waiting ${delay}ms...`);
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // Decrement download counter
    mediaDownloadQueue.set(sessionId, Math.max(0, (mediaDownloadQueue.get(sessionId) || 1) - 1));

    if (!buffer) {
      console.error('❌ Failed to download media after all retries');
      return { mediaType };
    }

    console.log(`✅ Downloaded: ${buffer.length} bytes`);

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

// ============== 1-HOUR REHYDRATION ==============

async function rehydrateRecentMessages(sessionId, instanceName, webhookSecret) {
  if (!supabase) {
    console.log('⚠️ Supabase not configured, skipping rehydration');
    return;
  }

  console.log(`\n🔄 Starting 1-hour rehydration for session ${instanceName}...`);

  try {
    // Get session's company_id
    const { data: sessionData, error: sessionError } = await supabase
      .from('whatsapp_sessions')
      .select('company_id')
      .eq('id', sessionId)
      .single();

    if (sessionError || !sessionData) {
      console.log('⚠️ Could not find session in database');
      return;
    }

    const companyId = sessionData.company_id;
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    // Get conversations with messages in the last hour
    const { data: conversations, error: convError } = await supabase
      .from('whatsapp_conversations')
      .select('id, contact_phone, contact_name, profile_picture')
      .eq('company_id', companyId)
      .gte('last_message_at', oneHourAgo);

    if (convError) {
      console.error('❌ Error fetching conversations:', convError.message);
      return;
    }

    console.log(`📋 Found ${conversations?.length || 0} conversations with recent messages`);

    if (!conversations || conversations.length === 0) {
      console.log('✅ No recent messages to rehydrate');
      return;
    }

    let totalMessages = 0;

    for (const conv of conversations) {
      // Get messages from last hour for this conversation
      const { data: messages, error: msgError } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('conversation_id', conv.id)
        .gte('timestamp', oneHourAgo)
        .order('timestamp', { ascending: true });

      if (msgError) {
        console.error(`❌ Error fetching messages for ${conv.contact_phone}:`, msgError.message);
        continue;
      }

      if (!messages || messages.length === 0) continue;

      console.log(`📨 Rehydrating ${messages.length} messages for ${conv.contact_name || conv.contact_phone}`);

      // Send messages in batches of 10
      const batchSize = 10;
      for (let i = 0; i < messages.length; i += batchSize) {
        const batch = messages.slice(i, i + batchSize);
        
        const formattedMessages = batch.map(msg => ({
          key: {
            remoteJid: formatJidForSend(conv.contact_phone, conv.contact_phone.length > 15),
            id: msg.wa_message_id || msg.id,
            fromMe: msg.from_me
          },
          message: {
            conversation: msg.content
          },
          messageTimestamp: Math.floor(new Date(msg.timestamp).getTime() / 1000),
          pushName: msg.sender_name || conv.contact_name,
          // Mark as rehydration so webhook knows not to send notification
          syncType: 'rehydration',
          // Include existing data
          groupName: conv.contact_name,
          senderPhone: msg.sender_phone || '',
          senderName: msg.sender_name || '',
          mediaUrl: msg.media_url || null,
          mediaType: msg.message_type !== 'text' ? msg.message_type : null,
          mediaCaption: msg.media_caption || '',
          // Preserve existing profile picture
          senderProfilePic: conv.profile_picture || null
        }));

        await sendWebhook({
          event: 'messages.upsert',
          sessionId,
          instanceName,
          webhookSecret,
          data: { 
            messages: formattedMessages,
            syncType: 'rehydration'
          }
        });

        totalMessages += batch.length;
        
        // Small delay between batches
        if (i + batchSize < messages.length) {
          await new Promise(r => setTimeout(r, 100));
        }
      }
    }

    console.log(`✅ Rehydration complete: ${totalMessages} messages sent to webhook\n`);
  } catch (error) {
    console.error('❌ Rehydration error:', error.message);
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
    // Clean up old session
    if (existing.socket) {
      try {
        existing.socket.end();
      } catch (e) {}
    }
    sessions.delete(sessionId);
  }

  const sessionPath = path.join(SESSIONS_DIR, instanceName);
  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
  const { version } = await fetchLatestBaileysVersion();

  console.log(`📱 Creating session: ${instanceName} (Baileys v${version.join('.')})`);
  console.log(`💓 Heartbeat: ENABLED (20s interval)`);
  console.log(`🔄 1-Hour Rehydration: ENABLED`);
  console.log(`🔒 Max concurrent downloads: ${MAX_CONCURRENT_DOWNLOADS}`);

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
    contacts: new Map(),
    lastActivity: Date.now()
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
    connectTimeoutMs: 120000,
    qrTimeout: 60000,
    keepAliveIntervalMs: 20000,
    syncFullHistory: false,
    shouldSyncHistoryMessage: () => false,
    fireInitQueries: true,
    generateHighQualityLinkPreview: false,
    markOnlineOnConnect: true,
    retryRequestDelayMs: 500,
    maxMsgRetryCount: 3
  });

  session.socket = socket;

  // Save credentials
  socket.ev.on('creds.update', saveCreds);

  // Connection updates
  socket.ev.on('connection.update', async (update) => {
    const { qr, connection, lastDisconnect } = update;

    if (qr) {
      session.qrCode = await QRCode.toDataURL(qr);
      console.log(`📱 QR generated`);

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
      session.lastActivity = Date.now();
      const wasReconnect = reconnectAttempt > 0;
      reconnectAttempt = 0;

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

      // ============== REHYDRATION: Run after reconnect ==============
      // Small delay to ensure webhook is ready
      setTimeout(async () => {
        await rehydrateRecentMessages(sessionId, instanceName, webhookSecret);
      }, 2000);
    }

    if (connection === 'close') {
      session.isConnected = false;
      
      if (session.heartbeatInterval) {
        clearInterval(session.heartbeatInterval);
        session.heartbeatInterval = null;
      }

      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const reason = lastDisconnect?.error?.output?.payload?.error || 'unknown';
      
      const isConflict = statusCode === 428;
      const isLoggedOut = statusCode === DisconnectReason?.loggedOut;
      const shouldReconnect = !isLoggedOut;

      console.log(`❌ Disconnected: ${statusCode} (${reason})`);

      await sendWebhook({
        event: 'connection.update',
        sessionId,
        instanceName,
        webhookSecret,
        data: { 
          connection: 'close', 
          isConnected: false, 
          statusCode,
          reason 
        }
      });

      sessions.delete(sessionId);

      if (shouldReconnect) {
        let delay;
        if (isConflict) {
          delay = 5000 + (reconnectAttempt * 5000);
          console.log(`⚠️ Conflict detected! Waiting ${delay}ms before reconnect...`);
        } else {
          delay = Math.min(Math.pow(2, reconnectAttempt + 1) * 1000, 30000);
        }
        
        console.log(`🔄 Reconnecting in ${delay}ms (attempt ${reconnectAttempt + 1})...`);
        setTimeout(() => createWhatsAppSession(sessionId, instanceName, webhookSecret, reconnectAttempt + 1), delay);
      }
    }
  });

  // Contacts sync
  socket.ev.on('contacts.set', async ({ contacts }) => {
    console.log(`👥 Received ${contacts?.length || 0} contacts`);
    if (!contacts?.length) return;
    
    const enriched = [];
    for (const c of contacts) {
      const phone = extractPhoneFromJid(c.id);
      if (!phone) continue;
      
      const e = { 
        id: c.id, 
        phone, 
        name: c.name || c.notify || c.verifiedName || null, 
        pushName: c.notify || null, 
        isGroup: isGroupJid(c.id) 
      };
      session.contacts.set(phone, e);
      enriched.push(e);
    }
    
    console.log(`👥 Processed ${enriched.length} contacts`);
    
    const batchSize = 100;
    for (let i = 0; i < enriched.length; i += batchSize) {
      await sendWebhook({ 
        event: 'contacts.set', 
        sessionId, 
        instanceName, 
        webhookSecret, 
        data: { contacts: enriched.slice(i, i + batchSize), total: enriched.length } 
      });
    }
  });

  socket.ev.on('contacts.update', async (updates) => {
    const enriched = [];
    for (const c of updates || []) {
      const phone = extractPhoneFromJid(c.id);
      if (!phone) continue;
      
      const existing = session.contacts.get(phone) || {};
      const e = { 
        ...existing, 
        id: c.id, 
        phone, 
        name: c.name || c.notify || existing.name || null, 
        pushName: c.notify || existing.pushName || null 
      };
      session.contacts.set(phone, e);
      enriched.push(e);
    }
    
    if (enriched.length) {
      await sendWebhook({ 
        event: 'contacts.update', 
        sessionId, 
        instanceName, 
        webhookSecret, 
        data: { contacts: enriched } 
      });
    }
  });

  // New messages
  socket.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') { 
      console.log(`⏭️ Skipping ${messages.length} (type: ${type})`); 
      return; 
    }
    
    console.log(`📨 Processing ${messages.length} messages`);
    
    for (const msg of messages) {
      if (msg.key.remoteJid === 'status@broadcast') continue;
      if (msg.message?.protocolMessage || msg.message?.reactionMessage) continue;
      
      const remoteJid = msg.key.remoteJid;
      if (remoteJid?.includes('@lid')) continue;
      
      const fromMe = msg.key.fromMe || false;
      const isGroup = isGroupJid(remoteJid);
      
      let senderPhone = '', senderName = '', groupName = '', groupProfilePic = null, contactProfilePic = null;
      
      if (isGroup) {
        const meta = await getGroupMetadata(socket, remoteJid);
        if (meta) groupName = meta.subject || '';
        groupProfilePic = await getProfilePicture(socket, remoteJid);
        
        if (!fromMe && msg.key.participant) {
          senderPhone = extractPhoneFromJid(msg.key.participant) || '';
          senderName = msg.pushName || '';
        }
      } else {
        if (!fromMe) { 
          senderPhone = extractPhoneFromJid(remoteJid) || ''; 
          senderName = msg.pushName || ''; 
        }
        contactProfilePic = await getProfilePicture(socket, remoteJid);
      }
      
      let mediaUrl = null, mediaMimeType = null, mediaType = null;
      const mediaCaption = getMediaCaption(msg);
      
      if (hasMedia(msg)) {
        const mediaResult = await processMediaMessage(socket, msg, sessionId);
        if (mediaResult) { 
          mediaUrl = mediaResult.mediaUrl || null; 
          mediaMimeType = mediaResult.mediaMimeType || null; 
          mediaType = mediaResult.mediaType || null; 
        }
      }
      
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
            groupName, 
            groupSubject: groupName, 
            groupProfilePic, 
            isGroup, 
            senderPhone, 
            senderName, 
            mediaUrl, 
            mediaMimeType, 
            mediaType, 
            mediaCaption, 
            senderProfilePic: contactProfilePic, 
            syncType: 'realtime'
          }] 
        }
      });
    }
  });

  // Message updates
  socket.ev.on('messages.update', async (updates) => { 
    await sendWebhook({ 
      event: 'messages.update', 
      sessionId, 
      instanceName, 
      webhookSecret, 
      data: { updates } 
    }); 
  });

  // Chats
  socket.ev.on('chats.upsert', async (chats) => {
    const enriched = [];
    for (const chat of chats) {
      const jid = chat.id;
      const isGroup = isGroupJid(jid);
      let e = { ...chat };
      
      if (isGroup) { 
        const meta = await getGroupMetadata(socket, jid); 
        if (meta) { 
          e.groupSubject = meta.subject; 
          e.name = meta.subject; 
        } 
      }
      e.profilePicture = await getProfilePicture(socket, jid);
      enriched.push(e);
    }
    await sendWebhook({ 
      event: 'chats.upsert', 
      sessionId, 
      instanceName, 
      webhookSecret, 
      data: { chats: enriched } 
    });
  });

  socket.ev.on('chats.set', async ({ chats }) => { 
    console.log(`🚫 Ignoring ${chats?.length || 0} historical chats`); 
  });
  
  socket.ev.on('messaging-history.set', async () => { 
    console.log(`🚫 Ignoring history sync`); 
  });

  return session;
}

// ============== API ENDPOINTS ==============

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    version: '4.0.0', 
    features: { 
      contactsSync: true, 
      mediaUpload: !!supabase, 
      heartbeat: true,
      rehydration: true
    }, 
    sessions: sessions.size, 
    timestamp: new Date().toISOString() 
  });
});

app.get('/api/sessions', (req, res) => {
  const list = [];
  for (const [id, session] of sessions) {
    list.push({
      sessionId: id,
      instanceName: session.instanceName,
      isConnected: session.isConnected,
      phoneNumber: session.phoneNumber,
      hasQr: !!session.qrCode
    });
  }
  res.json({ sessions: list });
});

app.post('/api/session/create', async (req, res) => {
  try {
    const { sessionId, instanceName, webhookSecret } = req.body;
    
    if (!sessionId || !instanceName) {
      return res.status(400).json({ error: 'sessionId and instanceName required' });
    }

    console.log(`\n📱 Creating session: ${instanceName}`);
    const session = await createWhatsAppSession(sessionId, instanceName, webhookSecret || '');

    res.json({
      success: true,
      sessionId: session.sessionId,
      instanceName: session.instanceName,
      status: session.isConnected ? 'connected' : 'waiting_qr'
    });
  } catch (error) {
    console.error('Session creation error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/session/:sessionId/qr', (req, res) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  res.json({
    qrCode: session.qrCode,
    isConnected: session.isConnected,
    phoneNumber: session.phoneNumber
  });
});

app.post('/api/session/:sessionId/disconnect', async (req, res) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  try {
    if (session.socket) {
      await session.socket.logout();
    }
    sessions.delete(sessionId);

    const sessionPath = path.join(SESSIONS_DIR, session.instanceName);
    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true });
    }

    res.json({ success: true, message: 'Session disconnected' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Force rehydration endpoint
app.post('/api/session/:sessionId/rehydrate', async (req, res) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  if (!session.isConnected) {
    return res.status(400).json({ error: 'Session not connected' });
  }

  try {
    await rehydrateRecentMessages(sessionId, session.instanceName, session.webhookSecret);
    res.json({ success: true, message: 'Rehydration triggered' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/message/send', async (req, res) => {
  const { sessionId, to, message, isGroup } = req.body;

  console.log(`📤 [SEND] Request: sessionId=${sessionId}, to=${to}, isGroup=${isGroup}`);

  if (!sessionId || !to || !message) {
    return res.status(400).json({ error: 'sessionId, to, and message required' });
  }

  const session = sessions.get(sessionId);
  if (!session) {
    console.error(`❌ [SEND] Session not found: ${sessionId}`);
    return res.status(404).json({ error: 'Session not found' });
  }

  if (!session.isConnected) {
    console.error(`❌ [SEND] Session not connected: ${sessionId}`);
    return res.status(400).json({ error: 'Session not connected' });
  }

  try {
    const jid = formatJidForSend(to, isGroup);
    console.log(`📤 [SEND] Sending to ${jid}`);

    const result = await session.socket.sendMessage(jid, { text: message });
    console.log(`✅ [SEND] Message sent: ${result.key.id}`);

    res.json({
      success: true,
      messageId: result.key.id,
      to: jid
    });
  } catch (error) {
    console.error(`❌ [SEND] Error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/message/send-media', async (req, res) => {
  const { sessionId, to, mediaUrl, mediaType, caption, isGroup, fileName } = req.body;

  if (!sessionId || !to || !mediaUrl) {
    return res.status(400).json({ error: 'sessionId, to, and mediaUrl required' });
  }

  const session = sessions.get(sessionId);
  if (!session || !session.isConnected) {
    return res.status(404).json({ error: 'Session not found or not connected' });
  }

  try {
    const jid = formatJidForSend(to, isGroup);
    let messageContent = {};

    const type = mediaType || 'image';
    if (type === 'image') {
      messageContent = { image: { url: mediaUrl }, caption: caption || '' };
    } else if (type === 'video') {
      messageContent = { video: { url: mediaUrl }, caption: caption || '' };
    } else if (type === 'audio' || type === 'ptt') {
      messageContent = { audio: { url: mediaUrl }, ptt: type === 'ptt' };
    } else if (type === 'document') {
      messageContent = { document: { url: mediaUrl }, fileName: fileName || 'document', caption: caption || '' };
    }

    const result = await session.socket.sendMessage(jid, messageContent);
    res.json({ success: true, messageId: result.key.id, to: jid });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============== STARTUP ==============

async function initialize() {
  try {
    const baileys = await import('@whiskeysockets/baileys');
    makeWASocket = baileys.default;
    useMultiFileAuthState = baileys.useMultiFileAuthState;
    DisconnectReason = baileys.DisconnectReason;
    fetchLatestBaileysVersion = baileys.fetchLatestBaileysVersion;
    makeCacheableSignalKeyStore = baileys.makeCacheableSignalKeyStore;
    downloadMediaMessage = baileys.downloadMediaMessage;
    Browsers = baileys.Browsers;

    QRCode = (await import('qrcode')).default;
    pino = (await import('pino')).default;
    mime = (await import('mime-types')).default;

    if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
      const { createClient } = await import('@supabase/supabase-js');
      supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
      console.log('✅ Supabase configured for media upload & rehydration');
    }

    console.log('✅ All modules loaded');
  } catch (error) {
    console.error('❌ Module loading error:', error);
    process.exit(1);
  }
}

const PORT = process.env.PORT || 3000;

initialize().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Baileys Server v4.0.0 running on port ${PORT}`);
    console.log(`📡 Webhook: ${WEBHOOK_URL || 'NOT CONFIGURED'}`);
    console.log(`💾 Supabase: ${supabase ? 'ENABLED' : 'DISABLED'}`);
    console.log(`🔄 1-Hour Rehydration: ENABLED`);
    console.log(`💓 Heartbeat: EVERY 20s\n`);
  });
});
