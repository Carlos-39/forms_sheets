// Lógica del formulario sin interfaz: visibilidad, fórmulas, puntajes, alertas,
// validación y conversión de un registro a la fila del Sheet.

export const TIPOS = {
  texto: 'Texto corto',
  parrafo: 'Texto largo',
  numero: 'Número',
  fecha: 'Fecha',
  unica: 'Opción única (botones)',
  lista: 'Opción única (lista desplegable)',
  multiple: 'Varias opciones (casillas)',
  calculo: 'Cálculo automático (fórmula)'
};

export const TIPOS_CON_OPCIONES = ['unica', 'lista', 'multiple'];

export const COLUMNAS_SISTEMA = [
  { id: 'id_registro', etiqueta: 'ID del registro' },
  { id: 'fecha_registro', etiqueta: 'Fecha de registro' },
  { id: 'ultima_modificacion', etiqueta: 'Última modificación' },
  { id: 'estado', etiqueta: 'Estado de la encuesta' }
];

export function preguntas(form) {
  return form.secciones.flatMap((s) => s.preguntas);
}

export function indice(form) {
  const mapa = new Map();
  for (const s of form.secciones) for (const p of s.preguntas) mapa.set(p.id, p);
  return mapa;
}

export function vacio(v) {
  return v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
}

/** Una pregunta es visible si su condición se cumple y la pregunta de la que depende también es visible. */
export function esVisible(p, respuestas, idx, visitados = new Set()) {
  const c = p.mostrarSi;
  if (!c || !c.pregunta) return true;
  const padre = idx.get(c.pregunta);
  if (!padre || visitados.has(p.id)) return true;
  visitados.add(p.id);
  if (!esVisible(padre, respuestas, idx, visitados)) return false;
  const v = respuestas[c.pregunta];
  const valores = c.valores || [];
  if (vacio(v)) return false;
  if (!valores.length) return true;
  if (Array.isArray(v)) return v.some((x) => valores.includes(x));
  return valores.includes(v);
}

// ---------------------------------------------------------------------------
// Fórmulas: números, variables, + - * / ^ y paréntesis.

function tokens(formula) {
  const out = [];
  const re = /\s*(?:(\d+(?:[.,]\d+)?)|([A-Za-z_][A-Za-z0-9_]*)|(.))/gy;
  let m;
  const s = String(formula || '');
  re.lastIndex = 0;
  while (re.lastIndex < s.length && (m = re.exec(s))) {
    if (m[1] !== undefined) out.push({ t: 'num', v: Number(m[1].replace(',', '.')) });
    else if (m[2] !== undefined) out.push({ t: 'id', v: m[2] });
    else if (m[3] !== undefined && m[3].trim()) {
      if (!'+-*/^()'.includes(m[3])) throw new Error(`Símbolo no permitido: "${m[3]}"`);
      out.push({ t: 'op', v: m[3] });
    }
  }
  return out;
}

class FaltaDato extends Error {}

function evaluar(formula, valorDe) {
  const tk = tokens(formula);
  if (!tk.length) throw new Error('La fórmula está vacía');
  let i = 0;
  const ver = () => tk[i];
  const es = (op) => tk[i] && tk[i].t === 'op' && tk[i].v === op;
  function suma() {
    let v = producto();
    while (es('+') || es('-')) { const op = tk[i++].v; const r = producto(); v = op === '+' ? v + r : v - r; }
    return v;
  }
  function producto() {
    let v = potencia();
    while (es('*') || es('/')) { const op = tk[i++].v; const r = potencia(); v = op === '*' ? v * r : v / r; }
    return v;
  }
  function potencia() {
    const b = unario();
    if (es('^')) { i++; return Math.pow(b, potencia()); }
    return b;
  }
  function unario() {
    if (es('-')) { i++; return -unario(); }
    if (es('+')) { i++; return unario(); }
    return primario();
  }
  function primario() {
    const t = tk[i++];
    if (!t) throw new Error('La fórmula está incompleta');
    if (t.t === 'num') return t.v;
    if (t.t === 'id') {
      const v = valorDe(t.v);
      if (vacio(v) || isNaN(Number(v))) throw new FaltaDato(t.v);
      return Number(v);
    }
    if (t.v === '(') {
      const v = suma();
      if (!es(')')) throw new Error('Falta cerrar un paréntesis');
      i++;
      return v;
    }
    throw new Error(`Símbolo inesperado: "${t.v}"`);
  }
  const v = suma();
  if (i < tk.length) throw new Error(`Símbolo inesperado: "${ver().v}"`);
  return v;
}

/** Revisa la fórmula en el editor. Devuelve un mensaje de error o null. */
export function revisarFormula(formula, idsValidos) {
  try {
    for (const t of tokens(formula)) {
      if (t.t === 'id' && !idsValidos.includes(t.v)) return `La variable "${t.v}" no existe`;
    }
    evaluar(formula, () => 1);
    return null;
  } catch (e) {
    return e.message;
  }
}

/** Calcula el valor de una pregunta tipo "calculo". → {valor, falta, error} */
export function calcular(p, respuestas, idx, pila = []) {
  if (pila.includes(p.id)) return { valor: null, error: 'La fórmula se refiere a sí misma' };
  const valorDe = (id) => {
    const q = idx.get(id);
    if (q && q.tipo === 'calculo') return calcular(q, respuestas, idx, [...pila, p.id]).valor;
    if (q && !esVisible(q, respuestas, idx)) return null;
    return respuestas[id];
  };
  try {
    const v = evaluar(p.formula, valorDe);
    if (!isFinite(v)) return { valor: null };
    const dec = Number.isInteger(p.decimales) ? p.decimales : 2;
    return { valor: Number(v.toFixed(dec)) };
  } catch (e) {
    if (e instanceof FaltaDato) return { valor: null, falta: e.message };
    return { valor: null, error: e.message };
  }
}

// ---------------------------------------------------------------------------
// Puntajes y alertas

function puntosDeOpcion(o) {
  return o && o.puntos !== undefined && o.puntos !== null && o.puntos !== '' && !isNaN(Number(o.puntos))
    ? Number(o.puntos) : null;
}

export function puntuable(p) {
  return (p.tipo === 'unica' || p.tipo === 'lista') && (p.opciones || []).some((o) => puntosDeOpcion(o) !== null);
}

/** → {total, respondidas, totalPreguntas, completo, nivel} o null si la sección no suma puntaje. */
export function puntajeSeccion(s, respuestas, idx) {
  if (!s.puntaje || !s.puntaje.activo) return null;
  let total = 0;
  let respondidas = 0;
  let totalPreguntas = 0;
  for (const p of s.preguntas) {
    if (!puntuable(p) || !esVisible(p, respuestas, idx)) continue;
    totalPreguntas++;
    const o = (p.opciones || []).find((x) => x.id === respuestas[p.id]);
    const pts = puntosDeOpcion(o);
    if (pts !== null) { total += pts; respondidas++; }
  }
  const completo = totalPreguntas > 0 && respondidas === totalPreguntas;
  const rango = (s.puntaje.rangos || []).find((r) => total >= Number(r.min) && total <= Number(r.max));
  return { total, respondidas, totalPreguntas, completo, nivel: completo && rango ? rango.etiqueta : '' };
}

export function alertas(form, respuestas) {
  const idx = indice(form);
  const out = [];
  for (const p of preguntas(form)) {
    if (!TIPOS_CON_OPCIONES.includes(p.tipo) || !esVisible(p, respuestas, idx)) continue;
    const elegidas = [].concat(respuestas[p.id] ?? []);
    for (const o of p.opciones || []) {
      if (o.alerta && elegidas.includes(o.id)) out.push({ pregunta: p.id, texto: o.alerta });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Validación

export function validar(form, respuestas, { registros = [], idActual = null } = {}) {
  const idx = indice(form);
  const errores = {};
  for (const p of preguntas(form)) {
    if (p.tipo === 'calculo' || !esVisible(p, respuestas, idx)) continue;
    const v = respuestas[p.id];
    if (vacio(v)) {
      if (p.obligatoria) errores[p.id] = 'Esta pregunta es obligatoria';
      continue;
    }
    if (p.tipo === 'numero') {
      const n = Number(v);
      if (isNaN(n)) errores[p.id] = 'Debe ser un número';
      else if (!vacio(p.min) && n < Number(p.min)) errores[p.id] = `El valor mínimo es ${p.min}`;
      else if (!vacio(p.max) && n > Number(p.max)) errores[p.id] = `El valor máximo es ${p.max}`;
      else if (Number.isInteger(p.decimales) && p.decimales === 0 && !Number.isInteger(n)) errores[p.id] = 'Debe ser un número entero';
    }
    if (p.unico) {
      const norm = String(v).trim().toLowerCase();
      const repetido = registros.find((r) => r.id !== idActual && !r.eliminado &&
        String(r.respuestas?.[p.id] ?? '').trim().toLowerCase() === norm);
      if (repetido) errores[p.id] = 'Ya existe otra encuesta con este valor';
    }
  }
  return errores;
}

// ---------------------------------------------------------------------------
// Conversión a columnas del Sheet

export function columnaPuntaje(s) { return `${s.id}_puntaje`; }
export function columnaNivel(s) { return `${s.id}_nivel`; }

export function columnas(form) {
  const cols = [...COLUMNAS_SISTEMA];
  for (const s of form.secciones) {
    for (const p of s.preguntas) cols.push({ id: p.id, etiqueta: p.etiqueta });
    if (s.puntaje && s.puntaje.activo) {
      cols.push({ id: columnaPuntaje(s), etiqueta: `${s.titulo} — puntaje` });
      cols.push({ id: columnaNivel(s), etiqueta: `${s.titulo} — nivel` });
    }
  }
  cols.push({ id: 'alertas', etiqueta: 'Alertas' });
  cols.push({ id: 'version_formulario', etiqueta: 'Versión del formulario' });
  return cols;
}

function textoOpcion(p, id) {
  const o = (p.opciones || []).find((x) => x.id === id);
  return o ? o.etiqueta : id;
}

/** Valor legible de una respuesta (etiquetas de opciones, números). */
export function valorLegible(p, v, respuestas, idx) {
  if (p.tipo === 'calculo') {
    const r = calcular(p, respuestas, idx);
    return r.valor === null ? '' : r.valor;
  }
  if (vacio(v)) return '';
  if (p.tipo === 'multiple') return [].concat(v).map((x) => textoOpcion(p, x)).join('; ');
  if (p.tipo === 'unica' || p.tipo === 'lista') return textoOpcion(p, v);
  if (p.tipo === 'numero') return Number(v);
  return v;
}

export function aplanar(form, registro, fechaTexto = (x) => x) {
  const idx = indice(form);
  const r = registro.respuestas || {};
  const fila = {
    id_registro: registro.id,
    fecha_registro: fechaTexto(registro.creado),
    ultima_modificacion: fechaTexto(registro.actualizado),
    estado: registro.completa ? 'Completa' : 'Incompleta'
  };
  for (const s of form.secciones) {
    for (const p of s.preguntas) {
      fila[p.id] = esVisible(p, r, idx) ? valorLegible(p, r[p.id], r, idx) : '';
    }
    const pj = puntajeSeccion(s, r, idx);
    if (pj) {
      fila[columnaPuntaje(s)] = pj.respondidas ? pj.total : '';
      fila[columnaNivel(s)] = pj.completo ? pj.nivel : (pj.respondidas ? 'Incompleto' : '');
    }
  }
  fila.alertas = alertas(form, r).map((a) => a.texto).join(' | ');
  fila.version_formulario = registro.versionFormulario ?? form.version;
  return fila;
}

export function diccionario(form) {
  const filas = [];
  for (const c of COLUMNAS_SISTEMA) filas.push([c.id, c.etiqueta, '(sistema)', '', '', '']);
  for (const s of form.secciones) {
    for (const p of s.preguntas) {
      let opciones = '';
      if (TIPOS_CON_OPCIONES.includes(p.tipo)) {
        opciones = (p.opciones || []).map((o) => (puntosDeOpcion(o) !== null ? `${o.etiqueta} (${o.puntos})` : o.etiqueta)).join('; ');
      } else if (p.tipo === 'calculo') {
        opciones = `= ${p.formula}`;
      } else if (p.tipo === 'numero') {
        opciones = [vacio(p.min) ? '' : `mín ${p.min}`, vacio(p.max) ? '' : `máx ${p.max}`, p.unidad || ''].filter(Boolean).join(', ');
      }
      filas.push([p.id, p.etiqueta, s.titulo, TIPOS[p.tipo] || p.tipo, opciones, p.obligatoria ? 'Sí' : 'No']);
    }
    if (s.puntaje && s.puntaje.activo) {
      const rangos = (s.puntaje.rangos || []).map((r) => `${r.min}–${r.max}: ${r.etiqueta}`).join('; ');
      filas.push([columnaPuntaje(s), `${s.titulo} — puntaje`, s.titulo, 'Suma de puntos', '', '']);
      filas.push([columnaNivel(s), `${s.titulo} — nivel`, s.titulo, 'Categoría', rangos, '']);
    }
  }
  filas.push(['alertas', 'Alertas', '(sistema)', '', '', '']);
  filas.push(['version_formulario', 'Versión del formulario', '(sistema)', '', '', '']);
  return filas;
}

export function aCSV(form, registros, fechaTexto) {
  const cols = columnas(form);
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lineas = [cols.map((c) => esc(c.id)).join(','), cols.map((c) => esc(c.etiqueta)).join(',')];
  for (const r of registros) {
    const f = aplanar(form, r, fechaTexto);
    lineas.push(cols.map((c) => esc(f[c.id])).join(','));
  }
  return '﻿' + lineas.join('\r\n');
}

// ---------------------------------------------------------------------------
// Identificadores de variables

export function slug(texto, max = 30) {
  const s = String(texto || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
    .slice(0, max).replace(/_+$/, '');
  return /^[a-z]/.test(s) ? s : ('v_' + s).slice(0, max);
}

export function idsReservados(form) {
  const ids = new Set(COLUMNAS_SISTEMA.map((c) => c.id).concat(['alertas', 'version_formulario']));
  for (const s of form.secciones) {
    if (s.puntaje && s.puntaje.activo) { ids.add(columnaPuntaje(s)); ids.add(columnaNivel(s)); }
  }
  return ids;
}

export function idUnico(base, ocupados) {
  let id = base || 'pregunta';
  let n = 2;
  while (ocupados.has(id)) id = `${base}_${n++}`;
  return id;
}
