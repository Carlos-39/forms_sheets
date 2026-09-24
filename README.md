# Formulario → Google Sheets (funciona sin señal)

Aplicación web para que la doctora diligencie la encuesta con cada paciente desde una tablet, celular o computador.

- **Cada encuesta se guarda en una fila de un Google Sheet**, en cuanto hay conexión.
- **Funciona sin internet.** Las encuestas quedan guardadas en el dispositivo y se envían solas cuando vuelve la señal.
- **La doctora edita el formulario desde la misma app.** Puede agregar, quitar, reordenar o cambiar preguntas, opciones, puntajes, alertas y condiciones. El Sheet se actualiza solo: aparecen columnas nuevas y cambia el texto de las preguntas.
- Viene cargada con el instrumento del proyecto *Prevalencia y factores relacionados al parto pretérmino* (ver [`docs/ANALISIS.md`](docs/ANALISIS.md)):
  - datos sociodemográficos,
  - antecedentes obstétricos,
  - infecciones y anemia,
  - peso, talla e IMC (calculado automáticamente),
  - las escalas EEP-10, PHQ-9 y GAD-7, con puntaje y nivel automáticos y alerta si el ítem 9 del PHQ-9 es positivo.

```
 Tablet / celular (app instalada)            Google
┌──────────────────────────────┐   POST   ┌──────────────────┐    ┌──────────────────────┐
│ Formulario + editor          │ ───────▶ │ Apps Script      │ ─▶ │ Google Sheet         │
│ Guarda todo en el dispositivo│ ◀─────── │ (aplicación web) │    │  Respuestas          │
│ Cola de envío si no hay señal│  preguntas└──────────────────┘    │  Diccionario, Resumen│
└──────────────────────────────┘                                   └──────────────────────┘
```

## Contenido del repositorio

| Ruta | Qué es |
|---|---|
| `web/` | La app (HTML, CSS y JavaScript sin dependencias ni compilación). Es lo que se publica. |
| `web/js/formulario-base.js` | Preguntas iniciales, tomadas del documento del proyecto. |
| `apps-script/Code.gs` | Código que va dentro del Google Sheet y recibe los datos. |
| `tests/` | Servidor de pruebas (simula Google Sheets) y prueba automática de extremo a extremo. |
| `docs/ANALISIS.md` | Análisis del documento del proyecto. |
| `docs/PREGUNTAS.md` | Lista de preguntas, escalas y puntos para confirmar con la doctora. |
| `docs/GUIA_PRUEBA_Y_ENTREGA.md` | Paso a paso para probar y dejar la app lista. |

---

## Instalación (una sola vez, unos 15 minutos)

### 1. Crear el Google Sheet y el Apps Script

1. Con la cuenta de Google del proyecto, cree un Google Sheet nuevo, por ejemplo *"Encuestas parto pretérmino 2026"*.
2. En el Sheet abra **Extensiones → Apps Script**.
3. Borre el contenido de `Código.gs` y pegue **todo** el archivo [`apps-script/Code.gs`](apps-script/Code.gs).
4. Cambie la clave de la línea `const CLAVE = 'CAMBIE-ESTA-CLAVE';` por una clave larga propia, por ejemplo `gigyo-2026-Xk93pQ`. Guarde con el ícono del disquete.
5. En la barra de arriba elija la función **`inicializar`** y pulse **Ejecutar**. Google pedirá permisos: acepte con la cuenta del proyecto. Si sale *"Google no ha verificado esta app"*, pulse **Configuración avanzada → Ir a … (no seguro)**. Es normal, porque el script es suyo.

### 2. Publicar el Apps Script como aplicación web

1. Pulse **Implementar → Nueva implementación**.
2. En el engranaje ⚙ elija **Aplicación web**.
3. Llene así:
   - **Ejecutar como:** *Yo*
   - **Quién tiene acceso:** *Cualquier persona*
4. Pulse **Implementar** y copie la **URL de la aplicación web**. Termina en `/exec`.

> *"Cualquier persona"* no significa que cualquiera vea los datos. Sin la clave, el script no acepta nada, y ningún endpoint permite leer las respuestas. El Sheet solo lo ven las personas con quienes usted lo comparta.

> **Si más adelante cambia `Code.gs`:** use **Implementar → Administrar implementaciones → ✏️ → Versión: Nueva versión → Implementar**. Así la URL no cambia.

### 3. Publicar la app

**Opción A — GitHub Pages (recomendada; ya está configurada):**

1. Deje este código en la rama `main` del repositorio (haga merge de la rama).
2. En GitHub vaya a **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Cada vez que se actualice `main`, el workflow [`pages.yml`](.github/workflows/pages.yml) publica la carpeta `web/`. La dirección queda como `https://<usuario>.github.io/forms_sheets/`.

**Opción B — Netlify u otro hosting estático:** suba la carpeta `web/` tal cual, por ejemplo arrastrándola a <https://app.netlify.com/drop>.

La app necesita **HTTPS** para funcionar sin conexión. Ambos servicios lo dan.

### 4. Conectar la tablet de la doctora

1. Abra la dirección de la app en la tablet, en Chrome o Safari.
2. Vaya a **Ajustes**, pegue la **URL del Apps Script** y la **clave**, y pulse **Guardar y probar conexión**.
   - En ese momento el Sheet recibe las preguntas: se crean las hojas **Respuestas**, **Diccionario** y **Resumen**.
3. **Instale la app en la pantalla de inicio.** En Chrome use el menú ⋮ → *Instalar app* o *Agregar a la pantalla principal*. En iPad o iPhone use *Compartir → Agregar a inicio*. Así abre sin conexión y el navegador no borra los datos.
4. Para configurar otros dispositivos: en **Ajustes → Enlace para otro dispositivo** se genera un link que deja la app conectada al abrirlo. Contiene la clave, así que compártalo solo con el equipo.

---

## Guía de uso para la doctora

### Llenar una encuesta
- **+ Nueva encuesta** abre el formulario por pasos, con las secciones arriba. Se puede avanzar, retroceder o saltar a cualquier sección.
- Lo que se va escribiendo **se guarda solo** como borrador. Si se cierra la app o se acaba la batería, al volver aparece *"Tiene una encuesta sin terminar → Continuar"*.
- Al pulsar **Guardar encuesta**, la app revisa las preguntas obligatorias:
  - Si falta algo, dice en qué secciones. Se puede **Revisar** o **Guardar como incompleta**, y completarla después.
  - Un **número de documento repetido** no se deja guardar.
- El **IMC**, los **puntajes** y los **niveles** de EEP-10, PHQ-9 y GAD-7 se calculan solos.
- Si el ítem 9 del PHQ-9 es positivo, aparece una **alerta roja** y se registra en la columna *Alertas*.
- En la lista de encuestas se puede **buscar**, **ver o editar** y **eliminar**. Editar actualiza la misma fila del Sheet, y eliminar la borra también del Sheet.

### El indicador de arriba a la derecha
| Indicador | Significa |
|---|---|
| 🟢 Sincronizado | Todo está en el Sheet. |
| 🟠 N pendientes / Sin señal | Hay encuestas guardadas en la tablet que aún no llegan al Sheet. Se envían solas al volver la señal; no hay que hacer nada. |
| 🔵 Sincronizando… | Enviando. |
| 🔴 Error al sincronizar | La clave o la URL no son correctas (toque el indicador para ver el detalle). |

Tocar el indicador fuerza una sincronización.

### Editar las preguntas (pestaña **Preguntas**)
- **Secciones:** cambiar el título o la descripción, agregar, eliminar y subir o bajar.
- **Preguntas:** tocar una para abrirla. Se puede cambiar:
  - el texto y la ayuda;
  - el **tipo**: texto corto, texto largo, número, fecha, opción única con botones, lista desplegable, varias opciones o cálculo con fórmula;
  - si es **obligatoria**;
  - si **no permite valores repetidos**;
  - el mínimo, el máximo, los decimales y la unidad;
  - el **nombre de la columna** en el Sheet.

  También se puede duplicar, mover a otra sección, subir o bajar, y eliminar.
- **Opciones:** agregar, quitar, reordenar, **pegar varias a la vez** (una por línea), asignar **puntos** y escribir un **mensaje de alerta** que salta cuando se elige esa opción.
- **Puntaje de sección:** active *"Calcular puntaje"* y defina los niveles (por ejemplo, 0–13 *Estrés bajo*). En el Sheet aparecen las columnas `<sección>_puntaje` y `<sección>_nivel`.
- **Preguntas condicionales:** *"Mostrar esta pregunta solo según la respuesta de otra"*. Por ejemplo, *Trimestre de la infección* solo aparece si *Infección urinaria = Sí*.
- **Cálculos:** una fórmula con los nombres de columna de preguntas numéricas, por ejemplo `peso_1t / talla ^ 2`.
- **Vista previa** muestra el formulario tal como quedaría, sin guardar nada.
- Nada se aplica hasta pulsar **Guardar cambios**. Al guardar, el Sheet se actualiza solo. Si no hay señal, se actualiza cuando vuelva.
- **Herramientas:** exportar o importar las preguntas (JSON) y **Restaurar plantilla original** para volver a las preguntas del documento.

**Qué pasa en el Sheet al editar:**
| Cambio | Efecto en el Sheet |
|---|---|
| Pregunta nueva | Se agrega una columna al final. |
| Cambiar el texto de una pregunta | Se actualiza el encabezado (fila 2). La columna es la misma. |
| Cambiar el texto de una opción | Las encuestas nuevas o editadas usan el texto nuevo. |
| Eliminar una pregunta | La columna y los datos ya enviados **se conservan**. |
| Cambiar el *nombre de columna* | Se crea una columna nueva. La vieja queda con los datos anteriores. |

### El Google Sheet
- **Respuestas:** una fila por encuesta.
  - La fila 1 tiene el nombre corto de cada variable, útil para SPSS o Excel.
  - La fila 2 tiene el texto de cada pregunta.
  - Los datos empiezan en la fila 3.
  - Las primeras columnas son: `id_registro`, fecha, última modificación y estado (*Completa* o *Incompleta*).
- **Diccionario:** cada variable con su pregunta, tipo, opciones y puntos. Se regenera al guardar las preguntas.
- **Resumen:** total de encuestas, cuántas están completas y la hora de la última actualización.
- ⚠️ **No reordene, borre ni renombre las columnas de las filas 1 y 2 de *Respuestas*.** La app usa la fila 1 para saber dónde va cada dato. Para análisis, trabaje en una copia o en otra hoja.

### Respaldo (Ajustes)
- **Descargar Excel (CSV)** baja las encuestas del dispositivo.
- **Descargar respaldo completo (JSON)** y **Importar respaldo** guardan y recuperan preguntas y encuestas, por ejemplo al cambiar de tablet.
- **Reenviar todas las encuestas** sirve si alguien borró filas del Sheet por error.

---

## Seguridad y privacidad

- El número de documento, sumado a los datos de salud mental, es un **dato sensible** (Ley 1581 de 2012). Recomendaciones:
  - Comparta el Sheet **solo** con los investigadores, sin *"cualquier persona con el enlace"*.
  - Use una clave larga y no la publique. **No la escriba en `web/config.js` si el repositorio es público.**
  - Si la clave se filtra, cámbiela en `Code.gs`, publique una nueva versión y actualícela en Ajustes de cada dispositivo.
- La app no envía datos a ningún servidor distinto del Apps Script que usted configure.
- Los datos pendientes viven en el almacenamiento del navegador del dispositivo. **Si se borran los datos del navegador antes de sincronizar, se pierden.** Instalar la app y sincronizar con frecuencia evita el problema.

## Limitaciones conocidas

- Cada dispositivo muestra en su lista las encuestas **creadas o importadas en ese dispositivo**. El Sheet siempre tiene todas.
- Si dos dispositivos editan las preguntas a la vez, queda la última versión que se guarde.
- El almacenamiento local alcanza para miles de encuestas. El estudio necesita 151.

---

## Desarrollo

No hay dependencias ni paso de compilación: la carpeta `web/` se sirve tal cual.

```bash
npm install                 # solo para las pruebas (Playwright)
npm run servidor            # app en http://localhost:8080 y Sheet simulado en http://localhost:8081/exec
npm test                    # (en otra terminal) prueba de extremo a extremo
```

Para usar la app contra el simulador, abra
`http://localhost:8080/?api=http://localhost:8081/exec&clave=CAMBIE-ESTA-CLAVE`.

La prueba automática ejecuta el `Code.gs` real contra un Sheet en memoria y verifica:
- la publicación del formulario;
- una encuesta completa, con puntajes, IMC y alerta;
- el bloqueo de documentos repetidos;
- el guardado **sin señal** y la sincronización al volver;
- que editar actualice la misma fila;
- que el editor de preguntas (pregunta nueva y opción renombrada) se refleje en el Sheet;
- el borrado;
- la vista en celular.

| Archivo | Responsabilidad |
|---|---|
| `web/js/app.js` | Navegación, lista de encuestas y ajustes. |
| `web/js/vista-formulario.js` | Formulario por pasos. |
| `web/js/vista-editor.js` | Editor de preguntas. |
| `web/js/calc.js` | Visibilidad, fórmulas, puntajes, alertas, validación y conversión a fila del Sheet. |
| `web/js/storage.js` | Datos en el dispositivo (localStorage). |
| `web/js/sync.js` | Cola de envío, reintentos y descarga de preguntas. |
| `web/sw.js` | Service worker: la app abre sin conexión. |

**Al publicar cambios en `web/`, suba el número de `CACHE` en `web/sw.js`** (por ejemplo `encuestas-v2`). Así los dispositivos descargan la versión nueva completa. La actualización se aplica la segunda vez que se abre la app con conexión.
