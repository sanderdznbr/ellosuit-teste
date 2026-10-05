-- Remover TODAS as políticas de UPDATE em room_participants para recomeçar limpo
DROP POLICY IF EXISTS "Hosts can manage participants via function" ON room_participants;
DROP POLICY IF EXISTS "Participants can update their media status" ON room_participants;
DROP POLICY IF EXISTS "Hosts can manage participants in their rooms" ON room_participants;
DROP POLICY IF EXISTS "Participants can update their own status" ON room_participants;
DROP POLICY IF EXISTS "Allow participant updates" ON room_participants;

-- Recriar a função SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.is_room_host(_room_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.room_participants 
    WHERE room_id = _room_id 
      AND user_id = _user_id 
      AND is_host = true
  );
$$;

-- Política para hosts gerenciarem participantes
CREATE POLICY "Hosts can manage participants"
ON room_participants
FOR UPDATE
TO public
USING (public.is_room_host(room_id, auth.uid()))
WITH CHECK (public.is_room_host(room_id, auth.uid()));

-- Política para participantes atualizarem seu próprio status
CREATE POLICY "Participants update own status"
ON room_participants
FOR UPDATE
TO public
USING (user_id = auth.uid() OR user_id IS NULL)
WITH CHECK (user_id = auth.uid() OR user_id IS NULL);