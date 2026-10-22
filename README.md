# Samuel Store — integración inicial con Supabase

Esta versión conserva la tienda y su diseño y añade una primera integración real de autenticación y catálogo.

## Qué hace
- Registro e inicio de sesión por correo y contraseña con Supabase Auth.
- Lee el catálogo desde `public.products` cuando se configura Supabase; si falta configuración, mantiene la vista de demostración.
- Incluye un panel de administrador para agregar y eliminar productos, visible únicamente para el perfil cuyo rol en la base de datos sea `admin`.
- Las políticas RLS bloquean las escrituras de productos a usuarios que no sean administradores.

## 1. Crear tablas y políticas
En Supabase abre **SQL Editor → New query**, pega y ejecuta el archivo `supabase/migrations/202610220001_store_schema.sql`.

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

## Limitaciones de esta etapa
- El historial de pedidos, pagos, carga de comprobantes, perfiles de revendedor y edición avanzada de productos no están implementados aún.
- La imagen del producto se guarda como URL, no se carga archivo al almacenamiento.
- El catálogo de demostración puede aparecer si las variables no están configuradas o si la consulta de Supabase falla; revisa el mensaje en la página.
- La compilación de producción debe validarse en el despliegue de Netlify antes de considerar la tienda lista.

## Despliegue
Este es el código fuente del repositorio. Si Netlify ya está conectado a GitHub, sube los archivos del ZIP al repositorio y Netlify ejecutará `vite build` con publicación desde `dist/client`.
