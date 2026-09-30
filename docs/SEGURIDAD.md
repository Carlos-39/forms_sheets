# Cómo se protege la información de las pacientes

Resumen para presentar: **la app pide clave para entrar, los datos solo se ven en el dispositivo de la doctora y en un Google Sheet privado, y nadie con el enlace puede leer ni enviar datos sin la clave.**

## 1. Acceso a la app con clave
- Al abrir la app aparece una **pantalla de acceso** que pide la clave del proyecto. Sin ella no se ve ninguna encuesta ni pregunta.
- La app se **bloquea sola** al cerrarla y después de **30 minutos sin uso**. También tiene un botón 🔒 para bloquearla a mano, por ejemplo al entregar la tablet a la paciente o al dejarla sobre el escritorio.
- Después de **5 intentos fallidos**, la app espera 30 segundos antes de aceptar otro intento.
- El bloqueo **funciona sin internet**: la clave se compara con la que ya está guardada en el dispositivo.
- En un dispositivo nuevo, la clave se verifica en línea contra el servidor la primera vez.

## 2. El enlace de la app no expone datos
- La dirección de la app es pública, pero **no contiene datos**. Es solo el formulario vacío.
- Las encuestas **no se descargan del servidor**: la app no tiene ninguna función para leer las respuestas del Sheet. Cada dispositivo solo guarda las encuestas que se llenaron en él.
- El enlace para configurar otro dispositivo **no incluye la clave**. La clave se comunica por separado.

## 3. Envío de datos protegido
- Toda la comunicación va cifrada por **HTTPS**, tanto la app en GitHub Pages como el servidor en Google Apps Script.
- El servidor (Apps Script) **rechaza cualquier envío sin la clave correcta**.
- El servidor **solo permite escribir**, no leer respuestas.

## 4. Almacenamiento en Google Sheets
- Las respuestas quedan en un **Google Sheet privado** del proyecto.
- Solo pueden verlo las cuentas de Google que el investigador agregue. El Sheet **no** se comparte con "cualquier persona con el enlace".
- Google guarda el historial de versiones del Sheet, así que cualquier cambio queda registrado.

## 5. En el dispositivo
- Mientras no hay señal, las encuestas quedan guardadas **solo en ese dispositivo** y se envían al volver la conexión.
- Se recomienda que la tablet tenga **bloqueo de pantalla** (PIN o huella) como protección adicional.

## Buenas prácticas del equipo
- Cambiar la clave si alguien que la conocía deja el proyecto. Se cambia en el Apps Script (`CLAVE`) y se publica una nueva versión. Al entrar, cada dispositivo pide la clave nueva.
- No anotar la clave en la tablet ni enviarla junto con el enlace.
- Al terminar el estudio, descargar el Sheet, restringir el acceso y borrar los datos de los dispositivos (**Ajustes → Borrar datos de este dispositivo**).

## Marco normativo
- Ley 1581 de 2012 (protección de datos personales).
- Resolución 1995 de 1999 (manejo de historia clínica), citada en el documento del proyecto.
- Resolución 8430 de 1993 (investigación en salud).
