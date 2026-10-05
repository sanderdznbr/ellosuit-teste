/**
 * Endpoint: POST /api/number/check
 * 
 * Verifica se um número existe no WhatsApp e retorna o JID correto.
 * Usa a função onWhatsApp() do Baileys para resolver o número real.
 * 
 * Body: { "instanceName": "xxx", "phone": "5541996875461" }
 * Response: { "exists": true, "jid": "554196875461@s.whatsapp.net" }
 * 
 * INSTRUÇÕES:
 * Cole este código no seu index.js do servidor Baileys (Railway),
 * ANTES dos endpoints de envio de mensagem (/api/message/send).
 * 
 * Compatível com Baileys v4.6.0+ / v4.7.0
 */

// ============================================================
// COPIE E COLE O BLOCO ABAIXO NO SEU index.js DO BAILEYS
// ============================================================

app.post('/api/number/check', async (req, res) => {
  try {
    const { instanceName, phone } = req.body;

    if (!phone) {
      return res.status(400).json({ error: 'phone is required' });
    }

    // Buscar a instância/socket ativa
    const instance = instances.get(instanceName);
    if (!instance || !instance.socket) {
      return res.status(404).json({ error: 'Instance not found or not connected' });
    }

    const socket = instance.socket;

    // Limpar o número (só dígitos)
    const cleanPhone = phone.replace(/\D/g, '');

    // Usar onWhatsApp() do Baileys para verificar se o número existe
    const [result] = await socket.onWhatsApp(cleanPhone);

    if (result && result.exists) {
      return res.json({
        exists: true,
        jid: result.jid,
      });
    } else {
      return res.json({
        exists: false,
        jid: null,
      });
    }
  } catch (error) {
    console.error('Error checking number:', error);
    return res.status(500).json({
      error: 'Failed to check number',
      details: error.message,
    });
  }
});
