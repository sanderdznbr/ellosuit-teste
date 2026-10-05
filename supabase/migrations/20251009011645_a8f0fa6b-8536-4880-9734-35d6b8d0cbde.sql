-- Drop políticas conflitantes que causam recursão
DROP POLICY IF EXISTS "Users can view participants in their rooms" ON public.room_participants;
DROP POLICY IF EXISTS "Users can view participants (joined or creator)" ON public.room_participants;

-- Recriar a função can_view_room_participants como security definer
CREATE OR REPLACE FUNCTION public.can_view_room_participants(p_room_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- Room creator can view
    SELECT 1
    FROM public.meeting_rooms mr
    WHERE mr.id = p_room_id
      AND mr.created_by = p_user_id
  )
  OR EXISTS (
    -- Any user who is a participant in that room
    SELECT 1
    FROM public.room_participants rp
    WHERE rp.room_id = p_room_id
      AND (rp.user_id = p_user_id OR rp.user_id IS NULL)
  );
$$;

-- Criar política simples usando a função security definer
CREATE POLICY "Users can view room participants"
ON public.room_participants
FOR SELECT
TO public
USING (public.can_view_room_participants(room_id, auth.uid()));

-- Garantir que a coluna waiting_approval existe
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'room_participants' 
    AND column_name = 'waiting_approval'
  ) THEN
    ALTER TABLE public.room_participants 
    ADD COLUMN waiting_approval boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Comentar a função para documentação
COMMENT ON FUNCTION public.can_view_room_participants IS 'Security definer function to check if user can view room participants without causing RLS recursion';