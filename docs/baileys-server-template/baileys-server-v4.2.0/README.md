# Baileys Server v4.2.0

Servidor WhatsApp estável usando Baileys - **sem dependência do SDK Supabase**.

## Correções v4.2.0

- ✅ **Removida dependência `@supabase/supabase-js`** - usa `fetch` nativo
- ✅ QR Code gerado corretamente
- ✅ Metadados de grupos (foto, descrição, participantes)
- ✅ Status/bio de contatos individuais
- ✅ Sincronização de contatos via `contacts.set`
- ✅ Reconexão automática com backoff exponencial

## Instalação

```bash
npm install
npm start
```

## Variáveis de Ambiente

```env
PORT=3333
SUPABASE_WEBHOOK_URL=https://seu-projeto.supabase.co/functions/v1/whatsapp-webhook
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
```

## Dependências

- `@whiskeysockets/baileys`: ^6.7.17
- `express`: ^4.21.2
- `cors`: ^2.8.5
- `pino`: ^9.6.0
- `qrcode`: ^1.5.4

**NÃO** inclui `@supabase/supabase-js` - todas as chamadas são via `fetch`.

## Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/health` | Health check (retorna versão 4.2.0) |
| POST | `/api/instance/create` | Criar instância |
| GET | `/api/instance/:name/qr` | Obter QR Code |
| GET | `/api/instance/:name/status` | Status da conexão |
| POST | `/api/instance/:name/logout` | Desconectar |
| DELETE | `/api/instance/:name/delete` | Remover instância |
| POST | `/api/message/send` | Enviar texto |
| POST | `/api/message/send-media` | Enviar mídia |
| POST | `/api/message/send-voice` | Enviar áudio PTT |
| POST | `/api/message/read` | Marcar como lido |
