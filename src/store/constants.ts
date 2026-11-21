export const RESELLER_MIN = 200

/** Días antes del vencimiento en que se habilita renovar y se avisa al admin. */
export const EXPIRY_WINDOW_DAYS = 5

/** Estados de un pedido que todavía no se resuelve. */
export const OPEN_ORDER_STATUSES = ['pending', 'payment_confirmed', 'processing']

export const ORDER_STATUS_LABEL: Record<string, string> = {
  completed: 'Completado',
  rejected: 'Rechazado',
  pending: 'En revisión',
  payment_confirmed: 'Pago confirmado',
  processing: 'En proceso',
  cancelled: 'Cancelado',
}
export const orderStatusLabel = (s: string) => ORDER_STATUS_LABEL[s] ?? 'En revisión'
export const orderStatusColor = (s: string) => (s === 'completed' ? 'green' : s === 'rejected' ? 'red' : 'orange')

// Columnas que se piden a Supabase. Las "LEGACY" sirven mientras no se haya
// ejecutado la migración de inventario, para que la tienda no se caiga.
export const LEGACY_PRODUCT_FIELDS = 'id,name,detail,game_name,category,price,reseller_price,active,contact_type,duration_days,image_url'
export const PRODUCT_FIELDS = `${LEGACY_PRODUCT_FIELDS},stream_type`

export const LEGACY_ITEM_FIELDS = 'id,game_name,product_name,product_id,player_id,quantity,unit_price,line_total,category,contact_type,duration_days,renewal_of,delivery_email,delivery_password,delivery_profile,delivery_pin,valid_until,delivered_at'
export const ITEM_FIELDS = `${LEGACY_ITEM_FIELDS},inventory_account_id,access_revoked_at,end_customer_name,end_customer_phone`

export const INVENTORY_FIELDS = 'id,platform,stream_type,email,password,profile_name,pin,status,assigned_item_id,assigned_at,notes,created_at'
