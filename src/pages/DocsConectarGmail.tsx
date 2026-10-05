
import React, { useState } from 'react';
import { Copy, Check, ArrowLeft, Mail, Key, Shield, Globe, Code2 } from 'lucide-react';
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

const CONNECT_GMAIL_CODE = `// Edge Function: google-calendar (action: exchange_code_gmail)
// Troca o código OAuth por tokens e salva a conta Gmail do usuário

// 1. Frontend: Gerar URL de autorização OAuth
const GOOGLE_CLIENT_ID = "SEU_GOOGLE_CLIENT_ID";
const REDIRECT_URI = "https://www.ellosuit.app/dashboard/email";
const SCOPES = [
  "email",
  "profile",
  "openid",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly"
].join(" ");

const authUrl = \`https://accounts.google.com/o/oauth2/v2/auth?\` +
  \`client_id=\${GOOGLE_CLIENT_ID}\` +
  \`&redirect_uri=\${encodeURIComponent(REDIRECT_URI)}\` +
  \`&response_type=code\` +
  \`&scope=\${encodeURIComponent(SCOPES)}\` +
  \`&access_type=offline\` +
  \`&prompt=consent\`;

// 2. Após redirect, o frontend captura o "code" da URL e envia para a Edge Function:
const connectGmail = async (code: string, userId: string) => {
  const { data, error } = await supabase.functions.invoke('google-calendar', {
    body: {
      action: 'exchange_code_gmail',
      code,
      user_id: userId
    }
  });
  return data; // { success: true, email: "usuario@gmail.com" }
};`;

const EXCHANGE_CODE_EDGE = `// Edge Function: supabase/functions/google-calendar/index.ts
// Trecho da action 'exchange_code_gmail'

if (body.action === 'exchange_code_gmail') {
  const { code, user_id } = body;

  // Trocar código por tokens
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
      client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
      code,
      grant_type: 'authorization_code',
      redirect_uri: 'https://www.ellosuit.app/dashboard/email'
    })
  });

  const tokenData = await tokenResponse.json();

  // Obter email do usuário
  const userInfo = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { 'Authorization': \`Bearer \${tokenData.access_token}\` }
  }).then(r => r.json());

  // Salvar conta no banco
  await supabase.from('user_email_accounts').insert({
    user_id,
    company_id: companyUser.company_id,
    provider: 'gmail',
    email: userInfo.email,
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
    connected_at: new Date().toISOString(),
    status: 'active'
  });

  return { success: true, email: userInfo.email };
}`;

const REFRESH_TOKEN_CODE = `// Função de refresh do token (usada automaticamente antes de enviar)
const refreshGmailToken = async (supabase, accountId, refreshToken) => {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
      client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    })
  });

  const tokens = await response.json();
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  // Atualizar token no banco
  await supabase.from('user_email_accounts')
    .update({ access_token: tokens.access_token, expires_at: expiresAt })
    .eq('id', accountId);

  return tokens.access_token;
};`;

const DB_SCHEMA = `-- Tabela: user_email_accounts
CREATE TABLE user_email_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  company_id UUID REFERENCES companies(id) NOT NULL,
  provider TEXT NOT NULL DEFAULT 'gmail',
  email TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  connected_at TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);`;

const GOOGLE_CONSOLE_STEPS = `Configuração no Google Cloud Console:

1. Acesse: https://console.cloud.google.com/auth/clients/
2. Crie ou selecione um projeto
3. Ative a API do Gmail: APIs & Services → Library → Gmail API
4. Configure a tela de consentimento OAuth: APIs & Services → OAuth consent screen
   - Tipo: Externo
   - Adicione os escopos: email, profile, openid, gmail.send, gmail.readonly
5. Crie credenciais OAuth 2.0: Credentials → Create Credentials → OAuth Client ID
   - Tipo: Aplicativo da Web (Web Application)

6. Authorized JavaScript Origins (origens JS autorizadas):
   - https://www.ellosuit.app
   - https://www.ellosuit.app
   - https://84320702-4971-42e0-bb91-6756570feabc.lovableproject.com
   - https://id-preview--84320702-4971-42e0-bb91-6756570feabc.lovable.app
   - https://www.ellosuit.app

7. URIs de Redirecionamento Autorizados (Authorized redirect URIs):
   - https://www.ellosuit.app/dashboard
   - https://jwddiyuezqrpuakazvgg.supabase.co/functions/v1/google-calendar
   - https://www.ellosuit.app/dashboard/email
   - https://www.ellosuit.app/dashboard/email

8. Copie Client ID e Client Secret
9. Configure como secrets no Supabase:
   - GOOGLE_CLIENT_ID
   - GOOGLE_CLIENT_SECRET`;

const GOOGLE_CONSOLE_EXPLANATION = `Por que essas URIs são necessárias?

═══════════════════════════════════════════════════
  AUTHORIZED JAVASCRIPT ORIGINS
═══════════════════════════════════════════════════

São os domínios de onde o navegador pode iniciar o fluxo OAuth.
Precisamos de múltiplas origens para cobrir todos os ambientes:

• www.ellosuit.app → Domínio de produção principal (com www)
• ellosuit.online → Domínio sem www (caso o usuário acesse diretamente)
• *.lovableproject.com → Ambiente de desenvolvimento no Lovable
• *.lovable.app → Preview e ambiente publicado do Lovable

═══════════════════════════════════════════════════
  AUTHORIZED REDIRECT URIs
═══════════════════════════════════════════════════

São as URLs para onde o Google redireciona o usuário APÓS
conceder permissão. O código de autorização é entregue nessa URL.

• /dashboard → Redireciona para o dashboard principal após login
• /functions/v1/google-calendar → Edge Function que troca o code
  por access_token e refresh_token (server-to-server)
• /dashboard/email → Página de email marketing onde o frontend
  captura o ?code= da URL e finaliza a conexão

⚠️  IMPORTANTE: Cada URI deve ser EXATAMENTE igual à que seu
código usa. Diferenças mínimas (com/sem barra final, http vs
https) causam erro "redirect_uri_mismatch".

⚠️  Em produção, mantenha APENAS os domínios necessários.
Os domínios do Lovable (lovable.app, lovableproject.com) são
úteis durante o desenvolvimento.`;

const DocsConectarGmail = () => {
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
            <Key className="h-4 w-4" />
            <span>Integração Gmail OAuth 2.0</span>
          </div>
          <h1 className="text-4xl font-bold mb-4">Conectar Gmail</h1>
          <p className="text-gray-400 text-lg max-w-2xl">
            Documentação completa do fluxo OAuth para conectar conta Gmail ao Ellosuit, 
            permitindo envio de emails marketing via Gmail API.
          </p>
        </div>

        {/* Navigation */}
        <div className="flex flex-wrap gap-2 mb-10">
          <a href="#google-console" className="text-sm px-3 py-1.5 rounded-full bg-gray-800 text-gray-300 hover:bg-gray-700 transition">
            Google Console
          </a>
          <a href="#fluxo-oauth" className="text-sm px-3 py-1.5 rounded-full bg-gray-800 text-gray-300 hover:bg-gray-700 transition">
            Fluxo OAuth
          </a>
          <a href="#edge-function" className="text-sm px-3 py-1.5 rounded-full bg-gray-800 text-gray-300 hover:bg-gray-700 transition">
            Edge Function
          </a>
          <a href="#refresh-token" className="text-sm px-3 py-1.5 rounded-full bg-gray-800 text-gray-300 hover:bg-gray-700 transition">
            Refresh Token
          </a>
          <a href="#banco-dados" className="text-sm px-3 py-1.5 rounded-full bg-gray-800 text-gray-300 hover:bg-gray-700 transition">
            Banco de Dados
          </a>
          <a href="/docs/enviar-email" className="text-sm px-3 py-1.5 rounded-full bg-[#2F428D]/20 text-[#374DA4] hover:bg-[#2F428D]/30 transition">
            → Enviar Email
          </a>
        </div>

        {/* Section: Google Console */}
        <section id="google-console" className="mb-12">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Globe className="h-5 w-5 text-[#5A74D1]" />
                Passo 1: Configurar Google Cloud Console
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CodeBlock code={GOOGLE_CONSOLE_STEPS} language="text" />
              <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <p className="text-yellow-400 text-sm">
                  <strong>⚠️ Importante:</strong> O Authorized redirect URI deve ser exatamente 
                  <code className="mx-1 px-1.5 py-0.5 bg-gray-800 rounded text-xs">https://www.ellosuit.app/dashboard/email</code>
                  para o ambiente de produção.
                </p>
              </div>

              <div className="mt-6">
                <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-[#5A74D1]" />
                  Entendendo as URIs configuradas
                </h3>
                <CodeBlock code={GOOGLE_CONSOLE_EXPLANATION} language="text" />
              </div>

              <div className="mt-4 p-4 bg-[#374DA4]/10 border border-[#374DA4]/20 rounded-lg">
                <p className="text-[#5A74D1] text-sm">
                  <strong>🔗 Link direto:</strong> Acesse{' '}
                  <a href="https://console.cloud.google.com/auth/clients/" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#879CE0]">
                    console.cloud.google.com/auth/clients/
                  </a>{' '}
                  para gerenciar suas credenciais OAuth diretamente.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Section: OAuth Flow */}
        <section id="fluxo-oauth" className="mb-12">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Shield className="h-5 w-5 text-green-400" />
                Passo 2: Fluxo OAuth (Frontend)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-400 mb-4">
                O frontend gera a URL de autorização, redireciona o usuário para o Google, 
                e após o consentimento, captura o código de autorização para trocar por tokens.
              </p>
              <CodeBlock code={CONNECT_GMAIL_CODE} language="typescript" />
            </CardContent>
          </Card>
        </section>

        {/* Section: Edge Function */}
        <section id="edge-function" className="mb-12">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Code2 className="h-5 w-5 text-purple-400" />
                Passo 3: Edge Function (Backend)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-400 mb-4">
                A edge function <code className="px-1.5 py-0.5 bg-gray-800 rounded text-xs text-gray-200">google-calendar</code> com 
                action <code className="px-1.5 py-0.5 bg-gray-800 rounded text-xs text-gray-200">exchange_code_gmail</code> troca o 
                código por tokens e salva no banco de dados.
              </p>
              <CodeBlock code={EXCHANGE_CODE_EDGE} language="typescript" />
            </CardContent>
          </Card>
        </section>

        {/* Section: Refresh Token */}
        <section id="refresh-token" className="mb-12">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Key className="h-5 w-5 text-yellow-400" />
                Passo 4: Refresh Token (Automático)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-400 mb-4">
                Os tokens do Google expiram após ~1 hora. Antes de cada envio de email, 
                o sistema verifica se o token expirou e faz refresh automaticamente.
              </p>
              <CodeBlock code={REFRESH_TOKEN_CODE} language="typescript" />
            </CardContent>
          </Card>
        </section>

        {/* Section: Database Schema */}
        <section id="banco-dados" className="mb-12">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Code2 className="h-5 w-5 text-cyan-400" />
                Esquema do Banco de Dados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-400 mb-4">
                Tabela que armazena as credenciais OAuth do Gmail para cada usuário conectado.
              </p>
              <CodeBlock code={DB_SCHEMA} language="sql" />
            </CardContent>
          </Card>
        </section>

        {/* Secrets */}
        <section className="mb-12">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">🔐 Secrets Necessárias (Supabase)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-gray-800 rounded-lg">
                  <code className="text-green-400 text-sm font-mono">GOOGLE_CLIENT_ID</code>
                  <p className="text-gray-400 text-sm mt-1">Client ID do OAuth 2.0 (Google Cloud Console)</p>
                </div>
                <div className="p-4 bg-gray-800 rounded-lg">
                  <code className="text-green-400 text-sm font-mono">GOOGLE_CLIENT_SECRET</code>
                  <p className="text-gray-400 text-sm mt-1">Client Secret do OAuth 2.0 (Google Cloud Console)</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Footer nav */}
        <div className="flex justify-between items-center pt-8 border-t border-gray-800">
          <span className="text-gray-500 text-sm">Ellosuit Docs v1.0</span>
          <Button
            variant="outline"
            className="border-[#2F428D]/50 text-[#374DA4] hover:bg-[#2F428D]/10"
            onClick={() => navigate('/docs/enviar-email')}
          >
            Próximo: Enviar Email →
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DocsConectarGmail;
