/**
 * ============================================
 * BAILEYS SERVER v3.9.0
 * ============================================
 * Servidor WhatsApp com estabilidade melhorada
 * 
 * MELHORIAS v3.9.0:
 * - FIX: Código 428 (conflict) com delay maior
 * - FIX: Download de mídia menos agressivo
 * - Heartbeat mais frequente (20s)
 * - Reconexão mais inteligente
 * - Proteção contra flood de requests
 * - Logs detalhados para debug
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
    const maxRetries = 3; // Reduced from 5 to 3
    
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
        const delay = attempt * 2000; // 2s, 4s, 6s (more conservative)
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
  console.log(`🔒 Max concurrent media downloads: ${MAX_CONCURRENT_DOWNLOADS}`);

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
    connectTimeoutMs: 120000, // Increased from 90s to 120s
    qrTimeout: 60000,
    keepAliveIntervalMs: 20000, // More frequent heartbeat (20s)
    syncFullHistory: false,
    shouldSyncHistoryMessage: () => false,
    fireInitQueries: true,
    generateHighQualityLinkPreview: false,
    markOnlineOnConnect: true,
    retryRequestDelayMs: 500, // Delay between retry requests
    maxMsgRetryCount: 3 // Max message retry count
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
    }

    if (connection === 'close') {
      session.isConnected = false;
      
      if (session.heartbeatInterval) {
        clearInterval(session.heartbeatInterval);
        session.heartbeatInterval = null;
      }

      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const reason = lastDisconnect?.error?.output?.payload?.error || 'unknown';
      
      // Specific handling for conflict (428)
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
        // Conflict (428) needs longer delay to let the other session stabilize
        let delay;
        if (isConflict) {
          delay = 5000 + (reconnectAttempt * 5000); // 5s, 10s, 15s... for conflicts
          console.log(`⚠️ Conflict detected! Waiting ${delay}ms before reconnect...`);
        } else {
          // Normal backoff: 2s, 4s, 8s, 16s, max 30s
          delay = Math.min(Math.pow(2, reconnectAttempt + 1) * 1000, 30000);
        }
        
        console.log(`🔄 Reconnecting in ${delay}ms (attempt ${reconnectAttempt + 1})...`);
        
        setTimeout(() => {
          createWhatsAppSession(sessionId, instanceName, webhookSecret, reconnectAttempt + 1);
        }, delay);
      } else {
        console.log(`🚪 Logged out - clearing session`);
        // Delete session files for clean restart
        try {
          fs.rmSync(sessionPath, { recursive: true, force: true });
        } catch (e) {
          console.log('Could not delete session files:', e.message);
        }
      }
    }
  });

  // Contacts sync
  socket.ev.on('contacts.set', async ({ contacts }) => {
    console.log(`👥 Syncing ${contacts?.length || 0} contacts`);
    
    if (!contacts || contacts.length === 0) return;
    
    for (const contact of contacts) {
      const phone = extractPhoneFromJid(contact.id);
      if (!phone) continue;
      
      session.contacts.set(phone, {
        id: contact.id,
        phone,
        name: contact.name || contact.notify || contact.verifiedName || null,
        pushName: contact.notify || null,
        verifiedName: contact.verifiedName || null,
        isGroup: isGroupJid(contact.id)
      });
    }

    await sendWebhook({
      event: 'contacts.sync',
      sessionId,
      instanceName,
      webhookSecret,
      data: { count: contacts.length }
    });
  });

  // Messages handler
  socket.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') {
      console.log(`⏭️ Skipping ${messages?.length || 0} (type: ${type})`);
      return;
    }

    console.log(`📨 Processing ${messages.length} messages`);
    session.lastActivity = Date.now();

    for (const msg of messages) {
      try {
        const remoteJid = msg.key?.remoteJid;
        if (!remoteJid || remoteJid === 'status@broadcast') continue;

        const isGroup = isGroupJid(remoteJid);
        const phone = extractPhoneFromJid(remoteJid);
        const senderJid = msg.key?.participant || msg.key?.remoteJid;
        const senderPhone = extractPhoneFromJid(senderJid);

        // Get message content
        let textContent = getTextContent(msg);
        let mediaData = null;
        let mediaCaption = '';

        if (hasMedia(msg)) {
          mediaCaption = getMediaCaption(msg);
          mediaData = await processMediaMessage(socket, msg, sessionId);
        }

        // Get contact/group info
        let contactName = null;
        let groupName = null;
        let senderName = null;

        if (isGroup) {
          const groupMeta = await getGroupMetadata(socket, remoteJid);
          groupName = groupMeta?.subject || null;
          
          if (senderPhone) {
            const senderContact = session.contacts.get(senderPhone);
            senderName = senderContact?.name || senderContact?.pushName || msg.pushName || null;
          }
        } else if (phone) {
          const contact = session.contacts.get(phone);
          contactName = contact?.name || contact?.pushName || msg.pushName || null;
        }

        // Build payload
        const payload = {
          event: 'messages.upsert',
          sessionId,
          instanceName,
          webhookSecret,
          data: {
            key: msg.key,
            messageId: msg.key?.id,
            remoteJid,
            phone,
            fromMe: msg.key?.fromMe || false,
            timestamp: msg.messageTimestamp,
            pushName: msg.pushName,
            content: textContent || mediaCaption,
            isGroup,
            groupName,
            participant: isGroup ? senderJid : null,
            participantPhone: isGroup ? senderPhone : null,
            senderName: isGroup ? senderName : contactName,
            contactName,
            mediaUrl: mediaData?.mediaUrl || null,
            mediaMimeType: mediaData?.mediaMimeType || null,
            mediaType: mediaData?.mediaType || null,
            rawMessage: msg.message
          }
        };

        await sendWebhook(payload);
      } catch (error) {
        console.error('❌ Message processing error:', error.message);
      }
    }
  });

  // Message status updates
  socket.ev.on('messages.update', async (updates) => {
    for (const update of updates) {
      if (update.update?.status) {
        await sendWebhook({
          event: 'messages.update',
          sessionId,
          instanceName,
          webhookSecret,
          data: {
            key: update.key,
            status: update.update.status
          }
        });
      }
    }
  });

  return session;
}

// ============== API ROUTES ==============

// Health check
app.get('/health', (req, res) => {
  const activeSessions = Array.from(sessions.values()).filter(s => s.isConnected).length;
  res.json({ 
    status: 'ok', 
    version: '3.9.0',
    activeSessions,
    uptime: process.uptime()
  });
});

// Create session
app.post('/api/session/create', async (req, res) => {
  try {
    const { sessionId, instanceName, webhookSecret } = req.body;
    
    if (!sessionId || !instanceName) {
      return res.status(400).json({ error: 'sessionId and instanceName required' });
    }

    const session = await createWhatsAppSession(sessionId, instanceName, webhookSecret || '');
    
    res.json({
      success: true,
      sessionId,
      instanceName,
      isConnected: session.isConnected,
      qrCode: session.qrCode
    });
  } catch (error) {
    console.error('Session creation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get session status
app.get('/api/session/:sessionId/status', (req, res) => {
  const session = sessions.get(req.params.sessionId);
  
  if (!session) {
    return res.json({ 
      exists: false, 
      isConnected: false 
    });
  }

  res.json({
    exists: true,
    isConnected: session.isConnected,
    phoneNumber: session.phoneNumber,
    pushName: session.pushName,
    profilePicture: session.profilePicture,
    qrCode: session.qrCode,
    lastActivity: session.lastActivity
  });
});

// Get QR code
app.get('/api/session/:sessionId/qr', (req, res) => {
  const session = sessions.get(req.params.sessionId);
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  if (session.isConnected) {
    return res.json({ connected: true, qrCode: null });
  }

  res.json({ connected: false, qrCode: session.qrCode });
});

// Disconnect session
app.post('/api/session/:sessionId/disconnect', async (req, res) => {
  const session = sessions.get(req.params.sessionId);
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  try {
    if (session.socket) {
      await session.socket.logout();
    }
    sessions.delete(req.params.sessionId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send text message
app.post('/api/message/send', async (req, res) => {
  try {
    const { sessionId, phone, message, isGroup } = req.body;
    const session = sessions.get(sessionId);
    
    if (!session?.isConnected) {
      return res.status(400).json({ error: 'Session not connected' });
    }

    const jid = formatJidForSend(phone, isGroup);
    const result = await session.socket.sendMessage(jid, { text: message });
    
    session.lastActivity = Date.now();
    
    res.json({ 
      success: true, 
      messageId: result?.key?.id,
      key: result?.key
    });
  } catch (error) {
    console.error('Send error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Send media
app.post('/api/message/media', async (req, res) => {
  try {
    const { sessionId, phone, mediaUrl, mediaType, caption, isGroup, fileName } = req.body;
    const session = sessions.get(sessionId);
    
    if (!session?.isConnected) {
      return res.status(400).json({ error: 'Session not connected' });
    }

    const jid = formatJidForSend(phone, isGroup);

    // Download media from URL
    console.log(`📥 Downloading media from: ${mediaUrl}`);
    const mediaResponse = await fetch(mediaUrl);
    
    if (!mediaResponse.ok) {
      throw new Error(`Failed to download media: ${mediaResponse.status}`);
    }
    
    const buffer = Buffer.from(await mediaResponse.arrayBuffer());
    const mimeType = mediaResponse.headers.get('content-type') || 'application/octet-stream';

    let messageContent;
    
    switch (mediaType) {
      case 'image':
        messageContent = {
          image: buffer,
          caption: caption || undefined,
          mimetype: mimeType
        };
        break;
      case 'video':
        messageContent = {
          video: buffer,
          caption: caption || undefined,
          mimetype: mimeType
        };
        break;
      case 'audio':
      case 'ptt':
        messageContent = {
          audio: buffer,
          mimetype: mimeType,
          ptt: mediaType === 'ptt'
        };
        break;
      case 'document':
        messageContent = {
          document: buffer,
          mimetype: mimeType,
          fileName: fileName || 'document'
        };
        break;
      default:
        return res.status(400).json({ error: 'Invalid media type' });
    }

    const result = await session.socket.sendMessage(jid, messageContent);
    
    session.lastActivity = Date.now();

    res.json({ 
      success: true, 
      messageId: result?.key?.id,
      key: result?.key
    });
  } catch (error) {
    console.error('Send media error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get contacts
app.get('/api/session/:sessionId/contacts', (req, res) => {
  const session = sessions.get(req.params.sessionId);
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const contacts = Array.from(session.contacts.values());
  res.json({ contacts, count: contacts.length });
});

// ============== STARTUP ==============

async function init() {
  try {
    // Import ESM modules
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
      console.log('✅ Supabase initialized');
    }

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`
╔════════════════════════════════════════════╗
║       BAILEYS SERVER v3.9.0 STARTED        ║
╠════════════════════════════════════════════╣
║ Port: ${PORT}                               ║
║ Heartbeat: 20s                             ║
║ Max concurrent downloads: ${MAX_CONCURRENT_DOWNLOADS}               ║
║ Conflict (428) handling: IMPROVED          ║
╚════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('Failed to start:', error);
    process.exit(1);
  }
}

init();
