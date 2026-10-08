# Migraciones — ejecutar en Supabase → SQL Editor, en este orden exacto

```
01_extensions.sql
02_empresa.sql
03_sedes.sql
04_roles_permisos.sql
05_profiles.sql
06_categorias.sql
07_productos.sql
08_inventario.sql
09_movimientos_inventario.sql
10_clientes.sql
11_proveedores.sql
12_ventas.sql
13_cotizaciones.sql
14_compras.sql
15_caja.sql
16_trabajadores.sql
17_notificaciones.sql
18_auditoria.sql
19_functions.sql
20_triggers.sql
21_views.sql
22_rls.sql
23_auditoria_generica.sql
24_caja_manual.sql
25_inventario_producto.sql
26_vistas_seguras.sql
27_revocar_ejecucion_publica.sql
28_roles_dos.sql
29_dashboard_resumen_seguro.sql
30_proteger_permisos.sql
31_funciones_integridad.sql
32_rls_cotizaciones.sql
33_exigir_caja_abierta.sql
34_pago_mixto.sql
36_backups.sql
37_metas_ventas.sql
```

Cada archivo es autocontenido: copia su contenido completo y pégalo en el SQL Editor,
ejecuta, y pasa al siguiente. Si alguno falla, **no sigas** con el resto — corrige el
error primero (probablemente significa que uno anterior no se ejecutó, o que ya existe
una tabla con ese nombre).

## Después de correr todo

Sigue `SUPABASE-SETUP.md` (raíz del proyecto): crear tu usuario en Authentication y ejecutar
`supabase/01_primer_arranque.sql`, que crea la empresa, la sede, la caja y tu perfil de administrador.

Atajo: `supabase/00_instalacion_completa.sql` es la suma de estas migraciones en un solo archivo.
