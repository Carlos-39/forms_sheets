// Pantalla para diligenciar una encuesta, paso a paso (una sección por paso).

import { h, limpiar, rellenar, dialogo } from './dom.js';
import {
  indice, esVisible, calcular, puntajeSeccion, alertas, validar, vacio, tieneGrupos, grupoDe
} from './calc.js';

/**
 * opciones: { form, respuestas, paso, titulo, registros, idActual,
 *             alCambiar(respuestas, paso), alGuardar(respuestas, completa), alCancelar() }
 */
export function montarFormulario(cont, opciones) {
  const { form } = opciones;
  const idx = indice(form);
  const respuestas = { ...(opciones.respuestas || {}) };
  let paso = Math.min(opciones.paso || 0, form.secciones.length - 1);
  const visitados = new Set([paso]);
  let errores = {};

  const bloques = new Map(); // id pregunta → {el, error, salida}
  const secciones = [];

  const notificar = () => opciones.alCambiar && opciones.alCambiar(respuestas, paso);

  function fijar(id, valor) {
    if (vacio(valor)) delete respuestas[id];
    else respuestas[id] = valor;
    if (errores[id]) { delete errores[id]; pintarErrores(); }
    actualizarDerivados();
    notificar();
  }

  // ---- Controles por tipo de pregunta ------------------------------------
  function control(p) {
    const v = respuestas[p.id];
    const nombre = 'q_' + p.id;
    switch (p.tipo) {
      case 'parrafo':
        return h('textarea', { rows: 3, id: nombre, value: v ?? '', oninput: (e) => fijar(p.id, e.target.value) });
      case 'numero': {
        const dec = Number.isInteger(p.decimales) ? p.decimales : null;
        return h('div', { class: 'con-unidad' },
          h('input', {
            type: 'number', id: nombre, inputmode: dec === 0 ? 'numeric' : 'decimal',
            step: dec === null ? 'any' : dec === 0 ? '1' : String(Math.pow(10, -dec)),
            min: p.min ?? undefined, max: p.max ?? undefined, value: v ?? '',
            oninput: (e) => fijar(p.id, e.target.value === '' ? '' : Number(e.target.value))
          }),
          p.unidad ? h('span', { class: 'unidad' }, p.unidad) : null);
      }
      case 'fecha':
        return h('input', { type: 'date', id: nombre, value: v ?? '', oninput: (e) => fijar(p.id, e.target.value) });
      case 'unica':
        return h('div', { class: 'opciones', role: 'radiogroup' },
          (p.opciones || []).map((o) => h('label', { class: 'opcion' + (o.alerta ? ' opcion-alerta' : '') },
            h('input', {
              type: 'radio', name: nombre, value: o.id, checked: v === o.id,
              onchange: () => fijar(p.id, o.id)
            }),
            h('span', {}, o.etiqueta))),
          h('button', {
            type: 'button', class: 'btn-enlace limpiar-respuesta', hidden: vacio(v),
            onclick: (e) => {
              e.currentTarget.parentElement.querySelectorAll('input').forEach((i) => { i.checked = false; });
              e.currentTarget.hidden = true;
              fijar(p.id, '');
            }
          }, 'Borrar respuesta'));
      case 'lista':
        return h('select', { id: nombre, onchange: (e) => fijar(p.id, e.target.value) },
          h('option', { value: '' }, '— Seleccione —'),
          (p.opciones || []).map((o) => h('option', { value: o.id, selected: v === o.id }, o.etiqueta)));
      case 'multiple':
        return h('div', { class: 'opciones' },
          (p.opciones || []).map((o) => h('label', { class: 'opcion opcion-check' },
            h('input', {
              type: 'checkbox', value: o.id, checked: Array.isArray(v) && v.includes(o.id),
              onchange: (e) => {
                const actual = new Set(respuestas[p.id] || []);
                e.target.checked ? actual.add(o.id) : actual.delete(o.id);
                // conserva el orden de las opciones
                fijar(p.id, (p.opciones || []).map((x) => x.id).filter((x) => actual.has(x)));
              }
            }),
            h('span', {}, o.etiqueta))));
      case 'calculo':
        return h('output', { class: 'calculo', id: nombre }, '—');
      default:
        return h('input', { type: 'text', id: nombre, value: v ?? '', oninput: (e) => fijar(p.id, e.target.value) });
    }
  }

  function bloquePregunta(p) {
    const error = h('div', { class: 'error-campo' });
    const el = h('div', { class: 'pregunta', 'data-q': p.id },
      h('label', { class: 'pregunta-etiqueta', for: 'q_' + p.id },
        p.etiqueta, p.obligatoria && p.tipo !== 'calculo' ? h('span', { class: 'obligatoria', title: 'Obligatoria' }, ' *') : null),
      p.ayuda ? h('div', { class: 'pregunta-ayuda' }, p.ayuda) : null,
      control(p),
      tieneGrupos(p) ? h('div', { class: 'grupo' }) : null,
      error);
    bloques.set(p.id, { el, error, p });
    return el;
  }

  // ---- Estructura --------------------------------------------------------
  const pasos = h('nav', { class: 'pasos' });
  const cuerpo = h('div', { class: 'secciones' });
  const zonaAlertas = h('div', { class: 'alertas' });
  const btnAtras = h('button', { type: 'button', class: 'btn', onclick: () => ir(paso - 1) }, '← Anterior');
  const btnSiguiente = h('button', { type: 'button', class: 'btn btn-primario', onclick: () => ir(paso + 1) }, 'Siguiente →');
  const btnGuardar = h('button', { type: 'button', class: 'btn btn-exito', onclick: guardar }, opciones.textoGuardar || 'Guardar encuesta');

  form.secciones.forEach((s, i) => {
    const puntaje = s.puntaje && s.puntaje.activo ? h('div', { class: 'puntaje' }) : null;
    const el = h('section', { class: 'seccion-form', hidden: i !== paso },
      h('h2', {}, s.titulo),
      s.descripcion ? h('p', { class: 'seccion-desc' }, s.descripcion) : null,
      s.preguntas.length ? s.preguntas.map(bloquePregunta) : h('p', { class: 'vacio' }, 'Esta sección no tiene preguntas.'),
      puntaje);
    secciones.push({ s, el, puntaje });
    cuerpo.append(el);
  });

  rellenar(cont, 
    h('div', { class: 'form-cabecera' },
      h('div', {},
        h('h1', {}, opciones.titulo || form.titulo),
        form.descripcion ? h('p', { class: 'sub' }, form.descripcion) : null),
      h('button', { type: 'button', class: 'btn', onclick: () => opciones.alCancelar && opciones.alCancelar() }, opciones.textoCancelar || 'Salir')),
    pasos, zonaAlertas, cuerpo,
    h('div', { class: 'form-navegacion' }, btnAtras, h('div', { class: 'espacio' }), btnSiguiente, btnGuardar));

  // ---- Actualizaciones ---------------------------------------------------
  function actualizarDerivados() {
    for (const { el, p } of bloques.values()) {
      el.hidden = !esVisible(p, respuestas, idx);
      if (p.tipo === 'calculo') {
        const r = calcular(p, respuestas, idx);
        const out = el.querySelector('output');
        if (r.valor !== null) out.textContent = `${String(r.valor).replace('.', ',')} ${p.unidad || ''}`;
        else if (r.error) out.textContent = `Error en la fórmula: ${r.error}`;
        else out.textContent = r.falta ? `— (falta: ${etiquetaDe(r.falta)})` : '—';
      }
      if (tieneGrupos(p)) {
        const g = grupoDe(p, respuestas, idx);
        const out = el.querySelector('.grupo');
        out.textContent = g ? `Grupo: ${g}` : '';
        out.hidden = !g;
      }
      if (p.tipo === 'unica') {
        const b = el.querySelector('.limpiar-respuesta');
        if (b) b.hidden = vacio(respuestas[p.id]);
      }
    }
    for (const { s, puntaje } of secciones) {
      if (!puntaje) continue;
      const r = puntajeSeccion(s, respuestas, idx);
      puntaje.textContent = '';
      puntaje.append(
        h('strong', {}, `Puntaje: ${r.total}`),
        r.completo
          ? h('span', { class: 'nivel' }, r.nivel || 'Fuera de los rangos definidos')
          : h('span', { class: 'sub' }, ` (${r.respondidas} de ${r.totalPreguntas} respondidas)`));
    }
    const lista = alertas(form, respuestas);
    limpiar(zonaAlertas);
    for (const a of lista) zonaAlertas.append(h('div', { class: 'alerta', role: 'alert' }, '⚠ ', a.texto));
    pintarPasos();
  }

  function etiquetaDe(id) {
    const p = idx.get(id);
    return p ? p.etiqueta : id;
  }

  function erroresDeSeccion(i) {
    return form.secciones[i].preguntas.filter((p) => errores[p.id]).length;
  }

  function pintarPasos() {
    limpiar(pasos);
    form.secciones.forEach((s, i) => {
      const nErr = erroresDeSeccion(i);
      pasos.append(h('button', {
        type: 'button',
        class: 'paso' + (i === paso ? ' activo' : '') + (nErr ? ' con-error' : '') + (visitados.has(i) && !nErr ? ' visto' : ''),
        onclick: () => ir(i),
        title: s.titulo
      }, h('span', { class: 'paso-num' }, i + 1), h('span', { class: 'paso-txt' }, s.titulo)));
    });
  }

  function pintarErrores() {
    for (const { el, error, p } of bloques.values()) {
      error.textContent = errores[p.id] || '';
      el.classList.toggle('tiene-error', !!errores[p.id]);
    }
    pintarPasos();
  }

  function validarTodo() {
    errores = validar(form, respuestas, { registros: opciones.registros || [], idActual: opciones.idActual });
    return errores;
  }

  function ir(i) {
    if (i < 0 || i >= form.secciones.length) return;
    // Al avanzar se marcan los faltantes de la sección, pero se permite continuar.
    if (i > paso) {
      const todos = validarTodo();
      const ids = new Set(form.secciones[paso].preguntas.map((p) => p.id));
      errores = Object.fromEntries(Object.entries(todos).filter(([id]) => ids.has(id) || errores[id]));
      pintarErrores();
    }
    secciones[paso].el.hidden = true;
    paso = i;
    visitados.add(i);
    secciones[paso].el.hidden = false;
    btnAtras.disabled = paso === 0;
    const ultimo = paso === form.secciones.length - 1;
    btnSiguiente.hidden = ultimo;
    pintarPasos();
    pasos.querySelector('.activo')?.scrollIntoView({ block: 'nearest', inline: 'center' });
    cont.scrollIntoView({ block: 'start' });
    window.scrollTo({ top: 0 });
    notificar();
  }

  async function guardar() {
    const errs = validarTodo();
    pintarErrores();
    const n = Object.keys(errs).length;
    let completa = true;
    if (n) {
      const nombres = form.secciones.map((s, i) => (erroresDeSeccion(i) ? `• ${s.titulo} (${erroresDeSeccion(i)})` : null)).filter(Boolean);
      const hayDuplicado = Object.values(errs).some((m) => m.startsWith('Ya existe'));
      const botones = [{ texto: 'Revisar', valor: 'revisar', clase: 'btn-primario' }];
      if (!hayDuplicado) botones.push({ texto: 'Guardar como incompleta', valor: 'guardar' });
      const r = await dialogo({
        titulo: `Hay ${n} respuesta${n === 1 ? '' : 's'} por revisar`,
        mensaje: nombres.join('\n') + (hayDuplicado ? '\n\nHay un valor repetido que ya existe en otra encuesta.' : ''),
        botones
      });
      if (r !== 'guardar') {
        const primera = form.secciones.findIndex((_, i) => erroresDeSeccion(i));
        if (primera >= 0 && primera !== paso) ir(primera);
        const el = cont.querySelector('.tiene-error:not([hidden])');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      completa = false;
    }
    opciones.alGuardar(respuestas, completa);
  }

  btnAtras.disabled = paso === 0;
  btnSiguiente.hidden = paso === form.secciones.length - 1;
  actualizarDerivados();
  return { respuestas };
}
