-- =====================================================================
-- TIENDA REAL · Archivo 4 de 5 · Google Sheets: clave y lectura de datos
-- Ejecutar en el Supabase de la TIENDA REAL, en orden (1, 2, 3, 4, 5).
-- Si algo falla, este archivo no aplica nada. Se puede repetir.
-- =====================================================================
begin;

-- ##################### PARTE 4 · Google Sheets #####################
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

commit;
