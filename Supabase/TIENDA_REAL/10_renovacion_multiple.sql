-- =====================================================================
-- TIENDA REAL · Archivo 10 · Renovar varias cuentas con un solo pago
-- Crea UN pedido con varias renovaciones (un solo depósito y comprobante).
-- Aplica las mismas reglas que create_renewal para cada cuenta:
--   · que sea del usuario, de streaming y esté entregada
--   · que venza en 1 a 5 días
--   · que no tenga otra renovación en revisión
--   · que el producto siga activo
--   · el monto depositado debe ser exactamente la suma de los precios
-- Al aprobar el pedido, apply_renewal_on_complete (ya existente) suma los
-- días a cada cuenta. No cambia create_renewal. Se puede repetir.
-- =====================================================================
begin;

create or replace function public.create_renewals(
  p_item_ids uuid[], p_reference_nc text, p_deposit_date date, p_receipt_path text, p_amount numeric
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_today date := (now() at time zone 'America/Guatemala')::date;
  v_ids uuid[];
  v_id uuid;
  v_item record;
  v_prod record;
  v_days int;
  v_price numeric;
  v_total numeric := 0;
  v_player text;
  v_order_id uuid := gen_random_uuid();
  v_label text;
begin
  if v_uid is null then raise exception 'Debes iniciar sesión'; end if;
  if coalesce(trim(p_reference_nc), '') = '' or p_deposit_date is null or coalesce(p_receipt_path, '') = '' then
    raise exception 'Faltan datos del pedido';
  end if;
  if split_part(p_receipt_path, '/', 1) <> v_uid::text then raise exception 'Comprobante inválido'; end if;

  select array_agg(distinct x) into v_ids from unnest(coalesce(p_item_ids, '{}'::uuid[])) x where x is not null;
  if v_ids is null or cardinality(v_ids) = 0 then raise exception 'Elige al menos una cuenta para renovar'; end if;
  if cardinality(v_ids) > 50 then raise exception 'Puedes renovar hasta 50 cuentas a la vez'; end if;

  select role into v_role from profiles where id = v_uid;

  foreach v_id in array v_ids loop
    select oi.* into v_item
    from order_items oi join orders o on o.id = oi.order_id
    where oi.id = v_id and o.user_id = v_uid and o.status = 'completed'
      and oi.category = 'Streaming' and oi.renewal_of is null and oi.valid_until is not null
    for update of oi;
    if not found then raise exception 'Una de las cuentas elegidas no se encontró'; end if;

    v_label := v_item.game_name || coalesce(' ' || nullif(v_item.delivery_profile, ''), '');
    if v_item.access_revoked_at is not null then
      raise exception '%: esta cuenta ya finalizó y no se puede renovar', v_label;
    end if;
    v_days := v_item.valid_until - v_today;
    if v_days < 1 or v_days > 5 then
      raise exception '%: solo se puede renovar de 5 a 1 días antes del vencimiento', v_label;
    end if;
    if exists (
      select 1 from order_items r join orders ro on ro.id = r.order_id
      where r.renewal_of = v_item.id and ro.status in ('pending', 'payment_confirmed', 'processing')
    ) then
      raise exception '%: ya tiene una renovación en revisión', v_label;
    end if;

    select id, name, detail, game_name, duration_days, price, reseller_price into v_prod
    from products where id = v_item.product_id and active = true;
    if not found then raise exception '%: este servicio ya no está disponible para renovar', v_label; end if;

    v_price := case when v_role in ('reseller', 'admin') then v_prod.reseller_price else v_prod.price end;
    v_total := v_total + v_price;
    v_player := coalesce(v_player, v_item.player_id);
  end loop;

  if v_total <> p_amount then
    raise exception 'El monto depositado debe ser exactamente Q%', v_total;
  end if;

  insert into orders (id, user_id, player_id, amount, reference_nc, deposit_date, receipt_path, status, created_at)
  values (v_order_id, v_uid, v_player, v_total, trim(p_reference_nc), p_deposit_date, p_receipt_path, 'pending', now());

  -- Segunda vuelta: una línea de renovación por cuenta (ya validadas arriba).
  foreach v_id in array v_ids loop
    select oi.* into v_item from order_items oi where oi.id = v_id;
    select id, duration_days, price, reseller_price into v_prod from products where id = v_item.product_id;
    v_price := case when v_role in ('reseller', 'admin') then v_prod.reseller_price else v_prod.price end;
    insert into order_items (id, order_id, product_id, game_name, product_name, player_id, quantity,
      unit_price, line_total, category, contact_type, duration_days, renewal_of, created_at)
    values (gen_random_uuid(), v_order_id, v_prod.id, v_item.game_name, v_item.product_name, v_item.player_id, 1,
      v_price, v_price, 'Streaming', 'whatsapp', coalesce(v_item.duration_days, v_prod.duration_days), v_item.id, now());
  end loop;

  return v_order_id;
end;
$$;

revoke all on function public.create_renewals(uuid[], text, date, text, numeric) from public, anon;
grant execute on function public.create_renewals(uuid[], text, date, text, numeric) to authenticated;

commit;
