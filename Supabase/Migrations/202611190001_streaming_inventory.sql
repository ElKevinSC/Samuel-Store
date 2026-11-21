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

-- ---------------------------------------------------------------------
-- 4. Aprobar pago y entregar automáticamente desde el inventario
-- ---------------------------------------------------------------------
-- Todo ocurre en una sola transacción: si falta una sola cuenta, no se
-- entrega nada y el pedido sigue pendiente.
create or replace function public.approve_order_with_inventory(p_order_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_status text;
  v_item record;
  v_acc public.streaming_accounts%rowtype;
  v_type text;
  v_today date := (now() at time zone 'America/Guatemala')::date;
  v_delivered integer := 0;
  i integer;
begin
  if not public.ss_is_admin() then
    raise exception 'Solo el administrador puede aprobar pedidos.';
  end if;

  select o.status into v_status from public.orders o where o.id = p_order_id for update;
  if not found then raise exception 'El pedido no existe.'; end if;
  if v_status <> 'pending' then
    raise exception 'Este pedido ya fue procesado (estado: %).', v_status;
  end if;

  -- 4.1 Una línea con cantidad 3 se divide en 3 líneas de 1, para que cada
  --     cuenta tenga su propio vencimiento, renovación y recordatorio.
  for v_item in
    select * from public.order_items oi
    where oi.order_id = p_order_id and oi.category = 'Streaming'
      and oi.renewal_of is null and oi.delivered_at is null and coalesce(oi.quantity, 1) > 1
  loop
    for i in 2..v_item.quantity loop
      insert into public.order_items
      select * from jsonb_populate_record(null::public.order_items,
        to_jsonb(v_item) || jsonb_build_object('id', gen_random_uuid(), 'quantity', 1, 'line_total', v_item.unit_price));
    end loop;
    update public.order_items set quantity = 1, line_total = unit_price where id = v_item.id;
  end loop;

  -- 4.2 Cada línea toma la cuenta disponible más antigua de su plataforma y tipo.
  for v_item in
    select oi.id, oi.game_name, oi.product_name, oi.duration_days, p.stream_type as product_type, p.duration_days as product_days
    from public.order_items oi
    left join public.products p on p.id = oi.product_id
    where oi.order_id = p_order_id and oi.category = 'Streaming'
      and oi.renewal_of is null and oi.delivered_at is null
    order by oi.id
  loop
    v_type := coalesce(v_item.product_type, case when v_item.product_name ilike '%complet%' then 'full' else 'profile' end);

    select * into v_acc from public.streaming_accounts a
    where a.status = 'available'
      and lower(trim(a.platform)) = lower(trim(v_item.game_name))
      and a.stream_type = v_type
    order by a.created_at, a.id
    limit 1
    for update skip locked;

    if not found then
      raise exception 'Sin inventario: no quedan % de % disponibles. Agrega cuentas o entrega este pedido manualmente.',
        case when v_type = 'full' then 'cuentas completas' else 'perfiles' end, v_item.game_name;
    end if;

    update public.order_items set
      delivery_email = v_acc.email,
      delivery_password = v_acc.password,
      delivery_profile = coalesce(nullif(trim(v_acc.profile_name), ''), case when v_type = 'full' then 'Cuenta completa' else 'Perfil' end),
      delivery_pin = nullif(trim(v_acc.pin), ''),
      valid_until = v_today + coalesce(v_item.duration_days, v_item.product_days, 30),
      delivered_at = now(),
      inventory_account_id = v_acc.id
    where id = v_item.id;

    update public.streaming_accounts
    set status = 'assigned', assigned_item_id = v_item.id, assigned_at = now(), updated_at = now()
    where id = v_acc.id;

    insert into public.streaming_account_events (account_id, item_id, event) values (v_acc.id, v_item.id, 'assigned');
    v_delivered := v_delivered + 1;
  end loop;

  update public.orders set status = 'completed' where id = p_order_id;
  return jsonb_build_object('delivered', v_delivered);
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Quitar acceso y devolver la cuenta al inventario
-- ---------------------------------------------------------------------
-- Sirve para cuentas entregadas desde el inventario y también para las que
-- se entregaron a mano antes de esta versión (se agregan al inventario).
-- Si cambias la contraseña de una cuenta con varios perfiles, se actualiza en
-- los otros perfiles y en los clientes que la siguen usando.
create or replace function public.release_streaming_access(p_item_id uuid, p_new_password text, p_new_pin text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_item record;
  v_acc_id uuid;
  v_type text;
  v_pass text := nullif(trim(coalesce(p_new_password, '')), '');
  v_pin text := nullif(trim(coalesce(p_new_pin, '')), '');
  v_others integer := 0;
begin
  if not public.ss_is_admin() then
    raise exception 'Solo el administrador puede quitar accesos.';
  end if;
  if v_pass is null and v_pin is null then
    raise exception 'Escribe la nueva contraseña o el nuevo PIN antes de liberar la cuenta.';
  end if;

  select oi.*, p.stream_type as product_type into v_item
  from public.order_items oi left join public.products p on p.id = oi.product_id
  where oi.id = p_item_id for update of oi;
  if not found then raise exception 'La suscripción no existe.'; end if;
  if v_item.access_revoked_at is not null then raise exception 'Este acceso ya fue retirado.'; end if;
  if v_item.delivery_email is null then raise exception 'Esta suscripción no tiene datos de cuenta.'; end if;

  if exists (
    select 1 from public.order_items r join public.orders o on o.id = r.order_id
    where r.renewal_of = p_item_id and o.status in ('pending', 'payment_confirmed', 'processing')
  ) then
    raise exception 'El cliente tiene una renovación pendiente. Apruébala o recházala primero.';
  end if;

  v_type := coalesce(v_item.product_type, case when v_item.delivery_profile ilike '%complet%' then 'full' else 'profile' end);

  -- Buscar la cuenta en el inventario (por enlace directo o por sus datos).
  select a.id into v_acc_id from public.streaming_accounts a
  where a.assigned_item_id = p_item_id or a.id = v_item.inventory_account_id
  limit 1 for update;

  if v_acc_id is null then
    select a.id into v_acc_id from public.streaming_accounts a
    where lower(trim(a.platform)) = lower(trim(v_item.game_name))
      and lower(trim(a.email)) = lower(trim(v_item.delivery_email))
      and lower(coalesce(trim(a.profile_name), '')) = lower(coalesce(trim(case when v_type = 'full' then null else v_item.delivery_profile end), ''))
    limit 1 for update;
    if v_acc_id is not null and exists (
      select 1 from public.streaming_accounts a where a.id = v_acc_id and a.status = 'assigned' and a.assigned_item_id is distinct from p_item_id
    ) then
      raise exception 'Ese perfil del inventario está asignado a otra venta. Revísalo en Inventario.';
    end if;
  end if;

  if v_acc_id is null then
    insert into public.streaming_accounts (platform, stream_type, email, password, profile_name, pin, status)
    values (trim(v_item.game_name), v_type, trim(v_item.delivery_email), coalesce(v_pass, v_item.delivery_password, ''),
            case when v_type = 'full' then null else v_item.delivery_profile end,
            coalesce(v_pin, v_item.delivery_pin), 'available')
    returning id into v_acc_id;
  else
    update public.streaming_accounts set
      password = coalesce(v_pass, password),
      pin = coalesce(v_pin, pin),
      status = 'available', assigned_item_id = null, assigned_at = null, updated_at = now()
    where id = v_acc_id;
  end if;

  update public.order_items set access_revoked_at = now() where id = p_item_id;

  -- Contraseña nueva en una cuenta compartida: actualizar los demás perfiles.
  if v_pass is not null then
    update public.streaming_accounts a set password = v_pass, updated_at = now()
    where lower(trim(a.platform)) = lower(trim(v_item.game_name))
      and lower(trim(a.email)) = lower(trim(v_item.delivery_email))
      and a.id <> v_acc_id;
    update public.order_items oi set delivery_password = v_pass
    where oi.id <> p_item_id and oi.access_revoked_at is null
      and lower(trim(oi.game_name)) = lower(trim(v_item.game_name))
      and lower(trim(oi.delivery_email)) = lower(trim(v_item.delivery_email));
    get diagnostics v_others = row_count;
  end if;

  insert into public.streaming_account_events (account_id, item_id, event) values (v_acc_id, p_item_id, 'released');
  return jsonb_build_object('account_id', v_acc_id, 'updated_customers', v_others);
end;
$$;

-- ---------------------------------------------------------------------
-- 6. El distribuidor anota para quién es cada cuenta (nombre y WhatsApp)
-- ---------------------------------------------------------------------
create or replace function public.set_end_customer(p_item_id uuid, p_name text, p_phone text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.order_items oi join public.orders o on o.id = oi.order_id
    where oi.id = p_item_id and o.user_id = auth.uid()
  ) then
    raise exception 'No puedes modificar esta suscripción.';
  end if;
  update public.order_items set
    end_customer_name = nullif(left(trim(coalesce(p_name, '')), 80), ''),
    end_customer_phone = nullif(left(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 15), '')
  where id = p_item_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 7. No permitir renovar un acceso que ya fue retirado
-- ---------------------------------------------------------------------
create or replace function public.ss_block_revoked_renewal()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.renewal_of is not null and exists (
    select 1 from public.order_items oi where oi.id = new.renewal_of and oi.access_revoked_at is not null
  ) then
    raise exception 'Este servicio ya terminó y no se puede renovar. Haz un pedido nuevo.';
  end if;
  return new;
end;
$$;
drop trigger if exists ss_block_revoked_renewal on public.order_items;
create trigger ss_block_revoked_renewal before insert on public.order_items
  for each row execute procedure public.ss_block_revoked_renewal();

-- ---------------------------------------------------------------------
-- 8. Permisos de ejecución
-- ---------------------------------------------------------------------
revoke all on function public.approve_order_with_inventory(uuid) from public, anon;
revoke all on function public.release_streaming_access(uuid, text, text) from public, anon;
revoke all on function public.set_end_customer(uuid, text, text) from public, anon;
grant execute on function public.approve_order_with_inventory(uuid) to authenticated;
grant execute on function public.release_streaming_access(uuid, text, text) to authenticated;
grant execute on function public.set_end_customer(uuid, text, text) to authenticated;
grant execute on function public.streaming_stock() to anon, authenticated;
grant execute on function public.ss_is_admin() to authenticated;
