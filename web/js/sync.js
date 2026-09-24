// Sincronización con Google Sheets (vía Apps Script). Todo se guarda primero en el
// dispositivo; este módulo envía lo pendiente cuando hay conexión y reintenta solo.

import { store, bus } from './storage.js';
import { columnas, aplanar, diccionario } from './calc.js';
import { fechaCorta } from './dom.js';

const LOTE = 20;
const INTERVALO_MS = 60 * 1000;

class ErrorServidor extends Error {}

const estado = { enLinea: navigator.onLine, sincronizando: false, error: null };
let enCurso = null;

export function estadoSync() { return estado; }

function actualizar(cambios) {
  Object.assign(estado, cambios);
  bus.dispatchEvent(new Event('sync'));
}

async function pedir(url, opciones) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 45000);
  let res;
  try {
    res = await fetch(url, { ...opciones, redirect: 'follow', signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
  if (!res.ok) throw new ErrorServidor(`El servidor respondió ${res.status}. Revise la URL del Apps Script.`);
  let datos;
  try {
    datos = await res.json();
  } catch {
    throw new ErrorServidor('Respuesta inválida. Revise la URL del Apps Script y que esté publicado para "Cualquier persona".');
  }
  if (!datos.ok) throw new ErrorServidor(datos.error || 'Error del servidor');
  return datos;
}

function post(accion, datos = {}) {
  const { apiUrl, clave } = store.config();
  return pedir(apiUrl, {
    method: 'POST',
    // text/plain evita la verificación CORS previa, que Apps Script no admite.
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ accion, clave, ...datos })
  });
}

function get(accion) {
  const { apiUrl, clave } = store.config();
  const sep = apiUrl.includes('?') ? '&' : '?';
  return pedir(`${apiUrl}${sep}accion=${encodeURIComponent(accion)}&clave=${encodeURIComponent(clave)}`, { method: 'GET' });
}

async function enviarFormulario(f) {
  await post('formulario', { formulario: f, columnas: columnas(f), diccionario: diccionario(f) });
  store.marcarFormularioSincronizado(f.version);
}

async function sincronizarFormulario() {
  const local = store.formulario();
  const { formulario: remoto } = await get('formulario');
  if (store.formularioPendiente()) {
    // Si otro dispositivo guardó una versión más nueva, la nuestra pasa a ser la siguiente.
    if (remoto && (remoto.version || 0) >= (local.version || 0)) {
      local.version = (remoto.version || 0) + 1;
      store.guardarFormulario(local);
    }
    await enviarFormulario(local);
  } else if (!remoto) {
    await enviarFormulario(local);
  } else if ((remoto.version || 0) > (local.version || 0)) {
    store.guardarFormulario(remoto, { pendiente: false });
  }
}

async function enviarEliminaciones() {
  const borrados = store.pendientes().filter((r) => r.eliminado);
  if (!borrados.length) return;
  await post('eliminar', { ids: borrados.map((r) => r.id) });
  store.actualizarSync(borrados.map((r) => ({ id: r.id, borrar: true })));
}

async function enviarRegistros() {
  const pendientes = store.pendientes().filter((r) => !r.eliminado);
  const form = store.formulario();
  const cols = columnas(form);
  for (let i = 0; i < pendientes.length; i += LOTE) {
    const lote = pendientes.slice(i, i + LOTE);
    const res = await post('registros', {
      columnas: cols,
      registros: lote.map((r) => ({ id: r.id, fila: aplanar(form, r, fechaCorta) }))
    });
    const ok = new Set((res.resultados || []).filter((x) => x.ok).map((x) => x.id));
    store.actualizarSync(lote.filter((r) => ok.has(r.id)).map((r) => ({
      id: r.id,
      actualizado: r.actualizado,
      datos: { sync: 'sincronizado', sincronizadoAlgunaVez: true }
    })));
  }
}

/** Sincroniza todo lo pendiente. Si ya hay una sincronización en curso, espera esa. */
export function sincronizar() {
  if (enCurso) return enCurso;
  if (!store.configurado()) {
    actualizar({ error: null });
    return Promise.resolve(false);
  }
  actualizar({ sincronizando: true });
  enCurso = (async () => {
    try {
      await sincronizarFormulario();
      await enviarEliminaciones();
      await enviarRegistros();
      store.marcarSync();
      actualizar({ enLinea: true, error: null });
      return true;
    } catch (e) {
      if (e instanceof ErrorServidor) actualizar({ enLinea: true, error: e.message });
      else actualizar({ enLinea: false, error: null }); // sin señal: se reintentará
      return false;
    } finally {
      enCurso = null;
      actualizar({ sincronizando: false });
    }
  })();
  return enCurso;
}

export async function probarConexion(apiUrl, clave) {
  const sep = apiUrl.includes('?') ? '&' : '?';
  await pedir(`${apiUrl}${sep}accion=ping&clave=${encodeURIComponent(clave)}`, { method: 'GET' });
}

export function iniciarSincronizacionAutomatica() {
  window.addEventListener('online', () => { actualizar({ enLinea: true }); sincronizar(); });
  window.addEventListener('offline', () => actualizar({ enLinea: false }));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) sincronizar(); });
  const siHayPendientes = () => {
    if (store.pendientes().length || store.formularioPendiente()) setTimeout(sincronizar, 300);
  };
  bus.addEventListener('registros', siHayPendientes);
  bus.addEventListener('formulario', siHayPendientes);
  setInterval(siHayPendientes, INTERVALO_MS);
  sincronizar();
}
