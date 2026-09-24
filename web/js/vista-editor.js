// Editor del formulario: la doctora agrega, quita, edita y reordena secciones,
// preguntas y opciones. Los cambios se aplican a una copia y se guardan con "Guardar cambios".

import { h, limpiar, rellenar, confirmar, dialogo, descargar, aviso } from './dom.js';
import {
  TIPOS, TIPOS_CON_OPCIONES, preguntas, revisarFormula, slug, idUnico, idsReservados,
  columnaPuntaje, columnaNivel, vacio
} from './calc.js';
import { formularioBase } from './formulario-base.js';

const ID_VALIDO = /^[a-z][a-z0-9_]{0,59}$/;

export function montarEditor(cont, { form, alGuardar, alVistaPrevia }) {
  let trabajo = structuredClone(form);
  let cambios = false;
  const abiertos = new WeakSet();
  let btnGuardar, btnDescartar, estadoEl;
  let foco = null; // elemento recién agregado que debe recibir el foco

  // ---- utilidades --------------------------------------------------------
  function marcar() {
    cambios = true;
    if (estadoEl) {
      estadoEl.textContent = 'Cambios sin guardar';
      estadoEl.className = 'ed-estado sin-guardar';
      btnGuardar.disabled = false;
      btnDescartar.disabled = false;
    }
  }

  function render(enfocar) {
    const y = window.scrollY;
    rellenar(cont, barra(), generales(), ...trabajo.secciones.map(editorSeccion),
      h('div', { class: 'ed-acciones-final' },
        h('button', { type: 'button', class: 'btn btn-primario', onclick: agregarSeccion }, '+ Agregar sección')),
      herramientas());
    window.scrollTo({ top: y });
    foco = null;
    if (enfocar) {
      const el = cont.querySelector(enfocar);
      if (el) { el.focus(); el.scrollIntoView({ block: 'center' }); }
    }
  }

  function mover(arr, i, d) {
    const j = i + d;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    marcar();
    render();
  }

  const texto = (obj, prop, attrs = {}, alCambiar) => h('input', {
    type: 'text', value: obj[prop] ?? '', ...attrs,
    oninput: (e) => { obj[prop] = e.target.value; marcar(); if (alCambiar) alCambiar(e.target.value); }
  });
  const area = (obj, prop, attrs = {}, alCambiar) => h('textarea', {
    rows: 2, value: obj[prop] ?? '', ...attrs,
    oninput: (e) => { obj[prop] = e.target.value; marcar(); if (alCambiar) alCambiar(e.target.value); }
  });
  const numero = (obj, prop, attrs = {}) => h('input', {
    type: 'number', step: 'any', value: obj[prop] ?? '', ...attrs,
    oninput: (e) => { obj[prop] = e.target.value === '' ? null : Number(e.target.value); marcar(); }
  });
  const casilla = (obj, prop, etiqueta, alCambiar) => h('label', { class: 'check' },
    h('input', { type: 'checkbox', checked: !!obj[prop], onchange: (e) => { obj[prop] = e.target.checked; marcar(); if (alCambiar) alCambiar(); } }),
    ' ', etiqueta);
  const campo = (etiqueta, control, ayuda) => h('label', { class: 'campo' },
    h('span', { class: 'campo-etiqueta' }, etiqueta), control, ayuda ? h('small', {}, ayuda) : null);
  const botonIcono = (txt, titulo, onclick, extra = '') => h('button', { type: 'button', class: 'btn-icono ' + extra, title: titulo, 'aria-label': titulo, onclick }, txt);

  function idsOcupados(excepto) {
    const s = idsReservados(trabajo);
    for (const p of preguntas(trabajo)) if (p !== excepto) s.add(p.id);
    return s;
  }

  /** Cambia el id de una pregunta y actualiza las condiciones y fórmulas que la usan. */
  function renombrar(p, nuevo) {
    const viejo = p.id;
    if (viejo === nuevo) return;
    p.id = nuevo;
    const re = new RegExp(`\\b${viejo}\\b`, 'g');
    for (const q of preguntas(trabajo)) {
      if (q.mostrarSi && q.mostrarSi.pregunta === viejo) q.mostrarSi.pregunta = nuevo;
      if (q.tipo === 'calculo' && q.formula) q.formula = q.formula.replace(re, nuevo);
    }
  }

  // ---- barra superior ----------------------------------------------------
  function barra() {
    estadoEl = h('span', { class: 'ed-estado ' + (cambios ? 'sin-guardar' : '') }, cambios ? 'Cambios sin guardar' : 'Todo guardado');
    btnDescartar = h('button', { type: 'button', class: 'btn', disabled: !cambios, onclick: descartar }, 'Descartar');
    btnGuardar = h('button', { type: 'button', class: 'btn btn-exito', disabled: !cambios, onclick: guardar }, 'Guardar cambios');
    return h('div', { class: 'ed-barra' },
      h('div', {}, h('strong', {}, 'Editor de preguntas'), ' ', estadoEl),
      h('div', { class: 'ed-barra-botones' },
        h('button', { type: 'button', class: 'btn', onclick: () => alVistaPrevia(structuredClone(trabajo)) }, 'Vista previa'),
        btnDescartar, btnGuardar));
  }

  function generales() {
    return h('div', { class: 'tarjeta' },
      h('h2', {}, 'Datos generales'),
      campo('Título del formulario', texto(trabajo, 'titulo')),
      campo('Descripción', texto(trabajo, 'descripcion')),
      h('p', { class: 'sub' }, `Versión ${trabajo.version} · ${preguntas(trabajo).length} preguntas en ${trabajo.secciones.length} secciones`));
  }

  // ---- secciones ---------------------------------------------------------
  function editorSeccion(s, i) {
    const abierta = abiertos.has(s);
    const conteo = h('span', { class: 'sub' }, `${s.preguntas.length} pregunta${s.preguntas.length === 1 ? '' : 's'}`);
    return h('section', { class: 'tarjeta ed-seccion' + (abierta ? ' abierta' : ''), 'data-foco': s === foco ? '' : undefined },
      h('div', { class: 'ed-seccion-cab' },
        botonIcono(abierta ? '▾' : '▸', abierta ? 'Contraer' : 'Expandir', () => { abierta ? abiertos.delete(s) : abiertos.add(s); render(); }),
        h('span', { class: 'ed-num' }, i + 1),
        texto(s, 'titulo', { class: 'ed-titulo-seccion', placeholder: 'Título de la sección', 'aria-label': 'Título de la sección' }),
        conteo,
        botonIcono('↑', 'Subir sección', () => mover(trabajo.secciones, i, -1)),
        botonIcono('↓', 'Bajar sección', () => mover(trabajo.secciones, i, 1)),
        botonIcono('🗑', 'Eliminar sección', () => eliminarSeccion(i), 'peligro')),
      abierta ? h('div', { class: 'ed-seccion-cuerpo' },
        campo('Descripción o instrucciones (opcional)', area(s, 'descripcion')),
        editorPuntaje(s),
        h('div', { class: 'ed-preguntas' }, s.preguntas.map((p, j) => editorPregunta(s, p, j))),
        h('button', { type: 'button', class: 'btn', onclick: () => agregarPregunta(s) }, '+ Agregar pregunta')) : null);
  }

  function editorPuntaje(s) {
    s.puntaje = s.puntaje || { activo: false, rangos: [] };
    const pj = s.puntaje;
    return h('div', { class: 'ed-puntaje' },
      casilla(pj, 'activo', 'Calcular puntaje de esta sección (suma de los puntos de las respuestas)', () => render()),
      pj.activo ? h('div', {},
        campo('Variable de la sección', h('input', {
          type: 'text', value: s.id,
          onchange: (e) => {
            const nuevo = e.target.value.trim();
            const otros = new Set(trabajo.secciones.filter((x) => x !== s).map((x) => x.id));
            if (!ID_VALIDO.test(nuevo) || otros.has(nuevo)) {
              aviso('Nombre inválido o repetido: use minúsculas, números y _', 'error');
              e.target.value = s.id;
              return;
            }
            s.id = nuevo;
            marcar();
            render();
          }
        }), `Columnas en el Sheet: ${columnaPuntaje(s)} y ${columnaNivel(s)}`),
        h('div', { class: 'ed-subtitulo' }, 'Niveles según el puntaje'),
        h('div', { class: 'ed-rangos' },
          (pj.rangos || []).map((r, k) => h('div', { class: 'ed-fila' },
            numero(r, 'min', { placeholder: 'Desde', 'aria-label': 'Desde', class: 'corto' }),
            numero(r, 'max', { placeholder: 'Hasta', 'aria-label': 'Hasta', class: 'corto' }),
            texto(r, 'etiqueta', { placeholder: 'Nombre del nivel', 'aria-label': 'Nombre del nivel' }),
            botonIcono('✕', 'Quitar nivel', () => { pj.rangos.splice(k, 1); marcar(); render(); }, 'peligro')))),
        h('button', { type: 'button', class: 'btn btn-chico', onclick: () => { pj.rangos = pj.rangos || []; pj.rangos.push({ min: null, max: null, etiqueta: '' }); marcar(); render(); } }, '+ Agregar nivel'),
        h('small', { class: 'sub bloque' }, 'Asigne los puntos en cada opción de las preguntas de esta sección.')) : null);
  }

  function agregarSeccion() {
    const ids = new Set(trabajo.secciones.map((s) => s.id));
    const s = { id: idUnico('seccion', ids), titulo: 'Nueva sección', descripcion: '', preguntas: [] };
    trabajo.secciones.push(s);
    abiertos.add(s);
    foco = s;
    marcar();
    render('.ed-seccion[data-foco] .ed-titulo-seccion');
  }

  async function eliminarSeccion(i) {
    const s = trabajo.secciones[i];
    if (trabajo.secciones.length === 1) { aviso('El formulario debe tener al menos una sección', 'error'); return; }
    const ok = await confirmar('Eliminar sección',
      `Se eliminará "${s.titulo}" con sus ${s.preguntas.length} preguntas.\nLas columnas y datos que ya están en el Sheet no se borran.`,
      'Eliminar', 'btn-peligro');
    if (!ok) return;
    for (const p of s.preguntas) quitarReferencias(p.id);
    trabajo.secciones.splice(i, 1);
    marcar();
    render();
  }

  // ---- preguntas ---------------------------------------------------------
  function resumenPregunta(p) {
    return [p.etiqueta || '(sin texto)'];
  }

  function editorPregunta(s, p, j) {
    const abierta = abiertos.has(p);
    const titulo = h('span', { class: 'ed-preg-texto' }, resumenPregunta(p));
    const cab = h('div', { class: 'ed-preg-cab', onclick: (e) => { if (e.target.closest('button')) return; abierta ? abiertos.delete(p) : abiertos.add(p); render(); } },
      h('span', { class: 'ed-flecha' }, abierta ? '▾' : '▸'),
      titulo,
      h('span', { class: 'etiqueta-tipo' }, TIPOS[p.tipo] || p.tipo),
      p.obligatoria ? h('span', { class: 'etiqueta-tipo oblig' }, 'Obligatoria') : null,
      p.mostrarSi && p.mostrarSi.pregunta ? h('span', { class: 'etiqueta-tipo cond' }, 'Condicional') : null,
      botonIcono('↑', 'Subir pregunta', () => mover(s.preguntas, j, -1)),
      botonIcono('↓', 'Bajar pregunta', () => mover(s.preguntas, j, 1)));

    if (!abierta) return h('div', { class: 'ed-pregunta' }, cab);
    const marcaFoco = p === foco ? '' : undefined;

    let inputId;
    const actualizarTitulo = (v) => {
      rellenar(titulo, v || '(sin texto)');
      if (p._idAuto) {
        const nuevo = idUnico(slug(v) || 'pregunta', idsOcupados(p));
        renombrar(p, nuevo);
        inputId.value = nuevo;
      }
    };
    inputId = h('input', {
      type: 'text', value: p.id, spellcheck: 'false',
      onchange: (e) => {
        const nuevo = e.target.value.trim();
        if (!ID_VALIDO.test(nuevo)) { aviso('Use solo minúsculas, números y _ (empezando por letra)', 'error'); e.target.value = p.id; return; }
        if (idsOcupados(p).has(nuevo)) { aviso(`Ya existe una variable llamada "${nuevo}"`, 'error'); e.target.value = p.id; return; }
        delete p._idAuto;
        renombrar(p, nuevo);
        marcar();
      }
    });

    const tipoSel = h('select', {
      onchange: (e) => {
        p.tipo = e.target.value;
        if (TIPOS_CON_OPCIONES.includes(p.tipo) && !(p.opciones && p.opciones.length)) {
          p.opciones = [{ id: 'o1', etiqueta: 'Opción 1' }, { id: 'o2', etiqueta: 'Opción 2' }];
        }
        if (p.tipo === 'calculo') { p.obligatoria = false; p.formula = p.formula || ''; }
        marcar();
        render();
      }
    }, Object.entries(TIPOS).map(([k, v]) => h('option', { value: k, selected: p.tipo === k }, v)));

    return h('div', { class: 'ed-pregunta abierta', 'data-foco': marcaFoco }, cab,
      h('div', { class: 'ed-preg-cuerpo' },
        campo('Pregunta', area(p, 'etiqueta', { placeholder: 'Escriba la pregunta', class: 'ed-etiqueta' }, actualizarTitulo)),
        campo('Texto de ayuda (opcional)', texto(p, 'ayuda', { placeholder: 'Instrucción o aclaración para quien responde' })),
        h('div', { class: 'ed-grid' },
          campo('Tipo de respuesta', tipoSel),
          campo('Nombre de la columna en el Sheet', inputId, 'Si lo cambia, en el Sheet se crea una columna nueva.')),
        h('div', { class: 'ed-checks' },
          p.tipo !== 'calculo' ? casilla(p, 'obligatoria', 'Obligatoria', () => render()) : null,
          ['texto', 'numero', 'fecha'].includes(p.tipo) ? casilla(p, 'unico', 'No permitir valores repetidos entre encuestas') : null),
        opcionesDeTipo(p),
        editorCondicion(p),
        h('div', { class: 'ed-preg-acciones' },
          h('button', { type: 'button', class: 'btn btn-chico', onclick: () => duplicar(s, j) }, 'Duplicar'),
          h('label', { class: 'mover-a' }, 'Mover a: ',
            h('select', {
              onchange: (e) => {
                const destino = trabajo.secciones[Number(e.target.value)];
                s.preguntas.splice(j, 1);
                destino.preguntas.push(p);
                abiertos.add(destino);
                marcar();
                render();
              }
            }, trabajo.secciones.map((x, k) => h('option', { value: k, selected: x === s }, `${k + 1}. ${x.titulo}`)))),
          h('div', { class: 'espacio' }),
          h('button', { type: 'button', class: 'btn btn-chico btn-peligro', onclick: () => eliminarPregunta(s, j) }, 'Eliminar pregunta'))));
  }

  function opcionesDeTipo(p) {
    if (p.tipo === 'numero') {
      return h('div', { class: 'ed-grid ed-grid-4' },
        campo('Mínimo', numero(p, 'min')),
        campo('Máximo', numero(p, 'max')),
        campo('Decimales', h('select', {
          onchange: (e) => { p.decimales = e.target.value === '' ? null : Number(e.target.value); marcar(); }
        }, [['', 'Cualquiera'], ['0', 'Ninguno (entero)'], ['1', '1'], ['2', '2'], ['3', '3']].map(([v, t]) =>
          h('option', { value: v, selected: String(p.decimales ?? '') === v }, t)))),
        campo('Unidad', texto(p, 'unidad', { placeholder: 'kg, años…' })));
    }
    if (p.tipo === 'calculo') {
      const numericas = preguntas(trabajo).filter((q) => q !== p && (q.tipo === 'numero' || q.tipo === 'calculo'));
      const msg = h('small', { class: 'error-campo' });
      const revisar = () => {
        const e = revisarFormula(p.formula, numericas.map((q) => q.id));
        msg.textContent = e ? `⚠ ${e}` : '✓ Fórmula válida';
        msg.className = e ? 'error-campo' : 'ok-campo';
      };
      const input = texto(p, 'formula', { placeholder: 'Ejemplo: peso_1t / talla ^ 2', spellcheck: 'false', class: 'mono' }, revisar);
      revisar();
      return h('div', {},
        campo('Fórmula', input, 'Use + − * / ^ y paréntesis con los nombres de columna de preguntas numéricas.'),
        msg,
        h('div', { class: 'chips' }, h('small', {}, 'Insertar: '),
          numericas.map((q) => h('button', {
            type: 'button', class: 'chip', title: q.etiqueta,
            onclick: () => { p.formula = `${p.formula || ''}${p.formula && !/\s$/.test(p.formula) ? ' ' : ''}${q.id}`; input.value = p.formula; marcar(); revisar(); input.focus(); }
          }, q.id))),
        h('div', { class: 'ed-grid' },
          campo('Decimales del resultado', numero(p, 'decimales', { min: 0, max: 6, step: 1 })),
          campo('Unidad', texto(p, 'unidad'))));
    }
    if (TIPOS_CON_OPCIONES.includes(p.tipo)) return editorOpciones(p);
    return null;
  }

  function editorOpciones(p) {
    p.opciones = p.opciones || [];
    const nuevaOpcion = (etiqueta) => {
      const ids = new Set(p.opciones.map((o) => o.id));
      let n = p.opciones.length + 1;
      while (ids.has('o' + n)) n++;
      return { id: 'o' + n, etiqueta };
    };
    return h('div', { class: 'ed-opciones' },
      h('div', { class: 'ed-subtitulo' }, 'Opciones de respuesta'),
      h('div', { class: 'ed-fila ed-fila-cab' }, h('span', {}, 'Texto de la opción'), h('span', { class: 'corto' }, 'Puntos'), h('span', {}, 'Alerta al elegirla (opcional)'), h('span', {})),
      p.opciones.map((o, k) => h('div', { class: 'ed-fila', 'data-foco': o === foco ? '' : undefined },
        texto(o, 'etiqueta', { placeholder: `Opción ${k + 1}`, 'aria-label': 'Texto de la opción' }),
        h('input', {
          type: 'number', step: 'any', class: 'corto', value: o.puntos ?? '', placeholder: '—', 'aria-label': 'Puntos',
          oninput: (e) => { if (e.target.value === '') delete o.puntos; else o.puntos = Number(e.target.value); marcar(); }
        }),
        texto(o, 'alerta', { placeholder: 'Mensaje de alerta', 'aria-label': 'Alerta' }),
        h('div', { class: 'ed-fila-botones' },
          botonIcono('↑', 'Subir opción', () => mover(p.opciones, k, -1)),
          botonIcono('↓', 'Bajar opción', () => mover(p.opciones, k, 1)),
          botonIcono('✕', 'Quitar opción', () => quitarOpcion(p, k), 'peligro')))),
      h('div', { class: 'ed-botones' },
        h('button', { type: 'button', class: 'btn btn-chico', onclick: () => { const o = nuevaOpcion(''); p.opciones.push(o); foco = o; marcar(); render('.ed-fila[data-foco] input'); } }, '+ Agregar opción'),
        h('button', {
          type: 'button', class: 'btn btn-chico',
          onclick: async () => {
            const ta = h('textarea', { rows: 8, placeholder: 'Una opción por línea' });
            const r = await dialogo({
              titulo: 'Agregar varias opciones',
              mensaje: h('div', {}, h('p', {}, 'Escriba o pegue una opción por línea:'), ta),
              botones: [{ texto: 'Cancelar', valor: false }, { texto: 'Agregar', valor: true, clase: 'btn-primario' }]
            });
            if (!r) return;
            ta.value.split('\n').map((x) => x.trim()).filter(Boolean).forEach((e) => p.opciones.push(nuevaOpcion(e)));
            marcar();
            render();
          }
        }, 'Pegar varias')));
  }

  async function quitarOpcion(p, k) {
    const o = p.opciones[k];
    if (p.opciones.length === 1) { aviso('La pregunta debe tener al menos una opción', 'error'); return; }
    const dependientes = preguntas(trabajo).filter((q) => q.mostrarSi && q.mostrarSi.pregunta === p.id && (q.mostrarSi.valores || []).includes(o.id));
    if (dependientes.length && !(await confirmar('Quitar opción', `Hay ${dependientes.length} pregunta(s) que se muestran según esta opción. Se ajustará su condición.`, 'Quitar'))) return;
    for (const q of dependientes) q.mostrarSi.valores = q.mostrarSi.valores.filter((v) => v !== o.id);
    p.opciones.splice(k, 1);
    marcar();
    render();
  }

  function editorCondicion(p) {
    const candidatas = preguntas(trabajo).filter((q) => q !== p && TIPOS_CON_OPCIONES.includes(q.tipo));
    const activa = !!p.mostrarSi;
    const box = h('div', { class: 'ed-condicion' },
      h('label', { class: 'check' },
        h('input', {
          type: 'checkbox', checked: activa, disabled: !candidatas.length && !activa,
          onchange: (e) => {
            p.mostrarSi = e.target.checked ? { pregunta: candidatas[0] ? candidatas[0].id : '', valores: [] } : undefined;
            if (!p.mostrarSi) delete p.mostrarSi;
            marcar();
            render();
          }
        }),
        ' Mostrar esta pregunta solo según la respuesta de otra pregunta'));
    if (!activa) return box;
    const padre = candidatas.find((q) => q.id === p.mostrarSi.pregunta);
    box.append(
      campo('Pregunta de la que depende', h('select', {
        onchange: (e) => { p.mostrarSi = { pregunta: e.target.value, valores: [] }; marcar(); render(); }
      }, h('option', { value: '' }, '— Seleccione —'),
      candidatas.map((q) => h('option', { value: q.id, selected: q.id === p.mostrarSi.pregunta }, `${q.etiqueta} [${q.id}]`)))),
      padre ? h('div', {},
        h('div', { class: 'ed-subtitulo' }, 'Se muestra cuando la respuesta es:'),
        h('div', { class: 'ed-checks' }, (padre.opciones || []).map((o) => h('label', { class: 'check' },
          h('input', {
            type: 'checkbox', checked: (p.mostrarSi.valores || []).includes(o.id),
            onchange: (e) => {
              const v = new Set(p.mostrarSi.valores || []);
              e.target.checked ? v.add(o.id) : v.delete(o.id);
              p.mostrarSi.valores = [...v];
              marcar();
            }
          }), ' ', o.etiqueta || '(sin texto)'))),
        h('small', { class: 'sub' }, 'Si no marca ninguna, se muestra cuando la otra pregunta tenga cualquier respuesta.')) : '');
    return box;
  }

  function agregarPregunta(s) {
    const p = {
      id: idUnico('pregunta', idsOcupados()),
      etiqueta: '',
      tipo: 'unica',
      obligatoria: false,
      opciones: [{ id: 'o1', etiqueta: 'Opción 1' }, { id: 'o2', etiqueta: 'Opción 2' }],
      _idAuto: true
    };
    s.preguntas.push(p);
    abiertos.add(p);
    foco = p;
    marcar();
    render('.ed-pregunta[data-foco] .ed-etiqueta');
  }

  function duplicar(s, j) {
    const copia = structuredClone(s.preguntas[j]);
    copia.id = idUnico(copia.id + '_copia', idsOcupados());
    delete copia._idAuto;
    s.preguntas.splice(j + 1, 0, copia);
    abiertos.add(copia);
    marcar();
    render();
  }

  function quitarReferencias(id) {
    for (const q of preguntas(trabajo)) if (q.mostrarSi && q.mostrarSi.pregunta === id) delete q.mostrarSi;
  }

  async function eliminarPregunta(s, j) {
    const p = s.preguntas[j];
    const deps = preguntas(trabajo).filter((q) => q.mostrarSi && q.mostrarSi.pregunta === p.id);
    const formulas = preguntas(trabajo).filter((q) => q.tipo === 'calculo' && new RegExp(`\\b${p.id}\\b`).test(q.formula || ''));
    let msg = `"${p.etiqueta || p.id}"\n\nLa columna y los datos que ya están en el Sheet no se borran.`;
    if (deps.length) msg += `\n\n${deps.length} pregunta(s) condicionadas a esta se mostrarán siempre.`;
    if (formulas.length) msg += `\n\nOjo: la usan estas fórmulas: ${formulas.map((q) => q.id).join(', ')}.`;
    if (!(await confirmar('Eliminar pregunta', msg, 'Eliminar', 'btn-peligro'))) return;
    quitarReferencias(p.id);
    s.preguntas.splice(j, 1);
    marcar();
    render();
  }

  // ---- herramientas ------------------------------------------------------
  function herramientas() {
    const archivo = h('input', {
      type: 'file', accept: 'application/json,.json', hidden: true,
      onchange: async (e) => {
        const f = e.target.files[0];
        e.target.value = '';
        if (!f) return;
        try {
          const nuevo = JSON.parse(await f.text());
          if (!nuevo || !Array.isArray(nuevo.secciones)) throw new Error('El archivo no es un formulario válido');
          if (!(await confirmar('Importar formulario', 'Se reemplazarán todas las preguntas del editor por las del archivo. Luego debe pulsar "Guardar cambios".', 'Importar'))) return;
          nuevo.version = trabajo.version;
          trabajo = nuevo;
          marcar();
          render();
        } catch (err) {
          aviso(err.message, 'error');
        }
      }
    });
    return h('div', { class: 'tarjeta ed-herramientas' },
      h('h2', {}, 'Herramientas'),
      h('div', { class: 'ed-botones' },
        h('button', { type: 'button', class: 'btn', onclick: () => descargar('formulario.json', JSON.stringify(limpio(trabajo), null, 2), 'application/json') }, 'Exportar preguntas (JSON)'),
        h('button', { type: 'button', class: 'btn', onclick: () => archivo.click() }, 'Importar preguntas (JSON)'),
        h('button', {
          type: 'button', class: 'btn btn-peligro',
          onclick: async () => {
            if (!(await confirmar('Restaurar plantilla original', 'Se reemplazarán todas las preguntas por las del documento del proyecto. Luego debe pulsar "Guardar cambios".', 'Restaurar', 'btn-peligro'))) return;
            const base = formularioBase();
            base.version = trabajo.version;
            trabajo = base;
            marcar();
            render();
          }
        }, 'Restaurar plantilla original')),
      archivo);
  }

  // ---- guardar -----------------------------------------------------------
  function limpio(f) {
    const c = structuredClone(f);
    for (const s of c.secciones) {
      for (const p of s.preguntas) {
        delete p._idAuto;
        if (!TIPOS_CON_OPCIONES.includes(p.tipo)) delete p.opciones;
        if (p.tipo !== 'calculo') delete p.formula;
        if (p.tipo === 'calculo') delete p.obligatoria;
        for (const o of p.opciones || []) if (!o.alerta) delete o.alerta;
      }
      if (s.puntaje && !s.puntaje.activo && !(s.puntaje.rangos || []).length) delete s.puntaje;
    }
    return c;
  }

  function revisar() {
    const errores = [];
    if (!String(trabajo.titulo || '').trim()) errores.push('El formulario no tiene título.');
    const idsSec = new Set();
    const ids = new Map();
    const numericas = preguntas(trabajo).filter((q) => q.tipo === 'numero' || q.tipo === 'calculo').map((q) => q.id);
    for (const s of trabajo.secciones) {
      const nombre = s.titulo || '(sección sin título)';
      if (!String(s.titulo || '').trim()) errores.push('Hay una sección sin título.');
      if (idsSec.has(s.id)) errores.push(`Dos secciones usan la variable "${s.id}".`);
      idsSec.add(s.id);
      if (s.puntaje && s.puntaje.activo) {
        for (const r of s.puntaje.rangos || []) {
          if (vacio(r.min) || vacio(r.max) || !String(r.etiqueta || '').trim()) errores.push(`${nombre}: complete todos los niveles de puntaje (desde, hasta y nombre).`);
          else if (Number(r.min) > Number(r.max)) errores.push(`${nombre}: en el nivel "${r.etiqueta}" el "desde" es mayor que el "hasta".`);
        }
      }
      for (const p of s.preguntas) {
        const q = `${nombre} → "${p.etiqueta || p.id}"`;
        if (!String(p.etiqueta || '').trim()) errores.push(`${nombre}: hay una pregunta sin texto.`);
        if (!ID_VALIDO.test(p.id)) errores.push(`${q}: el nombre de columna "${p.id}" no es válido.`);
        if (ids.has(p.id)) errores.push(`${q}: el nombre de columna "${p.id}" está repetido.`);
        ids.set(p.id, p);
        if (TIPOS_CON_OPCIONES.includes(p.tipo)) {
          if (!(p.opciones || []).length) errores.push(`${q}: no tiene opciones.`);
          if ((p.opciones || []).some((o) => !String(o.etiqueta || '').trim())) errores.push(`${q}: hay opciones sin texto.`);
        }
        if (p.tipo === 'numero' && !vacio(p.min) && !vacio(p.max) && Number(p.min) > Number(p.max)) errores.push(`${q}: el mínimo es mayor que el máximo.`);
        if (p.tipo === 'calculo') {
          const e = revisarFormula(p.formula, numericas.filter((x) => x !== p.id));
          if (e) errores.push(`${q}: ${e}.`);
        }
        if (p.mostrarSi && !p.mostrarSi.pregunta) errores.push(`${q}: elija de qué pregunta depende o desactive la condición.`);
      }
    }
    const reservados = idsReservados(trabajo);
    for (const id of ids.keys()) if (reservados.has(id)) errores.push(`El nombre de columna "${id}" está reservado; use otro.`);
    return [...new Set(errores)];
  }

  async function guardar() {
    const errores = revisar();
    if (errores.length) {
      await dialogo({ titulo: 'Revise estos puntos antes de guardar', mensaje: errores.map((e) => '• ' + e).join('\n') });
      return;
    }
    const final = limpio(trabajo);
    final.version = (form.version || 0) + 1;
    final.actualizado = new Date().toISOString();
    alGuardar(final);
    form = final;
    trabajo = structuredClone(final);
    cambios = false;
    render();
    aviso('Formulario guardado. Se sincronizará con el Sheet.');
  }

  async function descartar() {
    if (!(await confirmar('Descartar cambios', 'Se perderán los cambios que no ha guardado.', 'Descartar', 'btn-peligro'))) return;
    trabajo = structuredClone(form);
    cambios = false;
    render();
  }

  render();
  return {
    tieneCambios: () => cambios,
    recargar(nuevo) { if (!cambios) { form = nuevo; trabajo = structuredClone(nuevo); render(); } }
  };
}
