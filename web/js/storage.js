// Almacenamiento local (funciona sin internet). Todo vive en localStorage del dispositivo.

import { formularioBase } from './formulario-base.js';

const K = {
  config: 'fs.config',
  formulario: 'fs.formulario',
  formularioPendiente: 'fs.formularioPendiente',
  registros: 'fs.registros',
  borrador: 'fs.borrador',
  ultimaSync: 'fs.ultimaSync'
};

export const bus = new EventTarget();
const emitir = (tipo) => bus.dispatchEvent(new Event(tipo));

function leer(k, defecto) {
  try {
    const v = localStorage.getItem(k);
    return v === null ? defecto : JSON.parse(v);
  } catch {
    return defecto;
  }
}

function escribir(k, v) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch (e) {
    alert('No se pudo guardar en el dispositivo (almacenamiento lleno o bloqueado). Descargue un respaldo desde Ajustes.');
    throw e;
  }
}

export const store = {
  // Conexión con Google Sheets
  config() {
    const def = window.FS_CONFIG || {};
    const c = leer(K.config, {});
    return { apiUrl: c.apiUrl || def.apiUrl || '', clave: c.clave || def.clave || '' };
  },
  guardarConfig(c) { escribir(K.config, c); emitir('config'); },
  configurado() { const c = this.config(); return !!(c.apiUrl && c.clave); },

  // Formulario (preguntas)
  formulario() {
    let f = leer(K.formulario, null);
    if (!f) {
      // Versión 0 y sin cambios pendientes: si el Sheet ya tiene preguntas (por ejemplo,
      // editadas desde otro dispositivo), se descargan esas en vez de sobrescribirlas.
      f = { ...formularioBase(), version: 0 };
      escribir(K.formulario, f);
      escribir(K.formularioPendiente, false);
    }
    return f;
  },
  guardarFormulario(f, { pendiente = true } = {}) {
    escribir(K.formulario, f);
    escribir(K.formularioPendiente, pendiente);
    emitir('formulario');
  },
  formularioPendiente() { return leer(K.formularioPendiente, false); },
  marcarFormularioSincronizado(version) {
    const f = this.formulario();
    if (f.version === version) escribir(K.formularioPendiente, false);
    emitir('registros');
  },

  // Registros (encuestas)
  registrosMapa() { return leer(K.registros, {}); },
  registros() {
    return Object.values(this.registrosMapa()).filter((r) => !r.eliminado)
      .sort((a, b) => (b.creado || '').localeCompare(a.creado || ''));
  },
  registro(id) { return this.registrosMapa()[id] || null; },
  guardarRegistro(r) {
    const m = this.registrosMapa();
    m[r.id] = r;
    escribir(K.registros, m);
    emitir('registros');
  },
  eliminarRegistro(id) {
    const m = this.registrosMapa();
    const r = m[id];
    if (!r) return;
    if (r.sincronizadoAlgunaVez) {
      m[id] = { ...r, eliminado: true, sync: 'pendiente' }; // se borra del Sheet al sincronizar
    } else {
      delete m[id];
    }
    escribir(K.registros, m);
    emitir('registros');
  },
  /** Aplica cambios de estado de sincronización sin pisar ediciones hechas mientras tanto. */
  actualizarSync(cambios) {
    const m = this.registrosMapa();
    for (const c of cambios) {
      const r = m[c.id];
      if (!r) continue;
      if (c.borrar) { if (r.eliminado) delete m[c.id]; continue; }
      if (r.actualizado !== c.actualizado) continue; // se editó durante el envío: queda pendiente
      Object.assign(r, c.datos);
    }
    escribir(K.registros, m);
    emitir('registros');
  },
  pendientes() {
    return Object.values(this.registrosMapa()).filter((r) => r.sync !== 'sincronizado');
  },
  marcarTodosPendientes() {
    const m = this.registrosMapa();
    for (const r of Object.values(m)) r.sync = 'pendiente';
    escribir(K.registros, m);
    emitir('registros');
  },
  importarRegistros(lista) {
    const m = this.registrosMapa();
    let n = 0;
    for (const r of lista) {
      if (!r || !r.id) continue;
      const actual = m[r.id];
      if (!actual || (r.actualizado || '') > (actual.actualizado || '')) {
        m[r.id] = { ...r, sync: 'pendiente' };
        n++;
      }
    }
    escribir(K.registros, m);
    emitir('registros');
    return n;
  },

  // Encuesta en curso (se recupera si se cierra la app)
  borrador() { return leer(K.borrador, null); },
  guardarBorrador(b) { escribir(K.borrador, b); },
  descartarBorrador() { localStorage.removeItem(K.borrador); emitir('registros'); },

  ultimaSync() { return leer(K.ultimaSync, null); },
  marcarSync() { escribir(K.ultimaSync, new Date().toISOString()); },

  borrarTodo() {
    Object.values(K).filter((k) => k !== K.config).forEach((k) => localStorage.removeItem(k));
    emitir('registros');
    emitir('formulario');
  }
};
