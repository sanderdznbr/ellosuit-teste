-- Guarda os funis de vendas no banco, por empresa.
--
-- Motivo: até aqui o módulo de Vendas guardava tudo (funil, etapas, automações,
-- negociações) em localStorage, então os funis só existiam naquele navegador —
-- o time e outros aparelhos não viam nada. Com vários funis por empresa isso
-- deixaria de ser aceitável.
--
-- O documento é um jsonb por empresa porque o conteúdo é configuração (funis,
-- pipelines, etapas, automações) mais os dados comerciais das negociações, que
-- já são referenciados por id de conversa. Os dados relacionais de verdade
-- (conversas, contatos) continuam nas tabelas próprias.
--
-- RLS: uma policy por comando, sem policy permissiva convivendo (o Postgres
-- combina policies do mesmo comando com OR — foi assim que vazou dado entre
-- empresas antes). Diferente da convenção de "só o criador altera", aqui
-- qualquer membro da empresa pode ler E escrever: o funil é um artefato do time,
-- não do usuário que o criou.

BEGIN;

CREATE TABLE IF NOT EXISTS public.sales_workspaces (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.sales_workspaces IS
  'Documento do módulo de Vendas por empresa: funis, pipelines, etapas, automações e negociações.';

ALTER TABLE public.sales_workspaces ENABLE ROW LEVEL SECURITY;

-- Leitura: qualquer membro da empresa.
DROP POLICY IF EXISTS "Members can view their sales workspace" ON public.sales_workspaces;
CREATE POLICY "Members can view their sales workspace"
  ON public.sales_workspaces FOR SELECT
  USING (
    company_id IN (SELECT cu.company_id FROM public.company_users cu WHERE cu.user_id = auth.uid())
  );

-- Criação: membro da empresa, gravando o próprio created_by.
DROP POLICY IF EXISTS "Members can create their sales workspace" ON public.sales_workspaces;
CREATE POLICY "Members can create their sales workspace"
  ON public.sales_workspaces FOR INSERT
  WITH CHECK (
    company_id IN (SELECT cu.company_id FROM public.company_users cu WHERE cu.user_id = auth.uid())
    AND created_by = auth.uid()
  );

-- Alteração: qualquer membro da empresa (documento compartilhado).
DROP POLICY IF EXISTS "Members can update their sales workspace" ON public.sales_workspaces;
CREATE POLICY "Members can update their sales workspace"
  ON public.sales_workspaces FOR UPDATE
  USING (
    company_id IN (SELECT cu.company_id FROM public.company_users cu WHERE cu.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Members can delete their sales workspace" ON public.sales_workspaces;
CREATE POLICY "Members can delete their sales workspace"
  ON public.sales_workspaces FOR DELETE
  USING (
    company_id IN (SELECT cu.company_id FROM public.company_users cu WHERE cu.user_id = auth.uid())
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_workspaces TO authenticated;

COMMIT;
