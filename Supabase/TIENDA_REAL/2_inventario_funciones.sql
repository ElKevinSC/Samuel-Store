-- =====================================================================
-- TIENDA REAL · Archivo 2 de 5 · Inventario: entrega automática, quitar acceso y cliente del revendedor
-- Ejecutar en el Supabase de la TIENDA REAL, en orden (1, 2, 3, 4, 5).
-- Si algo falla, este archivo no aplica nada. Se puede repetir.
-- =====================================================================
begin;

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

-- ##################### PARTE 2 · Cliente final del revendedor #####################
-- Misma protección de siempre para los pedidos, con una sola excepción:
-- el dueño del pedido puede cambiar SOLO el nombre y WhatsApp de su cliente final.
create or replace function public.protect_order_item_fields()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if (select auth.uid()) is not null and not public.is_admin() then
    if tg_op = 'UPDATE'
       and (to_jsonb(new) - 'end_customer_name' - 'end_customer_phone')
         = (to_jsonb(old) - 'end_customer_name' - 'end_customer_phone')
       and exists (
         select 1 from public.orders o
         where o.id = new.order_id and o.user_id = (select auth.uid())
       )
    then
      return new;
    end if;

    if not exists (
      select 1 from public.orders o
      where o.id = new.order_id
        and o.user_id = (select auth.uid())
        and o.status = 'pending'
    ) then
      raise exception 'Pedido no editable.';
    end if;
  end if;
  new.unit_price := greatest(coalesce(new.unit_price, 0), 0);
  new.quantity   := greatest(coalesce(new.quantity, 1), 1);
  new.line_total := new.unit_price * new.quantity;
  return new;
end;
$function$;

commit;
