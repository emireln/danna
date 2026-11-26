-- =============================================================================
-- danna migration 0029: the storage in use, for the storage gateway (worker/storage in the Danna repository).
--
-- Run it in the Supabase dashboard: SQL Editor -> New query -> paste this whole file -> Run.
-- It is safe to run again. Run migration 0028 first. The same change ends supabase/schema.sql for new projects.
--
-- What it adds. One function that adds up the size of every file in Supabase Storage. Only the service-role key can call
-- it, and the gateway uses it to decide when new files go to Cloudflare R2 (400 MB by default). No row changes, and no
-- data is deleted.
-- =============================================================================

create or replace function public.storage_used_bytes()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum((o.metadata ->> 'size')::bigint), 0)
  from storage.objects o;
$$;

revoke all on function public.storage_used_bytes() from public, anon, authenticated;
grant execute on function public.storage_used_bytes() to service_role;
