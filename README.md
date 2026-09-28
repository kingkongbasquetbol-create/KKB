# King Kong Basketball

Aplicación web responsive para gestionar y publicar el contenido de King Kong Basketball. Está construida con Node.js y módulos nativos para que pueda arrancar sin instalar paquetes.

## Requisitos

- c o posterior.
- No requiere `npm install` ni dependencias de terceros.

## Ejecutar localmente

1. Copia `.env.example` a `.env`.
2. Crea el hash de la contraseña de administración con Node:

   ```sh
   node -e "const c=require('node:crypto'); const s=c.randomBytes(16).toString('hex'); console.log(s+':'+c.scryptSync('TU_CONTRASEÑA_LARGA',s,64).toString('hex'))"
   ```

3. En `.env`, define `ADMIN_EMAIL` y pega el resultado en `ADMIN_PASSWORD_HASH`. Puedes quitar `ADMIN_PASSWORD` o dejarlo vacío. Define también `SESSION_SECRET` con un secreto aleatorio largo; puedes generarlo con `node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"`.
4. Ejecuta `node server.js` y abre [http://localhost:3000](http://localhost:3000).
5. El primer inicio crea `data/store.json` con registros de demostración claramente marcados. Esta es la base de datos JSON de la instalación.
6. Abre `/admin` e inicia sesión con el correo y la contraseña usados para generar el hash.

También puedes establecer `ADMIN_PASSWORD` en `.env` para desarrollo local. En ese modo el servidor compara la contraseña configurada directamente; para cualquier despliegue usa `ADMIN_PASSWORD_HASH` con scrypt, una contraseña única y un `SESSION_SECRET` aleatorio.

## Contenido administrable

Desde `/admin` puedes añadir, modificar y eliminar jugadores, staff, partidos, noticias, fotos, videos, patrocinadores, historia, clasificación y palmarés. También puedes editar estadísticas generales y configuración del equipo. Los formularios públicos de contacto se guardan como mensajes y se consultan en el panel.

La API JSON vive en `/api`: las colecciones tienen operaciones GET/POST/PUT/DELETE. Las escrituras requieren sesión administrativa. Los únicos POST públicos son el login y el formulario de contacto. La sesión es una cookie firmada, `HttpOnly` y `SameSite=Strict`, con expiración de ocho horas. En producción se marca `Secure` al definir `NODE_ENV=production`; sirve la aplicación detrás de HTTPS.

## Publicar en GitHub y desplegar en Netlify

El repo incluye `netlify.toml`: Netlify publica `public/`, envía las rutas `/api/*` a una función serverless y usa Netlify Blobs como almacenamiento persistente. El sitio local sigue usando `data/store.json`; el despliegue no intenta escribir en el sistema de archivos temporal de las funciones.

1. Sube este proyecto al repositorio GitHub.
2. En Netlify, elige **Add new site → Import an existing project** y conecta ese repositorio.
3. Netlify detecta `netlify.toml`. El comando de build es `npm run build` y el directorio publicado es `public`.
4. En la configuración del sitio de Netlify, agrega estas variables de entorno: `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH` y `SESSION_SECRET`. Usa el generador de hash de la sección local para crear `ADMIN_PASSWORD_HASH`; genera un `SESSION_SECRET` aleatorio largo. No subas `.env` ni contraseñas al repo.
5. Inicia el deploy. La función inicializa los datos de demostración al primer acceso y guarda después los cambios en Netlify Blobs. Para probar el CMS, abre `/admin` en el dominio publicado.

Las funciones de Netlify requieren un sitio vinculado a Netlify para que Blobs quede configurado. Puedes mantener el dominio `netlify.app` o enlazar uno propio después. Revisa las opciones de facturación y límites de la cuenta Netlify antes de publicar tráfico real.

## Rutas incluidas

Sitio: inicio, nosotros, equipo, perfil de jugador, partidos, resultados, calendario, clasificación, estadísticas, galería, videos, noticias y detalle, palmarés, patrocinadores y contacto. Panel: `/admin`.

## Datos y activos

Los registros de ejemplo llevan etiqueta interna `demo` y no se presentan como logros o plantilla auténticos. Los datos reales del equipo, fotografías y enlaces sociales se editan desde el panel. No se incluyó logo oficial ni imagen de mascota porque no estaban en el workspace; la configuración permite añadir la URL de la mascota y la foto del equipo.

## Alcance técnico

Esta entrega ofrece una aplicación autocontenida con API, persistencia JSON para desarrollo local y Netlify Blobs en producción. No incluye PostgreSQL, Prisma, carga binaria de imágenes, edición visual enriquecida, vista mensual interactiva, OAuth, protección de intentos de inicio de sesión ni pruebas de seguridad. Antes de operar a escala o con varios administradores, conviene migrar a una base de datos relacional e incorporar límites de acceso y copias de seguridad. Los recursos tipográficos e imágenes remotos requieren conexión a internet.
