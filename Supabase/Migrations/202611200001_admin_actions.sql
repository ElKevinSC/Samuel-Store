-- =====================================================================
-- Samuel Store · Acciones del administrador sobre pedidos
-- La base de datos solo permite LEER orders y order_items desde la página.
-- Estas funciones dejan al administrador (y solo a él) aprobar, rechazar,
-- entregar a mano y corregir cuentas, sin abrir esas tablas a nadie más.
-- Ejecutar en Supabase → SQL Editor. Se puede ejecutar más de una vez.
-- =====================================================================

-- 1. Aprobar o rechazar un pedido (videojuegos, renovaciones o streaming).
create or replace function public.admin_set_order_status(p_order_id uuid, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_status text;
begin
  if not public.ss_is_admin() then raise exception 'Solo el administrador puede cambiar pedidos.'; end if;
  if p_status not in ('completed', 'rejected') then raise exception 'Estado no válido.'; end if;
  select o.status into v_status from public.orders o where o.id = p_order_id for update;
  if not found then raise exception 'El pedido no existe.'; end if;
  if v_status not in ('pending', 'payment_confirmed', 'processing') then
    raise exception 'Este pedido ya fue procesado (estado: %).', v_status;
  end if;
  update public.orders set status = p_status where id = p_order_id;
end;
$$;

-- 2. Entrega manual de streaming: guarda las cuentas y completa el pedido,
--    todo junto (si algo falla, no se guarda nada).
--    p_deliveries = [{ "item_id", "email", "password", "profile", "pin", "valid_until" }, ...]
create or replace function public.admin_deliver_order(p_order_id uuid, p_deliveries jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_status text;
  d jsonb;
  v_count integer := 0;
begin
  if not public.ss_is_admin() then raise exception 'Solo el administrador puede entregar pedidos.'; end if;
  select o.status into v_status from public.orders o where o.id = p_order_id for update;
  if not found then raise exception 'El pedido no existe.'; end if;
  if v_status <> 'pending' then raise exception 'Este pedido ya fue procesado (estado: %).', v_status; end if;

  for d in select * from jsonb_array_elements(coalesce(p_deliveries, '[]'::jsonb)) loop
    if coalesce(trim(d->>'email'), '') = '' or coalesce(d->>'password', '') = ''
       or coalesce(trim(d->>'profile'), '') = '' or coalesce(d->>'valid_until', '') = '' then
      raise exception 'Completa correo, contraseña, perfil y fecha en cada perfil.';
    end if;
    update public.order_items set
      delivery_email = trim(d->>'email'),
      delivery_password = trim(d->>'password'),
      delivery_profile = trim(d->>'profile'),
      delivery_pin = nullif(trim(coalesce(d->>'pin', '')), ''),
      valid_until = (d->>'valid_until')::date,
      delivered_at = now()
    where id = (d->>'item_id')::uuid and order_id = p_order_id
      and category = 'Streaming' and renewal_of is null;
    if not found then raise exception 'Una de las líneas no pertenece a este pedido.'; end if;
    v_count := v_count + 1;
  end loop;

  if v_count = 0 then raise exception 'No hay cuentas para entregar.'; end if;
  update public.orders set status = 'completed' where id = p_order_id;
end;
$$;

-- 3. Corregir los datos de una cuenta ya entregada (y su copia en el inventario).
create or replace function public.admin_edit_delivery(
  p_item_id uuid, p_email text, p_password text, p_profile text, p_pin text, p_valid_until date)
returns void language plpgsql security definer set search_path = '' as $$
declare it record;
begin
  if not public.ss_is_admin() then raise exception 'Solo el administrador puede editar cuentas.'; end if;
  select * into it from public.order_items where id = p_item_id for update;
  if not found or it.category <> 'Streaming' or it.delivered_at is null then raise exception 'Esta cuenta no se puede editar.'; end if;
  if it.access_revoked_at is not null then raise exception 'Este acceso ya fue retirado.'; end if;
  if coalesce(trim(p_email), '') = '' or coalesce(p_password, '') = '' or coalesce(trim(p_profile), '') = '' or p_valid_until is null then
    raise exception 'Completa correo, contraseña, perfil y fecha de vencimiento.';
  end if;
  if p_valid_until is distinct from it.valid_until and exists (
    select 1 from public.order_items r join public.orders o on o.id = r.order_id
    where r.renewal_of = p_item_id and o.status in ('pending', 'payment_confirmed', 'processing')
  ) then
    raise exception 'Hay una renovación pendiente. Resuélvela antes de cambiar la fecha.';
  end if;

  update public.order_items set
    delivery_email = trim(p_email),
    delivery_password = trim(p_password),
    delivery_profile = trim(p_profile),
    delivery_pin = nullif(trim(coalesce(p_pin, '')), ''),
    valid_until = p_valid_until
  where id = p_item_id;

  if it.inventory_account_id is not null then
    update public.streaming_accounts a set
      email = trim(p_email),
      password = trim(p_password),
      pin = nullif(trim(coalesce(p_pin, '')), ''),
      profile_name = case when a.stream_type = 'profile' then trim(p_profile) else a.profile_name end,
      updated_at = now()
    where a.id = it.inventory_account_id;
  end if;
end;
$$;

revoke all on function public.admin_set_order_status(uuid, text) from public, anon;
revoke all on function public.admin_deliver_order(uuid, jsonb) from public, anon;
revoke all on function public.admin_edit_delivery(uuid, text, text, text, text, date) from public, anon;
grant execute on function public.admin_set_order_status(uuid, text) to authenticated;
grant execute on function public.admin_deliver_order(uuid, jsonb) to authenticated;
grant execute on function public.admin_edit_delivery(uuid, text, text, text, text, date) to authenticated;
