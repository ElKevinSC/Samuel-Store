-- Samuel Store: schema base. Ejecutar en Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'customer' check (role in ('customer','admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  detail text not null default '',
  category text not null check (category in ('Videojuegos','Streaming','Redes sociales','Reventa')),
  price numeric(10,2) not null check (price > 0),
  reseller_price numeric(10,2) not null check (reseller_price > 0),
  image_url text,
  label text,
  art text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.products enable row level security;

-- Cada usuario solo puede leer su propio perfil. No puede cambiar su rol desde el navegador.
drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles for select to authenticated using (id = auth.uid());

-- Catálogo visible públicamente, solo administradores pueden escribir.
drop policy if exists "read active products" on public.products;
create policy "read active products" on public.products for select to anon, authenticated using (active = true or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
drop policy if exists "admin insert products" on public.products;
create policy "admin insert products" on public.products for insert to authenticated with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
drop policy if exists "admin update products" on public.products;
create policy "admin update products" on public.products for update to authenticated using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')) with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
drop policy if exists "admin delete products" on public.products;
create policy "admin delete products" on public.products for delete to authenticated using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Crea perfil básico automáticamente. El rol siempre nace como customer.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), 'customer')
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

-- IMPORTANTE: después de registrarte, usa SQL Editor con la cuenta propietaria para elevar SOLO tu usuario:
-- update public.profiles set role = 'admin' where id = 'UUID_DE_TU_USUARIO';
-- Nunca pongas la service_role key en variables VITE_* ni en el navegador.
