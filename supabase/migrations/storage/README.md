# Storage de adjuntos de correo

Esta carpeta contiene el diseño y el SQL ejecutable para habilitar adjuntos en los correos del Command Center.

## Estado

- Diseñado, no aplicado automáticamente.
- Requiere revisión del proyecto Supabase y de sus políticas RLS antes de ejecutarse.
- La CLI de Supabase no está instalada en este entorno, por lo que el archivo SQL se ha creado manualmente para ejecución controlada.
- No se habilita un bucket público.

## Objetivo

Permitir que un usuario autenticado de una organización:

1. Suba un archivo asociado a un correo.
2. Consulte únicamente archivos de su organización.
3. Elimine únicamente archivos que subió o que estén asociados a su organización según la política aprobada.
4. Entregue a Edge Functions y n8n una referencia estable, nunca credenciales ni contenido sin control.

## Estructura del path

Cada objeto usa este formato:

```text
{organization_id}/{email_id}/{attachment_id}-{safe_file_name}
```

El primer segmento permite aplicar aislamiento por organización mediante las políticas de `storage.objects`.

## Tabla de metadatos

`public.email_attachments` contiene la relación entre el objeto Storage y el correo:

- organización
- correo
- usuario que subió el archivo
- path del objeto
- nombre original seguro
- MIME type
- tamaño
- estado de procesamiento
- timestamps

El contenido binario vive únicamente en Storage. La tabla no duplica el archivo.

## Límites definidos

- Bucket privado: `email-attachments`.
- Tamaño máximo por archivo: 10 MiB.
- MIME types permitidos inicialmente: PDF, texto, imágenes PNG/JPEG/WEBP y documentos DOC/DOCX.
- Máximo recomendado por correo: 10 archivos. Este límite debe validarse también en la Edge Function.
- No se permite acceso `anon`.

## Seguridad

El SQL:

- Activa RLS en `public.email_attachments`.
- Revoca acceso público.
- Crea políticas por organización para la tabla.
- Crea políticas privadas para `storage.objects` usando el primer segmento del path.
- No usa `SECURITY DEFINER`.
- No modifica políticas existentes de otras tablas.

## Ejecución controlada

1. Revisar que el bucket y las tablas no existan con otro contrato.
2. Revisar las políticas actuales de `storage.objects`.
3. Ejecutar el SQL en un entorno de staging.
4. Verificar subida, lectura, eliminación y aislamiento entre dos organizaciones.
5. Sólo después promover a producción.
6. Conectar el frontend y la Edge Function a este contrato.

El archivo SQL no debe ejecutarse desde el navegador ni incluirse en una petición del cliente.
