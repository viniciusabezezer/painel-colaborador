const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
function server(codes = []) {
  const rows = [['Código', 'Data/Hora', 'Registrado por'], ...codes.map(c => [c])];
  let held = false, flushed = false;
  const sh = { getRange: () => ({ setNumberFormat() {} }), getDataRange: () => ({ getValues: () => rows }), appendRow: row => rows.push(row) };
  const context = vm.createContext({ LockService: { getScriptLock: () => ({ waitLock() { held = true; flushed = false; }, hasLock: () => held, releaseLock() { assert.ok(flushed || rows.length === codes.length + 1); held = false; } }) }, SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: () => sh }), flush() { assert.ok(held); flushed = true; } }, ContentService: { MimeType: { JSON: 'json' }, createTextOutput: text => ({ setMimeType: () => JSON.parse(text) }) } });
  vm.runInContext(fs.readFileSync(path.join(root, 'apps-script-codigos.gs'), 'utf8'), context);
  return { next: date => context.doGet({ parameter: { date } }), rows };
}
test('recupera zeros perdidos e avança no mesmo dia', () => {
  const s = server([6092601]);
  assert.equal(s.next('20260906').code, '06092602');
  assert.equal(s.next('20260906').code, '06092603');
});
test('usa maior sequência apesar de lacunas e duplicatas', () => {
  assert.equal(server(['10092601', '10092601', '10092608']).next('20260910').code, '10092609');
});
test('novo dia inicia sequência com prefixo diferente', () => {
  assert.equal(server(['10092608']).next('20260911').code, '11092601');
});
test('99 não volta a 00 nem a 01', () => {
  const s = server(['10092699']);
  assert.equal(s.next('20260910').success, false);
  assert.equal(s.rows.length, 2);
});
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
function client(fetch) {
  const code = html.slice(html.indexOf('        const CODIGOS_SCRIPT_URL'), html.indexOf('        function openOcorrenciaModal'));
  const context = vm.createContext({ URL, crypto: require('node:crypto').webcrypto, fetch, localStorage: { getItem() { throw Error('contador local não deve ser usado'); } } });
  vm.runInContext(code, context);
  return context;
}
test('requisições distintas e sem cache', async () => {
  const requests = [];
  const c = client(async (url, opts) => { requests.push({ url, opts }); return { ok: true, json: async () => ({ success: true, code: '10092601' }) }; });
  await c.getNextOcorrenciaCode(new Date(2026, 8, 10), 'Teste');
  await c.getNextOcorrenciaCode(new Date(2026, 8, 10), 'Teste');
  assert.notEqual(requests[0].url, requests[1].url);
  assert.equal(requests[0].opts.cache, 'no-store');
});
test('falha central não emite código local', async () => {
  const c = client(async () => { throw Error('offline'); });
  await assert.rejects(c.getNextOcorrenciaCode(new Date(2026, 8, 10), ''), /campos foram preservados/);
});
test('rejeita código de outro dia e limite do servidor', async () => {
  for (const response of [{ success: true, code: '09092601' }, { success: false, error: 'Limite de 99' }]) {
    const c = client(async () => ({ ok: true, json: async () => response }));
    await assert.rejects(c.getNextOcorrenciaCode(new Date(2026, 8, 10), ''));
  }
});
test('scripts HTML têm sintaxe válida', () => {
  for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) new vm.Script(match[1]);
});
