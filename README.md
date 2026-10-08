# Stock — Grupo LRomero Importaciones

Sistema de control de stock, ventas, compras, caja y reportes. Next.js 16 + Supabase.
Sin facturación electrónica: las ventas son notas de venta internas (NV-000001), sin IGV obligatorio.

## Empezar
1. Sigue **`SUPABASE-SETUP.md`** (crear proyecto, pegar el SQL, crear tu usuario, `.env.local`).
2. `npm install`
3. `npm run dev` → http://localhost:3000

## Roles y reglas
- Solo hay 2 roles: **administrador** (todo) y **supervisor** (opera los 11 módulos de trabajo con las 7 acciones; sin Auditoría, Usuarios ni Configuración, que no ve ni escribiendo la ruta).
- **No se vende con la caja cerrada**: hay que abrir la caja en Ingresos y Caja antes de registrar una venta.
- **Pago mixto**: una venta puede pagarse con varios medios (efectivo, Yape, Plin…); la suma debe ser igual al total y se valida en el servidor.
- Anular una venta devuelve el stock y registra el egreso en la caja abierta.

## Antes de usarlo en serio
Lee **`CONSIDERACIONES.md`**: lo que es manual, lo que aún no existe y lo que falta decidir.

## Scripts
- `npm run dev` — desarrollo
- `npm run build` / `npm start` — producción
- `npm run lint` — ESLint
- `npm run typecheck` — revisa los tipos (`tsc --noEmit`)
- `npm run clean` — borra la caché `.next` (crece mucho en desarrollo; es seguro borrarla)

## Estructura
- `app/` rutas · `components/` interfaz · `services/` acceso a datos (Supabase) · `store/` estado de sesión
- `supabase/` SQL: `00_instalacion_completa.sql`, `01_primer_arranque.sql`, `01.2_segundo_arranque.sql` (supervisores), `99_reset_total.sql` y `migrations/`
