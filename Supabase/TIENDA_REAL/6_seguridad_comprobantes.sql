-- =====================================================================
-- SAMUEL STORE · Cerrar acceso público a los comprobantes de pago
-- Ejecutar en el Supabase de la TIENDA REAL (opcional pero recomendado).
--
-- Estas dos reglas dejaban que CUALQUIERA, sin iniciar sesión, viera o
-- subiera comprobantes. Ya existen reglas correctas que siguen funcionando:
--   receipt_upload_own_folder  → cada cliente sube a su propia carpeta
--   receipt_read_own_or_admin  → cada cliente ve los suyos y el admin todos
--   receipt_delete_admin / receipt_update_own_folder
-- =====================================================================
drop policy if exists "boletas_select" on storage.objects;
drop policy if exists "boletas_insert" on storage.objects;
