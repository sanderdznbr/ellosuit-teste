# Baileys Server v3.9.0

## Melhorias desta versão

### 🔧 Correções de Estabilidade
- **Código 428 (Conflict)**: Delay maior antes de reconectar quando há conflito de sessão
- **Download de Mídia**: Menos tentativas (3 em vez de 5) com delays maiores
- **Rate Limiting**: Máximo de 2 downloads simultâneos para evitar sobrecarga
- **Heartbeat**: Intervalo reduzido para 20s (mais frequente)

### 📊 Variáveis de Ambiente

```env
PORT=3000
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_WEBHOOK_URL=https://xxx.supabase.co/functions/v1/whatsapp-webhook
```

### 🚀 Deploy no Railway

1. Faça fork do repositório ou copie os arquivos
2. Conecte ao Railway
3. Configure as variáveis de ambiente
4. Deploy!

### ⚠️ Importante

Se o servidor continuar desconectando com código 428:
1. Verifique se não há outra instância do WhatsApp Web aberta
2. Desconecte todos os dispositivos no WhatsApp do celular (Configurações > Dispositivos Conectados)
3. Aguarde 5 minutos e reconecte

O código 428 significa que o WhatsApp detectou conflito de sessão - outra instância tentando usar a mesma conta.
