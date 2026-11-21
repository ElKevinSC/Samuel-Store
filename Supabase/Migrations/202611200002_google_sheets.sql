-- =====================================================================
-- Samuel Store · Conexión con Google Sheets
-- La hoja lee la tienda (sheet_export) y manda cambios (sheet_apply).
-- Ambas funciones exigen una clave secreta larga que solo conoce tu hoja.
-- Ejecutar en Supabase → SQL Editor. Se puede ejecutar más de una vez.
-- Al final, este comando muestra la clave para pegarla en la hoja:
--   select secret from public.sheet_sync_config;
-- =====================================================================

-- 1. Clave secreta (se genera sola; solo la base de datos puede leerla).
create table if not exists public.sheet_sync_config (
  id integer primary key default 1 check (id = 1),
  secret text not null,
  created_at timestamptz not null default now()
);
alter table public.sheet_sync_config enable row level security;
revoke all on public.sheet_sync_config from anon, authenticated;
insert into public.sheet_sync_config (id, secret)
values (1, replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''))
on conflict (id) do nothing;

create or replace function public.ss_sheet_check(p_secret text)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if p_secret is null or length(p_secret) < 32
     or not exists (select 1 from public.sheet_sync_config c where c.secret = p_secret) then
    raise exception 'Clave de la hoja incorrecta.';
  end if;
end;
$$;
revoke all on function public.ss_sheet_check(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Exportar todo lo que muestra la hoja
-- ---------------------------------------------------------------------
create or replace function public.sheet_export(p_secret text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_today date := (now() at time zone 'America/Guatemala')::date;
  v_month text := to_char(now() at time zone 'America/Guatemala', 'YYYY-MM');
  v_prev text := to_char((date_trunc('month', now() at time zone 'America/Guatemala') - interval '1 day'), 'YYYY-MM');
  r jsonb := '{}'::jsonb;
begin
  perform public.ss_sheet_check(p_secret);

  -- Pedidos: una fila por producto del pedido.
  r := r || jsonb_build_object('pedidos', coalesce((
    select jsonb_agg(x order by x.fecha desc) from (
      select
        o.id as pedido_id,
        to_char(o.created_at at time zone 'America/Guatemala', 'YYYY-MM-DD HH24:MI') as fecha,
        coalesce(p.full_name, '') as cliente,
        case p.role when 'reseller' then 'Revendedor' when 'admin' then 'Admin' else 'Cliente' end as rol,
        case o.status when 'completed' then 'Completado' when 'rejected' then 'Rechazado' when 'pending' then 'En revisión'
          when 'payment_confirmed' then 'Pago confirmado' when 'processing' then 'En proceso' when 'cancelled' then 'Cancelado' else o.status end as estado,
        coalesce(i.category, '') as seccion,
        coalesce(i.game_name, '') as juego,
        coalesce(i.product_name, '') as paquete,
        coalesce(i.quantity, 1) as cantidad,
        i.unit_price as precio,
        i.line_total as total_linea,
        o.amount as total_pedido,
        o.player_id as contacto,
        o.reference_nc as referencia,
        o.deposit_date::text as fecha_deposito,
        case when i.renewal_of is not null then 'Sí' else '' end as renovacion
      from public.orders o
      left join public.profiles p on p.id = o.user_id
      left join public.order_items i on i.order_id = o.id
    ) x), '[]'::jsonb));

  -- Suscripciones de streaming entregadas.
  r := r || jsonb_build_object('suscripciones', coalesce((
    select jsonb_agg(x order by x.orden, x.vence) from (
      select
        i.id,
        i.game_name as plataforma,
        i.delivery_profile as perfil,
        i.delivery_email as correo,
        i.delivery_password as contrasena,
        coalesce(i.delivery_pin, '') as pin,
        i.valid_until::text as vence,
        (i.valid_until - v_today) as dias,
        case when i.access_revoked_at is not null then 'Finalizada'
             when i.valid_until < v_today then 'Vencida'
             when i.valid_until - v_today <= 5 then 'Por vencer'
             else 'Activa' end as estado,
        coalesce(p.full_name, '') as comprador,
        o.player_id as whatsapp_comprador,
        coalesce(i.end_customer_name, '') as para,
        coalesce(i.end_customer_phone, '') as whatsapp_para,
        case when i.inventory_account_id is null then 'Manual' else 'Inventario' end as origen,
        case when i.access_revoked_at is null then 0 else 1 end as orden
      from public.order_items i
      join public.orders o on o.id = i.order_id
      left join public.profiles p on p.id = o.user_id
      where o.status = 'completed' and i.category = 'Streaming' and i.renewal_of is null and i.valid_until is not null
    ) x), '[]'::jsonb));

  -- Inventario.
  r := r || jsonb_build_object('inventario', coalesce((
    select jsonb_agg(x order by x.plataforma, x.creado) from (
      select
        a.id,
        trim(a.platform) as plataforma,
        case a.stream_type when 'full' then 'Cuenta completa' else 'Perfil' end as tipo,
        a.email as correo,
        a.password as contrasena,
        coalesce(a.profile_name, '') as perfil,
        coalesce(a.pin, '') as pin,
        case a.status when 'available' then 'Disponible' when 'assigned' then 'Vendida' else 'Desactivada' end as estado,
        coalesce(p.full_name, '') as vendida_a,
        coalesce(i.valid_until::text, '') as vence,
        a.created_at as creado
      from public.streaming_accounts a
      left join public.order_items i on i.id = a.assigned_item_id
      left join public.orders o on o.id = i.order_id
      left join public.profiles p on p.id = o.user_id
    ) x), '[]'::jsonb));

  -- Productos.
  r := r || jsonb_build_object('productos', coalesce((
    select jsonb_agg(x order by x.seccion, x.juego, x.nombre) from (
      select
        pr.id,
        pr.category as seccion,
        coalesce(pr.game_name, '') as juego,
        coalesce(nullif(pr.detail, ''), pr.name) as nombre,
        pr.price as precio,
        pr.reseller_price as precio_revendedor,
        pr.duration_days as dias,
        case when pr.category <> 'Streaming' then ''
             when coalesce(pr.stream_type, case when (coalesce(pr.detail, '') || ' ' || coalesce(pr.name, '')) ilike '%complet%' then 'full' else 'profile' end) = 'full'
             then 'Cuenta completa' else 'Perfil' end as tipo,
        pr.active as visible,
        case pr.contact_type when 'whatsapp' then 'WhatsApp' else 'ID de jugador' end as pide
      from public.products pr
    ) x), '[]'::jsonb));

  -- Revendedores y su meta del mes.
  r := r || jsonb_build_object('revendedores', coalesce((
    select jsonb_agg(x order by x.compras_mes desc) from (
      select
        p.id,
        coalesce(p.full_name, '') as nombre,
        coalesce(p.whatsapp, '') as whatsapp,
        coalesce(sum(o.amount) filter (where o.status = 'completed' and to_char(coalesce(o.completed_at, o.created_at) at time zone 'America/Guatemala', 'YYYY-MM') = v_month), 0) as compras_mes,
        count(o.id) filter (where o.status = 'completed' and to_char(coalesce(o.completed_at, o.created_at) at time zone 'America/Guatemala', 'YYYY-MM') = v_month) as pedidos_mes,
        coalesce(sum(o.amount) filter (where o.status = 'completed' and to_char(coalesce(o.completed_at, o.created_at) at time zone 'America/Guatemala', 'YYYY-MM') = v_prev), 0) as compras_mes_anterior,
        (select count(*) from public.order_items i join public.orders o2 on o2.id = i.order_id
          where o2.user_id = p.id and o2.status = 'completed' and i.category = 'Streaming' and i.renewal_of is null
            and i.access_revoked_at is null and i.valid_until >= v_today) as cuentas_activas,
        (select count(*) from public.order_items i join public.orders o2 on o2.id = i.order_id
          where o2.user_id = p.id and o2.status = 'completed' and i.category = 'Streaming' and i.renewal_of is null
            and i.access_revoked_at is null and i.valid_until between v_today and v_today + 5) as por_vencer
      from public.profiles p
      left join public.orders o on o.user_id = p.id
      where p.role = 'reseller'
      group by p.id
    ) x), '[]'::jsonb));

  -- Ventas generales: por mes (12 meses), por día (31 días) y por producto (este mes).
  r := r || jsonb_build_object('resumen_mensual', coalesce((
    select jsonb_agg(x order by x.mes desc) from (
      select
        m.mes,
        coalesce(sum(o.amount) filter (where o.status = 'completed'), 0) as ventas,
        count(o.id) filter (where o.status = 'completed') as pedidos,
        coalesce(sum(o.amount) filter (where o.status = 'completed' and o.cat = 'Videojuegos'), 0) as videojuegos,
        coalesce(sum(o.amount) filter (where o.status = 'completed' and o.cat = 'Streaming'), 0) as streaming,
        coalesce(sum(o.amount) filter (where o.status = 'completed' and o.rol = 'reseller'), 0) as revendedores,
        coalesce(sum(o.amount) filter (where o.status = 'completed' and o.rol <> 'reseller'), 0) as clientes,
        coalesce(sum(o.amount) filter (where o.status = 'pending'), 0) as pendiente,
        count(o.id) filter (where o.status = 'rejected') as rechazados
      from (
        select to_char(d, 'YYYY-MM') as mes
        from generate_series(date_trunc('month', now() at time zone 'America/Guatemala') - interval '11 months',
                             date_trunc('month', now() at time zone 'America/Guatemala'), interval '1 month') d
      ) m
      left join (
        select o.*, to_char(coalesce(o.completed_at, o.created_at) at time zone 'America/Guatemala', 'YYYY-MM') as mes_o,
               (select i.category from public.order_items i where i.order_id = o.id limit 1) as cat,
               coalesce(pp.role, 'customer') as rol
        from public.orders o left join public.profiles pp on pp.id = o.user_id
      ) o on o.mes_o = m.mes
      group by m.mes
    ) x), '[]'::jsonb));

  r := r || jsonb_build_object('resumen_diario', coalesce((
    select jsonb_agg(x order by x.dia desc) from (
      select d::date::text as dia,
        coalesce(sum(o.amount) filter (where o.status = 'completed'), 0) as ventas,
        count(o.id) filter (where o.status = 'completed') as pedidos
      from generate_series(v_today - 30, v_today, interval '1 day') d
      left join public.orders o on (coalesce(o.completed_at, o.created_at) at time zone 'America/Guatemala')::date = d::date
      group by d
    ) x), '[]'::jsonb));

  r := r || jsonb_build_object('resumen_productos', coalesce((
    select jsonb_agg(x order by x.ventas desc) from (
      select i.category as seccion, i.game_name as juego,
        sum(coalesce(i.quantity, 1)) as unidades, sum(i.line_total) as ventas
      from public.order_items i join public.orders o on o.id = i.order_id
      where o.status = 'completed'
        and to_char(coalesce(o.completed_at, o.created_at) at time zone 'America/Guatemala', 'YYYY-MM') = v_month
      group by i.category, i.game_name
    ) x), '[]'::jsonb));

  return r || jsonb_build_object('generado', to_char(now() at time zone 'America/Guatemala', 'DD/MM/YYYY HH24:MI'), 'mes', v_month);
end;
$$;

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
