-- Corrige vazamento de dados entre empresas (multi-tenant).
--
-- Várias tabelas tinham uma policy permissiva (ALL, USING true / auth.role() =
-- 'authenticated') convivendo com a policy correta por empresa. O Postgres
-- combina policies do mesmo comando com OR, então bastava a permissiva existir
-- para qualquer usuário autenticado ler/alterar/apagar dados de todas as outras
-- empresas.
--
-- As tabelas ai_agent_extracted_data e ai_agent_conversions já possuem a policy
-- correta por empresa. As policy permissivas foram criadas em
-- 20260512160454_cf804ddb-... e a migration 20260518042739_02491674-... tentou
-- removê-las, mas usou nomes errados, então elas nunca saíram do banco.

BEGIN;

-- 1) Conversões e Dados Extraídos dos agentes de IA (tela /dashboard/bot-ia).
-- A policy "Company members can manage ..." (via ai_agents.company_id) permanece.
DROP POLICY IF EXISTS "Allow all for authenticated users on extracted_data" ON public.ai_agent_extracted_data;
DROP POLICY IF EXISTS "Allow all for authenticated users on conversions" ON public.ai_agent_conversions;

-- 2) Anexos e comentários de cards de workflow.
-- As policies por empresa (SELECT/INSERT/DELETE/UPDATE) já existem e continuam.
DROP POLICY IF EXISTS "Anyone authenticated can manage attachments" ON public.workflow_card_attachments;
DROP POLICY IF EXISTS "Anyone authenticated can manage comments" ON public.workflow_card_comments;

-- 3) Checklists de cards de workflow.
DROP POLICY IF EXISTS "Anyone authenticated can manage checklists" ON public.workflow_card_checklists;
DROP POLICY IF EXISTS "Users can manage company checklists" ON public.workflow_card_checklists;
CREATE POLICY "Users can manage company checklists"
  ON public.workflow_card_checklists
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.workflow_cards c
    WHERE c.id = workflow_card_checklists.card_id
      AND c.company_id IN (
        SELECT company_id FROM public.company_users WHERE user_id = auth.uid()
      )
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.workflow_cards c
    WHERE c.id = workflow_card_checklists.card_id
      AND c.company_id IN (
        SELECT company_id FROM public.company_users WHERE user_id = auth.uid()
      )
  ));

-- 4) Itens de checklist (escopo herdado via workflow_card_checklists -> workflow_cards).
DROP POLICY IF EXISTS "Anyone authenticated can manage checklist items" ON public.workflow_card_checklist_items;
DROP POLICY IF EXISTS "Users can manage company checklist items" ON public.workflow_card_checklist_items;
CREATE POLICY "Users can manage company checklist items"
  ON public.workflow_card_checklist_items
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.workflow_card_checklists cl
    JOIN public.workflow_cards c ON c.id = cl.card_id
    WHERE cl.id = workflow_card_checklist_items.checklist_id
      AND c.company_id IN (
        SELECT company_id FROM public.company_users WHERE user_id = auth.uid()
      )
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.workflow_card_checklists cl
    JOIN public.workflow_cards c ON c.id = cl.card_id
    WHERE cl.id = workflow_card_checklist_items.checklist_id
      AND c.company_id IN (
        SELECT company_id FROM public.company_users WHERE user_id = auth.uid()
      )
  ));

-- 5) Tags de workflow (escopo herdado via workflows.company_id).
DROP POLICY IF EXISTS "Anyone authenticated can manage workflow tags" ON public.workflow_tags;
DROP POLICY IF EXISTS "Users can manage company workflow tags" ON public.workflow_tags;
CREATE POLICY "Users can manage company workflow tags"
  ON public.workflow_tags
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.workflows w
    WHERE w.id = workflow_tags.workflow_id
      AND w.company_id IN (
        SELECT company_id FROM public.company_users WHERE user_id = auth.uid()
      )
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.workflows w
    WHERE w.id = workflow_tags.workflow_id
      AND w.company_id IN (
        SELECT company_id FROM public.company_users WHERE user_id = auth.uid()
      )
  ));

-- 6) Vínculo card <-> tag: card e tag precisam pertencer à mesma empresa.
DROP POLICY IF EXISTS "Anyone authenticated can manage card tags" ON public.workflow_card_tags_junction;
DROP POLICY IF EXISTS "Users can manage company card tags" ON public.workflow_card_tags_junction;
CREATE POLICY "Users can manage company card tags"
  ON public.workflow_card_tags_junction
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.workflow_cards c
    WHERE c.id = workflow_card_tags_junction.card_id
      AND c.company_id IN (
        SELECT company_id FROM public.company_users WHERE user_id = auth.uid()
      )
  ))
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workflow_cards c
      WHERE c.id = workflow_card_tags_junction.card_id
        AND c.company_id IN (
          SELECT company_id FROM public.company_users WHERE user_id = auth.uid()
        )
    )
    AND EXISTS (
      SELECT 1 FROM public.workflow_tags t
      JOIN public.workflows w ON w.id = t.workflow_id
      WHERE t.id = workflow_card_tags_junction.tag_id
        AND w.company_id IN (
          SELECT company_id FROM public.company_users WHERE user_id = auth.uid()
        )
    )
  );

COMMIT;
