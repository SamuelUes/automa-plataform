-- Datos de demo únicamente para desarrollo.
-- Ejecutar solo después de crear una organización y nunca en producción.
-- Requiere sustituir el UUID de la organización por una existente.

begin;

-- select id from public.organizations limit 1;
-- \\set demo_org_id '00000000-0000-0000-0000-000000000000'

-- El dashboard incluye un fallback visual seguro cuando la organización no tiene datos.
-- Este archivo queda como punto de partida para poblar datos en un entorno local.

commit;
