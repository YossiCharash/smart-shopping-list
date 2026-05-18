create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'רשימת קניות',
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.list_members (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.shopping_lists(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('owner', 'member')),
  invited_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (list_id, email)
);

create table if not exists public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.shopping_lists(id) on delete cascade,
  name text not null,
  done boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.shopping_lists enable row level security;
alter table public.list_members enable row level security;
alter table public.shopping_items enable row level security;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, lower(new.email))
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert or update of email on auth.users
for each row execute function public.handle_new_user();

create or replace function public.accept_my_invites()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.list_members
  set user_id = auth.uid(), accepted_at = coalesce(accepted_at, now())
  where lower(email) = lower((select email from auth.users where id = auth.uid()))
    and user_id is null;
end;
$$;

create or replace function public.is_list_member(target_list_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.list_members
    where list_id = target_list_id
      and user_id = auth.uid()
  );
$$;

drop policy if exists "Profiles are visible to signed in users" on public.profiles;
create policy "Profiles are visible to signed in users"
on public.profiles for select
to authenticated
using (true);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
on public.profiles for insert
to authenticated
with check (id = auth.uid());

drop policy if exists "Members can view lists" on public.shopping_lists;
create policy "Members can view lists"
on public.shopping_lists for select
to authenticated
using (owner_id = auth.uid() or public.is_list_member(id));

drop policy if exists "Users can create lists" on public.shopping_lists;
create policy "Users can create lists"
on public.shopping_lists for insert
to authenticated
with check (owner_id = auth.uid());

drop policy if exists "Owners can update lists" on public.shopping_lists;
create policy "Owners can update lists"
on public.shopping_lists for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "Members can view members" on public.list_members;
create policy "Members can view members"
on public.list_members for select
to authenticated
using (public.is_list_member(list_id));

drop policy if exists "Owners can add members" on public.list_members;
create policy "Owners can add members"
on public.list_members for insert
to authenticated
with check (
  invited_by = auth.uid()
  and exists (
    select 1 from public.shopping_lists
    where id = list_id
      and owner_id = auth.uid()
  )
);

drop policy if exists "Members can update own membership" on public.list_members;
create policy "Members can update own membership"
on public.list_members for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Members can view items" on public.shopping_items;
create policy "Members can view items"
on public.shopping_items for select
to authenticated
using (public.is_list_member(list_id));

drop policy if exists "Members can add items" on public.shopping_items;
create policy "Members can add items"
on public.shopping_items for insert
to authenticated
with check (public.is_list_member(list_id));

drop policy if exists "Members can update items" on public.shopping_items;
create policy "Members can update items"
on public.shopping_items for update
to authenticated
using (public.is_list_member(list_id))
with check (public.is_list_member(list_id));

drop policy if exists "Members can delete items" on public.shopping_items;
create policy "Members can delete items"
on public.shopping_items for delete
to authenticated
using (public.is_list_member(list_id));
