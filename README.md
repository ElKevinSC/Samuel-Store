# Samuel Store — integración inicial con Supabase

Esta versión conserva la tienda y su diseño y añade una primera integración real de autenticación y catálogo.

## Qué hace
- Registro e inicio de sesión por correo y contraseña con Supabase Auth.
- Lee el catálogo desde `public.products` cuando se configura Supabase; si falta configuración, mantiene la vista de demostración.
- Incluye un panel de administrador para agregar y eliminar productos, visible únicamente para el perfil cuyo rol en la base de datos sea `admin`.
- Las políticas RLS bloquean las escrituras de productos a usuarios que no sean administradores.

## 1. Crear tablas y políticas
En Supabase abre **SQL Editor → New query**, pega y ejecuta el archivo `Supabase/Migrations/202610220001_store_schema.sql`.

## 2. Configurar variables en Netlify
En el sitio de Netlify abre **Project configuration → Environment variables** y crea:
- `VITE_SUPABASE_URL` = URL del proyecto Supabase.
- `VITE_SUPABASE_ANON_KEY` = publishable key (o anon key pública antigua).

No uses `service_role` ni ninguna clave secreta en variables `VITE_*`. Las variables del navegador son públicas por diseño; la seguridad depende de RLS.

Después de guardar variables, vuelve a desplegar el sitio.

## 3. Crear tu usuario administrador
1. Abre la tienda desplegada y regístrate con tu correo personal.
2. En Supabase ve a **Authentication → Users**, abre tu usuario y copia su UUID.
3. En **SQL Editor**, ejecuta esta consulta reemplazando el marcador por tu UUID real:

```sql
update public.profiles
set role = 'admin'
where id = 'PEGA-AQUI-TU-UUID';
```

Ejecuta esto solo para tu propia cuenta. El formulario de registro nunca asigna el rol de administrador. No pongas el UUID en código público ni compartas claves secretas.

## Inventario de cuentas de streaming (noviembre 2026)

### Instalar (una sola vez, ANTES de subir el código)
1. En Supabase abre **SQL Editor → New query**.
2. Pega y ejecuta `Supabase/Migrations/202611190001_streaming_inventory.sql`.
   Es aditivo: no borra nada ni toca videojuegos, y se puede volver a ejecutar sin problema.
3. Sube el código a GitHub; Netlify publica solo.

Si subes el código sin ejecutar el SQL, la tienda sigue funcionando como antes y la pestaña Inventario te recuerda ejecutarlo.

### Cómo funciona
- **Inventario** (panel → 🗂️ Inventario): sube una cuenta con varios perfiles (correo, contraseña y una línea `perfil | PIN` por perfil) o pega una lista (`correo | contraseña | perfil | PIN`; para cuentas completas, `correo | contraseña`). También acepta columnas copiadas de Excel. Los repetidos se omiten.
- **Productos**: cada producto de streaming dice si se entrega como *Perfil* o *Cuenta completa* y cuántos días dura. La plataforma debe escribirse igual que en el inventario.
- **Aprobar pago**: en 📺 Streaming, si hay inventario suficiente aparece **Aprobar pago y entregar**. Cada cuenta llega sola al panel del cliente, con su vencimiento contado desde ese día. Si falta inventario no se entrega nada a medias; puedes agregar cuentas o usar **Entregar manualmente** (el método de antes).
- **Por vencer**: en 📺 Streaming aparecen las cuentas que vencen en 5 días o menos. **Quitar acceso** pide el nuevo PIN (perfiles) o la nueva contraseña (cuentas completas), retira el acceso al cliente y devuelve la cuenta al inventario. Si cambias la contraseña de una cuenta compartida, se actualiza sola a los demás clientes que la usan.
- **Distribuidores**: en *Mis suscripciones* cada cuenta tiene Copiar datos, Enviar por WhatsApp y Recordatorio. Pueden anotar el nombre y WhatsApp de su cliente para que los mensajes le lleguen directo.
- **Catálogo**: muestra "Quedan N" o "Agotado" y no deja pedir más cuentas de las que hay. Las plataformas sin inventario se venden como siempre (entrega manual).

## Estructura del código
- `src/routes/index.tsx`: solo la ruta; arma el `StoreProvider` y la página.
- `src/store/`: estado compartido (`StoreProvider`), lecturas de Supabase (`queries.ts`), tipos y constantes.
- `src/lib/`: utilidades sin interfaz (fechas, WhatsApp, CSV, portapapeles, comprobantes, cliente Supabase).
- `src/data/`: textos fijos (legales, ayuda, logos).
- `src/components/layout/`: encabezado, portada, ayuda, pie y elementos flotantes. `src/components/StoreDialogs.tsx`: el diálogo único.
- `src/features/`: una carpeta por área: `catalog`, `checkout`, `orders`, `auth`, `legal`, `reseller`, `streaming`, `inventory` y `admin` (con una pestaña por archivo en `admin/tabs`).

## Limitaciones de esta etapa
- El historial de pedidos, pagos, carga de comprobantes, perfiles de revendedor y edición avanzada de productos no están implementados aún.
- La imagen del producto se guarda como URL, no se carga archivo al almacenamiento.
- El catálogo de demostración puede aparecer si las variables no están configuradas o si la consulta de Supabase falla; revisa el mensaje en la página.
- La compilación de producción debe validarse en el despliegue de Netlify antes de considerar la tienda lista.

## Despliegue
Este es el código fuente del repositorio. Si Netlify ya está conectado a GitHub, sube los archivos del ZIP al repositorio y Netlify ejecutará `vite build` con publicación desde `dist/client`.
