-- =====================================================================
-- TIENDA REAL · Archivo 5 de 5 · Google Sheets: edición desde la hoja
-- Ejecutar en el Supabase de la TIENDA REAL, en orden (1, 2, 3, 4, 5).
-- Si algo falla, este archivo no aplica nada. Se puede repetir.
-- =====================================================================
begin;

-- ---------------------------------------------------------------------
-- 3. Aplicar un cambio hecho en la hoja (una fila a la vez)
--    p_tab: 'productos' | 'inventario' | 'suscripciones'
--    Devuelve { id, mensaje }.
-- ---------------------------------------------------------------------
create or replace function public.sheet_apply(p_secret text, p_tab text, p_row jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := nullif(trim(coalesce(p_row->>'id', '')), '')::uuid;
  v_txt text;
  v_type text;
  v_status text;
  v_cat text;
  v_price numeric;
  v_rprice numeric;
  v_days integer;
  v_active boolean;
  v_contact text;
  it record;
  acc record;
  v_date date;
begin
  perform public.ss_sheet_check(p_secret);

  -- ---------------- Productos ----------------
  if p_tab = 'productos' then
    v_price := nullif(trim(coalesce(p_row->>'precio', '')), '')::numeric;
    v_rprice := coalesce(nullif(trim(coalesce(p_row->>'precio_revendedor', '')), '')::numeric, v_price);
    v_days := nullif(trim(coalesce(p_row->>'dias', '')), '')::numeric::integer;
    v_txt := trim(coalesce(p_row->>'nombre', ''));
    v_active := coalesce(nullif(p_row->>'visible', '')::boolean, true);
    v_type := case when coalesce(p_row->>'tipo', '') ilike '%complet%' then 'full' else 'profile' end;
    v_contact := case when coalesce(p_row->>'pide', '') ilike '%whats%' then 'whatsapp' when coalesce(p_row->>'pide', '') = '' then null else 'player_id' end;

    if trim(coalesce(p_row->>'juego', '')) = '' or v_txt = '' then raise exception 'Escribe el juego o plataforma y el nombre.'; end if;
    if v_price is null or v_price <= 0 or v_rprice <= 0 then raise exception 'Los precios deben ser mayores a 0.'; end if;

    if v_id is null then
      v_cat := case when coalesce(p_row->>'seccion', '') ilike 'stream%' then 'Streaming' when coalesce(p_row->>'seccion', '') ilike 'video%' then 'Videojuegos' else null end;
      if v_cat is null then raise exception 'Elige la sección: Videojuegos o Streaming.'; end if;
      if v_cat = 'Streaming' and coalesce(v_days, 0) < 1 then raise exception 'Escribe los días que dura (Ej. 30).'; end if;
      insert into public.products (name, detail, game_name, category, price, reseller_price, active, contact_type, duration_days, stream_type)
      values (v_txt, v_txt, trim(p_row->>'juego'), v_cat, v_price, v_rprice, v_active,
              coalesce(v_contact, case when v_cat = 'Streaming' then 'whatsapp' else 'player_id' end),
              case when v_cat = 'Streaming' then v_days else null end,
              case when v_cat = 'Streaming' then v_type else null end)
      returning id into v_id;
      return jsonb_build_object('id', v_id, 'mensaje', 'Producto creado');
    end if;

    select category into v_cat from public.products where id = v_id;
    if not found then raise exception 'Ese producto ya no existe.'; end if;
    if v_cat = 'Streaming' and coalesce(v_days, 0) < 1 then raise exception 'Escribe los días que dura (Ej. 30).'; end if;
    update public.products set
      name = v_txt, detail = v_txt, game_name = trim(p_row->>'juego'),
      price = v_price, reseller_price = v_rprice, active = v_active,
      contact_type = coalesce(v_contact, contact_type),
      duration_days = case when v_cat = 'Streaming' then v_days else duration_days end,
      stream_type = case when v_cat = 'Streaming' then v_type else stream_type end
    where id = v_id;
    return jsonb_build_object('id', v_id, 'mensaje', 'Guardado');
  end if;

  -- ---------------- Inventario ----------------
  if p_tab = 'inventario' then
    v_type := case when coalesce(p_row->>'tipo', '') ilike '%complet%' then 'full' else 'profile' end;
    v_status := case when coalesce(p_row->>'estado', '') ilike 'desact%' then 'disabled' else 'available' end;
    if trim(coalesce(p_row->>'plataforma', '')) = '' or trim(coalesce(p_row->>'correo', '')) = '' or coalesce(p_row->>'contrasena', '') = '' then
      raise exception 'Falta plataforma, correo o contraseña.';
    end if;
    if v_type = 'profile' and trim(coalesce(p_row->>'perfil', '')) = '' then raise exception 'Falta el nombre del perfil (Ej. P1).'; end if;

    if v_id is null then
      begin
        insert into public.streaming_accounts (platform, stream_type, email, password, profile_name, pin, status)
        values (trim(p_row->>'plataforma'), v_type, trim(p_row->>'correo'), trim(p_row->>'contrasena'),
                case when v_type = 'profile' then trim(p_row->>'perfil') else null end,
                nullif(trim(coalesce(p_row->>'pin', '')), ''), v_status)
        returning id into v_id;
      exception when unique_violation then
        raise exception 'Ese perfil ya está en el inventario.';
      end;
      return jsonb_build_object('id', v_id, 'mensaje', 'Agregada al inventario');
    end if;

    select * into acc from public.streaming_accounts where id = v_id for update;
    if not found then raise exception 'Esa cuenta ya no existe en el inventario.'; end if;
    if acc.status = 'assigned' then raise exception 'Está vendida: corrígela en la pestaña Suscripciones.'; end if;
    begin
      update public.streaming_accounts set
        platform = trim(p_row->>'plataforma'), stream_type = v_type,
        email = trim(p_row->>'correo'), password = trim(p_row->>'contrasena'),
        profile_name = case when v_type = 'profile' then trim(p_row->>'perfil') else null end,
        pin = nullif(trim(coalesce(p_row->>'pin', '')), ''),
        status = v_status, updated_at = now()
      where id = v_id;
    exception when unique_violation then
      raise exception 'Ya existe otro perfil igual en el inventario.';
    end;
    return jsonb_build_object('id', v_id, 'mensaje', case when v_status = 'disabled' then 'Desactivada' else 'Guardado' end);
  end if;

  -- ---------------- Suscripciones ----------------
  if p_tab = 'suscripciones' then
    if v_id is null then raise exception 'Las suscripciones nuevas se crean al aprobar un pedido.'; end if;
    select * into it from public.order_items where id = v_id for update;
    if not found or it.category <> 'Streaming' or it.delivered_at is null then raise exception 'Esta suscripción no se puede editar.'; end if;
    if it.access_revoked_at is not null then raise exception 'Este acceso ya fue retirado.'; end if;
    v_date := nullif(trim(coalesce(p_row->>'vence', '')), '')::date;
    if trim(coalesce(p_row->>'correo', '')) = '' or coalesce(p_row->>'contrasena', '') = '' or trim(coalesce(p_row->>'perfil', '')) = '' or v_date is null then
      raise exception 'Falta correo, contraseña, perfil o fecha de vencimiento.';
    end if;
    if v_date is distinct from it.valid_until and exists (
      select 1 from public.order_items r join public.orders o on o.id = r.order_id
      where r.renewal_of = v_id and o.status in ('pending', 'payment_confirmed', 'processing')
    ) then
      raise exception 'Hay una renovación pendiente. Resuélvela antes de cambiar la fecha.';
    end if;
    update public.order_items set
      delivery_email = trim(p_row->>'correo'),
      delivery_password = trim(p_row->>'contrasena'),
      delivery_profile = trim(p_row->>'perfil'),
      delivery_pin = nullif(trim(coalesce(p_row->>'pin', '')), ''),
      valid_until = v_date,
      end_customer_name = nullif(left(trim(coalesce(p_row->>'para', '')), 80), ''),
      end_customer_phone = nullif(left(regexp_replace(coalesce(p_row->>'whatsapp_para', ''), '\D', '', 'g'), 15), '')
    where id = v_id;
    if it.inventory_account_id is not null then
      update public.streaming_accounts a set
        email = trim(p_row->>'correo'), password = trim(p_row->>'contrasena'),
        pin = nullif(trim(coalesce(p_row->>'pin', '')), ''),
        profile_name = case when a.stream_type = 'profile' then trim(p_row->>'perfil') else a.profile_name end,
        updated_at = now()
      where a.id = it.inventory_account_id;
    end if;
    return jsonb_build_object('id', v_id, 'mensaje', 'Guardado');
  end if;

  raise exception 'La pestaña % no se puede editar.', p_tab;
end;
$$;

revoke all on function public.sheet_export(text) from public;
revoke all on function public.sheet_apply(text, text, jsonb) from public;
grant execute on function public.sheet_export(text) to anon, authenticated;
grant execute on function public.sheet_apply(text, text, jsonb) to anon, authenticated;

commit;

-- Copia tu clave para Google Sheets con:
--   select secret from public.sheet_sync_config;
