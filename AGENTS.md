# Samuel Store

## Arquitectura

Interfaz en español con React 19, TanStack Start y Supabase (autenticación, base de datos, almacenamiento).

- `src/routes/index.tsx`: ruta `/`; solo monta `StoreProvider` y `HomePage`.
- `src/store/`: estado compartido (`StoreProvider`, `useStore`), lecturas (`queries.ts`), tipos y constantes.
- `src/lib/`: utilidades puras (fechas GT, WhatsApp, CSV, portapapeles, comprobantes, cliente Supabase).
- `src/data/`: catálogo de demostración y formato monetario, textos legales, ayuda y logos.
- `src/components/layout/`: encabezado, portada, ayuda, pie y elementos flotantes; `StoreDialogs.tsx` muestra el diálogo activo.
- `src/features/<área>/`: catálogo, checkout, pedidos, auth, legal, revendedor, streaming, inventario y admin (`admin/tabs/` una pestaña por archivo).
- `Supabase/Migrations/`: SQL a ejecutar en Supabase. La entrega desde inventario y quitar acceso son funciones de la base de datos (transaccionales).
- `src/components/ui/`: componentes Radix/shadcn. `src/styles.css`: tema oscuro, azul #00A3FF.

La lógica de videojuegos no debe cambiar sin pedirlo expresamente.

## Convenciones

Mantener el texto visible en español, etiquetas accesibles y avisos de demostración. Usar datos tipados y separar futuras integraciones del código visual. No presentar el registro, pedidos, productos, disponibilidad o pagos como operativos. Los estados de filtros y diálogos son efímeros y no representan persistencia. No añadir credenciales ni datos bancarios inventados.

El catálogo muestra inicialmente cuatro productos; el resto aparece al seleccionar su categoría o mediante búsqueda. Los precios de cliente y revendedor son ejemplos. Los logotipos de productos son representaciones tipográficas ilustrativas, sin implicar afiliación.

El proceso de construcción genera el árbol de rutas. No editar archivos generados. En este entorno la plataforma valida la compilación: no ejecutar builds, servidores ni tests para validación durante el trabajo del agente.

Para desarrollo fuera de esta ejecución: `pnpm install`, luego `netlify dev --port 8889`.
