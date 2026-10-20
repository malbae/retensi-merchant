const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const XLSX = require('../xlsx.full.min.js');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
  if (match[1].trim()) new vm.Script(match[1]);
}
function sourceFunction(name) {
  const start = html.indexOf('function ' + name + '(');
  assert(start >= 0, name + ' must exist');
  const tail = html.slice(start);
  const next = tail.slice(10).search(/\n(?:async )?function /);
  return next < 0 ? tail : tail.slice(0, next + 10);
}
const context = { XLSX, TARGET_FINAL: 0.2, N: value => Number(value) || 0 };
vm.createContext(context);
for (const name of ['normalizeImportHeader', 'importValue', 'importNumber',
  'nullableImportNumber', 'importBranchCode', 'filterFalatehanRows',
  'normalizedExcelRows', 'prepareLivinWorkbookRows', 'mapImportedPerformance', 'livinMetric']) {
  vm.runInContext(sourceFunction(name), context);
}
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([
  { store_name: 'Wrong sheet', kode_cabang_final: '12600', sv_ytd: 999999 }
]), 'Sheet1');
XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([
  { store_name: 'Merchant A', account_number: '001', kode_cabang_final: '12600',
    'avgbal final year': 22999322.74126234, 'SUM SV YTD STAT DIN': 393482000,
    sv_ytd: 1, growth_avgbal_rekening_yoy: 999999, pct_growth_avgbal_rekening_yoy: 1 },
  { store_name: 'Other branch', account_number: '002', kode_cabang_final: '12601',
    'avgbal final year': 100, 'SUM SV YTD STAT DIN': 100 },
  { store_name: 'Zero balance', account_number: '003', kode_cabang_final: '12600',
    'avgbal final year': 0, 'SUM SV YTD STAT DIN': 100 },
  { store_name: 'Missing balance', account_number: '004', kode_cabang_final: '12600',
    'avgbal final year': '', 'SUM SV YTD STAT DIN': 100 },
  { store_name: 'Missing SV', account_number: '005', kode_cabang_final: '12600',
    'avgbal final year': 50, 'SUM SV YTD STAT DIN': '' },
  { store_name: 'Zero SV', account_number: '006', kode_cabang_final: '12600',
    'avgbal final year': 50, 'SUM SV YTD STAT DIN': 0 }
]), 'Falatehan');
const prepared = context.prepareLivinWorkbookRows(workbook);
const result = context.mapImportedPerformance(prepared, 'LIVIN');
assert.equal(result.valid.length, 5);
assert.equal(result.errors.length, 0);
assert(result.valid.every(row => row.source_sheet === 'Falatehan'));
const metrics = result.valid.map(row => context.livinMetric(row));
assert.equal(metrics[0].sv, 393482000);
assert(Math.abs(metrics[0].implied - 22999322.74126234) < 0.01);
assert(Math.abs(metrics[0].gap - 55697077.25873766) < 0.01);
assert.equal(metrics[1].gap, 20);
assert.equal(metrics[2].gap, null);
assert.equal(metrics[3].sv, null);
assert.equal(metrics[3].gap, null);
assert.equal(metrics[4].ratio, null);
assert.equal(metrics[4].gap, 0);
for (const value of ['', null, undefined, '#DIV/0!', '#N/A', 'invalid', -1]) {
  assert.equal(context.nullableImportNumber(value), null);
}
assert.equal(context.nullableImportNumber(0), 0);
assert.equal(context.nullableImportNumber('1.250.000,50'), 1250000.5);
assert.equal(context.livinMetric({ imported_avbal: 1000, sv_ytd: 100,
  growth_avgbal_rekening_yoy: 10, pct_growth_avgbal_rekening_yoy: 1 }).implied, null);
assert.throws(() => context.prepareLivinWorkbookRows({ SheetNames: ['Sheet1'],
  Sheets: { Sheet1: workbook.Sheets.Sheet1 } }), /Wajib ada kolom/);
console.log('Livin import: direct sources, sheet selection, branch, missing/zero, legacy and formula tests passed.');
