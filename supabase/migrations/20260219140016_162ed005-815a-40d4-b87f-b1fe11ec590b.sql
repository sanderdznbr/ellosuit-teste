
-- Convert all 16 existing templates to block-based design_data
DO $$
DECLARE
  gs jsonb := '{"backgroundColor":"#f4f4f4","contentBackgroundColor":"#ffffff","fontFamily":"Arial, sans-serif","maxWidth":"600px","padding":"20px"}';
BEGIN
  -- 1. Pagamento Confirmado
  UPDATE email_templates SET design_data = jsonb_build_object('globalStyles', gs, 'elements', '[
    {"id":"el-1","type":"logo-header","content":{"logoSrc":"","title":"Pagamento Confirmado","subtitle":"Seu pagamento foi processado com sucesso"},"styles":{"gradientFrom":"#059669","gradientTo":"#10B981","padding":"40px","textAlign":"center","titleColor":"#ffffff","subtitleColor":"rgba(255,255,255,0.8)","borderRadius":"0"}},
    {"id":"el-2","type":"spacer","content":{},"styles":{"height":"24px"}},
    {"id":"el-3","type":"paragraph","content":{"text":"Olá {{nome}},"},"styles":{"color":"#4a4a4a","fontSize":"16px","lineHeight":"1.6","textAlign":"left","padding":"8px 0"}},
    {"id":"el-4","type":"alert","content":{"text":"✅ Seu pagamento foi confirmado e processado com sucesso. Obrigado pela confiança!","alertType":"success"},"styles":{"backgroundColor":"#F0FDF4","borderColor":"#22C55E","textColor":"#166534","padding":"16px 20px","borderRadius":"8px","borderWidth":"1px","fontSize":"14px"}},
    {"id":"el-5","type":"paragraph","content":{"text":"Os detalhes do pagamento estão disponíveis na sua área do cliente. Caso tenha alguma dúvida, estamos à disposição."},"styles":{"color":"#4a4a4a","fontSize":"16px","lineHeight":"1.6","textAlign":"left","padding":"8px 0"}},
    {"id":"el-6","type":"button","content":{"text":"Ver Detalhes","url":"https://ellosuit-connect-vista.lovable.app/dashboard"},"styles":{"backgroundColor":"#059669","color":"#ffffff","padding":"16px 32px","borderRadius":"8px","fontSize":"16px","textAlign":"center"}},
    {"id":"el-7","type":"footer","content":{"text":"© 2024 Ellosuit. Todos os direitos reservados.","unsubscribe":"#","address":""},"styles":{"color":"#888888","fontSize":"12px","backgroundColor":"#f9f9f9","padding":"24px"}}
  ]'::jsonb) WHERE id = '594cc505-eb98-4a32-9fd0-7178d585a9e0';

  -- 2. Pagamento Pendente
  UPDATE email_templates SET design_data = jsonb_build_object('globalStyles', gs, 'elements', '[
    {"id":"el-1","type":"logo-header","content":{"logoSrc":"","title":"Pagamento Pendente","subtitle":"Ação necessária"},"styles":{"gradientFrom":"#D97706","gradientTo":"#F59E0B","padding":"40px","textAlign":"center","titleColor":"#ffffff","subtitleColor":"rgba(255,255,255,0.8)","borderRadius":"0"}},
    {"id":"el-2","type":"spacer","content":{},"styles":{"height":"24px"}},
    {"id":"el-3","type":"paragraph","content":{"text":"Olá {{nome}},"},"styles":{"color":"#4a4a4a","fontSize":"16px","lineHeight":"1.6","textAlign":"left","padding":"8px 0"}},
    {"id":"el-4","type":"alert","content":{"text":"⚠️ Identificamos que seu pagamento ainda está pendente. Por favor, regularize para manter o acesso aos serviços.","alertType":"warning"},"styles":{"backgroundColor":"#FFFBEB","borderColor":"#F59E0B","textColor":"#92400E","padding":"16px 20px","borderRadius":"8px","borderWidth":"1px","fontSize":"14px"}},
    {"id":"el-5","type":"button","content":{"text":"Realizar Pagamento","url":"#"},"styles":{"backgroundColor":"#D97706","color":"#ffffff","padding":"16px 32px","borderRadius":"8px","fontSize":"16px","textAlign":"center"}},
    {"id":"el-6","type":"footer","content":{"text":"© 2024 Ellosuit. Todos os direitos reservados.","unsubscribe":"#","address":""},"styles":{"color":"#888888","fontSize":"12px","backgroundColor":"#f9f9f9","padding":"24px"}}
  ]'::jsonb) WHERE id = '1eaf80c7-f806-49f0-aa05-c41c9169ea66';

  -- 3. Boas-Vindas ao Ellosuit
  UPDATE email_templates SET design_data = jsonb_build_object('globalStyles', gs, 'elements', '[
    {"id":"el-1","type":"logo-header","content":{"logoSrc":"","title":"Bem-vindo ao Ellosuit!","subtitle":"Estamos felizes em ter você conosco"},"styles":{"gradientFrom":"#3A00E5","gradientTo":"#6B3AFF","padding":"40px","textAlign":"center","titleColor":"#ffffff","subtitleColor":"rgba(255,255,255,0.8)","borderRadius":"0"}},
    {"id":"el-2","type":"spacer","content":{},"styles":{"height":"24px"}},
    {"id":"el-3","type":"paragraph","content":{"text":"Olá {{nome}},\n\nSeja muito bem-vindo(a) à plataforma Ellosuit! Agora você tem acesso a ferramentas poderosas para gerenciar seu negócio."},"styles":{"color":"#4a4a4a","fontSize":"16px","lineHeight":"1.6","textAlign":"left","padding":"8px 0"}},
    {"id":"el-4","type":"list","content":{"items":["CRM completo para gestão de clientes","Automações de marketing por email e WhatsApp","Agendamento e calendário integrado","Documentos, contratos e propostas","Agentes de IA personalizados"],"listIcon":"check"},"styles":{"color":"#4a4a4a","fontSize":"16px","lineHeight":"1.8"}},
    {"id":"el-5","type":"button","content":{"text":"Acessar Plataforma","url":"https://ellosuit-connect-vista.lovable.app/dashboard"},"styles":{"backgroundColor":"#3A00E5","color":"#ffffff","padding":"16px 32px","borderRadius":"8px","fontSize":"16px","textAlign":"center"}},
    {"id":"el-6","type":"footer","content":{"text":"© 2024 Ellosuit. Todos os direitos reservados.","unsubscribe":"#","address":""},"styles":{"color":"#888888","fontSize":"12px","backgroundColor":"#f9f9f9","padding":"24px"}}
  ]'::jsonb) WHERE id = '0694ac25-4442-49d0-892b-be075943cf25';

  -- 4. Periodo de Teste Iniciado
  UPDATE email_templates SET design_data = jsonb_build_object('globalStyles', gs, 'elements', '[
    {"id":"el-1","type":"logo-header","content":{"logoSrc":"","title":"Período de Teste Iniciado","subtitle":"Aproveite ao máximo!"},"styles":{"gradientFrom":"#3A00E5","gradientTo":"#6B3AFF","padding":"40px","textAlign":"center","titleColor":"#ffffff","subtitleColor":"rgba(255,255,255,0.8)","borderRadius":"0"}},
    {"id":"el-2","type":"spacer","content":{},"styles":{"height":"24px"}},
    {"id":"el-3","type":"paragraph","content":{"text":"Olá {{nome}},\n\nSeu período de teste foi ativado com sucesso! Explore todas as funcionalidades disponíveis."},"styles":{"color":"#4a4a4a","fontSize":"16px","lineHeight":"1.6","textAlign":"left","padding":"8px 0"}},
    {"id":"el-4","type":"alert","content":{"text":"🎉 Seu trial está ativo! Você tem acesso completo a todas as funcionalidades durante o período de teste.","alertType":"info"},"styles":{"backgroundColor":"#EFF6FF","borderColor":"#3B82F6","textColor":"#1E40AF","padding":"16px 20px","borderRadius":"8px","borderWidth":"1px","fontSize":"14px"}},
    {"id":"el-5","type":"button","content":{"text":"Começar Agora","url":"https://ellosuit-connect-vista.lovable.app/dashboard"},"styles":{"backgroundColor":"#3A00E5","color":"#ffffff","padding":"16px 32px","borderRadius":"8px","fontSize":"16px","textAlign":"center"}},
    {"id":"el-6","type":"footer","content":{"text":"© 2024 Ellosuit. Todos os direitos reservados.","unsubscribe":"#","address":""},"styles":{"color":"#888888","fontSize":"12px","backgroundColor":"#f9f9f9","padding":"24px"}}
  ]'::jsonb) WHERE id = 'a1b2c3d4-0001-4000-8000-000000000001';

  -- 5. Periodo de Teste Acabando
  UPDATE email_templates SET design_data = jsonb_build_object('globalStyles', gs, 'elements', '[
    {"id":"el-1","type":"logo-header","content":{"logoSrc":"","title":"Seu Teste Está Acabando","subtitle":"Não perca o acesso"},"styles":{"gradientFrom":"#D97706","gradientTo":"#F59E0B","padding":"40px","textAlign":"center","titleColor":"#ffffff","subtitleColor":"rgba(255,255,255,0.8)","borderRadius":"0"}},
    {"id":"el-2","type":"spacer","content":{},"styles":{"height":"24px"}},
    {"id":"el-3","type":"paragraph","content":{"text":"Olá {{nome}},"},"styles":{"color":"#4a4a4a","fontSize":"16px","lineHeight":"1.6","textAlign":"left","padding":"8px 0"}},
    {"id":"el-4","type":"alert","content":{"text":"⏰ Seu período de teste está prestes a expirar. Assine agora para manter acesso a todas as funcionalidades.","alertType":"warning"},"styles":{"backgroundColor":"#FFFBEB","borderColor":"#F59E0B","textColor":"#92400E","padding":"16px 20px","borderRadius":"8px","borderWidth":"1px","fontSize":"14px"}},
    {"id":"el-5","type":"button","content":{"text":"Assinar Agora","url":"https://ellosuit-connect-vista.lovable.app/dashboard/assinatura"},"styles":{"backgroundColor":"#D97706","color":"#ffffff","padding":"16px 32px","borderRadius":"8px","fontSize":"16px","textAlign":"center"}},
    {"id":"el-6","type":"footer","content":{"text":"© 2024 Ellosuit. Todos os direitos reservados.","unsubscribe":"#","address":""},"styles":{"color":"#888888","fontSize":"12px","backgroundColor":"#f9f9f9","padding":"24px"}}
  ]'::jsonb) WHERE id = 'a1b2c3d4-0002-4000-8000-000000000002';

  -- 6. Conta Suspensa
  UPDATE email_templates SET design_data = jsonb_build_object('globalStyles', gs, 'elements', '[
    {"id":"el-1","type":"logo-header","content":{"logoSrc":"","title":"Conta Suspensa","subtitle":"Ação necessária para reativar"},"styles":{"gradientFrom":"#DC2626","gradientTo":"#EF4444","padding":"40px","textAlign":"center","titleColor":"#ffffff","subtitleColor":"rgba(255,255,255,0.8)","borderRadius":"0"}},
    {"id":"el-2","type":"spacer","content":{},"styles":{"height":"24px"}},
    {"id":"el-3","type":"paragraph","content":{"text":"Olá {{nome}},"},"styles":{"color":"#4a4a4a","fontSize":"16px","lineHeight":"1.6","textAlign":"left","padding":"8px 0"}},
    {"id":"el-4","type":"alert","content":{"text":"🚫 Sua conta foi suspensa devido a pendências de pagamento. Regularize a situação para restaurar o acesso.","alertType":"error"},"styles":{"backgroundColor":"#FEF2F2","borderColor":"#EF4444","textColor":"#991B1B","padding":"16px 20px","borderRadius":"8px","borderWidth":"1px","fontSize":"14px"}},
    {"id":"el-5","type":"button","content":{"text":"Reativar Conta","url":"https://ellosuit-connect-vista.lovable.app/dashboard/assinatura"},"styles":{"backgroundColor":"#DC2626","color":"#ffffff","padding":"16px 32px","borderRadius":"8px","fontSize":"16px","textAlign":"center"}},
    {"id":"el-6","type":"footer","content":{"text":"© 2024 Ellosuit. Todos os direitos reservados.","unsubscribe":"#","address":""},"styles":{"color":"#888888","fontSize":"12px","backgroundColor":"#f9f9f9","padding":"24px"}}
  ]'::jsonb) WHERE id = 'a1b2c3d4-0003-4000-8000-000000000003';

  -- 7. Reuniao Agendada
  UPDATE email_templates SET design_data = jsonb_build_object('globalStyles', gs, 'elements', '[
    {"id":"el-1","type":"logo-header","content":{"logoSrc":"","title":"Reunião Agendada","subtitle":"Sua reunião foi confirmada"},"styles":{"gradientFrom":"#3A00E5","gradientTo":"#6B3AFF","padding":"40px","textAlign":"center","titleColor":"#ffffff","subtitleColor":"rgba(255,255,255,0.8)","borderRadius":"0"}},
    {"id":"el-2","type":"spacer","content":{},"styles":{"height":"24px"}},
    {"id":"el-3","type":"paragraph","content":{"text":"Olá {{nome}},\n\nSua reunião foi agendada com sucesso. Confira os detalhes abaixo:"},"styles":{"color":"#4a4a4a","fontSize":"16px","lineHeight":"1.6","textAlign":"left","padding":"8px 0"}},
    {"id":"el-4","type":"alert","content":{"text":"📅 Data: {{data_reuniao}}\n🕐 Horário: {{horario_reuniao}}\n👤 Com: {{organizador}}","alertType":"info"},"styles":{"backgroundColor":"#EFF6FF","borderColor":"#3B82F6","textColor":"#1E40AF","padding":"16px 20px","borderRadius":"8px","borderWidth":"1px","fontSize":"14px"}},
    {"id":"el-5","type":"button","content":{"text":"Entrar na Reunião","url":"{{link_reuniao}}"},"styles":{"backgroundColor":"#3A00E5","color":"#ffffff","padding":"16px 32px","borderRadius":"8px","fontSize":"16px","textAlign":"center"}},
    {"id":"el-6","type":"footer","content":{"text":"© 2024 Ellosuit. Todos os direitos reservados.","unsubscribe":"#","address":""},"styles":{"color":"#888888","fontSize":"12px","backgroundColor":"#f9f9f9","padding":"24px"}}
  ]'::jsonb) WHERE id = 'b1000001-0006-4000-8000-000000000006';

  -- 8. Lembrete de Reuniao
  UPDATE email_templates SET design_data = jsonb_build_object('globalStyles', gs, 'elements', '[
    {"id":"el-1","type":"logo-header","content":{"logoSrc":"","title":"Lembrete de Reunião","subtitle":"Sua reunião começa em breve"},"styles":{"gradientFrom":"#D97706","gradientTo":"#F59E0B","padding":"40px","textAlign":"center","titleColor":"#ffffff","subtitleColor":"rgba(255,255,255,0.8)","borderRadius":"0"}},
    {"id":"el-2","type":"spacer","content":{},"styles":{"height":"24px"}},
    {"id":"el-3","type":"alert","content":{"text":"⏰ Sua reunião começa em breve! Não se esqueça de participar.","alertType":"warning"},"styles":{"backgroundColor":"#FFFBEB","borderColor":"#F59E0B","textColor":"#92400E","padding":"16px 20px","borderRadius":"8px","borderWidth":"1px","fontSize":"14px"}},
    {"id":"el-4","type":"paragraph","content":{"text":"Olá {{nome}},\n\nEste é um lembrete da sua reunião agendada. Esteja preparado(a) para participar no horário marcado."},"styles":{"color":"#4a4a4a","fontSize":"16px","lineHeight":"1.6","textAlign":"left","padding":"8px 0"}},
    {"id":"el-5","type":"button","content":{"text":"Entrar na Reunião","url":"{{link_reuniao}}"},"styles":{"backgroundColor":"#D97706","color":"#ffffff","padding":"16px 32px","borderRadius":"8px","fontSize":"16px","textAlign":"center"}},
    {"id":"el-6","type":"footer","content":{"text":"© 2024 Ellosuit. Todos os direitos reservados.","unsubscribe":"#","address":""},"styles":{"color":"#888888","fontSize":"12px","backgroundColor":"#f9f9f9","padding":"24px"}}
  ]'::jsonb) WHERE id = 'b1000001-0007-4000-8000-000000000007';

  -- 9. Documento Compartilhado
  UPDATE email_templates SET design_data = jsonb_build_object('globalStyles', gs, 'elements', '[
    {"id":"el-1","type":"logo-header","content":{"logoSrc":"","title":"Documento Compartilhado","subtitle":"Um novo documento foi compartilhado com você"},"styles":{"gradientFrom":"#3A00E5","gradientTo":"#6B3AFF","padding":"40px","textAlign":"center","titleColor":"#ffffff","subtitleColor":"rgba(255,255,255,0.8)","borderRadius":"0"}},
    {"id":"el-2","type":"spacer","content":{},"styles":{"height":"24px"}},
    {"id":"el-3","type":"paragraph","content":{"text":"Olá {{nome}},\n\nUm documento foi compartilhado com você. Clique no botão abaixo para visualizá-lo."},"styles":{"color":"#4a4a4a","fontSize":"16px","lineHeight":"1.6","textAlign":"left","padding":"8px 0"}},
    {"id":"el-4","type":"button","content":{"text":"Ver Documento","url":"{{link_documento}}"},"styles":{"backgroundColor":"#3A00E5","color":"#ffffff","padding":"16px 32px","borderRadius":"8px","fontSize":"16px","textAlign":"center"}},
    {"id":"el-5","type":"footer","content":{"text":"© 2024 Ellosuit. Todos os direitos reservados.","unsubscribe":"#","address":""},"styles":{"color":"#888888","fontSize":"12px","backgroundColor":"#f9f9f9","padding":"24px"}}
  ]'::jsonb) WHERE id = 'b1000001-0008-4000-8000-000000000008';

  -- 10. Proposta Enviada
  UPDATE email_templates SET design_data = jsonb_build_object('globalStyles', gs, 'elements', '[
    {"id":"el-1","type":"logo-header","content":{"logoSrc":"","title":"Proposta Enviada","subtitle":"Confira os detalhes da proposta"},"styles":{"gradientFrom":"#3A00E5","gradientTo":"#6B3AFF","padding":"40px","textAlign":"center","titleColor":"#ffffff","subtitleColor":"rgba(255,255,255,0.8)","borderRadius":"0"}},
    {"id":"el-2","type":"spacer","content":{},"styles":{"height":"24px"}},
    {"id":"el-3","type":"paragraph","content":{"text":"Olá {{nome}},\n\nUma proposta comercial foi preparada para você. Confira todos os detalhes clicando no botão abaixo."},"styles":{"color":"#4a4a4a","fontSize":"16px","lineHeight":"1.6","textAlign":"left","padding":"8px 0"}},
    {"id":"el-4","type":"alert","content":{"text":"📋 Proposta disponível para visualização. Revise os termos e entre em contato caso tenha dúvidas.","alertType":"info"},"styles":{"backgroundColor":"#EFF6FF","borderColor":"#3B82F6","textColor":"#1E40AF","padding":"16px 20px","borderRadius":"8px","borderWidth":"1px","fontSize":"14px"}},
    {"id":"el-5","type":"button","content":{"text":"Ver Proposta","url":"{{link_proposta}}"},"styles":{"backgroundColor":"#3A00E5","color":"#ffffff","padding":"16px 32px","borderRadius":"8px","fontSize":"16px","textAlign":"center"}},
    {"id":"el-6","type":"footer","content":{"text":"© 2024 Ellosuit. Todos os direitos reservados.","unsubscribe":"#","address":""},"styles":{"color":"#888888","fontSize":"12px","backgroundColor":"#f9f9f9","padding":"24px"}}
  ]'::jsonb) WHERE id = 'b1000001-0009-4000-8000-000000000009';

  -- 11. Reembolso Processado
  UPDATE email_templates SET design_data = jsonb_build_object('globalStyles', gs, 'elements', '[
    {"id":"el-1","type":"logo-header","content":{"logoSrc":"","title":"Reembolso Processado","subtitle":"Seu reembolso foi confirmado"},"styles":{"gradientFrom":"#059669","gradientTo":"#10B981","padding":"40px","textAlign":"center","titleColor":"#ffffff","subtitleColor":"rgba(255,255,255,0.8)","borderRadius":"0"}},
    {"id":"el-2","type":"spacer","content":{},"styles":{"height":"24px"}},
    {"id":"el-3","type":"paragraph","content":{"text":"Olá {{nome}},"},"styles":{"color":"#4a4a4a","fontSize":"16px","lineHeight":"1.6","textAlign":"left","padding":"8px 0"}},
    {"id":"el-4","type":"alert","content":{"text":"💰 Seu reembolso foi processado com sucesso. O valor será creditado em sua conta em até 5 dias úteis.","alertType":"success"},"styles":{"backgroundColor":"#F0FDF4","borderColor":"#22C55E","textColor":"#166534","padding":"16px 20px","borderRadius":"8px","borderWidth":"1px","fontSize":"14px"}},
    {"id":"el-5","type":"footer","content":{"text":"© 2024 Ellosuit. Todos os direitos reservados.","unsubscribe":"#","address":""},"styles":{"color":"#888888","fontSize":"12px","backgroundColor":"#f9f9f9","padding":"24px"}}
  ]'::jsonb) WHERE id = 'b1000001-0010-4000-8000-000000000010';

  -- 12. Assinatura Renovada
  UPDATE email_templates SET design_data = jsonb_build_object('globalStyles', gs, 'elements', '[
    {"id":"el-1","type":"logo-header","content":{"logoSrc":"","title":"Assinatura Renovada","subtitle":"Obrigado por continuar conosco!"},"styles":{"gradientFrom":"#059669","gradientTo":"#10B981","padding":"40px","textAlign":"center","titleColor":"#ffffff","subtitleColor":"rgba(255,255,255,0.8)","borderRadius":"0"}},
    {"id":"el-2","type":"spacer","content":{},"styles":{"height":"24px"}},
    {"id":"el-3","type":"paragraph","content":{"text":"Olá {{nome}},"},"styles":{"color":"#4a4a4a","fontSize":"16px","lineHeight":"1.6","textAlign":"left","padding":"8px 0"}},
    {"id":"el-4","type":"alert","content":{"text":"✅ Sua assinatura foi renovada com sucesso. Continue aproveitando todos os recursos da plataforma.","alertType":"success"},"styles":{"backgroundColor":"#F0FDF4","borderColor":"#22C55E","textColor":"#166534","padding":"16px 20px","borderRadius":"8px","borderWidth":"1px","fontSize":"14px"}},
    {"id":"el-5","type":"footer","content":{"text":"© 2024 Ellosuit. Todos os direitos reservados.","unsubscribe":"#","address":""},"styles":{"color":"#888888","fontSize":"12px","backgroundColor":"#f9f9f9","padding":"24px"}}
  ]'::jsonb) WHERE id = 'b1000001-0002-4000-8000-000000000002';

  -- 13. Falha no Pagamento
  UPDATE email_templates SET design_data = jsonb_build_object('globalStyles', gs, 'elements', '[
    {"id":"el-1","type":"logo-header","content":{"logoSrc":"","title":"Falha no Pagamento","subtitle":"Não foi possível processar seu pagamento"},"styles":{"gradientFrom":"#DC2626","gradientTo":"#EF4444","padding":"40px","textAlign":"center","titleColor":"#ffffff","subtitleColor":"rgba(255,255,255,0.8)","borderRadius":"0"}},
    {"id":"el-2","type":"spacer","content":{},"styles":{"height":"24px"}},
    {"id":"el-3","type":"paragraph","content":{"text":"Olá {{nome}},"},"styles":{"color":"#4a4a4a","fontSize":"16px","lineHeight":"1.6","textAlign":"left","padding":"8px 0"}},
    {"id":"el-4","type":"alert","content":{"text":"❌ Houve uma falha ao processar seu pagamento. Por favor, verifique seus dados de pagamento e tente novamente.","alertType":"error"},"styles":{"backgroundColor":"#FEF2F2","borderColor":"#EF4444","textColor":"#991B1B","padding":"16px 20px","borderRadius":"8px","borderWidth":"1px","fontSize":"14px"}},
    {"id":"el-5","type":"button","content":{"text":"Tentar Novamente","url":"https://ellosuit-connect-vista.lovable.app/dashboard/assinatura"},"styles":{"backgroundColor":"#DC2626","color":"#ffffff","padding":"16px 32px","borderRadius":"8px","fontSize":"16px","textAlign":"center"}},
    {"id":"el-6","type":"footer","content":{"text":"© 2024 Ellosuit. Todos os direitos reservados.","unsubscribe":"#","address":""},"styles":{"color":"#888888","fontSize":"12px","backgroundColor":"#f9f9f9","padding":"24px"}}
  ]'::jsonb) WHERE id = 'b1000001-0003-4000-8000-000000000003';

  -- 14. Upgrade de Plano Confirmado
  UPDATE email_templates SET design_data = jsonb_build_object('globalStyles', gs, 'elements', '[
    {"id":"el-1","type":"logo-header","content":{"logoSrc":"","title":"Upgrade Confirmado!","subtitle":"Seu plano foi atualizado com sucesso"},"styles":{"gradientFrom":"#3A00E5","gradientTo":"#6B3AFF","padding":"40px","textAlign":"center","titleColor":"#ffffff","subtitleColor":"rgba(255,255,255,0.8)","borderRadius":"0"}},
    {"id":"el-2","type":"spacer","content":{},"styles":{"height":"24px"}},
    {"id":"el-3","type":"paragraph","content":{"text":"Olá {{nome}},"},"styles":{"color":"#4a4a4a","fontSize":"16px","lineHeight":"1.6","textAlign":"left","padding":"8px 0"}},
    {"id":"el-4","type":"alert","content":{"text":"🚀 Parabéns! Seu plano foi atualizado. Agora você tem acesso a recursos exclusivos.","alertType":"success"},"styles":{"backgroundColor":"#F0FDF4","borderColor":"#22C55E","textColor":"#166534","padding":"16px 20px","borderRadius":"8px","borderWidth":"1px","fontSize":"14px"}},
    {"id":"el-5","type":"list","content":{"items":["Mais usuários simultâneos","Módulos avançados desbloqueados","Suporte prioritário","Armazenamento expandido"],"listIcon":"check"},"styles":{"color":"#4a4a4a","fontSize":"16px","lineHeight":"1.8"}},
    {"id":"el-6","type":"button","content":{"text":"Explorar Novos Recursos","url":"https://ellosuit-connect-vista.lovable.app/dashboard"},"styles":{"backgroundColor":"#3A00E5","color":"#ffffff","padding":"16px 32px","borderRadius":"8px","fontSize":"16px","textAlign":"center"}},
    {"id":"el-7","type":"footer","content":{"text":"© 2024 Ellosuit. Todos os direitos reservados.","unsubscribe":"#","address":""},"styles":{"color":"#888888","fontSize":"12px","backgroundColor":"#f9f9f9","padding":"24px"}}
  ]'::jsonb) WHERE id = 'b1000001-0001-4000-8000-000000000001';

  -- 15. Cancelamento Confirmado
  UPDATE email_templates SET design_data = jsonb_build_object('globalStyles', gs, 'elements', '[
    {"id":"el-1","type":"logo-header","content":{"logoSrc":"","title":"Cancelamento Confirmado","subtitle":"Sentiremos sua falta"},"styles":{"gradientFrom":"#6B7280","gradientTo":"#9CA3AF","padding":"40px","textAlign":"center","titleColor":"#ffffff","subtitleColor":"rgba(255,255,255,0.8)","borderRadius":"0"}},
    {"id":"el-2","type":"spacer","content":{},"styles":{"height":"24px"}},
    {"id":"el-3","type":"paragraph","content":{"text":"Olá {{nome}},\n\nSeu cancelamento foi processado. Seus dados serão mantidos por 30 dias caso deseje reativar."},"styles":{"color":"#4a4a4a","fontSize":"16px","lineHeight":"1.6","textAlign":"left","padding":"8px 0"}},
    {"id":"el-4","type":"alert","content":{"text":"ℹ️ Você pode reativar sua conta a qualquer momento dentro de 30 dias sem perder seus dados.","alertType":"info"},"styles":{"backgroundColor":"#EFF6FF","borderColor":"#3B82F6","textColor":"#1E40AF","padding":"16px 20px","borderRadius":"8px","borderWidth":"1px","fontSize":"14px"}},
    {"id":"el-5","type":"button","content":{"text":"Reativar Conta","url":"https://ellosuit-connect-vista.lovable.app/dashboard/assinatura"},"styles":{"backgroundColor":"#3A00E5","color":"#ffffff","padding":"16px 32px","borderRadius":"8px","fontSize":"16px","textAlign":"center"}},
    {"id":"el-6","type":"footer","content":{"text":"© 2024 Ellosuit. Todos os direitos reservados.","unsubscribe":"#","address":""},"styles":{"color":"#888888","fontSize":"12px","backgroundColor":"#f9f9f9","padding":"24px"}}
  ]'::jsonb) WHERE id = 'b1000001-0004-4000-8000-000000000004';

  -- 16. Novo Contato Cadastrado
  UPDATE email_templates SET design_data = jsonb_build_object('globalStyles', gs, 'elements', '[
    {"id":"el-1","type":"logo-header","content":{"logoSrc":"","title":"Novo Contato Cadastrado","subtitle":"Um novo contato foi adicionado ao seu CRM"},"styles":{"gradientFrom":"#3A00E5","gradientTo":"#6B3AFF","padding":"40px","textAlign":"center","titleColor":"#ffffff","subtitleColor":"rgba(255,255,255,0.8)","borderRadius":"0"}},
    {"id":"el-2","type":"spacer","content":{},"styles":{"height":"24px"}},
    {"id":"el-3","type":"paragraph","content":{"text":"Olá {{nome}},\n\nUm novo contato foi cadastrado no seu CRM. Confira os detalhes e inicie o relacionamento."},"styles":{"color":"#4a4a4a","fontSize":"16px","lineHeight":"1.6","textAlign":"left","padding":"8px 0"}},
    {"id":"el-4","type":"button","content":{"text":"Ver Contato","url":"https://ellosuit-connect-vista.lovable.app/dashboard/clientes"},"styles":{"backgroundColor":"#3A00E5","color":"#ffffff","padding":"16px 32px","borderRadius":"8px","fontSize":"16px","textAlign":"center"}},
    {"id":"el-5","type":"footer","content":{"text":"© 2024 Ellosuit. Todos os direitos reservados.","unsubscribe":"#","address":""},"styles":{"color":"#888888","fontSize":"12px","backgroundColor":"#f9f9f9","padding":"24px"}}
  ]'::jsonb) WHERE id = 'b1000001-0005-4000-8000-000000000005';
END $$;
