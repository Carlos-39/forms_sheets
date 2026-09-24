/**
 * API del formulario → Google Sheets.
 *
 * Este script va "pegado" al Google Sheet (Extensiones → Apps Script) y se publica
 * como aplicación web. La app del formulario le envía:
 *   - los registros (una fila por encuesta, se crean o actualizan por su id),
 *   - las eliminaciones de registros,
 *   - la definición del formulario (preguntas/opciones) cuando la doctora la edita.
 *
 * Hojas que administra:
 *   Respuestas   fila 1 = nombre de variable, fila 2 = pregunta, datos desde la fila 3
 *   Diccionario  lista de variables, preguntas y opciones (se regenera al editar el formulario)
 *   Resumen      totales
 *   _config      (oculta) definición del formulario en JSON
 */

// ⚠️ Cambie esta clave antes de publicar. Debe ser la misma que se escribe en Ajustes de la app.
const CLAVE = 'CAMBIE-ESTA-CLAVE';

const HOJA_RESPUESTAS = 'Respuestas';
const HOJA_DICCIONARIO = 'Diccionario';
const HOJA_RESUMEN = 'Resumen';
const HOJA_CONFIG = '_config';
const TAM_TROZO = 45000; // una celda admite 50.000 caracteres

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.clave !== CLAVE) return responder_({ ok: false, error: 'Clave inválida' });
  if (p.accion === 'formulario') return responder_({ ok: true, formulario: leerFormulario_() });
  return responder_({ ok: true, mensaje: 'API activa' });
}

function doPost(e) {
  let cuerpo;
  try {
    cuerpo = JSON.parse(e.postData.contents);
  } catch (err) {
    return responder_({ ok: false, error: 'Solicitud inválida' });
  }
  if (cuerpo.clave !== CLAVE) return responder_({ ok: false, error: 'Clave inválida' });

  const candado = LockService.getScriptLock();
  candado.waitLock(30000);
  try {
    switch (cuerpo.accion) {
      case 'ping':
        return responder_({ ok: true });
      case 'registros':
        return responder_({ ok: true, resultados: guardarRegistros_(cuerpo.columnas || [], cuerpo.registros || []) });
      case 'eliminar':
        return responder_({ ok: true, resultados: eliminarRegistros_(cuerpo.ids || []) });
      case 'formulario':
        guardarFormulario_(cuerpo.formulario, cuerpo.columnas || [], cuerpo.diccionario || []);
        return responder_({ ok: true, version: cuerpo.formulario.version });
      default:
        return responder_({ ok: false, error: 'Acción desconocida' });
    }
  } catch (err) {
    return responder_({ ok: false, error: String(err && err.message ? err.message : err) });
  } finally {
    candado.releaseLock();
  }
}

/** Ejecútela una vez desde el editor para crear las hojas y autorizar el script. */
function inicializar() {
  hojaRespuestas_();
  hojaResumen_();
}

// ---------------------------------------------------------------------------
// Registros

function guardarRegistros_(columnas, registros) {
  const hoja = hojaRespuestas_();
  const ids = asegurarColumnas_(hoja, columnas);
  const filas = mapaFilas_(hoja);
  const resultados = [];

  registros.forEach(function (reg) {
    const datos = reg.fila || {};
    const nroFila = filas[reg.id];
    if (nroFila) {
      // Solo se sobrescriben las columnas enviadas: los datos de preguntas eliminadas se conservan.
      const rango = hoja.getRange(nroFila, 1, 1, ids.length);
      const actual = rango.getValues()[0];
      ids.forEach(function (id, j) {
        if (Object.prototype.hasOwnProperty.call(datos, id)) actual[j] = limpiar_(datos[id]);
      });
      rango.setValues([actual]);
    } else {
      hoja.appendRow(ids.map(function (id) {
        return Object.prototype.hasOwnProperty.call(datos, id) ? limpiar_(datos[id]) : '';
      }));
      filas[reg.id] = hoja.getLastRow();
    }
    resultados.push({ id: reg.id, ok: true });
  });

  marcarActualizacion_();
  return resultados;
}

function eliminarRegistros_(idsRegistros) {
  const hoja = hojaRespuestas_();
  const filas = mapaFilas_(hoja);
  const aBorrar = [];
  idsRegistros.forEach(function (id) {
    if (filas[id]) aBorrar.push(filas[id]);
  });
  aBorrar.sort(function (a, b) { return b - a; }).forEach(function (f) { hoja.deleteRow(f); });
  marcarActualizacion_();
  return idsRegistros.map(function (id) { return { id: id, ok: true }; });
}

/** id_registro → número de fila */
function mapaFilas_(hoja) {
  const mapa = {};
  const ultima = hoja.getLastRow();
  if (ultima >= 3) {
    hoja.getRange(3, 1, ultima - 2, 1).getValues().forEach(function (f, i) {
      if (f[0] !== '' && f[0] !== null) mapa[String(f[0])] = i + 3;
    });
  }
  return mapa;
}

/**
 * Garantiza que exista una columna por variable. Las nuevas se agregan al final
 * (nunca se reordenan ni borran columnas existentes) y se actualiza el texto de la pregunta.
 * Devuelve la lista de ids en el orden de las columnas.
 */
function asegurarColumnas_(hoja, columnas) {
  const nCol = Math.max(hoja.getLastColumn(), 1);
  const encabezado = hoja.getRange(1, 1, 2, nCol).getValues();
  const ids = encabezado[0].map(function (v) { return String(v); });
  const etiquetas = encabezado[1].slice();
  let cambioEtiquetas = false;
  const nuevas = [];

  columnas.forEach(function (c) {
    const i = ids.indexOf(c.id);
    if (i === -1) {
      ids.push(c.id);
      nuevas.push(c);
    } else if (etiquetas[i] !== c.etiqueta) {
      etiquetas[i] = c.etiqueta;
      cambioEtiquetas = true;
    }
  });

  if (cambioEtiquetas) hoja.getRange(2, 1, 1, etiquetas.length).setValues([etiquetas]);
  if (nuevas.length) {
    const faltan = ids.length - hoja.getMaxColumns();
    if (faltan > 0) hoja.insertColumnsAfter(hoja.getMaxColumns(), faltan);
    const desde = ids.length - nuevas.length + 1;
    hoja.getRange(1, desde, 2, nuevas.length).setValues([
      nuevas.map(function (c) { return c.id; }),
      nuevas.map(function (c) { return c.etiqueta; })
    ]);
  }
  return ids;
}

/**
 * Evita que un texto que empiece por "=" se interprete como fórmula y que
 * un documento como "0123" pierda el cero inicial.
 */
function limpiar_(v) {
  if (typeof v === 'string' && (/^[=+@]/.test(v) || /^0\d+$/.test(v))) return "'" + v;
  return v;
}

// ---------------------------------------------------------------------------
// Formulario

function guardarFormulario_(formulario, columnas, diccionario) {
  if (!formulario || !formulario.secciones) throw new Error('Formulario inválido');

  const hoja = hojaConfig_();
  const texto = JSON.stringify(formulario);
  const trozos = [];
  for (let i = 0; i < texto.length; i += TAM_TROZO) trozos.push([texto.substring(i, i + TAM_TROZO)]);
  hoja.clear();
  hoja.getRange(1, 1, trozos.length, 1).setValues(trozos);

  // Refleja de inmediato las preguntas nuevas o renombradas en la hoja de respuestas.
  asegurarColumnas_(hojaRespuestas_(), columnas);
  escribirDiccionario_(diccionario);
  hojaResumen_();
  marcarActualizacion_();
}

function leerFormulario_() {
  const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA_CONFIG);
  if (!hoja || hoja.getLastRow() < 1) return null;
  const texto = hoja.getRange(1, 1, hoja.getLastRow(), 1).getValues()
    .map(function (f) { return f[0]; }).join('');
  if (!texto) return null;
  try {
    return JSON.parse(texto);
  } catch (err) {
    return null;
  }
}

function escribirDiccionario_(filas) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let hoja = ss.getSheetByName(HOJA_DICCIONARIO);
  if (!hoja) hoja = ss.insertSheet(HOJA_DICCIONARIO);
  hoja.clear();
  const encabezado = ['Variable', 'Pregunta', 'Sección', 'Tipo', 'Opciones (puntos)', 'Obligatoria'];
  const datos = [encabezado].concat(filas.map(function (f) {
    return encabezado.map(function (_, i) { return f[i] === undefined ? '' : f[i]; });
  }));
  hoja.getRange(1, 1, datos.length, encabezado.length).setValues(datos);
  hoja.getRange(1, 1, 1, encabezado.length).setFontWeight('bold').setBackground('#e8f0fe');
  hoja.setFrozenRows(1);
}

// ---------------------------------------------------------------------------
// Hojas

function hojaRespuestas_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let hoja = ss.getSheetByName(HOJA_RESPUESTAS);
  if (!hoja) {
    hoja = ss.insertSheet(HOJA_RESPUESTAS, 0);
    hoja.getRange(1, 1, 2, 1).setValues([['id_registro'], ['ID del registro']]);
    hoja.getRange(1, 1, 1, hoja.getMaxColumns()).setFontColor('#80868b');
    hoja.getRange(2, 1, 1, hoja.getMaxColumns()).setFontWeight('bold').setBackground('#e8f0fe');
    hoja.setFrozenRows(2);
  }
  return hoja;
}

function hojaConfig_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let hoja = ss.getSheetByName(HOJA_CONFIG);
  if (!hoja) {
    hoja = ss.insertSheet(HOJA_CONFIG);
    hoja.hideSheet();
  }
  return hoja;
}

function hojaResumen_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let hoja = ss.getSheetByName(HOJA_RESUMEN);
  if (!hoja) {
    hoja = ss.insertSheet(HOJA_RESUMEN);
    const r = "'" + HOJA_RESPUESTAS + "'!";
    hoja.getRange(1, 1, 4, 2).setValues([
      ['Indicador', 'Valor'],
      ['Total de encuestas', '=MAX(0,COUNTA(' + r + 'A3:A))'],
      ['Encuestas completas', '=IFERROR(COUNTIF(INDEX(' + r + 'A3:ZZ,0,MATCH("estado",' + r + '1:1,0)),"Completa"),0)'],
      ['Última actualización', '']
    ]);
    hoja.getRange(1, 1, 1, 2).setFontWeight('bold').setBackground('#e8f0fe');
  }
  return hoja;
}

function marcarActualizacion_() {
  hojaResumen_().getRange(4, 2).setValue(new Date());
}

function responder_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
