# 🚀 Servidor Baileys para WhatsApp CRM

Este é o template completo do servidor Node.js que você precisa hospedar externamente (Railway, Render, VPS, etc.) para conectar o WhatsApp CRM do Lovable com o Baileys.

## 📦 Estrutura do Projeto

```
baileys-server/
├── src/
│   ├── server.ts          # Servidor Express principal
│   ├── whatsapp.ts        # Lógica Baileys
│   ├── routes/
│   │   ├── instance.ts    # Rotas de instância
│   │   └── message.ts     # Rotas de mensagem
│   └── types.ts           # Tipos TypeScript
├── sessions/              # Sessões Baileys (persistidas)
├── package.json
├── tsconfig.json
└── .env.example
```

## 🔧 Instalação

### 1. Criar o projeto

```bash
mkdir baileys-server
cd baileys-server
npm init -y
```

### 2. Instalar dependências

```bash
npm install express cors @whiskeysockets/baileys qrcode pino socket.io dotenv
npm install -D typescript ts-node nodemon @types/node @types/express @types/cors
```

### 3. Configurar TypeScript

```bash
npx tsc --init
```

Edite `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

### 4. Configurar variáveis de ambiente

Crie `.env`:
```env
PORT=3333
SUPABASE_WEBHOOK_URL=https://jwddiyuezqrpuakazvgg.supabase.co/functions/v1/whatsapp-webhook
```

## 📁 Código Fonte

### package.json

```json
{
  "name": "baileys-server",
  "version": "1.0.0",
  "main": "dist/server.js",
  "scripts": {
    "dev": "nodemon --exec ts-node src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js"
  },
  "dependencies": {
    "@whiskeysockets/baileys": "^6.7.0",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.18.2",
    "pino": "^8.19.0",
    "qrcode": "^1.5.3",
    "socket.io": "^4.7.4"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/node": "^20.11.19",
    "nodemon": "^3.0.3",
    "ts-node": "^10.9.2",
    "typescript": "^5.3.3"
  }
}
```

### src/server.ts

```typescript
import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import instanceRoutes from './routes/instance';
import messageRoutes from './routes/message';
import { sessions } from './whatsapp';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { 
  cors: { origin: '*' } 
});

// Export io for use in other modules
export { io };

app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    sessions: Object.keys(sessions).length,
    timestamp: new Date().toISOString()
  });
});

// Routes
app.use('/api/instance', instanceRoutes);
app.use('/api/message', messageRoutes);

// Socket.IO connection
io.on('connection', (socket) => {
  console.log('🔌 Client connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('🔌 Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3333;
server.listen(PORT, () => {
  console.log(`🚀 Baileys Server running on port ${PORT}`);
});
```

### src/types.ts

```typescript
import { WASocket } from '@whiskeysockets/baileys';

export interface Session {
  sessionId: string;
  instanceName: string;
  socket: WASocket | null;
  webhookUrl: string;
  webhookSecret: string;
  qrCode: string | null;
  isConnected: boolean;
  phoneNumber: string | null;
  pushName: string | null;
  profilePicture: string | null;
}

export interface WebhookPayload {
  event: string;
  sessionId: string;
  instanceName: string;
  data: any;
}
```

### src/whatsapp.ts

```typescript
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  WASocket
} from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import pino from 'pino';
import { Boom } from '@hapi/boom';
import fs from 'fs';
import path from 'path';
import { io } from './server';
import { Session, WebhookPayload } from './types';

const logger = pino({ level: 'silent' });

// Store active sessions
export const sessions: Map<string, Session> = new Map();

// Send webhook to Supabase
async function sendWebhook(payload: WebhookPayload) {
  const session = sessions.get(payload.sessionId);
  if (!session?.webhookUrl) return;

  try {
    await fetch(session.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': session.webhookSecret
      },
      body: JSON.stringify(payload)
    });
    console.log(`📤 Webhook sent: ${payload.event}`);
  } catch (error) {
    console.error('Webhook error:', error);
  }
}

// Create or restore WhatsApp session
export async function createSession(config: {
  sessionId: string;
  instanceName: string;
  webhookUrl: string;
  webhookSecret: string;
}) {
  const { sessionId, instanceName, webhookUrl, webhookSecret } = config;
  
  // Check if session already exists
  if (sessions.has(sessionId)) {
    console.log(`Session ${instanceName} already exists`);
    return sessions.get(sessionId);
  }

  const sessionPath = path.join(__dirname, '..', 'sessions', instanceName);
  
  // Create sessions directory if it doesn't exist
  if (!fs.existsSync(path.join(__dirname, '..', 'sessions'))) {
    fs.mkdirSync(path.join(__dirname, '..', 'sessions'), { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
  const { version, isLatest } = await fetchLatestBaileysVersion();
  
  console.log(`📱 Creating session: ${instanceName} (Baileys v${version.join('.')}, latest: ${isLatest})`);

  const session: Session = {
    sessionId,
    instanceName,
    socket: null,
    webhookUrl,
    webhookSecret,
    qrCode: null,
    isConnected: false,
    phoneNumber: null,
    pushName: null,
    profilePicture: null
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
    defaultQueryTimeoutMs: 60000
  });

  session.socket = socket;

  // Handle credentials update
  socket.ev.on('creds.update', saveCreds);

  // Handle connection updates
  socket.ev.on('connection.update', async (update) => {
    const { qr, connection, lastDisconnect } = update;

    // QR Code received
    if (qr) {
      const qrDataUrl = await QRCode.toDataURL(qr);
      session.qrCode = qrDataUrl;
      
      // Emit to Socket.IO
      io.emit('qr', { sessionId, instanceName, qr: qrDataUrl });
      
      // Send webhook
      await sendWebhook({
        event: 'qr.update',
        sessionId,
        instanceName,
        data: { qrCode: qrDataUrl }
      });
      
      console.log(`📱 QR Code generated for ${instanceName}`);
    }

    // Connection opened
    if (connection === 'open') {
      session.isConnected = true;
      session.qrCode = null;
      
      // Get profile info
      const user = socket.user;
      if (user) {
        session.phoneNumber = user.id.split(':')[0].replace('@s.whatsapp.net', '');
        session.pushName = user.name || user.notify || null;
        
        try {
          const pp = await socket.profilePictureUrl(user.id, 'image');
          session.profilePicture = pp;
        } catch (e) {
          console.log('Could not fetch profile picture');
        }
      }
      
      io.emit('connected', { 
        sessionId, 
        instanceName,
        phoneNumber: session.phoneNumber,
        pushName: session.pushName
      });
      
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
      });
      
      console.log(`✅ ${instanceName} connected!`);
    }

    // Connection closed
    if (connection === 'close') {
      session.isConnected = false;
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      
      console.log(`❌ ${instanceName} disconnected. Code: ${statusCode}. Reconnect: ${shouldReconnect}`);
      
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
      });

      if (shouldReconnect) {
        console.log(`🔄 Reconnecting ${instanceName}...`);
        setTimeout(() => {
          sessions.delete(sessionId);
          createSession(config);
        }, 5000);
      } else {
        console.log(`🚫 ${instanceName} logged out - manual reconnection required`);
        sessions.delete(sessionId);
      }
    }
  });

  // Handle incoming messages
  socket.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      // Skip status messages
      if (msg.key.remoteJid === 'status@broadcast') continue;
      
      console.log(`📨 Message from ${msg.key.remoteJid}: ${msg.message?.conversation || '[media]'}`);
      
      await sendWebhook({
        event: 'messages.upsert',
        sessionId,
        instanceName,
        data: {
          messages: [{
            key: msg.key,
            message: msg.message,
            messageTimestamp: msg.messageTimestamp,
            pushName: msg.pushName
          }]
        }
      });
    }
  });

  // Handle message status updates
  socket.ev.on('messages.update', async (updates) => {
    await sendWebhook({
      event: 'messages.update',
      sessionId,
      instanceName,
      data: { updates }
    });
  });

  // Handle contacts update
  socket.ev.on('contacts.update', async (contacts) => {
    await sendWebhook({
      event: 'contacts.update',
      sessionId,
      instanceName,
      data: { contacts }
    });
  });

  return session;
}

// Get session
export function getSession(sessionId: string): Session | undefined {
  return sessions.get(sessionId);
}

// Get session by instance name
export function getSessionByName(instanceName: string): Session | undefined {
  for (const session of sessions.values()) {
    if (session.instanceName === instanceName) {
      return session;
    }
  }
  return undefined;
}

// Delete session
export async function deleteSession(sessionId: string): Promise<boolean> {
  const session = sessions.get(sessionId);
  if (!session) return false;
  
  try {
    if (session.socket) {
      await session.socket.logout();
    }
  } catch (e) {
    console.log('Error logging out:', e);
  }
  
  // Delete session files
  const sessionPath = path.join(__dirname, '..', 'sessions', session.instanceName);
  if (fs.existsSync(sessionPath)) {
    fs.rmSync(sessionPath, { recursive: true });
  }
  
  sessions.delete(sessionId);
  return true;
}

// Logout session (but keep files for reconnection)
export async function logoutSession(sessionId: string): Promise<boolean> {
  const session = sessions.get(sessionId);
  if (!session) return false;
  
  try {
    if (session.socket) {
      await session.socket.logout();
    }
    sessions.delete(sessionId);
    return true;
  } catch (e) {
    console.error('Error logging out:', e);
    return false;
  }
}
```

### src/routes/instance.ts

```typescript
import { Router } from 'express';
import { createSession, getSession, getSessionByName, deleteSession, logoutSession, sessions } from '../whatsapp';

const router = Router();

// Create new instance
router.post('/create', async (req, res) => {
  try {
    const { sessionId, instanceName, webhookUrl, webhookSecret } = req.body;
    
    if (!sessionId || !instanceName) {
      return res.status(400).json({ error: 'sessionId and instanceName are required' });
    }
    
    const session = await createSession({
      sessionId,
      instanceName,
      webhookUrl: webhookUrl || process.env.SUPABASE_WEBHOOK_URL || '',
      webhookSecret: webhookSecret || ''
    });
    
    res.json({
      success: true,
      sessionId: session?.sessionId,
      instanceName: session?.instanceName,
      qrCode: session?.qrCode
    });
  } catch (error) {
    console.error('Create instance error:', error);
    res.status(500).json({ error: 'Failed to create instance' });
  }
});

// Get QR code
router.get('/:instanceName/qr', (req, res) => {
  const { instanceName } = req.params;
  const session = getSessionByName(instanceName);
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  res.json({
    qrCode: session.qrCode,
    isConnected: session.isConnected
  });
});

// Get status
router.get('/:instanceName/status', (req, res) => {
  const { instanceName } = req.params;
  const session = getSessionByName(instanceName);
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  res.json({
    status: session.isConnected ? 'connected' : 'disconnected',
    isConnected: session.isConnected,
    phoneNumber: session.phoneNumber,
    pushName: session.pushName,
    profilePicture: session.profilePicture
  });
});

// Logout instance
router.post('/:instanceName/logout', async (req, res) => {
  const { instanceName } = req.params;
  const session = getSessionByName(instanceName);
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  const success = await logoutSession(session.sessionId);
  res.json({ success });
});

// Delete instance
router.delete('/:instanceName/delete', async (req, res) => {
  const { instanceName } = req.params;
  const session = getSessionByName(instanceName);
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  const success = await deleteSession(session.sessionId);
  res.json({ success });
});

// List all sessions
router.get('/list', (req, res) => {
  const sessionList = Array.from(sessions.values()).map(s => ({
    sessionId: s.sessionId,
    instanceName: s.instanceName,
    isConnected: s.isConnected,
    phoneNumber: s.phoneNumber,
    pushName: s.pushName
  }));
  
  res.json({ sessions: sessionList });
});

export default router;
```

### src/routes/message.ts

```typescript
import { Router } from 'express';
import { getSessionByName, sessions } from '../whatsapp';
import fs from 'fs';
import path from 'path';

const router = Router();

// Send text message
router.post('/send', async (req, res) => {
  try {
    const { instanceName, jid, message } = req.body;
    
    if (!instanceName || !jid || !message) {
      return res.status(400).json({ error: 'instanceName, jid, and message are required' });
    }
    
    const session = getSessionByName(instanceName);
    if (!session || !session.socket) {
      return res.status(404).json({ error: 'Session not found or not connected' });
    }
    
    if (!session.isConnected) {
      return res.status(400).json({ error: 'Session not connected' });
    }
    
    const result = await session.socket.sendMessage(jid, message);
    
    res.json({
      success: true,
      messageId: result.key.id,
      key: result.key
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Send media message
router.post('/send-media', async (req, res) => {
  try {
    const { instanceName, jid, mediaUrl, mediaType, caption } = req.body;
    
    if (!instanceName || !jid || !mediaUrl) {
      return res.status(400).json({ error: 'instanceName, jid, and mediaUrl are required' });
    }
    
    const session = getSessionByName(instanceName);
    if (!session || !session.socket || !session.isConnected) {
      return res.status(404).json({ error: 'Session not found or not connected' });
    }
    
    let messageContent: any;
    
    switch (mediaType) {
      case 'image':
        messageContent = { 
          image: { url: mediaUrl }, 
          caption 
        };
        break;
      case 'video':
        messageContent = { 
          video: { url: mediaUrl }, 
          caption 
        };
        break;
      case 'audio':
        messageContent = { 
          audio: { url: mediaUrl }, 
          mimetype: 'audio/mp4',
          ptt: false
        };
        break;
      case 'document':
        messageContent = { 
          document: { url: mediaUrl },
          fileName: caption || 'document'
        };
        break;
      default:
        messageContent = { 
          image: { url: mediaUrl }, 
          caption 
        };
    }
    
    const result = await session.socket.sendMessage(jid, messageContent);
    
    res.json({
      success: true,
      messageId: result.key.id,
      key: result.key
    });
  } catch (error) {
    console.error('Send media error:', error);
    res.status(500).json({ error: 'Failed to send media' });
  }
});

// Send voice message (PTT)
router.post('/send-voice', async (req, res) => {
  try {
    const { instanceName, jid, audioUrl } = req.body;
    
    if (!instanceName || !jid || !audioUrl) {
      return res.status(400).json({ error: 'instanceName, jid, and audioUrl are required' });
    }
    
    const session = getSessionByName(instanceName);
    if (!session || !session.socket || !session.isConnected) {
      return res.status(404).json({ error: 'Session not found or not connected' });
    }
    
    const result = await session.socket.sendMessage(jid, {
      audio: { url: audioUrl },
      mimetype: 'audio/ogg; codecs=opus',
      ptt: true // Push to talk = voice message
    });
    
    res.json({
      success: true,
      messageId: result.key.id,
      key: result.key
    });
  } catch (error) {
    console.error('Send voice error:', error);
    res.status(500).json({ error: 'Failed to send voice message' });
  }
});

// Mark messages as read
router.post('/read', async (req, res) => {
  try {
    const { instanceName, keys } = req.body;
    
    if (!instanceName || !keys || !Array.isArray(keys)) {
      return res.status(400).json({ error: 'instanceName and keys array are required' });
    }
    
    const session = getSessionByName(instanceName);
    if (!session || !session.socket || !session.isConnected) {
      return res.status(404).json({ error: 'Session not found or not connected' });
    }
    
    await session.socket.readMessages(keys);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
});

export default router;
```

## 🚀 Deploy

### Railway

1. Criar conta em [railway.app](https://railway.app)
2. Conectar repositório GitHub
3. Configurar variáveis de ambiente:
   - `PORT=3333`
   - `SUPABASE_WEBHOOK_URL=https://jwddiyuezqrpuakazvgg.supabase.co/functions/v1/whatsapp-webhook`
4. Deploy automático

### Render

1. Criar conta em [render.com](https://render.com)
2. New > Web Service
3. Conectar repositório
4. Build Command: `npm install && npm run build`
5. Start Command: `npm start`
6. Configurar variáveis de ambiente

### VPS (Ubuntu)

```bash
# Instalar Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clonar repositório
git clone https://github.com/seu-usuario/baileys-server.git
cd baileys-server

# Instalar dependências
npm install
npm run build

# Usar PM2 para manter rodando
npm install -g pm2
pm2 start dist/server.js --name baileys-server
pm2 save
pm2 startup
```

## 📡 Endpoints da API

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/health` | Health check |
| POST | `/api/instance/create` | Criar nova instância |
| GET | `/api/instance/:name/qr` | Obter QR code |
| GET | `/api/instance/:name/status` | Status da conexão |
| POST | `/api/instance/:name/logout` | Desconectar |
| DELETE | `/api/instance/:name/delete` | Excluir instância |
| GET | `/api/instance/list` | Listar todas instâncias |
| POST | `/api/message/send` | Enviar mensagem texto |
| POST | `/api/message/send-media` | Enviar mídia |
| POST | `/api/message/send-voice` | Enviar áudio |
| POST | `/api/message/read` | Marcar como lido |

## 🔗 Conectando ao Lovable

Após fazer deploy do servidor:

1. Acesse `/dashboard/crm-whatsapp` no Lovable
2. Clique em "Conectar WhatsApp"
3. Na tela de configuração, informe a URL do seu servidor Baileys:
   - Exemplo: `https://seu-servidor.railway.app`
4. Escaneie o QR Code com seu WhatsApp
5. Pronto! Mensagens serão sincronizadas automaticamente

## ⚠️ Importante

- **Nunca exponha este servidor publicamente sem autenticação**
- Use HTTPS em produção
- As sessões são salvas na pasta `sessions/` - faça backup
- O WhatsApp pode banir números que enviam muitas mensagens automatizadas
- Use com responsabilidade e siga os Termos de Serviço do WhatsApp
