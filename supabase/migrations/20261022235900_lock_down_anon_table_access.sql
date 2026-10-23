-- NorthStar: lock down direct browser (anon / authenticated) access to app tables.
--
-- WHY: the publishable key is sent to every browser via /api/config. A read-only audit
-- probe (2026-10-22) confirmed that with only that key anyone could:
--   * SELECT every row of public.profiles, including pass_hash
--   * INSERT into profiles and UPDATE any row's pass_hash (=> account takeover)
--   * INSERT into public.jobs and UPDATE public.deliveries
--
-- The web app only reaches these tables through server.js, which uses the server-side
-- secret key (bypasses RLS). After this migration the browser has no direct access;
-- server.js keeps working unchanged.
--
-- REVIEW BEFORE APPLYING. Apply in the Supabase SQL editor or with `supabase db push`.

begin;

-- 1. Drop every existing policy on these tables (names are unknown / may be permissive).
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public' and tablename in ('profiles', 'jobs', 'deliveries')
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- 2. RLS on, with no policies => anon/authenticated roles see and change nothing.
alter table public.profiles   enable row level security;
alter table public.jobs       enable row level security;
alter table public.deliveries enable row level security;

-- 3. Belt and braces: remove table privileges from the browser roles.
revoke all on table public.profiles   from anon, authenticated;
revoke all on table public.jobs       from anon, authenticated;
revoke all on table public.deliveries from anon, authenticated;

commit;

-- Verify afterwards (should return 0 rows / permission errors with the publishable key):
--   select id, pass_hash from public.profiles limit 1;   -- as anon
