-- =====================================================================
-- TIENDA REAL · Archivo 1 de 5 · Inventario: columnas nuevas, tablas y existencias
-- Ejecutar en el Supabase de la TIENDA REAL, en orden (1, 2, 3, 4, 5).
-- Si algo falla, este archivo no aplica nada. Se puede repetir.
-- =====================================================================
begin;

-- ##################### PARTE 1 · Inventario de streaming #####################
-- =====================================================================
-- Samuel Store · Inventario de cuentas de streaming
-- Ejecutar UNA vez en Supabase → SQL Editor → New query.
-- Es aditivo: no borra datos ni cambia nada de videojuegos.
-- Se puede volver a ejecutar sin problemas (usa "if not exists").
-- =====================================================================
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 0. Ayudante: ¿el usuario actual es administrador?
-- ---------------------------------------------------------------------
create or replace function public.ss_is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
$$;

-- ---------------------------------------------------------------------
-- 1. Columnas nuevas en tablas existentes
-- ---------------------------------------------------------------------
-- Cómo se entrega un producto de streaming: perfil suelto o cuenta completa.
alter table public.products add column if not exists stream_type text;
do $$ begin
  alter table public.products add constraint products_stream_type_check check (stream_type in ('profile', 'full'));
exception when duplicate_object then null; end $$;

-- Los productos de streaming que ya existen se clasifican por su nombre.
update public.products
set stream_type = case when (coalesce(detail, '') || ' ' || coalesce(name, '')) ilike '%complet%' then 'full' else 'profile' end
where category = 'Streaming' and stream_type is null;

-- Datos de la entrega automática y del cliente final del distribuidor.
alter table public.order_items add column if not exists inventory_account_id uuid;
alter table public.order_items add column if not exists access_revoked_at timestamptz;
alter table public.order_items add column if not exists end_customer_name text;
alter table public.order_items add column if not exists end_customer_phone text;

-- ---------------------------------------------------------------------
-- 2. Inventario de cuentas
-- ---------------------------------------------------------------------
create table if not exists public.streaming_accounts (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (char_length(trim(platform)) between 1 and 80),
  stream_type text not null default 'profile' check (stream_type in ('profile', 'full')),
  email text not null check (char_length(trim(email)) between 1 and 200),
  password text not null check (char_length(password) between 1 and 200),
  profile_name text,
  pin text,
  status text not null default 'available' check (status in ('available', 'assigned', 'disabled')),
  assigned_item_id uuid references public.order_items(id) on delete set null,
  assigned_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Un perfil solo puede estar asignado a una venta a la vez.
create unique index if not exists streaming_accounts_one_item
  on public.streaming_accounts (assigned_item_id) where assigned_item_id is not null;
-- Evita subir dos veces el mismo perfil de la misma cuenta.
create unique index if not exists streaming_accounts_unique_slot
  on public.streaming_accounts (lower(trim(platform)), lower(trim(email)), lower(coalesce(trim(profile_name), '')));
create index if not exists streaming_accounts_pick
  on public.streaming_accounts (lower(trim(platform)), stream_type, status, created_at);

-- Historial: a quién se entregó cada cuenta y cuándo se liberó.
create table if not exists public.streaming_account_events (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.streaming_accounts(id) on delete cascade,
  item_id uuid,
  event text not null check (event in ('assigned', 'released')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.streaming_accounts to authenticated;
grant select on public.streaming_account_events to authenticated;

alter table public.streaming_accounts enable row level security;
alter table public.streaming_account_events enable row level security;

-- Solo el administrador ve y modifica el inventario. Los clientes reciben los
-- datos copiados en su pedido (order_items), nunca leen esta tabla.
drop policy if exists "admin all streaming accounts" on public.streaming_accounts;
create policy "admin all streaming accounts" on public.streaming_accounts
  for all to authenticated using (public.ss_is_admin()) with check (public.ss_is_admin());
drop policy if exists "admin read account events" on public.streaming_account_events;
create policy "admin read account events" on public.streaming_account_events
  for select to authenticated using (public.ss_is_admin());

-- ---------------------------------------------------------------------
-- 3. Existencias públicas (solo cantidades, nunca datos de acceso)
-- ---------------------------------------------------------------------
create or replace function public.streaming_stock()
returns table (platform text, stream_type text, available integer, total integer)
language sql stable security definer set search_path = '' as $$
  select min(trim(a.platform)) as platform,
         a.stream_type,
         count(*) filter (where a.status = 'available')::int as available,
         count(*) filter (where a.status <> 'disabled')::int as total
  from public.streaming_accounts a
  group by lower(trim(a.platform)), a.stream_type
$$;

commit;
