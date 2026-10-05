# 🚀 Baileys Server v4.1.0 - Metadados Completos

## ✨ Novidades v4.1.0

### 📸 Foto de Grupos
- Busca `profilePictureUrl()` para JIDs de grupo (`@g.us`)
- Exibe foto de perfil do grupo no CRM

### 📝 Descrição do Grupo
- Busca `groupMetadata().desc`
- Mostra descrição/bio do grupo

### 👥 Lista de Participantes
- Busca `groupMetadata().participants`
- Retorna lista com roles: `{ jid, isAdmin, isSuperAdmin }`
- Permite identificar admins do grupo

### 💬 Status dos Contatos
- Busca `fetchStatus(jid)` para contatos individuais
- Mostra o status/bio de cada contato

### 🔄 Reidratação de 1 Hora
- Ao reconectar, busca mensagens da última 1h do banco
- Sincroniza automaticamente com o webhook

## Deploy no Railway

1. New Project → Deploy from GitHub
2. Em **Variables**, adicione:
   - `SUPABASE_WEBHOOK_URL` = URL do seu webhook
   - `SUPABASE_URL` = URL do Supabase  
   - `SUPABASE_SERVICE_ROLE_KEY` = Service role key

**NÃO** defina PORT - Railway define automaticamente!

## Novo Endpoint

### GET /api/instance/:instanceName/contact/:jid/metadata

Busca metadados completos de um contato ou grupo específico.

**Resposta para grupo:**
```json
{
  "success": true,
  "profilePicture": "https://...",
  "groupDescription": "Grupo da família",
  "groupParticipants": [
    { "jid": "5511999...", "isAdmin": true, "isSuperAdmin": false },
    { "jid": "5511888...", "isAdmin": false, "isSuperAdmin": false }
  ],
  "status": null
}
```

**Resposta para contato:**
```json
{
  "success": true,
  "profilePicture": "https://...",
  "status": "Ocupado no trabalho",
  "groupDescription": null,
  "groupParticipants": null
}
```

## Estrutura do Webhook

O evento `messages.upsert` agora inclui metadados extras:

```json
{
  "event": "messages.upsert",
  "sessionId": "...",
  "instanceName": "minha-instancia",
  "data": {
    "messages": [{
      "key": { "remoteJid": "...", "fromMe": false, "id": "..." },
      "message": { "conversation": "Olá!" },
      "pushName": "João",
      "contactMetadata": {
        "profilePicture": "https://...",
        "status": "Online",
        "groupDescription": null,
        "groupParticipants": null
      }
    }]
  }
}
```

## Migração da v4.0.0

1. Baixe o novo servidor v4.1.0
2. No Railway: substitua arquivos
3. **NÃO** delete a pasta `sessions/` (mantém login)
4. Reinicie o serviço

Seus dados continuarão intactos!

## Comportamento

### ✅ O que será buscado automaticamente:
- Foto de perfil (contatos E grupos)
- Descrição do grupo
- Lista de participantes com roles
- Status/bio dos contatos individuais
- Mensagens da última 1h (ao reconectar)

### ⚠️ Limitações:
- Status de contatos só funciona se o contato permitir
- Foto de grupo precisa de permissão de visualização
- Dados são buscados a cada mensagem recebida
