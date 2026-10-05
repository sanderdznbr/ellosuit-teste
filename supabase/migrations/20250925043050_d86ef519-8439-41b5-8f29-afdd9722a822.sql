-- Fix infinite recursion in RLS for room_participants by using a SECURITY DEFINER function
-- and replacing the SELECT policy.

-- 1) Helper function that bypasses RLS to compute access
create or replace function public.can_view_room_participants(p_room_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    -- Room creator can view
    exists (
      select 1
      from public.meeting_rooms mr
      where mr.id = p_room_id
        and mr.created_by = p_user_id
    )
    OR
    -- Any user who has (or had) a participant row in that room, including guests (user_id is null)
    exists (
      select 1
      from public.room_participants rp
      where rp.room_id = p_room_id
        and (rp.user_id = p_user_id or rp.user_id is null)
    );
$$;

-- 2) Replace the recursive SELECT policy
drop policy if exists "Users can view participants in rooms they joined" on public.room_participants;

create policy "Users can view participants (joined or creator)"
on public.room_participants
for select
using (
  public.can_view_room_participants(room_id, auth.uid())
);
