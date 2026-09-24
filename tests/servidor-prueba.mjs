// Servidor de pruebas local:
//  - http://localhost:8080      sirve la app (carpeta web/)
//  - http://localhost:8081/exec emula la aplicación web de Apps Script ejecutando apps-script/Code.gs
//    contra un Google Sheet falso en memoria. GET /__hojas devuelve el contenido de las hojas
//    y GET /__reiniciar las borra.
// Uso: node tests/servidor-prueba.mjs   (la clave es la de Code.gs)

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUERTO_APP = Number(process.env.PUERTO_APP || 8080);
const PUERTO_API = Number(process.env.PUERTO_API || 8081);

// ---- Google Sheets falso -------------------------------------------------
class Rango {
  constructor(hoja, fila, col, nf = 1, nc = 1) {
    if (fila < 1 || col < 1 || nf < 1 || nc < 1) throw new Error(`Rango inválido ${fila},${col},${nf},${nc}`);
    Object.assign(this, { hoja, fila, col, nf, nc });
    const proxy = new Proxy(this, { get: (t, k) => (k in t ? t[k] : () => proxy) }); // formato: no-op
    return proxy;
  }
  getValues() {
    return Array.from({ length: this.nf }, (_, i) => Array.from({ length: this.nc }, (_, j) => this.hoja.celda(this.fila + i, this.col + j)));
  }
  setValues(v) {
    if (v.length !== this.nf || v.some((f) => f.length !== this.nc)) throw new Error('Dimensiones no coinciden');
    v.forEach((f, i) => f.forEach((x, j) => this.hoja.fijar(this.fila + i, this.col + j, x)));
    return this;
  }
  setValue(x) { this.hoja.fijar(this.fila, this.col, x); return this; }
}

class Hoja {
  constructor(nombre) { this.nombre = nombre; this.datos = []; this.maxCols = 26; this.oculta = false; }
  celda(f, c) { return (this.datos[f - 1] && this.datos[f - 1][c - 1] !== undefined) ? this.datos[f - 1][c - 1] : ''; }
  fijar(f, c, v) {
    if (c > this.maxCols) throw new Error(`Columna ${c} fuera de la hoja (${this.maxCols})`);
    while (this.datos.length < f) this.datos.push([]);
    this.datos[f - 1][c - 1] = v instanceof Date ? v.toISOString() : v;
  }
  getName() { return this.nombre; }
  getLastRow() { for (let i = this.datos.length; i > 0; i--) if ((this.datos[i - 1] || []).some((x) => x !== '' && x !== undefined)) return i; return 0; }
  getLastColumn() { let m = 0; for (const f of this.datos) for (let j = (f || []).length; j > m; j--) if (f[j - 1] !== '' && f[j - 1] !== undefined) { m = j; break; } return m; }
  getMaxColumns() { return this.maxCols; }
  insertColumnsAfter(_, n) { this.maxCols += n; }
  getRange(f, c, nf, nc) { return new Rango(this, f, c, nf, nc); }
  appendRow(fila) { const f = this.getLastRow() + 1; if (fila.length > this.maxCols) this.maxCols = fila.length; fila.forEach((v, j) => this.fijar(f, j + 1, v)); }
  deleteRow(f) { this.datos.splice(f - 1, 1); }
  setFrozenRows() {}
  hideSheet() { this.oculta = true; }
  clear() { this.datos = []; }
}

const libro = { hojas: [] };
const ss = {
  getSheetByName: (n) => libro.hojas.find((h) => h.nombre === n) || null,
  insertSheet: (n, pos) => { const h = new Hoja(n); pos === 0 ? libro.hojas.unshift(h) : libro.hojas.push(h); return h; }
};
const contexto = vm.createContext({
  SpreadsheetApp: { getActiveSpreadsheet: () => ss },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  ContentService: {
    MimeType: { JSON: 'json' },
    createTextOutput: (texto) => ({ texto, setMimeType() { return this; } })
  },
  JSON, Object, Math, String, Number, Date
});
vm.runInContext(fs.readFileSync(path.join(raiz, 'apps-script/Code.gs'), 'utf8'), contexto);

// ---- Servidores -----------------------------------------------------------
// GET /__red?activa=0 simula que se cae la señal: ambos servidores cortan las conexiones.
let sinRed = false;
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png' };

http.createServer((req, res) => {
  if (sinRed) { req.socket.destroy(); return; }
  const url = new URL(req.url, 'http://x');
  let archivo = path.join(raiz, 'web', decodeURIComponent(url.pathname));
  if (!archivo.startsWith(path.join(raiz, 'web'))) { res.writeHead(403).end(); return; }
  if (fs.existsSync(archivo) && fs.statSync(archivo).isDirectory()) archivo = path.join(archivo, 'index.html');
  if (!fs.existsSync(archivo)) { res.writeHead(404).end('no encontrado'); return; }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(archivo)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(archivo).pipe(res);
}).listen(PUERTO_APP, () => console.log(`App: http://localhost:${PUERTO_APP}/`));

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const cabeceras = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  if (url.pathname === '/__red') {
    sinRed = url.searchParams.get('activa') === '0';
    res.writeHead(200, cabeceras).end(JSON.stringify({ sinRed }));
    return;
  }
  if (url.pathname === '/__reiniciar') {
    libro.hojas = [];
    sinRed = false;
    res.writeHead(200, cabeceras).end('{"ok":true}');
    return;
  }
  if (url.pathname === '/__hojas') {
    res.writeHead(200, cabeceras).end(JSON.stringify(Object.fromEntries(libro.hojas.map((h) => [h.nombre, h.datos]))));
    return;
  }
  if (sinRed) { req.socket.destroy(); return; }
  if (url.pathname !== '/exec') { res.writeHead(404).end(); return; }
  if (req.method === 'OPTIONS') { res.writeHead(405).end(); return; } // Apps Script no admite preflight
  let cuerpo = '';
  req.on('data', (c) => { cuerpo += c; });
  req.on('end', () => {
    try {
      const salida = req.method === 'POST'
        ? contexto.doPost({ postData: { contents: cuerpo } })
        : contexto.doGet({ parameter: Object.fromEntries(url.searchParams) });
      res.writeHead(200, cabeceras).end(salida.texto);
    } catch (e) {
      res.writeHead(500, cabeceras).end(JSON.stringify({ ok: false, error: String(e) }));
    }
  });
}).listen(PUERTO_API, () => console.log(`API simulada: http://localhost:${PUERTO_API}/exec`));
