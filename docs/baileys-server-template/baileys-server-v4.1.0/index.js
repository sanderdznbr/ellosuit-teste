/**
 * Baileys Server v4.1.0 - Metadados Completos
 * 
 * NOVIDADES v4.1.0:
 * - Foto de perfil de GRUPOS (profilePictureUrl para grupos)
 * - Descrição do grupo (groupMetadata().desc)
 * - Lista de participantes com roles (admin/member)
 * - Status/bio dos contatos individuais (fetchStatus)
 * - Reidratação de 1h de mensagens ao reconectar
 * - Preservação de metadados existentes
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

// Função para buscar metadados completos de um contato/grupo
async function fetchContactMetadata(socket, jid) {
  const metadata = {
    profilePicture: null,
    status: null,
    groupDescription: null,
    groupParticipants: null
  };

  const isGroup = jid.endsWith('@g.us');

  try {
    // Buscar foto de perfil (funciona para contatos E grupos)
    try {
      metadata.profilePicture = await socket.profilePictureUrl(jid, 'image');
    } catch (e) {
      // Sem foto de perfil
    }

    if (isGroup) {
      // Para grupos: buscar metadados completos
      try {
        const groupMeta = await socket.groupMetadata(jid);
        metadata.groupDescription = groupMeta.desc || null;
        metadata.groupParticipants = groupMeta.participants?.map(p => ({
          jid: p.id,
          isAdmin: p.admin === 'admin' || p.admin === 'superadmin',
          isSuperAdmin: p.admin === 'superadmin'
        })) || [];
      } catch (e) {
        console.log(`Erro ao buscar metadados do grupo ${jid}:`, e.message);
      }
    } else {
      // Para contatos individuais: buscar status/bio
      try {
        const statusResult = await socket.fetchStatus(jid);
        if (statusResult?.status) {
          metadata.status = statusResult.status;
        }
      } catch (e) {
        // Sem status disponível
      }
    }
  } catch (e) {
    console.error(`Erro ao buscar metadados de ${jid}:`, e.message);
  }

  return metadata;
}

// Enviar webhook para Supabase
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
      console.error('Webhook error:', response.status, await response.text());
    }
  } catch (error) {
    console.error('Webhook fetch error:', error.message);
  }
}

// Reidratação: buscar mensagens da última 1 hora e reenviar
async function rehydrateMessages(sessionId, instanceName, webhookUrl, webhookSecret) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.log('⚠️ Supabase não configurado, pulando reidratação');
    return;
  }

  try {
    console.log(`🔄 Iniciando reidratação de mensagens para ${instanceName}...`);
    
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    // Buscar conversas com mensagens recentes
    const convResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/whatsapp_conversations?session_id=eq.${sessionId}&last_message_at=gte.${oneHourAgo}&select=id,contact_phone,contact_name,profile_picture`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        }
      }
    );

    if (!convResponse.ok) {
      console.error('Erro ao buscar conversas:', await convResponse.text());
      return;
    }

    const conversations = await convResponse.json();
    console.log(`📋 Encontradas ${conversations.length} conversas com mensagens recentes`);

    for (const conv of conversations) {
      // Buscar mensagens dessa conversa da última 1h
      const msgResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/whatsapp_messages?conversation_id=eq.${conv.id}&created_at=gte.${oneHourAgo}&order=created_at.asc&select=*`,
        {
          headers: {
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
          }
        }
      );

      if (!msgResponse.ok) continue;

      const messages = await msgResponse.json();
      if (messages.length === 0) continue;

      console.log(`📨 Reenviando ${messages.length} mensagens de ${conv.contact_name || conv.contact_phone}`);

      // Reformatar mensagens para o formato do webhook
      const formattedMessages = messages.map(msg => ({
        key: {
          remoteJid: conv.contact_phone,
          fromMe: msg.is_from_me,
          id: msg.wa_message_id
        },
        message: msg.message_type === 'text' 
          ? { conversation: msg.content }
          : { [msg.message_type]: { url: msg.media_url, caption: msg.content } },
        messageTimestamp: Math.floor(new Date(msg.created_at).getTime() / 1000),
        pushName: conv.contact_name
      }));

      // Enviar ao webhook com flag de reidratação
      await sendWebhook({
        event: 'messages.upsert',
        sessionId,
        instanceName,
        syncType: 'rehydration',
        data: { messages: formattedMessages }
      }, webhookUrl, webhookSecret);

      // Pequeno delay para não sobrecarregar
      await new Promise(r => setTimeout(r, 100));
    }

    console.log(`✅ Reidratação concluída para ${instanceName}`);
  } catch (error) {
    console.error('Erro na reidratação:', error);
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
      const qrDataUrl = await QRCode.toDataURL(qr);
      session.qrCode = qrDataUrl;
      
      await sendWebhook({
        event: 'qr.update',
        sessionId,
        instanceName,
        data: { qrCode: qrDataUrl }
      }, webhookUrl, webhookSecret);
      
      console.log(`📱 QR Code gerado para ${instanceName}`);
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

      // Iniciar reidratação em background
      setTimeout(() => {
        rehydrateMessages(sessionId, instanceName, webhookUrl, webhookSecret);
      }, 3000);
    }

    if (connection === 'close') {
      session.isConnected = false;
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      
      console.log(`❌ ${instanceName} desconectado. Código: ${statusCode}. Reconectar: ${shouldReconnect}`);
      
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
        console.log(`🔄 Reconectando ${instanceName} em ${delay/1000}s (tentativa ${session.reconnectAttempts})`);
        
        setTimeout(() => {
          sessions.delete(sessionId);
          createSession(config);
        }, delay);
      } else if (statusCode === DisconnectReason.loggedOut) {
        console.log(`🚫 ${instanceName} deslogado - reconexão manual necessária`);
        sessions.delete(sessionId);
      }
    }
  });

  // Mensagens recebidas
  socket.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      if (msg.key.remoteJid === 'status@broadcast') continue;
      
      const jid = msg.key.remoteJid;
      const isGroup = jid.endsWith('@g.us');
      
      console.log(`📨 Mensagem de ${jid}: ${msg.message?.conversation || '[mídia]'}`);
      
      // Buscar metadados completos do contato/grupo
      const metadata = await fetchContactMetadata(socket, jid);
      
      // Preparar dados da mensagem
      let mediaUrl = null;
      let mediaType = null;
      
      // Detectar tipo de mídia
      const msgContent = msg.message;
      if (msgContent) {
        if (msgContent.imageMessage) mediaType = 'image';
        else if (msgContent.videoMessage) mediaType = 'video';
        else if (msgContent.audioMessage) mediaType = 'audio';
        else if (msgContent.documentMessage) mediaType = 'document';
        else if (msgContent.stickerMessage) mediaType = 'sticker';
      }

      // Download de mídia com controle de concorrência
      if (mediaType && !msg.key.fromMe) {
        try {
          await acquireDownload();
          const buffer = await downloadMediaMessage(msg, 'buffer', {});
          
          if (buffer && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
            // Upload para Supabase Storage
            const fileName = `${sessionId}/${Date.now()}_${msg.key.id}.${mediaType === 'audio' ? 'ogg' : mediaType === 'video' ? 'mp4' : 'jpg'}`;
            
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
          console.error('Erro no download de mídia:', e.message);
        } finally {
          releaseDownload();
        }
      }

      // Enviar webhook com todos os metadados
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
            // Metadados extras v4.1.0
            contactMetadata: {
              profilePicture: metadata.profilePicture,
              status: metadata.status,
              groupDescription: metadata.groupDescription,
              groupParticipants: metadata.groupParticipants
            }
          }]
        }
      }, webhookUrl, webhookSecret);
    }
  });

  // Atualização de status de mensagens
  socket.ev.on('messages.update', async (updates) => {
    await sendWebhook({
      event: 'messages.update',
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
    version: '4.1.0',
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
    console.error('Erro ao criar instância:', error);
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

// Buscar metadados de um contato/grupo específico
app.get('/api/instance/:instanceName/contact/:jid/metadata', async (req, res) => {
  const session = Array.from(sessions.values()).find(s => s.instanceName === req.params.instanceName);
  
  if (!session || !session.socket || !session.isConnected) {
    return res.status(404).json({ error: 'Sessão não encontrada ou desconectada' });
  }

  try {
    const metadata = await fetchContactMetadata(session.socket, req.params.jid);
    res.json({ success: true, ...metadata });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
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

// Enviar mensagem de texto
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
    console.error('Erro ao enviar mensagem:', error);
    res.status(500).json({ error: 'Falha ao enviar mensagem' });
  }
});

// Enviar mídia
app.post('/api/message/send-media', async (req, res) => {
  try {
    const { instanceName, jid, mediaUrl, mediaType, caption } = req.body;
    
    const session = Array.from(sessions.values()).find(s => s.instanceName === instanceName);
    if (!session || !session.socket || !session.isConnected) {
      return res.status(404).json({ error: 'Sessão não encontrada ou desconectada' });
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
    
    res.json({
      success: true,
      messageId: result.key.id,
      key: result.key
    });
  } catch (error) {
    console.error('Erro ao enviar mídia:', error);
    res.status(500).json({ error: 'Falha ao enviar mídia' });
  }
});

// Enviar áudio de voz (PTT)
app.post('/api/message/send-voice', async (req, res) => {
  try {
    const { instanceName, jid, audioUrl } = req.body;
    
    const session = Array.from(sessions.values()).find(s => s.instanceName === instanceName);
    if (!session || !session.socket || !session.isConnected) {
      return res.status(404).json({ error: 'Sessão não encontrada ou desconectada' });
    }
    
    const result = await session.socket.sendMessage(jid, {
      audio: { url: audioUrl },
      mimetype: 'audio/ogg; codecs=opus',
      ptt: true
    });
    
    res.json({
      success: true,
      messageId: result.key.id,
      key: result.key
    });
  } catch (error) {
    console.error('Erro ao enviar voz:', error);
    res.status(500).json({ error: 'Falha ao enviar mensagem de voz' });
  }
});

// Marcar como lido
app.post('/api/message/read', async (req, res) => {
  try {
    const { instanceName, keys } = req.body;
    
    const session = Array.from(sessions.values()).find(s => s.instanceName === instanceName);
    if (!session || !session.socket || !session.isConnected) {
      return res.status(404).json({ error: 'Sessão não encontrada ou desconectada' });
    }
    
    await session.socket.readMessages(keys);
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao marcar como lido:', error);
    res.status(500).json({ error: 'Falha ao marcar mensagens como lidas' });
  }
});

// Iniciar servidor
server.listen(PORT, () => {
  console.log(`🚀 Baileys Server v4.1.0 rodando na porta ${PORT}`);
  console.log(`📡 Webhook: ${SUPABASE_WEBHOOK_URL || 'não configurado'}`);
  console.log(`🗄️ Supabase: ${SUPABASE_URL ? 'configurado' : 'não configurado'}`);
});
