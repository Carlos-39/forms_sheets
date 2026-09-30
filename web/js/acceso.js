// Pantalla de acceso con clave. Protege los datos guardados en el dispositivo:
// - Se pide la clave al abrir la app y tras 30 minutos sin uso (o al pulsar "Bloquear").
// - Funciona sin señal: compara con la clave ya guardada en el dispositivo.
// - En un dispositivo nuevo, la clave se verifica en línea contra el Apps Script
//   (es la misma CLAVE de Code.gs) y queda configurada.

import { h } from './dom.js';
import { store } from './storage.js';
import { probarConexion, sincronizar } from './sync.js';

const SESION = 'fs.sesion';
const INACTIVIDAD_MS = 30 * 60 * 1000;
const MAX_INTENTOS = 5;
const ESPERA_MS = 30 * 1000;

let intentos = 0;
let esperarHasta = 0;

function leerSesion() {
  try { return Number(sessionStorage.getItem(SESION)) || 0; } catch { return 0; }
}

function tocarSesion() {
  try { sessionStorage.setItem(SESION, String(Date.now())); } catch { /* sin almacenamiento de sesión */ }
}

export function sesionActiva() {
  const t = leerSesion();
  return t > 0 && Date.now() - t < INACTIVIDAD_MS;
}

export function bloquear() {
  try { sessionStorage.removeItem(SESION); } catch { /* nada */ }
  mostrarBloqueo();
}

function desbloquear() {
  intentos = 0;
  tocarSesion();
  document.getElementById('bloqueo')?.remove();
  document.body.classList.remove('sin-scroll');
}

function sinConexion(err) {
  return err && (err.name === 'TypeError' || err.name === 'AbortError');
}

export function mostrarBloqueo() {
  if (document.getElementById('bloqueo')) return;
  document.querySelectorAll('dialog[open]').forEach((d) => d.close());

  const cfg = store.config();
  const pedirUrl = !cfg.apiUrl;
  const url = h('input', { type: 'url', placeholder: 'https://script.google.com/macros/s/…/exec', value: cfg.apiUrl, spellcheck: 'false' });
  const clave = h('input', { type: 'password', autocomplete: 'current-password', placeholder: 'Clave de acceso', 'aria-label': 'Clave de acceso' });
  const mensaje = h('p', { class: 'error-campo', role: 'alert' });
  const boton = h('button', { type: 'submit', class: 'btn btn-primario btn-grande' }, 'Entrar');

  async function entrar(e) {
    e.preventDefault();
    const valor = clave.value.trim();
    const api = (url.value || '').trim();
    mensaje.textContent = '';
    if (Date.now() < esperarHasta) {
      mensaje.textContent = `Demasiados intentos. Espere ${Math.ceil((esperarHasta - Date.now()) / 1000)} segundos.`;
      return;
    }
    if (!valor) { mensaje.textContent = 'Escriba la clave.'; return; }
    if (pedirUrl && !api) { mensaje.textContent = 'Falta la dirección de conexión (URL del Apps Script).'; return; }

    const actual = store.config();
    if (actual.clave && valor === actual.clave) { desbloquear(); return; }

    // Dispositivo sin clave guardada, o la clave cambió en el Apps Script: se verifica en línea.
    boton.disabled = true;
    mensaje.textContent = 'Verificando…';
    try {
      await probarConexion(api || actual.apiUrl, valor);
      store.guardarConfig({ apiUrl: api || actual.apiUrl, clave: valor });
      desbloquear();
      sincronizar();
    } catch (err) {
      if (sinConexion(err) && !actual.clave) {
        mensaje.textContent = 'La primera vez en este dispositivo se necesita internet para verificar la clave.';
      } else {
        intentos++;
        if (intentos >= MAX_INTENTOS) {
          esperarHasta = Date.now() + ESPERA_MS;
          intentos = 0;
        }
        mensaje.textContent = 'Clave incorrecta.';
      }
    } finally {
      boton.disabled = false;
      clave.select();
    }
  }

  const capa = h('div', { id: 'bloqueo', class: 'bloqueo' },
    h('form', { class: 'bloqueo-caja', onsubmit: entrar },
      h('div', { class: 'bloqueo-icono', 'aria-hidden': 'true' }, '🔒'),
      h('h1', {}, store.formulario().titulo || 'Encuestas'),
      h('p', { class: 'sub' }, 'Acceso restringido al equipo investigador.'),
      pedirUrl ? h('label', { class: 'campo' }, h('span', { class: 'campo-etiqueta' }, 'Dirección de conexión (URL del Apps Script)'), url) : null,
      h('label', { class: 'campo' }, h('span', { class: 'campo-etiqueta' }, 'Clave'), clave),
      mensaje,
      boton));
  document.body.append(capa);
  document.body.classList.add('sin-scroll');
  setTimeout(() => (pedirUrl ? url : clave).focus(), 50);
}

/** Pide la clave al iniciar si no hay sesión y bloquea tras 30 minutos sin uso. */
export function iniciarAcceso() {
  if (!sesionActiva()) mostrarBloqueo();
  const actividad = () => { if (!document.getElementById('bloqueo')) tocarSesion(); };
  ['pointerdown', 'keydown'].forEach((ev) => document.addEventListener(ev, actividad, { passive: true }));
  const revisar = () => { if (!document.getElementById('bloqueo') && !sesionActiva()) bloquear(); };
  setInterval(revisar, 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) revisar(); });
}
