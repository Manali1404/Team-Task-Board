Supabase + Vercel Setup (Open Shared Board)
===========================================

1) Create Supabase project
- Go to https://supabase.com/
- Create a new project
- Wait until database is ready

2) Create tasks table + realtime
Run this SQL in Supabase SQL Editor:

create extension if not exists "pgcrypto";

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  assignee text not null,
  target_date date not null,
  latest_update text not null,
  priority text not null check (priority in ('low','medium','high')),
  story_points int not null default 0,
  type text not null default 'task' check (type in ('feature','bug','task')),
  status text not null check (status in ('todo','in-progress','in-review','done')),
  created_at timestamptz not null default now()
);

alter table public.tasks replica identity full;
alter publication supabase_realtime add table public.tasks;

-- If you created table before adding dynamic hours:
alter table public.tasks add column if not exists hours_logged numeric not null default 0;

3) Open board policy (no auth, everyone can edit)
Run this SQL:

alter table public.tasks enable row level security;

create policy "Open read access"
on public.tasks
for select
to anon
using (true);

create policy "Open insert access"
on public.tasks
for insert
to anon
with check (true);

create policy "Open update access"
on public.tasks
for update
to anon
using (true)
with check (true);

create policy "Open delete access"
on public.tasks
for delete
to anon
using (true);

Important:
- This is intentionally open for collaboration.
- Anyone with your app URL can modify tasks.

4) Get project keys
- In Supabase: Project Settings -> API
- Copy:
  - Project URL
  - anon public key

5) Paste keys in app
- Open script.js
- Set:
  - SUPABASE_URL
  - SUPABASE_ANON_KEY

6) Test locally
- Open index.html in browser
- Open same app in two different browser windows
- Update a task in one window and confirm instant sync in the other

7) Deploy to Vercel
- Push this project to GitHub
- In Vercel: New Project -> import repository -> Deploy
- No backend needed; this is a static frontend connecting to Supabase

