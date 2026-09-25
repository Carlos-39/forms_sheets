// Prueba de extremo a extremo con Playwright contra el servidor de pruebas.
// 1) node tests/servidor-prueba.mjs      2) node tests/e2e.mjs
// Requiere playwright instalado (npm i -D playwright o global).

import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const APP = 'http://localhost:8080/';
const API = 'http://localhost:8081/exec';
const CLAVE = 'CAMBIE-ESTA-CLAVE';
const CAPTURAS = process.env.CAPTURAS || '';

const red = (activa) => fetch(`http://localhost:8081/__red?activa=${activa ? 1 : 0}`);
const hojas = async () => (await fetch('http://localhost:8081/__hojas')).json();
const esperar = async (fn, msg, ms = 15000) => {
  const fin = Date.now() + ms;
  let ultimo;
  while (Date.now() < fin) {
    try { ultimo = await fn(); if (ultimo) return ultimo; } catch (e) { ultimo = e; }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('Tiempo agotado: ' + msg + (ultimo instanceof Error ? ' — ' + ultimo.message : ''));
};
const filas = (h) => (h.Respuestas || []).slice(2).filter((f) => f && f.some((x) => x !== '' && x !== null));
const col = (h, id) => h.Respuestas[0].indexOf(id);

const navegador = await chromium.launch();
const contexto = await navegador.newContext({ viewport: { width: 820, height: 1100 } });
const pagina = await contexto.newPage();
const errores = [];
pagina.on('pageerror', (e) => errores.push(e.message));
pagina.on('console', (m) => { if (m.type() === 'error' && !/Failed to fetch|ERR_INTERNET_DISCONNECTED|net::/.test(m.text())) errores.push(m.text()); });
const foto = async (nombre) => { if (CAPTURAS) await pagina.screenshot({ path: `${CAPTURAS}/${nombre}.png`, fullPage: false }); };

async function responderPaso({ documento, edad, alertaPHQ = false } = {}) {
  // Llena las preguntas visibles del paso activo.
  const sec = pagina.locator('.seccion-form:not([hidden])');
  if (documento && await sec.locator('#q_documento').count()) await sec.locator('#q_documento').fill(documento);
  if (edad && await sec.locator('#q_edad').count()) await sec.locator('#q_edad').fill(String(edad));
  const grupos = sec.locator('.pregunta:not([hidden]) .opciones[role=radiogroup]');
  const n = await grupos.count();
  for (let i = 0; i < n; i++) {
    const g = grupos.nth(i);
    const q = await g.locator('input').first().getAttribute('name');
    const indice = alertaPHQ && q === 'q_phq_9' ? 2 : 1;
    await g.locator('.opcion').nth(indice).click();
  }
}

async function llenarEncuestaCompleta(documento, { alertaPHQ = false } = {}) {
  await pagina.click('a[href="#/nueva"]');
  await pagina.waitForSelector('.seccion-form');
  const pasos = await pagina.locator('.paso').count();
  for (let i = 0; i < pasos; i++) {
    await responderPaso({ documento, edad: 27, alertaPHQ });
    if (await pagina.locator('.seccion-form:not([hidden]) #q_talla').count()) { // talla y peso → IMC automático
      await pagina.fill('#q_talla', '1.6');
      await pagina.fill('#q_peso_1t', '64');
      const imc = await pagina.locator('[data-q=imc_1t] output').textContent();
      assert.match(imc, /25/, 'IMC calculado: ' + imc);
    }
    if (i < pasos - 1) await pagina.click('text=Siguiente →');
  }
  await pagina.click('text=Guardar encuesta');
}

try {
  await fetch('http://localhost:8081/__reiniciar');
  // ---- 1. Conexión por enlace y publicación del formulario en el Sheet
  await pagina.goto(`${APP}?api=${encodeURIComponent(API)}&clave=${CLAVE}`);
  await pagina.waitForSelector('text=Nueva encuesta');
  await esperar(async () => (await pagina.textContent('#estado-sync')).includes('Sincronizado'), 'primera sincronización');
  let h = await hojas();
  assert.ok(h._config && h._config.length, 'formulario guardado en _config');
  assert.ok(col(h, 'documento') > 0 && col(h, 'eep10_puntaje') > 0 && col(h, 'alertas') > 0, 'columnas creadas');
  assert.equal(h.Respuestas[1][col(h, 'estrato')], 'Estrato socioeconómico', 'fila 2 = texto de la pregunta');
  assert.ok(h.Diccionario.length > 50, 'diccionario');
  await esperar(() => pagina.evaluate(() => navigator.serviceWorker.controller !== null || navigator.serviceWorker.ready.then(() => true)), 'service worker');
  console.log('✓ formulario publicado en el Sheet');

  // ---- 2. Encuesta completa con alerta PHQ-9
  await llenarEncuestaCompleta('1144000111', { alertaPHQ: true });
  await pagina.waitForSelector('dialog[open] >> text=Atención');
  await foto('03-alerta');
  await pagina.click('dialog[open] button:text-is("Aceptar")');
  await esperar(async () => filas(await hojas()).length === 1, 'fila en el Sheet');
  h = await hojas();
  let f = filas(h)[0];
  assert.equal(String(f[col(h, 'documento')]), '1144000111');
  assert.equal(f[col(h, 'estado')], 'Completa');
  assert.equal(f[col(h, 'estrato')], '2: Bajo');
  assert.equal(f[col(h, 'eep10_puntaje')], 18, 'EEP-10: 6 ítems directos ×1 + 4 inversos ×3');
  assert.equal(f[col(h, 'eep10_nivel')], 'Estrés moderado');
  assert.equal(f[col(h, 'phq9_puntaje')], 10, 'PHQ-9: 8 ítems ×1 + ítem 9 ×2');
  assert.ok(String(f[col(h, 'alertas')]).includes('PHQ-9'), 'alerta registrada');
  assert.equal(f[col(h, 'imc_1t')], 25);
  console.log('✓ encuesta completa sincronizada (puntajes, IMC y alerta)');
  await foto('04-inicio');

  // ---- 3. Documento repetido bloqueado
  await pagina.click('a[href="#/nueva"]');
  await pagina.fill('#q_documento', '1144000111');
  await pagina.click('text=Guardar encuesta');
  await pagina.waitForSelector('dialog[open] >> text=valor repetido');
  assert.equal(await pagina.locator('dialog[open] button:text-is("Guardar como incompleta")').count(), 0);
  await pagina.click('dialog[open] button:text-is("Revisar")');
  await pagina.click('text=Salir');
  await pagina.click('dialog[open] button:text-is("Descartar cambios")');
  console.log('✓ documento repetido detectado');

  // ---- 4. Sin señal: la app abre, guarda y sincroniza al volver
  await red(false);
  await contexto.setOffline(true);
  await pagina.reload();
  await pagina.waitForSelector('text=Nueva encuesta');
  await pagina.click('a[href="#/nueva"]');
  await pagina.fill('#q_documento', '999888777');
  await pagina.click('text=Guardar encuesta');
  await pagina.click('dialog[open] button:text-is("Guardar como incompleta")');
  await esperar(async () => /Sin señal · 1 pendiente/.test(await pagina.textContent('#estado-sync')), 'indicador sin señal');
  await foto('05-sin-senal');
  assert.equal(filas(await hojas()).length, 1, 'aún no llega al Sheet');
  await red(true);
  await contexto.setOffline(false);
  await pagina.evaluate(() => window.dispatchEvent(new Event('online')));
  await esperar(async () => filas(await hojas()).length === 2, 'sincronización al volver la señal');
  h = await hojas();
  assert.equal(filas(h)[1][col(h, 'estado')], 'Incompleta');
  console.log('✓ modo sin señal y sincronización posterior');

  // ---- 5. Editar una encuesta actualiza la misma fila
  await pagina.click('.registro-principal >> nth=0');
  await pagina.click('.paso >> nth=-1'); // sección Biológico
  await pagina.fill('#q_edad', '32');
  await pagina.click('text=Guardar encuesta');
  await pagina.click('dialog[open] button:text-is("Guardar como incompleta")');
  await esperar(async () => { const x = await hojas(); return filas(x).some((r) => r[col(x, 'edad')] === 32); }, 'edición');
  assert.equal(filas(await hojas()).length, 2, 'no se duplica');
  console.log('✓ edición actualiza la fila existente');

  // ---- 6. Editor: nueva pregunta, cambio de opción y reflejo en el Sheet
  await pagina.click('a[href="#/preguntas"]');
  await pagina.waitForSelector('.ed-seccion');
  await pagina.locator('.ed-seccion').nth(1).locator('.btn-icono').first().click(); // expandir sociodemográficos
  await pagina.locator('.ed-seccion').nth(1).locator('text=+ Agregar pregunta').click();
  await pagina.locator('.ed-pregunta[data-foco] .ed-etiqueta, .ed-pregunta.abierta .ed-etiqueta').last().fill('¿Tiene afiliación a salud?');
  const pregNueva = pagina.locator('.ed-pregunta.abierta').last();
  await pregNueva.locator('.ed-fila:not(.ed-fila-cab) input[type=text]').nth(0).fill('Contributivo');
  await pregNueva.locator('.ed-fila:not(.ed-fila-cab) input[type=text]').nth(2).fill('Subsidiado');
  await pregNueva.locator('text=+ Agregar opción').click();
  await pagina.locator('.ed-fila[data-foco] input').first().fill('Ninguna');
  // cambiar el texto de una opción existente (estado civil → "Unión marital de hecho")
  await pagina.locator('.ed-pregunta', { hasText: 'Estado civil' }).locator('.ed-preg-cab').click();
  const opcionesEC = pagina.locator('.ed-pregunta.abierta', { hasText: 'Estado civil' }).locator('.ed-opciones input[type=text]');
  const valores = await opcionesEC.evaluateAll((els) => els.map((e) => e.value));
  await opcionesEC.nth(valores.indexOf('Unión libre')).fill('Unión marital de hecho');
  await foto('06-editor');
  await pagina.click('text=Guardar cambios');
  await esperar(async () => { const x = await hojas(); return col(x, 'tiene_afiliacion_a_salud') > 0; }, 'columna nueva en el Sheet');
  h = await hojas();
  assert.equal(h.Respuestas[1][col(h, 'tiene_afiliacion_a_salud')], '¿Tiene afiliación a salud?');
  assert.ok(h.Diccionario.some((r) => r[0] === 'estado_civil' && String(r[4]).includes('Unión marital de hecho')));
  console.log('✓ editor: pregunta nueva y opción renombrada reflejadas en el Sheet');

  // ---- 7. La pregunta nueva aparece en el formulario
  await pagina.click('a[href="#/"]');
  await pagina.click('a[href="#/nueva"]');
  await pagina.click('.paso >> nth=1');
  await pagina.waitForSelector('text=¿Tiene afiliación a salud?');
  await pagina.click('text=Salir');
  if (await pagina.locator('dialog[open]').count()) await pagina.click('dialog[open] button:text-is("Descartar cambios")');
  console.log('✓ pregunta nueva visible en el formulario');

  // ---- 7b. Un dispositivo nuevo descarga las preguntas editadas (no las sobrescribe)
  const otro = await navegador.newContext();
  const pagina2 = await otro.newPage();
  await pagina2.goto(`${APP}?api=${encodeURIComponent(API)}&clave=${CLAVE}`);
  await esperar(async () => (await pagina2.textContent('#estado-sync')).includes('Sincronizado'), 'sincronización del segundo dispositivo');
  await pagina2.click('a[href="#/nueva"]');
  await pagina2.click('.paso >> nth=1');
  await pagina2.waitForSelector('text=¿Tiene afiliación a salud?', { timeout: 5000 });
  h = await hojas();
  assert.ok(JSON.stringify(h._config).includes('afiliaci'), 'el Sheet conserva la pregunta editada');
  // Se aceptan menores de edad
  await pagina2.click('.paso >> nth=-1');
  await pagina2.fill('#q_edad', '15');
  await pagina2.click('.paso >> nth=0');
  assert.equal(await pagina2.locator('[data-q=edad] .error-campo').textContent(), '', 'edad 15 válida');
  await otro.close();
  console.log('✓ dispositivo nuevo recibe las preguntas editadas y acepta menores de edad');

  // ---- 8. Eliminar una encuesta la borra del Sheet
  await pagina.locator('.registro', { hasText: '999888777' }).locator('text=Eliminar').click();
  await pagina.click('dialog[open] button:text-is("Eliminar")');
  await esperar(async () => filas(await hojas()).length === 1, 'eliminación en el Sheet');
  console.log('✓ eliminación sincronizada');

  // ---- 9. Vista en celular
  await pagina.setViewportSize({ width: 390, height: 844 });
  await pagina.click('a[href="#/nueva"]');
  await foto('07-movil-formulario');
  const anchoDoc = await pagina.evaluate(() => document.documentElement.scrollWidth);
  assert.ok(anchoDoc <= 390, 'sin desplazamiento horizontal en celular: ' + anchoDoc);
  await pagina.click('text=Salir');

  assert.deepEqual(errores, [], 'errores de consola');
  console.log('\nTODAS LAS PRUEBAS PASARON');
} catch (e) {
  await red(true);
  console.error('✗', e.message);
  if (errores.length) console.error('Errores de consola:', errores);
  if (CAPTURAS) await pagina.screenshot({ path: `${CAPTURAS}/fallo.png`, fullPage: true });
  process.exitCode = 1;
} finally {
  await navegador.close();
}
