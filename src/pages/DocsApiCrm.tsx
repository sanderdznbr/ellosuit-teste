import React, { useState } from 'react';
import { Copy, Code } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

const API_ENDPOINT = 'https://jwddiyuezqrpuakazvgg.supabase.co/functions/v1/whatsapp-public-api';

type Field = [name: string, type: string, required: boolean, desc: string];
interface Action { action: string; title: string; desc: string; fields?: Field[]; example?: Record<string, unknown>; response?: string }
interface Section { id: string; title: string; intro?: string; actions: Action[] }

const SECTIONS: Section[] = [
  {
    id: 'mensagens', title: 'Mensagens',
    actions: [
      { action: 'check_status', title: 'Status da conexão', desc: 'Informa se o WhatsApp da chave está conectado.', example: {}, response: `{ "success": true, "status": "connected", "is_connected": true, "phone_number": "5511999999999" }` },
      { action: 'send_text', title: 'Enviar texto', desc: 'Envia uma mensagem de texto.', fields: [['phone', 'string', true, 'Número com DDI e DDD (ex: 5511999999999)'], ['message', 'string', true, 'Texto da mensagem']], example: { phone: '5511999999999', message: 'Olá!' }, response: `{ "success": true, "message_id": "3EB0...", "resolved_jid": "5511999999999@s.whatsapp.net" }` },
      { action: 'send_media', title: 'Enviar mídia', desc: 'Envia imagem, vídeo, áudio ou documento por URL pública.', fields: [['phone', 'string', true, 'Número do destinatário'], ['media_url', 'string', true, 'URL pública https'], ['media_type', 'string', true, 'image | video | audio | document'], ['caption', 'string', false, 'Legenda']], example: { phone: '5511999999999', media_url: 'https://site.com/foto.jpg', media_type: 'image', caption: 'Veja!' } },
    ],
  },
  {
    id: 'aprovacao', title: 'Aprovação de posts',
    intro: 'Envia um post para o cliente aprovar pelo WhatsApp. A Ellosuit conversa com o cliente e avisa o seu sistema pelo webhook a cada decisão. Enquanto a aprovação estiver aberta, o chatbot e o piloto automático não respondem nessa conversa.',
    actions: [
      { action: 'create_approval', title: 'Criar aprovação', desc: 'Envia as mídias + legenda ao cliente e pergunta "Você aprova? SIM / NÃO". Só existe uma aprovação aberta por telefone; a anterior vira "superseded".', fields: [['phone', 'string', true, 'WhatsApp do cliente'], ['media_urls', 'string[]', false, 'Até 10 URLs públicas (imagem/vídeo). Mais de 1 = carrossel'], ['caption', 'string', false, 'Legenda do post (obrigatória se não houver mídia)'], ['external_id', 'string', false, 'ID do post no seu sistema'], ['webhook_url', 'string', false, 'URL que recebe os eventos (senão usa o webhook padrão da chave)'], ['auto_publish', 'boolean', false, 'Se true, publica sozinho no Instagram/Facebook quando o cliente aprovar'], ['publish_to', 'array', false, '["instagram","facebook"] ou [{ "platform": "instagram", "connection_id": "..." }]'], ['question', 'string', false, 'Pergunta personalizada enviada após o post'], ['contact_name', 'string', false, 'Nome do cliente'], ['expires_in_hours', 'number', false, 'Validade (padrão 168h = 7 dias)'], ['metadata', 'object', false, 'Dados livres devolvidos nos webhooks']], example: { phone: '5511999999999', external_id: 'post_123', media_urls: ['https://site.com/slide1.jpg', 'https://site.com/slide2.jpg'], caption: 'Nova coleção chegando! #moda', webhook_url: 'https://seusistema.com/webhooks/ellosuit', auto_publish: true, publish_to: ['instagram', 'facebook'] }, response: `{ "success": true, "approval": { "id": "uuid", "external_id": "post_123", "status": "pending", "stage": "awaiting_approval", "version": 1, ... } }` },
      { action: 'submit_revision', title: 'Enviar nova versão', desc: 'Use depois do evento approval.revision_requested. Reenvia ao cliente com "versão N".', fields: [['approval_id', 'string', false, 'ID da aprovação (ou external_id)'], ['external_id', 'string', false, 'Seu ID do post'], ['media_urls', 'string[]', false, 'Novas mídias (se omitido, mantém)'], ['caption', 'string', false, 'Nova legenda']], example: { external_id: 'post_123', media_urls: ['https://site.com/slide1-v2.jpg'], caption: 'Legenda ajustada' } },
      { action: 'get_approval', title: 'Consultar aprovação', desc: 'Retorna status, versão, última resposta do cliente e histórico.', fields: [['approval_id', 'string', false, 'ou external_id'], ['external_id', 'string', false, '']], example: { external_id: 'post_123' } },
      { action: 'list_approvals', title: 'Listar aprovações', desc: 'Lista as aprovações da empresa.', fields: [['status', 'string', false, 'Filtrar por status'], ['phone', 'string', false, 'Filtrar por telefone'], ['limit', 'number', false, 'Máx. 200 (padrão 50)']], example: { status: 'pending' } },
      { action: 'cancel_approval', title: 'Cancelar aprovação', desc: 'Cancela pelo seu sistema.', fields: [['approval_id', 'string', false, 'ou external_id'], ['notify_client', 'boolean', false, 'Avisar o cliente no WhatsApp'], ['message', 'string', false, 'Mensagem de aviso']], example: { external_id: 'post_123', notify_client: true } },
      { action: 'publish_approval', title: 'Publicar aprovado', desc: 'Publica manualmente um post já aprovado (quando auto_publish = false ou se a publicação falhou).', fields: [['approval_id', 'string', false, 'ou external_id'], ['publish_to', 'array', false, 'Redes de destino'], ['caption', 'string', false, 'Sobrescrever legenda']], example: { external_id: 'post_123', publish_to: ['instagram'] } },
    ],
  },
  {
    id: 'social', title: 'Publicação Instagram / Facebook',
    intro: 'Usa as contas conectadas em Apps → Instagram/Facebook. Instagram exige imagem em URL pública (JPG).',
    actions: [
      { action: 'list_social_accounts', title: 'Listar contas', desc: 'Contas sociais conectadas.', example: {} },
      { action: 'publish_post', title: 'Publicar direto', desc: 'Publica sem aprovação. 1 imagem = post, 2+ = carrossel.', fields: [['media_urls', 'string[]', true, 'URLs públicas'], ['caption', 'string', false, 'Legenda'], ['publish_to', 'array', true, '["instagram","facebook"]']], example: { media_urls: ['https://site.com/foto.jpg'], caption: 'Bom dia!', publish_to: ['instagram', 'facebook'] }, response: `{ "success": true, "results": [{ "platform": "instagram", "success": true, "post_id": "179..." }] }` },
    ],
  },
  {
    id: 'chatbots', title: 'Chatbots',
    intro: 'Cria e gerencia fluxos de chatbot. nodes e edges seguem o mesmo formato do construtor visual (tipos: trigger, message, condition, action, delay).',
    actions: [
      { action: 'list_chatbots', title: 'Listar', desc: 'Lista os chatbots.', example: {} },
      { action: 'get_chatbot', title: 'Detalhes', desc: 'Retorna o fluxo completo.', fields: [['chatbot_id', 'string', true, '']], example: { chatbot_id: 'uuid' } },
      { action: 'create_chatbot', title: 'Criar', desc: 'Cria um fluxo. Se trigger_config não for enviado, dispara em novas conversas do WhatsApp da chave.', fields: [['name', 'string', true, 'Nome'], ['description', 'string', false, ''], ['nodes', 'array', false, 'Blocos'], ['edges', 'array', false, 'Ligações'], ['trigger_config', 'object', false, '{ "type": "whatsapp_channel" | "keyword", "sessionId": "..." }'], ['is_active', 'boolean', false, 'Padrão false']], example: { name: 'Boas-vindas', is_active: true, nodes: [{ id: 't1', type: 'trigger', subType: 'whatsapp_channel', position: { x: 0, y: 0 }, data: { label: 'Início', config: {} } }, { id: 'm1', type: 'message', subType: 'text', position: { x: 0, y: 150 }, data: { label: 'Olá', config: { text: 'Olá! Como posso ajudar?' } } }], edges: [{ id: 'e1', source: 't1', target: 'm1' }] } },
      { action: 'update_chatbot', title: 'Atualizar', desc: 'Atualiza qualquer campo.', fields: [['chatbot_id', 'string', true, ''], ['name | description | nodes | edges | trigger_config | is_active', '', false, '']], example: { chatbot_id: 'uuid', name: 'Novo nome' } },
      { action: 'activate_chatbot', title: 'Ativar', desc: 'Também existe deactivate_chatbot.', fields: [['chatbot_id', 'string', true, '']], example: { chatbot_id: 'uuid' } },
      { action: 'delete_chatbot', title: 'Excluir', desc: 'Remove o fluxo.', fields: [['chatbot_id', 'string', true, '']], example: { chatbot_id: 'uuid' } },
    ],
  },
  {
    id: 'agentes', title: 'Agentes de IA',
    actions: [
      { action: 'list_agents', title: 'Listar', desc: 'Lista os agentes.', example: {} },
      { action: 'get_agent', title: 'Detalhes', desc: '', fields: [['agent_id', 'string', true, '']], example: { agent_id: 'uuid' } },
      { action: 'create_agent', title: 'Criar', desc: 'Cria um agente de IA.', fields: [['name', 'string', true, ''], ['instructions', 'string', true, 'Prompt / regras do agente'], ['personality', 'string', false, 'Tom de voz'], ['description', 'string', false, ''], ['whatsapp_enabled', 'boolean', false, 'Responder no WhatsApp da chave'], ['settings', 'object', false, 'Config. avançada'], ['is_active', 'boolean', false, 'Padrão true']], example: { name: 'Atendente Loja', personality: 'simpática e objetiva', instructions: 'Você atende clientes da loja. Responda dúvidas sobre produtos e prazos.', whatsapp_enabled: true } },
      { action: 'update_agent', title: 'Atualizar', desc: '', fields: [['agent_id', 'string', true, ''], ['name | instructions | personality | settings | whatsapp_enabled ...', '', false, '']], example: { agent_id: 'uuid', instructions: 'Novas regras...' } },
      { action: 'toggle_agent', title: 'Ligar/desligar', desc: '', fields: [['agent_id', 'string', true, ''], ['is_active', 'boolean', true, '']], example: { agent_id: 'uuid', is_active: false } },
      { action: 'delete_agent', title: 'Excluir', desc: '', fields: [['agent_id', 'string', true, '']], example: { agent_id: 'uuid' } },
      { action: 'assign_agent_to_conversation', title: 'Atribuir a um contato', desc: 'Liga o agente à conversa do telefone (a conversa precisa existir). agent_id null desliga.', fields: [['phone', 'string', true, ''], ['agent_id', 'string|null', true, '']], example: { phone: '5511999999999', agent_id: 'uuid' } },
    ],
  },
];

const EVENTS: [string, string][] = [
  ['approval.sent', 'Post (ou nova versão) entregue ao cliente.'],
  ['approval.approved', 'Cliente respondeu SIM. Publique ou aguarde approval.published se auto_publish = true.'],
  ['approval.published', 'Publicado no Instagram/Facebook. data.results traz o post_id de cada rede.'],
  ['approval.publish_failed', 'Aprovado mas a publicação falhou (ver data.results[].error). Use publish_approval para tentar de novo.'],
  ['approval.rejected', 'Cliente respondeu NÃO. A Ellosuit pergunta: nova versão ou cancelar?'],
  ['approval.revision_requested', 'Cliente quer outra versão. data.client_feedback tem o que ele pediu. Responda com submit_revision.'],
  ['approval.cancelled', 'Cancelado pelo cliente (cancelled_by: "client") ou pela API ("api").'],
  ['webhook.test', 'Enviado pela ação test_webhook.'],
  ['message.received', 'Toda mensagem recebida no número da chave (data: message_id, phone, contact_name, type, text, media_url, caption, conversation_id, timestamp).'],
];

const STATUSES: [string, string][] = [
  ['pending', 'Aguardando SIM/NÃO do cliente'], ['awaiting_decision', 'Cliente disse NÃO; aguardando "nova versão" ou "cancelar"'],
  ['revision_requested', 'Aguardando seu sistema enviar submit_revision'], ['approved', 'Aprovado'], ['published', 'Publicado'],
  ['publish_failed', 'Aprovado, publicação falhou'], ['cancelled', 'Cancelado'], ['superseded', 'Substituído por outra aprovação'], ['failed', 'Falha ao enviar no WhatsApp'],
];

const ERRORS: [string, string][] = [
  ['400', 'Campo obrigatório ausente ou inválido'], ['401', 'X-API-Key ausente ou inválida'], ['404', 'Recurso não encontrado'],
  ['422', 'Número não existe no WhatsApp'], ['429', 'Limite por minuto excedido (retry_after_seconds)'], ['502', 'Falha ao entregar no WhatsApp/Meta'], ['503', 'WhatsApp desconectado'],
];

const DocsApiCrm: React.FC = () => {
  const { toast } = useToast();
  const [lang, setLang] = useState<'curl' | 'js'>('curl');
  const copy = (t: string) => { navigator.clipboard.writeText(t); toast({ title: 'Copiado!' }); };

  const CodeBlock = ({ code }: { code: string }) => (
    <div className="relative group">
      <pre className="bg-muted text-foreground border border-border p-4 rounded-lg text-[13px] overflow-x-auto whitespace-pre font-mono leading-relaxed">{code}</pre>
      <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => copy(code)}>
        <Copy className="h-3 w-3" />
      </Button>
    </div>
  );

  const sample = (a: Action) => {
    const body = JSON.stringify({ action: a.action, ...(a.example || {}) }, null, 2);
    if (lang === 'curl') return `curl -X POST "${API_ENDPOINT}" \\\n  -H "Content-Type: application/json" \\\n  -H "X-API-Key: SUA_API_KEY" \\\n  -d '${body}'`;
    return `const res = await fetch("${API_ENDPOINT}", {\n  method: "POST",\n  headers: { "Content-Type": "application/json", "X-API-Key": "SUA_API_KEY" },\n  body: JSON.stringify(${body.replace(/\n/g, '\n  ')})\n});\nconst data = await res.json();`;
  };

  const nav = [['inicio', 'Início'], ['fluxo-posts', 'Guia: sistema de posts'], ...SECTIONS.map((s) => [s.id, s.title]), ['webhooks', 'Webhooks'], ['erros', 'Erros']];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-foreground flex items-center justify-center"><Code className="h-4 w-4 text-background" /></div>
            <div>
              <h1 className="font-semibold">Ellosuit API</h1>
              <p className="text-xs text-muted-foreground">WhatsApp, aprovação de posts, chatbots e agentes de IA</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border border-border p-0.5 text-xs">
              {(['curl', 'js'] as const).map((l) => (
                <button key={l} onClick={() => setLang(l)} className={`px-2.5 py-1 rounded ${lang === l ? 'bg-foreground text-background' : 'text-muted-foreground'}`}>{l === 'curl' ? 'cURL' : 'JavaScript'}</button>
              ))}
            </div>
            <Badge variant="outline">v2.0</Badge>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8 flex gap-10">
        <aside className="hidden lg:block w-52 shrink-0">
          <nav className="sticky top-20 space-y-1 text-sm">
            {nav.map(([id, label]) => (
              <a key={id} href={`#${id}`} className="block px-2 py-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted">{label}</a>
            ))}
          </nav>
        </aside>

        <main className="flex-1 min-w-0 space-y-14">
          <section id="inicio" className="space-y-4 scroll-mt-20">
            <h2 className="text-2xl font-semibold">Início</h2>
            <p className="text-muted-foreground leading-relaxed">Todas as ações usam <strong>um único endpoint</strong> via <code>POST</code>, com o campo <code>action</code> no corpo e a chave no cabeçalho <code>X-API-Key</code>. Gere a chave em <strong>Dashboard → API WhatsApp</strong>. Cada chave pertence a uma empresa e a um número de WhatsApp.</p>
            <CodeBlock code={`POST ${API_ENDPOINT}\nContent-Type: application/json\nX-API-Key: SUA_API_KEY\n\n{ "action": "nome_da_acao", ...campos }`} />
            <p className="text-sm text-muted-foreground">Limite padrão: 30 requisições por minuto por chave (configurável). Respostas são JSON; erros trazem <code>{'{ "error": "..." }'}</code>.</p>
          </section>

          <section id="fluxo-posts" className="space-y-4 scroll-mt-20">
            <h2 className="text-2xl font-semibold">Guia: integrar um sistema de posts</h2>
            <CodeBlock code={`Seu sistema                 Ellosuit                      Cliente (WhatsApp)
     |  create_approval ------>  |  envia post + "Aprova? SIM/NÃO" -->  |
     |  <-- approval.sent        |                                      |
     |                           |  <------------------ "SIM"           |
     |  <-- approval.approved    |  (auto_publish) publica IG/FB        |
     |  <-- approval.published   |                                      |
     |                           |  <------------------ "NÃO"           |
     |  <-- approval.rejected    |  "Nova versão ou cancelar?" ------>  |
     |                           |  <----- "nova versão, muda a cor"    |
     |  <-- approval.revision_requested (client_feedback)               |
     |  submit_revision ------>  |  envia versão 2 + pergunta ------->  |
     |                           |  <------------------ "cancelar"      |
     |  <-- approval.cancelled   |                                      |`} />
            <ol className="list-decimal pl-5 space-y-2 text-muted-foreground">
              <li>Gere a API Key e, opcionalmente, salve um <strong>webhook padrão</strong> na chave (Dashboard → API WhatsApp).</li>
              <li>Conecte Instagram/Facebook em Apps, se quiser publicação automática. Use <code>list_social_accounts</code> para conferir.</li>
              <li>Ao criar o post, chame <code>create_approval</code> com <code>external_id</code> = ID do post no seu sistema.</li>
              <li>Trate os eventos no seu webhook. Em <code>approval.revision_requested</code>, gere a nova arte e chame <code>submit_revision</code>.</li>
              <li>A IA entende respostas livres ("pode postar", "não gostei da cor", "desisti"). Se não entender, pergunta de novo.</li>
              <li>Para ver o estado a qualquer momento, use <code>get_approval</code>.</li>
            </ol>
            <div className="rounded-lg border border-border p-4">
              <p className="text-sm font-medium mb-2">Status possíveis</p>
              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                {STATUSES.map(([s, d]) => <div key={s}><code className="text-xs">{s}</code> <span className="text-muted-foreground">— {d}</span></div>)}
              </div>
            </div>
          </section>

          {SECTIONS.map((s) => (
            <section key={s.id} id={s.id} className="space-y-6 scroll-mt-20">
              <div>
                <h2 className="text-2xl font-semibold">{s.title}</h2>
                {s.intro && <p className="text-muted-foreground mt-2 leading-relaxed">{s.intro}</p>}
              </div>
              {s.actions.map((a) => (
                <div key={a.action} className="rounded-xl border border-border bg-card p-5 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="font-mono text-xs">{a.action}</Badge>
                    <span className="font-medium">{a.title}</span>
                  </div>
                  {a.desc && <p className="text-sm text-muted-foreground">{a.desc}</p>}
                  {a.fields && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead><tr className="text-left text-muted-foreground border-b border-border"><th className="py-1.5 pr-4 font-medium">Campo</th><th className="py-1.5 pr-4 font-medium">Tipo</th><th className="py-1.5 font-medium">Descrição</th></tr></thead>
                        <tbody>
                          {a.fields.map(([n, t, r, d]) => (
                            <tr key={n} className="border-b border-border/60 last:border-0">
                              <td className="py-1.5 pr-4 font-mono text-xs">{n}{r && <span className="text-destructive"> *</span>}</td>
                              <td className="py-1.5 pr-4 text-xs text-muted-foreground">{t}</td>
                              <td className="py-1.5 text-muted-foreground">{d}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <CodeBlock code={sample(a)} />
                  {a.response && <><p className="text-xs text-muted-foreground">Resposta</p><CodeBlock code={a.response} /></>}
                </div>
              ))}
            </section>
          ))}

          <section id="webhooks" className="space-y-4 scroll-mt-20">
            <h2 className="text-2xl font-semibold">Webhooks</h2>
            <p className="text-muted-foreground">A Ellosuit envia um <code>POST</code> JSON para o <code>webhook_url</code> da aprovação (ou o webhook padrão da chave). Responda com status 2xx. Se falhar, tentamos de novo (até 6 vezes, com espera crescente).</p>
            <div className="rounded-lg border border-border divide-y divide-border">
              {EVENTS.map(([e, d]) => <div key={e} className="p-3 text-sm flex flex-col sm:flex-row sm:gap-4"><code className="text-xs w-64 shrink-0">{e}</code><span className="text-muted-foreground">{d}</span></div>)}
            </div>
            <p className="text-sm font-medium">Exemplo de payload</p>
            <CodeBlock code={`POST https://seusistema.com/webhooks/ellosuit
X-Ellosuit-Event: approval.revision_requested
X-Ellosuit-Signature: sha256=5f2c...

{
  "event": "approval.revision_requested",
  "created_at": "2026-10-02T12:00:00.000Z",
  "data": {
    "approval": {
      "id": "8c1e...", "external_id": "post_123", "status": "revision_requested",
      "version": 1, "contact_phone": "5511999999999",
      "last_client_reply": "não gostei, troca a cor pra azul",
      "revision_notes": "trocar a cor para azul", "media_urls": ["..."], "caption": "...",
      "published_results": null, "metadata": {}
    },
    "client_feedback": "trocar a cor para azul"
  }
}`} />
            <p className="text-sm font-medium">Validar a assinatura (Node.js)</p>
            <CodeBlock code={`import crypto from "crypto";
// rawBody = corpo exatamente como recebido; secret = "Segredo do webhook" da chave no painel
const expected = "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
const valid = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(req.headers["x-ellosuit-signature"]));`} />
            <p className="text-sm text-muted-foreground">Teste seu endpoint com <code>{'{ "action": "test_webhook", "webhook_url": "https://..." }'}</code>.</p>
          </section>

          <section id="erros" className="space-y-4 scroll-mt-20">
            <h2 className="text-2xl font-semibold">Erros</h2>
            <div className="rounded-lg border border-border divide-y divide-border">
              {ERRORS.map(([c, d]) => <div key={c} className="p-3 text-sm flex gap-4"><code className="w-12">{c}</code><span className="text-muted-foreground">{d}</span></div>)}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};

export default DocsApiCrm;
