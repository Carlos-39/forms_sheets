import { h, limpiar, rellenar, aviso, confirmar, dialogo, descargar, uid, fechaCorta } from './dom.js';
import { store, bus } from './storage.js';
import { sincronizar, estadoSync, probarConexion, iniciarSincronizacionAutomatica } from './sync.js';
import { alertas, aCSV, indice, valorLegible, preguntas } from './calc.js';
import { montarFormulario } from './vista-formulario.js';
import { montarEditor } from './vista-editor.js';

export const VERSION_APP = '1.0.0';

const vista = document.getElementById('vista');
const pill = document.getElementById('estado-sync');
const marca = document.getElementById('marca');
let editorActual = null;
let rutaActual = '';
let ignorarCambioRuta = false;
let repintarLista = null; // refresca la lista de inicio sin perder la búsqueda

// ---------------------------------------------------------------------------
// Configuración rápida por enlace: ?api=URL&clave=CLAVE

(function configDesdeURL() {
  const q = new URLSearchParams(location.search);
  if (q.get('api') || q.get('clave')) {
    const c = store.config();
    store.guardarConfig({ apiUrl: q.get('api') || c.apiUrl, clave: q.get('clave') || c.clave });
    history.replaceState(null, '', location.pathname + location.hash);
  }
})();

// ---------------------------------------------------------------------------
// Estado de sincronización (indicador de la cabecera)

function pintarEstado() {
  const e = estadoSync();
  const pend = store.pendientes().length + (store.formularioPendiente() ? 1 : 0);
  let texto, clase, titulo = '';
  if (!store.configurado()) { texto = 'Sin conectar a Sheets'; clase = 'gris'; titulo = 'Configure la conexión en Ajustes'; }
  else if (e.sincronizando) { texto = 'Sincronizando…'; clase = 'azul'; }
  else if (e.error) { texto = 'Error al sincronizar'; clase = 'rojo'; titulo = e.error; }
  else if (!e.enLinea) { texto = pend ? `Sin señal · ${pend} pendiente${pend === 1 ? '' : 's'}` : 'Sin señal'; clase = 'naranja'; titulo = 'Los datos quedan guardados en el dispositivo y se enviarán cuando vuelva la señal.'; }
  else if (pend) { texto = `${pend} pendiente${pend === 1 ? '' : 's'}`; clase = 'naranja'; }
  else { texto = 'Sincronizado'; clase = 'verde'; }
  pill.className = 'pill pill-' + clase;
  pill.title = titulo || 'Pulse para sincronizar ahora';
  rellenar(pill, h('span', { class: 'punto' }), texto);
  marca.textContent = store.formulario().titulo || 'Formulario';
}

pill.addEventListener('click', () => {
  if (!store.configurado()) { location.hash = '#/ajustes'; return; }
  sincronizar().then((ok) => {
    if (ok) aviso('Sincronizado con Google Sheets');
    else if (estadoSync().error) aviso(estadoSync().error, 'error');
    else if (!estadoSync().enLinea) aviso('Sin conexión. Se reintentará automáticamente.', 'alerta');
  });
});

// ---------------------------------------------------------------------------
// Rutas

const rutas = [
  [/^#?\/?$/, inicio],
  [/^#\/nueva$/, () => encuesta(null)],
  [/^#\/encuesta\/(.+)$/, (m) => encuesta(decodeURIComponent(m[1]))],
  [/^#\/preguntas$/, editor],
  [/^#\/ajustes$/, ajustes]
];

async function navegar() {
  if (ignorarCambioRuta) { ignorarCambioRuta = false; return; }
  const hash = location.hash || '#/';
  if (editorActual && editorActual.tieneCambios() && hash !== rutaActual) {
    const salir = await confirmar('Cambios sin guardar', 'Tiene cambios sin guardar en las preguntas. ¿Salir y descartarlos?', 'Salir sin guardar', 'btn-peligro');
    if (!salir) { ignorarCambioRuta = true; location.hash = rutaActual; return; }
  }
  editorActual = null;
  repintarLista = null;
  rutaActual = hash;
  const seccion = hash.startsWith('#/preguntas') ? '#/preguntas' : hash.startsWith('#/ajustes') ? '#/ajustes' : '#/';
  document.querySelectorAll('.nav a').forEach((a) => a.classList.toggle('activo', a.getAttribute('href') === seccion));
  for (const [re, fn] of rutas) {
    const m = hash.match(re);
    if (m) { fn(m); window.scrollTo({ top: 0 }); return; }
  }
  location.hash = '#/';
}

window.addEventListener('hashchange', navegar);
window.addEventListener('beforeunload', (e) => {
  if (editorActual && editorActual.tieneCambios()) { e.preventDefault(); e.returnValue = ''; }
});

// ---------------------------------------------------------------------------
// Inicio: lista de encuestas

function resumen(form, r) {
  const idx = indice(form);
  const ps = preguntas(form);
  const principal = ps.find((p) => p.unico) || ps.find((p) => p.tipo === 'texto') || ps[0];
  const titulo = principal ? valorLegible(principal, r.respuestas?.[principal.id], r.respuestas || {}, idx) : '';
  const extras = ps.filter((p) => p !== principal && p.tipo !== 'calculo' && r.respuestas?.[p.id] !== undefined)
    .slice(0, 2).map((p) => `${p.etiqueta}: ${valorLegible(p, r.respuestas[p.id], r.respuestas, idx)}`);
  return { titulo: titulo || 'Encuesta sin identificar', etiqueta: principal ? principal.etiqueta : '', extras };
}

function inicio() {
  const form = store.formulario();
  const lista = h('div', { class: 'lista' });
  const buscador = h('input', { type: 'search', placeholder: 'Buscar por documento o cualquier respuesta…', class: 'buscador', oninput: pintar });
  const conteo = h('p', { class: 'sub' });
  const borrador = store.borrador();

  function pintar() {
    const q = buscador.value.trim().toLowerCase();
    const registros = store.registros();
    const pend = registros.filter((r) => r.sync !== 'sincronizado').length;
    conteo.textContent = `${registros.length} encuesta${registros.length === 1 ? '' : 's'} en este dispositivo` + (pend ? ` · ${pend} por sincronizar` : '');
    const filtrados = q ? registros.filter((r) => textoBuscable(form, r).includes(q)) : registros;
    limpiar(lista);
    if (!filtrados.length) {
      lista.append(h('div', { class: 'vacio' }, registros.length ? 'No hay resultados para la búsqueda.' : 'Aún no hay encuestas. Pulse "Nueva encuesta" para empezar.'));
      return;
    }
    for (const r of filtrados) {
      const res = resumen(form, r);
      const tieneAlerta = alertas(form, r.respuestas || {}).length > 0;
      lista.append(h('article', { class: 'registro' },
        h('a', { class: 'registro-principal', href: '#/encuesta/' + encodeURIComponent(r.id) },
          h('div', { class: 'registro-titulo' }, res.etiqueta ? h('small', {}, res.etiqueta + ': ') : null, res.titulo),
          h('div', { class: 'registro-detalle' }, res.extras.join(' · ')),
          h('div', { class: 'registro-meta' },
            h('span', {}, fechaCorta(r.creado)),
            r.sync === 'sincronizado'
              ? h('span', { class: 'insignia verde' }, '✓ En el Sheet')
              : h('span', { class: 'insignia naranja' }, '⏳ Pendiente de enviar'),
            r.completa ? null : h('span', { class: 'insignia gris' }, 'Incompleta'),
            tieneAlerta ? h('span', { class: 'insignia rojo' }, '⚠ Alerta') : null)),
        h('div', { class: 'registro-acciones' },
          h('a', { class: 'btn btn-chico', href: '#/encuesta/' + encodeURIComponent(r.id) }, 'Ver / editar'),
          h('button', {
            type: 'button', class: 'btn btn-chico btn-peligro',
            onclick: async () => {
              const ok = await confirmar('Eliminar encuesta', `Se eliminará "${res.titulo}" de este dispositivo` + (r.sincronizadoAlgunaVez ? ' y del Sheet.' : '.'), 'Eliminar', 'btn-peligro');
              if (ok) { store.eliminarRegistro(r.id); aviso('Encuesta eliminada'); }
            }
          }, 'Eliminar'))));
    }
  }

  rellenar(vista, 
    !store.configurado() ? h('div', { class: 'banner' },
      'Aún no está conectada a Google Sheets. Las encuestas se guardan en este dispositivo. ',
      h('a', { href: '#/ajustes' }, 'Configurar conexión')) : null,
    borrador ? h('div', { class: 'banner banner-azul' },
      h('span', {}, `Tiene una encuesta ${borrador.nuevo ? 'nueva' : 'en edición'} sin terminar (${fechaCorta(borrador.guardado)}).`),
      h('span', { class: 'banner-botones' },
        h('a', { class: 'btn btn-chico btn-primario', href: borrador.nuevo ? '#/nueva' : '#/encuesta/' + encodeURIComponent(borrador.id) }, 'Continuar'),
        h('button', {
          type: 'button', class: 'btn btn-chico',
          onclick: async () => { if (await confirmar('Descartar', '¿Descartar la encuesta sin terminar?', 'Descartar', 'btn-peligro')) { store.descartarBorrador(); inicio(); } }
        }, 'Descartar'))) : null,
    h('div', { class: 'inicio-cab' },
      h('div', {}, h('h1', {}, 'Encuestas'), conteo),
      h('a', { class: 'btn btn-primario btn-grande', href: '#/nueva' }, '+ Nueva encuesta')),
    buscador,
    lista);
  pintar();
  repintarLista = pintar;
}

function textoBuscable(form, r) {
  const idx = indice(form);
  const resp = r.respuestas || {};
  return preguntas(form).map((p) => valorLegible(p, resp[p.id], resp, idx)).join(' ').toLowerCase();
}

// ---------------------------------------------------------------------------
// Diligenciar / editar una encuesta

async function encuesta(id) {
  const form = store.formulario();
  const existente = id ? store.registro(id) : null;
  if (id && !existente) { aviso('La encuesta no existe en este dispositivo', 'error'); location.hash = '#/'; return; }

  // Un solo borrador a la vez: se retoma si corresponde a esta encuesta.
  let borrador = store.borrador();
  const coincide = borrador && (id ? borrador.id === id : borrador.nuevo);
  if (borrador && !coincide) {
    const seguir = await confirmar('Encuesta sin terminar',
      'Hay otra encuesta sin terminar en este dispositivo. Si continúa, esa se descartará.', 'Continuar y descartarla', 'btn-peligro');
    if (!seguir) { location.hash = '#/'; return; }
    store.descartarBorrador();
    borrador = null;
  }

  const registroId = id || (borrador && borrador.id) || uid();
  const creado = existente ? existente.creado : (borrador && borrador.creado) || new Date().toISOString();
  let ultimo = {
    respuestas: borrador ? borrador.respuestas : (existente ? existente.respuestas : {}),
    paso: borrador ? borrador.paso : 0
  };
  let tocado = !!borrador;
  let temporizador = null;
  const guardarBorrador = () => {
    clearTimeout(temporizador);
    store.guardarBorrador({ id: registroId, nuevo: !existente, creado, ...ultimo, guardado: new Date().toISOString() });
  };

  montarFormulario(vista, {
    form,
    respuestas: ultimo.respuestas,
    paso: ultimo.paso,
    titulo: existente ? 'Editar encuesta' : 'Nueva encuesta',
    registros: store.registros(),
    idActual: registroId,
    alCambiar(resp, paso) {
      tocado = true;
      ultimo = { respuestas: { ...resp }, paso };
      clearTimeout(temporizador);
      temporizador = setTimeout(guardarBorrador, 300);
    },
    alGuardar(resp, completa) {
      clearTimeout(temporizador);
      store.guardarRegistro({
        id: registroId,
        creado,
        actualizado: new Date().toISOString(),
        respuestas: { ...resp },
        completa,
        versionFormulario: form.version,
        sync: 'pendiente',
        sincronizadoAlgunaVez: existente ? !!existente.sincronizadoAlgunaVez : false
      });
      store.descartarBorrador();
      aviso(completa ? 'Encuesta guardada' : 'Encuesta guardada como incompleta');
      const lista = alertas(form, resp);
      const fin = () => { location.hash = '#/'; };
      if (lista.length) dialogo({ titulo: '⚠ Atención', mensaje: lista.map((a) => '• ' + a.texto).join('\n') }).then(fin);
      else fin();
    },
    async alCancelar() {
      if (!tocado) { location.hash = '#/'; return; }
      guardarBorrador();
      const r = await dialogo({
        titulo: 'Salir de la encuesta',
        mensaje: 'Lo que lleva queda guardado como borrador en este dispositivo y puede continuarlo después desde el inicio.',
        botones: [
          { texto: 'Seguir llenando', valor: 'seguir' },
          { texto: 'Descartar cambios', valor: 'descartar', clase: 'btn-peligro' },
          { texto: 'Salir y conservar borrador', valor: 'salir', clase: 'btn-primario' }
        ]
      });
      if (r === 'descartar') { store.descartarBorrador(); location.hash = '#/'; }
      if (r === 'salir') location.hash = '#/';
    }
  });
}

// ---------------------------------------------------------------------------
// Editor de preguntas

function editor() {
  limpiar(vista);
  const cont = h('div', { class: 'editor' });
  vista.append(cont);
  editorActual = montarEditor(cont, {
    form: store.formulario(),
    alGuardar(f) { store.guardarFormulario(f); pintarEstado(); },
    alVistaPrevia: vistaPrevia
  });
}

function vistaPrevia(form) {
  const cont = h('div', { class: 'contenedor' });
  const capa = h('div', { class: 'capa-previa' },
    h('div', { class: 'previa-aviso' }, 'Vista previa — las respuestas no se guardan'), cont);
  document.body.append(capa);
  document.body.classList.add('sin-scroll');
  const cerrar = () => { capa.remove(); document.body.classList.remove('sin-scroll'); };
  montarFormulario(cont, {
    form,
    titulo: 'Vista previa',
    textoCancelar: 'Cerrar vista previa',
    textoGuardar: 'Probar guardar',
    alGuardar: (_, completa) => aviso(completa ? 'Todo correcto (vista previa, no se guarda)' : 'Guardado incompleto (vista previa, no se guarda)'),
    alCancelar: cerrar
  });
}

// ---------------------------------------------------------------------------
// Ajustes

function ajustes() {
  const c = store.config();
  const url = h('input', { type: 'url', value: c.apiUrl, placeholder: 'https://script.google.com/macros/s/…/exec', spellcheck: 'false' });
  const clave = h('input', { type: 'password', value: c.clave, placeholder: 'La clave definida en el Apps Script', autocomplete: 'off' });
  const estado = h('div', { class: 'estado-ajustes' });
  const archivo = h('input', {
    type: 'file', accept: 'application/json,.json', hidden: true,
    onchange: async (e) => {
      const f = e.target.files[0];
      e.target.value = '';
      if (!f) return;
      try {
        const datos = JSON.parse(await f.text());
        const n = store.importarRegistros(datos.registros || []);
        aviso(`${n} encuesta(s) importada(s)`);
        pintarAjustes();
      } catch (err) {
        aviso('No se pudo leer el archivo: ' + err.message, 'error');
      }
    }
  });

  function pintarAjustes() {
    const e = estadoSync();
    const ultima = store.ultimaSync();
    const pend = store.pendientes().length;
    rellenar(estado, 
      h('p', {}, h('strong', {}, 'Última sincronización: '), ultima ? fechaCorta(ultima) : 'nunca'),
      h('p', {}, h('strong', {}, 'Encuestas pendientes de enviar: '), String(pend)),
      h('p', {}, h('strong', {}, 'Cambios de preguntas pendientes: '), store.formularioPendiente() ? 'sí' : 'no'),
      e.error ? h('p', { class: 'error-campo' }, '⚠ ' + e.error) : null);
  }

  rellenar(vista, 
    h('h1', {}, 'Ajustes'),
    h('section', { class: 'tarjeta' },
      h('h2', {}, 'Conexión con Google Sheets'),
      h('label', { class: 'campo' }, h('span', { class: 'campo-etiqueta' }, 'URL de la aplicación web (Apps Script)'), url),
      h('label', { class: 'campo' }, h('span', { class: 'campo-etiqueta' }, 'Clave'),
        h('div', { class: 'con-unidad' }, clave,
          h('button', { type: 'button', class: 'btn btn-chico', onclick: (e) => { clave.type = clave.type === 'password' ? 'text' : 'password'; e.target.textContent = clave.type === 'password' ? 'Mostrar' : 'Ocultar'; } }, 'Mostrar'))),
      h('div', { class: 'ed-botones' },
        h('button', {
          type: 'button', class: 'btn btn-primario',
          onclick: async (ev) => {
            const nueva = { apiUrl: url.value.trim(), clave: clave.value.trim() };
            store.guardarConfig(nueva);
            if (!nueva.apiUrl || !nueva.clave) { aviso('Configuración guardada (incompleta)', 'alerta'); return; }
            ev.target.disabled = true;
            try {
              await probarConexion(nueva.apiUrl, nueva.clave);
              aviso('¡Conexión exitosa!');
              await sincronizar();
            } catch (err) {
              aviso(err.name === 'TypeError' || err.name === 'AbortError' ? 'No hay conexión con el servidor. Verifique la señal y la URL.' : err.message, 'error');
            } finally {
              ev.target.disabled = false;
              pintarAjustes();
            }
          }
        }, 'Guardar y probar conexión'),
        h('button', {
          type: 'button', class: 'btn',
          onclick: async () => {
            const cfg = store.config();
            if (!cfg.apiUrl || !cfg.clave) { aviso('Primero guarde la URL y la clave', 'alerta'); return; }
            const enlace = `${location.origin}${location.pathname}?api=${encodeURIComponent(cfg.apiUrl)}&clave=${encodeURIComponent(cfg.clave)}`;
            try { await navigator.clipboard.writeText(enlace); aviso('Enlace copiado'); } catch { /* sin portapapeles */ }
            dialogo({
              titulo: 'Enlace de configuración',
              mensaje: h('div', {}, h('p', {}, 'Abra este enlace en otro dispositivo para dejarlo conectado automáticamente. Contiene la clave: compártalo solo con el equipo.'),
                h('textarea', { rows: 4, readonly: true, class: 'mono', value: enlace, onfocus: (e) => e.target.select() }))
            });
          }
        }, 'Enlace para otro dispositivo'))),
    h('section', { class: 'tarjeta' },
      h('h2', {}, 'Sincronización'),
      estado,
      h('div', { class: 'ed-botones' },
        h('button', {
          type: 'button', class: 'btn btn-primario',
          onclick: async () => {
            const ok = await sincronizar();
            aviso(ok ? 'Sincronizado' : (estadoSync().error || 'Sin conexión; se reintentará automáticamente'), ok ? 'ok' : 'alerta');
            pintarAjustes();
          }
        }, 'Sincronizar ahora'),
        h('button', {
          type: 'button', class: 'btn',
          onclick: async () => {
            const n = store.registros().length;
            if (!(await confirmar('Reenviar todo', `Se volverán a enviar las ${n} encuestas de este dispositivo al Sheet (útil si se borraron filas del Sheet por error).`, 'Reenviar'))) return;
            store.marcarTodosPendientes();
            pintarAjustes();
          }
        }, 'Reenviar todas las encuestas'))),
    h('section', { class: 'tarjeta' },
      h('h2', {}, 'Respaldo'),
      h('p', { class: 'sub' }, 'Descargue una copia de las encuestas guardadas en este dispositivo.'),
      h('div', { class: 'ed-botones' },
        h('button', { type: 'button', class: 'btn', onclick: () => descargar(`encuestas-${hoy()}.csv`, aCSV(store.formulario(), store.registros(), fechaCorta), 'text/csv;charset=utf-8') }, 'Descargar Excel (CSV)'),
        h('button', { type: 'button', class: 'btn', onclick: () => descargar(`respaldo-${hoy()}.json`, JSON.stringify({ app: VERSION_APP, fecha: new Date().toISOString(), formulario: store.formulario(), registros: store.registros() }, null, 2), 'application/json') }, 'Descargar respaldo completo (JSON)'),
        h('button', { type: 'button', class: 'btn', onclick: () => archivo.click() }, 'Importar respaldo (JSON)')),
      archivo),
    h('section', { class: 'tarjeta' },
      h('h2', {}, 'Dispositivo'),
      h('p', { class: 'sub', id: 'persistencia' }, ''),
      h('p', { class: 'sub' }, `Versión de la app: ${VERSION_APP}`),
      h('button', {
        type: 'button', class: 'btn btn-peligro',
        onclick: async () => {
          const pend = store.pendientes().length;
          const msg = (pend ? `⚠ Hay ${pend} encuesta(s) que NO se han enviado al Sheet y se perderán.\n\n` : '') +
            'Se borrarán las encuestas y las preguntas guardadas en este dispositivo (el Sheet no se modifica). La conexión se conserva.';
          if (!(await confirmar('Borrar datos del dispositivo', msg, 'Borrar', 'btn-peligro'))) return;
          store.borrarTodo();
          aviso('Datos locales borrados');
          location.hash = '#/';
        }
      }, 'Borrar datos de este dispositivo')));

  pintarAjustes();
  if (navigator.storage && navigator.storage.persisted) {
    navigator.storage.persisted().then((p) => {
      const el = document.getElementById('persistencia');
      if (el) el.textContent = p ? 'Almacenamiento protegido: el navegador no borrará los datos automáticamente.' : 'Consejo: instale la app en la pantalla de inicio para proteger los datos guardados.';
    });
  }
}

function hoy() {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Arranque

bus.addEventListener('sync', pintarEstado);
bus.addEventListener('registros', () => {
  pintarEstado();
  if (repintarLista) repintarLista();
});
bus.addEventListener('formulario', () => {
  pintarEstado();
  if (editorActual) editorActual.recargar(store.formulario());
});
bus.addEventListener('config', pintarEstado);

if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

pintarEstado();
navegar();
iniciarSincronizacionAutomatica();
