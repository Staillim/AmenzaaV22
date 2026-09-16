# Amenza — backend privado

El navegador ya no conecta directamente a Firebase. `/api/account` valida sesiones, permisos y vencimientos en el servidor. Las contraseñas nuevas se gestionan en Firebase Authentication; nunca se guardan hashes en Realtime Database ni se devuelven al navegador. El administrador entra con correo; los usuarios, con nombre y contraseña.

## Antes de publicar

1. Bloquea la base antigua con `database.rules.json`, guarda una exportación y revisa accesos IAM, cuentas administrativas y claves de servicio. Los cambios locales NO modifican la base ni el sitio publicados. No borres evidencia.
2. Crea un **proyecto Firebase nuevo**, una Realtime Database bloqueada y publica el contenido completo de `database.rules.json`. El backend rechaza el ID del proyecto comprometido.
3. Habilita Email/Password en Firebase Authentication. Crea allí tu cuenta administrativa con contraseña nueva y fuerte. Copia su **UID** a `ADMIN_UIDS`. Las demás cuentas no reciben permisos administrativos automáticamente.
4. Crea una cuenta de servicio exclusiva para el backend con acceso a Authentication y Realtime Database del proyecto nuevo, sin permisos Owner/Editor generales. Guarda la clave privada solamente en el gestor de secretos del hosting o en `.env` local. No la envíes por chat ni la subas al repositorio.
5. Completa las variables de `.env.example`. En Netlify deben estar disponibles para **Functions**, en el contexto correcto. `APP_ORIGIN` es el origen HTTPS exacto sin barra final. Los previews necesitan su propio origen y configuración; no uses datos reales en pruebas.
6. Despliega el código completo. Netlify usa `netlify.toml`, ejecuta `npm run build` y publica solamente `dist`, además de las funciones. Otro hosting necesita ejecutar el backend en el mismo origen: subir solo HTML no basta.
7. Entra como administrador y crea las cuentas desde el panel. Las contraseñas requieren 12–128 caracteres. Configura también una política de contraseña adecuada en Firebase Auth. Los nombres no distinguen mayúsculas/minúsculas.
8. Verifica contra el proyecto nuevo: login, creación/listado/borrado, vencimiento, cierre de sesión y reinicio de dispositivo. Comprueba que leer/escribir directamente en RTDB sin privilegios devuelve permiso denegado. Las pruebas locales usan dobles de Firebase: no sustituyen esta comprobación.

## Variables, solo servidor

| Variable | Valor |
| --- | --- |
| FIREBASE_PROJECT_ID | ID del proyecto nuevo |
| FIREBASE_DATABASE_URL | URL exacta de su Realtime Database |
| FIREBASE_CLIENT_EMAIL | client_email de la cuenta de servicio |
| FIREBASE_PRIVATE_KEY | private_key, con saltos de línea o secuencias \n |
| FIREBASE_WEB_API_KEY | Clave web del nuevo proyecto para Authentication |
| ADMIN_UIDS | UID administrativos separados por comas |
| APP_ORIGIN | Por ejemplo https://tu-sitio.netlify.app |

La clave web Firebase no es un secreto de autorización; la clave privada de servicio sí. Restringe la clave web a las APIs necesarias, sin reutilizarla para otros servicios. Activa MFA en las cuentas de Google y del hosting. El formulario de esta app todavía no implementa un segundo factor.

## Local y pruebas

Requiere Node 22+. Ejecuta `npm ci`, copia `.env.example` a `.env` y completa los valores. Usa `APP_ORIGIN=http://localhost:5173` y ejecuta `npm start`. Abre esa URL; no abras el HTML con file://. El servidor escucha solamente en loopback y sirve archivos de `dist`.

`npm run build` regenera solamente `dist`. Después ejecuta `npm test`: comprueba autorización, entradas inválidas, límites, configuración cerrada y exclusión de archivos internos. `npm audit` revisa dependencias conocidas.

## Controles y límites

- Reglas RTDB deniegan todos los clientes. El SDK Admin del servidor tiene privilegios: hay que proteger sus credenciales y permisos IAM.
- Cookie de 8 horas, HttpOnly, SameSite=Strict, Secure en producción. No hay tokens de sesión en localStorage. Referencia: https://firebase.google.com/docs/auth/admin/manage-cookies
- Origen exacto y JSON obligatorios, sin CORS abierto en la API de cuentas; cuerpo limitado a 8 KiB.
- 120 solicitudes/minuto por IP; login limitado a 10 intentos/15 minutos por IP y por identificador, con contadores compartidos transaccionales. Configura además protección de abuso y alertas de consumo del hosting; no equivale a protección DDoS.
- Vencimientos, revocaciones y administradores se comprueban en servidor. Una nueva sesión de usuario invalida la anterior. Cerrar sesión revoca las sesiones Firebase de esa cuenta también en otros dispositivos.
- La vinculación de dispositivo usa un identificador local; es una restricción operativa, no una prueba criptográfica del dispositivo.
- El nodo `audit` guarda actor, operación y fecha de las operaciones administrativas. No es inmutable ante robo de credenciales de servicio.
- `rateLimits` guarda una entrada por clave. Configura limpieza periódica de entradas con `until` expirado y alertas de almacenamiento.
- Los saldos, movimientos y flujos de Robux/pago siguen siendo una demostración local manipulable desde el navegador. No son contabilidad ni pagos o transferencias reales. Esta migración protege cuentas y base de datos; no transforma la demo en un sistema financiero.

## Recuperación

El nuevo formato usa `users/{uid}` y cuentas en Firebase Authentication. No importes directamente `users/{nombre}` ni reutilices las contraseñas antiguas potencialmente expuestas. Los vencimientos requieren una fuente fiable anterior al ataque. Migrar cuentas antiguas requiere revisar esa fuente y crear contraseñas nuevas.

Activa backups diarios antes de dar de alta usuarios y prueba una restauración en una base separada. Los backups RTDB requieren configuración y plan compatible: https://firebase.google.com/docs/database/backups . Activarlos ahora no recupera fechas pasadas. Mantén procedimientos separados para Authentication y los secretos.
