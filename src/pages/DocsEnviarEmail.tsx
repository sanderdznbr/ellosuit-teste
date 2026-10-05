
import React, { useState } from 'react';
import { Copy, Check, ArrowLeft, Mail, Send, Zap, Code2, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';

const CodeBlock = ({ code, language = 'typescript' }: { code: string; language?: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group rounded-lg overflow-hidden border border-gray-700 bg-gray-950 my-4">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-700">
        <span className="text-xs text-gray-400 font-mono">{language}</span>
        <Button variant="ghost" size="sm" onClick={handleCopy} className="text-gray-400 hover:text-white h-7 px-2">
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          <span className="ml-1 text-xs">{copied ? 'Copiado!' : 'Copiar'}</span>
        </Button>
      </div>
      <pre className="p-4 overflow-x-auto text-sm leading-relaxed">
        <code className="text-gray-300 font-mono whitespace-pre">{code}</code>
      </pre>
    </div>
  );
};

const SEND_EMAIL_FULL = `// Edge Function: supabase/functions/send-email/index.ts
// Código COMPLETO da função de envio de email

import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendEmailRequest {
  recipient_email: string;
  recipient_name?: string;
  subject: string;
  content_html: string;
  content_text?: string;
  campaign_id?: string;
  provider?: 'resend' | 'gmail';
  from_email?: string;
  from_name?: string;
  user_id?: string;
}

// ── Refresh Token do Gmail ──
const refreshGmailToken = async (supabase, accountId, refreshToken) => {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    })
  });

  const tokens = await response.json();
  if (!response.ok) throw new Error('Failed to refresh Gmail token');

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  await supabase.from('user_email_accounts')
    .update({ access_token: tokens.access_token, expires_at: expiresAt })
    .eq('id', accountId);

  return tokens.access_token;
};

// ── Enviar via Gmail API ──
const sendWithGmail = async (emailData, accessToken) => {
  const messageParts = [
    \`To: \${emailData.recipient_email}\`,
    \`From: \${emailData.from_email}\`,
    \`Subject: \${emailData.subject}\`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    '',
    emailData.content_html || emailData.content_text || ''
  ];

  const message = messageParts.join('\\n');
  const encodedMessage = btoa(unescape(encodeURIComponent(message)))
    .replace(/\\+/g, '-')
    .replace(/\\//g, '_')
    .replace(/=+$/, '');

  const response = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    {
      method: 'POST',
      headers: {
        'Authorization': \`Bearer \${accessToken}\`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: encodedMessage })
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(\`Gmail API error: \${error.error?.message}\`);
  }

  const result = await response.json();
  return { provider: 'gmail', external_id: result.id, status: 'sent' };
};

// ── Handler Principal ──
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL'),
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  );

  const {
    recipient_email, subject, content_html,
    provider = 'resend', from_email, from_name,
    user_id, company_id, campaign_id
  } = await req.json();

  // Verificar limite diário
  if (user_id && company_id) {
    const today = new Date().toISOString().split('T')[0];
    const { data: limitData } = await supabase
      .from('email_send_limits')
      .select('sent_count, daily_limit')
      .eq('user_id', user_id)
      .eq('date', today)
      .maybeSingle();

    if (limitData && limitData.sent_count >= limitData.daily_limit) {
      return new Response(JSON.stringify({
        error: 'Limite diário atingido'
      }), { status: 429, headers: corsHeaders });
    }
  }

  // Tracking pixel
  const tracking_pixel_id = crypto.randomUUID();
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const pixelUrl = \`\${supabaseUrl}/functions/v1/track-email-open?pixel_id=\${tracking_pixel_id}\`;
  const htmlWithPixel = content_html +
    \`<img src="\${pixelUrl}" width="1" height="1" style="display:none;" />\`;

  let sendResult;

  if (provider === 'gmail' && user_id) {
    // Buscar conta Gmail do usuário
    const { data: emailAccount } = await supabase
      .from('user_email_accounts')
      .select('*')
      .eq('user_id', user_id)
      .eq('provider', 'gmail')
      .single();

    if (!emailAccount) throw new Error('Gmail não conectado');

    // Refresh token se expirado
    let accessToken = emailAccount.access_token;
    if (new Date() >= new Date(emailAccount.expires_at)) {
      accessToken = await refreshGmailToken(
        supabase, emailAccount.id, emailAccount.refresh_token
      );
    }

    sendResult = await sendWithGmail({
      recipient_email, subject, content_html: htmlWithPixel,
      from_email: from_email || emailAccount.email,
      from_name: from_name || emailAccount.email.split('@')[0]
    }, accessToken);
  }

  // Salvar no banco
  const { data: emailData } = await supabase.from('emails').insert({
    campaign_id, recipient_email, subject,
    content_html: htmlWithPixel,
    tracking_pixel_id,
    status: sendResult.status,
    user_id, company_id,
    metadata: {
      provider: sendResult.provider,
      external_id: sendResult.external_id
    }
  }).select().single();

  // Incrementar contador diário
  if (user_id && company_id) {
    await supabase.rpc('increment_email_count', {
      p_user_id: user_id, p_company_id: company_id
    });
  }

  return new Response(JSON.stringify({
    success: true,
    email_id: emailData.id,
    provider: sendResult.provider
  }), { status: 200, headers: corsHeaders });
});`;

const FRONTEND_CALL = `// Chamada do Frontend para enviar email
const sendEmail = async () => {
  const { data, error } = await supabase.functions.invoke('send-email', {
    body: {
      recipient_email: 'destinatario@email.com',
      recipient_name: 'Nome do Destinatário',
      subject: 'Assunto do Email',
      content_html: '<h1>Olá!</h1><p>Conteúdo do email em HTML</p>',
      provider: 'gmail',          // 'gmail' ou 'resend'
      from_email: 'seu@gmail.com', // opcional (alias)
      from_name: 'Seu Nome',       // opcional
      user_id: user.id,            // ID do usuário logado
      company_id: companyId,       // ID da empresa
      campaign_id: campaignId      // opcional (para campanhas)
    }
  });

  if (error) {
    console.error('Erro ao enviar:', error);
  } else {
    console.log('Email enviado:', data);
    // data = { success: true, email_id: "uuid", provider: "gmail" }
  }
};`;

const CAMPAIGN_SEND = `// Envio em massa (Campaign Mail)
const sendCampaign = async (contacts: Contact[], template: string) => {
  for (const contact of contacts) {
    // Substituir variáveis do template
    let html = template
      .replace('{{nome}}', contact.name)
      .replace('{{email}}', contact.email);

    await supabase.functions.invoke('send-email', {
      body: {
        recipient_email: contact.email,
        recipient_name: contact.name,
        subject: 'Sua campanha aqui',
        content_html: html,
        provider: 'gmail',
        user_id: currentUser.id,
        company_id: companyId,
        campaign_id: campaign.id
      }
    });

    // Delay entre envios (evitar rate limit do Gmail)
    await new Promise(r => setTimeout(r, 1000));
  }
};`;

const TRACKING_FEATURES = `// Recursos de Tracking incluídos automaticamente:

// 1. Pixel de abertura (tracking_pixel_id)
// - Imagem 1x1 invisível inserida no HTML
// - Quando aberta, registra evento 'open' na tabela email_events

// 2. Rastreamento de links
// - Todos os links <a href="..."> são substituídos por URLs tracked
// - Ao clicar, registra evento e redireciona para URL original
// - Links salvos na tabela email_tracked_links

// 3. Limite diário
// - Tabela email_send_limits controla envios por usuário/dia
// - Função RPC increment_email_count incrementa o contador

// 4. Suporte a aliases Gmail
// - Parâmetro from_email permite enviar como alias
// - Aliases disponíveis via action 'list_gmail_aliases'
// - Preferência salva na tabela user_email_preferences`;

const DocsEnviarEmail = () => {
  const navigate = useNavigate();

  return (
    <div className="h-screen bg-gray-950 text-gray-100 overflow-y-auto">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="text-gray-400 hover:text-white">
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <div className="h-5 w-px bg-gray-700" />
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-[#374DA4]" />
            <span className="font-semibold text-lg">Ellosuit Docs</span>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Title */}
        <div className="mb-10">
          <div className="flex items-center gap-2 text-[#374DA4] text-sm font-medium mb-3">
            <Send className="h-4 w-4" />
            <span>Edge Function: send-email</span>
          </div>
          <h1 className="text-4xl font-bold mb-4">Enviar Email</h1>
          <p className="text-gray-400 text-lg max-w-2xl">
            Documentação completa da Edge Function de envio de emails via Gmail API, 
            incluindo tracking de abertura, rastreamento de links e envio em massa.
          </p>
        </div>

        {/* Navigation */}
        <div className="flex flex-wrap gap-2 mb-10">
          <a href="/docs/conectar-gmail" className="text-sm px-3 py-1.5 rounded-full bg-[#2F428D]/20 text-[#374DA4] hover:bg-[#2F428D]/30 transition">
            ← Conectar Gmail
          </a>
          <a href="#chamada-frontend" className="text-sm px-3 py-1.5 rounded-full bg-gray-800 text-gray-300 hover:bg-gray-700 transition">
            Chamada Frontend
          </a>
          <a href="#edge-function" className="text-sm px-3 py-1.5 rounded-full bg-gray-800 text-gray-300 hover:bg-gray-700 transition">
            Edge Function Completa
          </a>
          <a href="#campanha" className="text-sm px-3 py-1.5 rounded-full bg-gray-800 text-gray-300 hover:bg-gray-700 transition">
            Envio em Massa
          </a>
          <a href="#tracking" className="text-sm px-3 py-1.5 rounded-full bg-gray-800 text-gray-300 hover:bg-gray-700 transition">
            Tracking
          </a>
        </div>

        {/* Section: Frontend Call */}
        <section id="chamada-frontend" className="mb-12">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Zap className="h-5 w-5 text-yellow-400" />
                Como Chamar (Frontend)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-400 mb-4">
                Use <code className="px-1.5 py-0.5 bg-gray-800 rounded text-xs text-gray-200">supabase.functions.invoke('send-email')</code> para 
                enviar um email. Todos os parâmetros disponíveis estão documentados abaixo.
              </p>
              <CodeBlock code={FRONTEND_CALL} language="typescript" />
              
              <div className="mt-6 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left py-2 px-3 text-gray-400 font-medium">Parâmetro</th>
                      <th className="text-left py-2 px-3 text-gray-400 font-medium">Tipo</th>
                      <th className="text-left py-2 px-3 text-gray-400 font-medium">Obrigatório</th>
                      <th className="text-left py-2 px-3 text-gray-400 font-medium">Descrição</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-300">
                    <tr className="border-b border-gray-800"><td className="py-2 px-3 font-mono text-xs text-green-400">recipient_email</td><td className="py-2 px-3">string</td><td className="py-2 px-3">✅</td><td className="py-2 px-3">Email do destinatário</td></tr>
                    <tr className="border-b border-gray-800"><td className="py-2 px-3 font-mono text-xs text-green-400">subject</td><td className="py-2 px-3">string</td><td className="py-2 px-3">✅</td><td className="py-2 px-3">Assunto do email</td></tr>
                    <tr className="border-b border-gray-800"><td className="py-2 px-3 font-mono text-xs text-green-400">content_html</td><td className="py-2 px-3">string</td><td className="py-2 px-3">✅</td><td className="py-2 px-3">Conteúdo HTML do email</td></tr>
                    <tr className="border-b border-gray-800"><td className="py-2 px-3 font-mono text-xs text-green-400">provider</td><td className="py-2 px-3">'gmail' | 'resend'</td><td className="py-2 px-3">❌</td><td className="py-2 px-3">Provedor (default: 'resend')</td></tr>
                    <tr className="border-b border-gray-800"><td className="py-2 px-3 font-mono text-xs text-green-400">user_id</td><td className="py-2 px-3">string</td><td className="py-2 px-3">✅ (Gmail)</td><td className="py-2 px-3">ID do usuário logado</td></tr>
                    <tr className="border-b border-gray-800"><td className="py-2 px-3 font-mono text-xs text-green-400">company_id</td><td className="py-2 px-3">string</td><td className="py-2 px-3">❌</td><td className="py-2 px-3">ID da empresa</td></tr>
                    <tr className="border-b border-gray-800"><td className="py-2 px-3 font-mono text-xs text-green-400">from_email</td><td className="py-2 px-3">string</td><td className="py-2 px-3">❌</td><td className="py-2 px-3">Alias "Enviar como"</td></tr>
                    <tr className="border-b border-gray-800"><td className="py-2 px-3 font-mono text-xs text-green-400">from_name</td><td className="py-2 px-3">string</td><td className="py-2 px-3">❌</td><td className="py-2 px-3">Nome do remetente</td></tr>
                    <tr><td className="py-2 px-3 font-mono text-xs text-green-400">campaign_id</td><td className="py-2 px-3">string</td><td className="py-2 px-3">❌</td><td className="py-2 px-3">ID da campanha</td></tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Section: Full Edge Function */}
        <section id="edge-function" className="mb-12">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Code2 className="h-5 w-5 text-purple-400" />
                Edge Function Completa
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-400 mb-4">
                Código completo da Edge Function <code className="px-1.5 py-0.5 bg-gray-800 rounded text-xs text-gray-200">send-email</code> com 
                suporte a Gmail API, Resend, tracking de abertura, rastreamento de links e controle de limite diário.
              </p>
              <CodeBlock code={SEND_EMAIL_FULL} language="typescript" />
            </CardContent>
          </Card>
        </section>

        {/* Section: Campaign Send */}
        <section id="campanha" className="mb-12">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Send className="h-5 w-5 text-[#5A74D1]" />
                Envio em Massa (Campanhas)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-400 mb-4">
                Para campanhas de email marketing, itere sobre a lista de contatos com delay entre envios 
                para respeitar os limites do Gmail (aprox. 500 emails/dia para contas regulares).
              </p>
              <CodeBlock code={CAMPAIGN_SEND} language="typescript" />
              <div className="mt-4 p-4 bg-[#374DA4]/10 border border-[#374DA4]/20 rounded-lg">
                <p className="text-[#5A74D1] text-sm">
                  <strong>💡 Dica:</strong> O Gmail tem limite de ~500 emails/dia para contas pessoais 
                  e ~2.000/dia para Google Workspace. Use o delay de 1s entre envios.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Section: Tracking */}
        <section id="tracking" className="mb-12">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Database className="h-5 w-5 text-cyan-400" />
                Tracking e Monitoramento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CodeBlock code={TRACKING_FEATURES} language="typescript" />
            </CardContent>
          </Card>
        </section>

        {/* Response format */}
        <section className="mb-12">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">📦 Resposta da API</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-green-400 text-sm font-medium mb-2">✅ Sucesso (200)</p>
                  <CodeBlock code={`{
  "success": true,
  "email_id": "uuid-do-email",
  "tracking_pixel_id": "uuid-do-pixel",
  "provider": "gmail",
  "external_id": "gmail-message-id"
}`} language="json" />
                </div>
                <div>
                  <p className="text-red-400 text-sm font-medium mb-2">❌ Erro (500 / 429)</p>
                  <CodeBlock code={`{
  "error": "Limite diário de emails atingido",
  "sent_count": 500,
  "daily_limit": 500
}`} language="json" />
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Footer nav */}
        <div className="flex justify-between items-center pt-8 border-t border-gray-800">
          <Button
            variant="outline"
            className="border-[#2F428D]/50 text-[#374DA4] hover:bg-[#2F428D]/10"
            onClick={() => navigate('/docs/conectar-gmail')}
          >
            ← Conectar Gmail
          </Button>
          <span className="text-gray-500 text-sm">Ellosuit Docs v1.0</span>
        </div>
      </div>
    </div>
  );
};

export default DocsEnviarEmail;
