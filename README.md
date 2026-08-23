# AportAR

Plataforma solidaria de intercambio local: donaciones, servicios y solicitudes de ayuda entre vecinos.

## Configurar el envío de correo (recuperar contraseña)

El sitio usa una cuenta de Gmail para enviar el link de "¿Olvidaste tu contraseña?". Cada persona que corra el proyecto en su computadora necesita configurar "su propia" cuenta — no se debe comparte ni se sube a un sitio publico.

1. Copiá el archivo `.env.example` y renombrá la copia a `.env` (en la misma carpeta que `app.py`).
2. Entrá a tu cuenta de Google: "Seguridad" y activá la "Verificación en 2 pasos" si no esta puesta.
3. Buscá "Contraseñas de aplicaciones", generá una nueva (llamarla "AportAR") y copiá el código de 16 letras que te muestra.
4. Completá el `.env` con tus datos:
   ```
   MAIL_SERVER=smtp.gmail.com
   MAIL_PORT=587
   MAIL_USERNAME=tu_correo@gmail.com
   MAIL_PASSWORD=tu_codigo_de_16_letras_sin_espacios
   ```
5. Guardá y reiniciá `app.py`.

**Si no configurás el `.env`:** el sitio funcionando igual. La diferencia es que no se manda ningún correo de verdad. En su lugar, el enlace para recuperar la contraseña aparece en la terminal donde ejecutás app.py.

