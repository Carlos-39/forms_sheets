# Guía: probar la app y dejarla lista para la doctora

Hay tres etapas:

- **A.** Probar en tu computador, sin Google (opcional, 5 minutos).
- **B.** Conectar el Google Sheet real y probar desde tu computador.
- **C.** Publicar la app y dejar la tablet de la doctora lista.

Requisitos: **Node.js 18+** (solo para la etapa A; es opcional), una **cuenta de Google** (idealmente la del proyecto) y acceso al repositorio en GitHub.

---

## A. Prueba rápida en tu computador (sin Google)

Un servidor local simula Google Sheets usando el `Code.gs` real.

```bash
git clone https://github.com/carlos-39/forms_sheets.git
cd forms_sheets
npm run servidor        # no requiere npm install
```

Abre en Chrome:
`http://localhost:8080/?api=http://localhost:8081/exec&clave=CAMBIE-ESTA-CLAVE`

Prueba lo siguiente:
1. El indicador de arriba a la derecha dice **Sincronizado**.
2. **+ Nueva encuesta** → llénala → **Guardar encuesta**.
3. Mira el "Sheet" simulado en <http://localhost:8081/__hojas>. Es un JSON; en `Respuestas` debe estar tu fila.
4. En la pestaña **Preguntas**, cambia algo (por ejemplo, agrega una opción) → **Guardar cambios** → recarga `__hojas` y verás el cambio.

Prueba automática completa (opcional): `npm install && npx playwright install chromium && npm test` con el servidor corriendo.

Para detenerlo: `Ctrl+C`. Los datos del simulador se pierden al cerrarlo, y así debe ser.

---

## B. Conectar el Google Sheet real

### B1. Crear el Sheet y el script
1. Entra a <https://sheets.google.com> con la cuenta del proyecto y crea una hoja en blanco, por ejemplo **"Encuestas parto pretérmino 2026"**.
2. Menú **Extensiones → Apps Script**.
3. Borra lo que haya en `Código.gs` y pega **todo** el contenido de [`apps-script/Code.gs`](../apps-script/Code.gs).
4. Cambia la línea:
   ```js
   const CLAVE = 'CAMBIE-ESTA-CLAVE';
   ```
   por una clave propia, larga y sin espacios, por ejemplo `gigyo2026-Tq83xLm`. **Anótala.**
5. Guarda con 💾 (Ctrl+S).
6. Arriba, en la lista de funciones, elige **`inicializar`** y pulsa **▶ Ejecutar**.
   - Pide permisos: **Revisar permisos → elige la cuenta**.
   - Si dice *"Google no ha verificado esta app"*: **Configuración avanzada → Ir a (nombre del proyecto) (no seguro) → Permitir**. Es tu propio script, así que es normal.
   - Vuelve al Sheet: ya deben existir las hojas **Respuestas** y **Resumen**.

### B2. Publicarlo como aplicación web
1. En Apps Script pulsa **Implementar → Nueva implementación**.
2. En el engranaje ⚙ junto a "Seleccionar tipo", elige **Aplicación web**.
3. Configura:
   - Descripción: `v1`
   - **Ejecutar como: Yo (tu correo)**
   - **Quién tiene acceso: Cualquier persona**. Si eliges otra opción, la app no podrá conectarse.
4. Pulsa **Implementar** y copia la **URL de la aplicación web**. Termina en **`/exec`**.
5. Verifica la URL: pégala en el navegador agregando `?accion=ping&clave=TU_CLAVE`. Debe responder `{"ok":true}`.

> Si más adelante modificas `Code.gs`: **Implementar → Administrar implementaciones → ✏️ → Versión: "Nueva versión" → Implementar**. Así conservas la misma URL. Si haces "Nueva implementación", la URL cambia.

### B3. Probar contra el Sheet real (desde tu computador)
Con `npm run servidor` corriendo, abre:
`http://localhost:8080/?api=URL_DEL_SCRIPT&clave=TU_CLAVE`

(O abre `http://localhost:8080`, ve a **Ajustes**, pega la URL y la clave y pulsa **Guardar y probar conexión**.)

Lista de verificación:

| # | Prueba | Resultado esperado |
|---|---|---|
| 1 | Abrir la app | Indicador **Sincronizado**. En el Sheet aparecen **Respuestas** (fila 1 con nombres de variables, fila 2 con preguntas), **Diccionario** y **Resumen**. |
| 2 | Llenar una encuesta completa y guardar | En segundos aparece la fila en *Respuestas*, con puntajes, niveles e IMC. |
| 3 | En el PHQ-9, responder la pregunta 9 con "Varios días" | Alerta roja en pantalla y texto en la columna **Alertas**. |
| 4 | Intentar otra encuesta con el mismo documento | No deja guardar. |
| 5 | Guardar una encuesta a medias | Pregunta *"¿Guardar como incompleta?"*; en el Sheet, *Estado = Incompleta*. |
| 6 | Editar una encuesta (Ver / editar → cambiar la edad → guardar) | Se actualiza la **misma** fila. |
| 7 | **Sin señal:** Chrome → F12 → pestaña **Network** → cambiar *No throttling* por **Offline**. Llenar y guardar una encuesta. | Indicador naranja **Sin señal · 1 pendiente**. No llega al Sheet. |
| 8 | Volver a *No throttling* | En segundos el indicador vuelve a **Sincronizado** y la fila aparece. |
| 9 | Recargar la página estando en *Offline* | La app abre igual (queda guardada en el navegador). |
| 10 | **Preguntas** → abrir una sección → **+ Agregar pregunta** → escribirla → **Guardar cambios** | Aparece una columna nueva al final de *Respuestas* y una fila en *Diccionario*. |
| 11 | Eliminar una encuesta en la app | Se borra la fila del Sheet. |

Si algo sale en rojo (**Error al sincronizar**), toca el indicador para ver el detalle. Lo más común es una clave distinta o una URL sin `/exec`.

---

## C. Publicar la app y preparar la tablet

### C1. Publicar con GitHub Pages
La rama **`main`** ya existe con todo el código y el repositorio es público, así que Pages es gratis.
1. En GitHub: **Settings → General → Default branch** → cambiar a **`main`** (ícono ⇄) → *Update*.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Pestaña **Actions → "Publicar app" → Run workflow → Branch: main → Run workflow**.
4. Cuando termine (✅, 1 o 2 minutos), la app queda en:
   **https://carlos-39.github.io/forms_sheets/**
   Después, cada cambio que llegue a `main` se publica solo.

> No escribas la clave en `web/config.js`: el repositorio es público.

### C2. Dejar la tablet de la doctora lista
1. En tu computador abre la app publicada. En **Ajustes** pon la URL y la clave, pulsa **Guardar y probar conexión** y luego **Enlace para otro dispositivo**. Copia ese enlace.
2. Envía ese enlace a la tablet de la doctora (por WhatsApp o correo a ella misma) y ábrelo **en Chrome** (en iPad, en **Safari**). La app queda conectada sola.
3. **Instálala:** en Chrome (Android), menú **⋮ → Instalar app / Agregar a pantalla principal**. En iPad o iPhone, **Compartir ⬆ → Agregar a inicio**. Desde ahí se abre como una app y funciona sin señal.
4. Haz **una encuesta de prueba** en la tablet y confirma que llega al Sheet.
5. **Limpia los datos de prueba:** en la app, **Eliminar** cada encuesta de prueba (se borran también del Sheet). Si quedaron filas de pruebas hechas desde tu computador, bórralas en el Sheet desde la fila 3 hacia abajo. **Nunca borres las filas 1 y 2.**
6. **Comparte el Sheet** solo con la doctora y los investigadores (*Compartir → agregar correos*). No uses "cualquier persona con el enlace".
7. Revisa con ella [`PREGUNTAS.md`](PREGUNTAS.md) y los *puntos para confirmar*. Los cambios los puede hacer ella misma en la pestaña **Preguntas**, o se los haces tú antes de empezar.

### C3. Qué decirle a la doctora (resumen)
- **+ Nueva encuesta** → llenar por secciones → **Guardar encuesta**.
- Si no hay señal, **no pasa nada**: se guarda en la tablet y se envía sola cuando vuelva. El punto de arriba a la derecha dice cuántas faltan.
- Si se cierra la app a mitad de encuesta, al volver aparece **Continuar**.
- Para cambiar preguntas: pestaña **Preguntas** → tocar la pregunta → cambiar → **Guardar cambios**.
- No reordenar ni borrar las columnas ni las filas 1 y 2 del Sheet. Para analizar, hacer una copia.
- De vez en cuando conviene abrir la app con señal, para que todo quede enviado.
