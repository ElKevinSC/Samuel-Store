# Samuel Store

## Arquitectura

Interfaz exclusivamente visual en español, construida con React 19 y TanStack Start. El proyecto actual no utiliza Next.js ni Supabase. Los componentes React y los modelos se mantienen desacoplados del enrutador para facilitar una migración posterior.

- `src/routes/index.tsx`: inicio, categorías, catálogo, filtros, búsqueda, selector de precios y diálogos informativos.
- `src/routes/__root.tsx`: documento HTML en español, metadatos y proveedores.
- `src/data/catalog.ts`: contratos TypeScript, catálogo de demostración y formato monetario en quetzales.
- `src/components/store/controller-art.tsx`: ilustración vectorial propia del control gamer.
- `src/components/ui/`: componentes accesibles Radix/shadcn, incluido Dialog.
- `src/styles.css`: tema oscuro, azul #00A3FF, tipografías Barlow y Barlow Condensed y adaptación móvil.

## Convenciones

Mantener el texto visible en español, etiquetas accesibles y avisos de demostración. Usar datos tipados y separar futuras integraciones del código visual. No presentar el registro, pedidos, productos, disponibilidad o pagos como operativos. Los estados de filtros y diálogos son efímeros y no representan persistencia. No añadir credenciales ni datos bancarios inventados.

El catálogo muestra inicialmente cuatro productos; el resto aparece al seleccionar su categoría o mediante búsqueda. Los precios de cliente y revendedor son ejemplos. Los logotipos de productos son representaciones tipográficas ilustrativas, sin implicar afiliación.

El proceso de construcción genera el árbol de rutas. No editar archivos generados. En este entorno la plataforma valida la compilación: no ejecutar builds, servidores ni tests para validación durante el trabajo del agente.

Para desarrollo fuera de esta ejecución: `pnpm install`, luego `netlify dev --port 8889`.
