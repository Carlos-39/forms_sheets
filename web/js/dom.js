// Utilidades mínimas de DOM, diálogos y avisos.

export function h(tag, attrs, ...hijos) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v;
    else if (k === 'checked' || k === 'selected' || k === 'disabled' || k === 'hidden') el[k] = !!v;
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  agregar(el, hijos);
  return el;
}

function agregar(el, hijos) {
  for (const hijo of hijos) {
    if (hijo === null || hijo === undefined || hijo === false) continue;
    if (Array.isArray(hijo)) agregar(el, hijo);
    else el.append(hijo instanceof Node ? hijo : document.createTextNode(String(hijo)));
  }
}

export function limpiar(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

/** Vacía el elemento y le agrega los hijos (ignora null/false). */
export function rellenar(el, ...hijos) {
  limpiar(el);
  agregar(el, hijos);
  return el;
}

/** Diálogo modal. botones: [{texto, valor, clase}] → Promise con el valor elegido. */
export function dialogo({ titulo, mensaje, botones = [{ texto: 'Aceptar', valor: true, clase: 'btn-primario' }] }) {
  return new Promise((resolver) => {
    const dlg = h('dialog', { class: 'dialogo' },
      h('h3', {}, titulo),
      typeof mensaje === 'string' ? h('p', { class: 'pre' }, mensaje) : mensaje,
      h('div', { class: 'dialogo-botones' },
        botones.map((b) => h('button', {
          type: 'button',
          class: 'btn ' + (b.clase || ''),
          onclick: () => { dlg.close(); resolver(b.valor); }
        }, b.texto))
      )
    );
    dlg.addEventListener('cancel', () => resolver(undefined));
    dlg.addEventListener('close', () => setTimeout(() => dlg.remove(), 0));
    document.body.append(dlg);
    dlg.showModal();
  });
}

export function confirmar(titulo, mensaje, textoSi = 'Sí', claseSi = 'btn-primario') {
  return dialogo({
    titulo, mensaje,
    botones: [{ texto: 'Cancelar', valor: false }, { texto: textoSi, valor: true, clase: claseSi }]
  }).then((v) => v === true);
}

export function aviso(texto, tipo = 'ok') {
  let zona = document.getElementById('avisos');
  if (!zona) {
    zona = h('div', { id: 'avisos' });
    document.body.append(zona);
  }
  const el = h('div', { class: 'aviso aviso-' + tipo }, texto);
  zona.append(el);
  setTimeout(() => el.classList.add('saliendo'), 2800);
  setTimeout(() => el.remove(), 3300);
}

export function descargar(nombre, contenido, tipo) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = h('a', { href: url, download: nombre });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function uid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export function fechaCorta(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
