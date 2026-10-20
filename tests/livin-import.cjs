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
  'normalizedExcelRows', 'convertLivinSources', 'prepareLivinWorkbookRows', 'mapImportedPerformance', 'livinMetric']) {
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
const auto = context.convertLivinSources({growth_avgbal_rekening_yoy: -173660,
  pct_growth_avgbal_rekening_yoy: -0.749407195176377,
  sv_ytd_qris_statis: 300000000, sv_ytd_qris_dinamis: 93482000});
assert(Math.abs(auto.avgbal_final_year - 22999322.74126234) < 0.01);
assert.equal(auto.sum_sv_ytd_stat_din, 393482000);
assert.equal(auto.balance_source, 'calculated');
assert.equal(auto.sv_source, 'calculated');
const authoritative = context.convertLivinSources({...auto, avgbal_final_year: 0,
  sum_sv_ytd_stat_din: 0});
assert.equal(authoritative.avgbal_final_year, 0);
assert.equal(authoritative.sum_sv_ytd_stat_din, 0);
assert.equal(authoritative.balance_source, 'excel');
assert.equal(context.convertLivinSources({...auto, avgbal_final_year: ''}).avgbal_final_year, null);
assert.equal(context.convertLivinSources({growth_avgbal_rekening_yoy: 10,
  pct_growth_avgbal_rekening_yoy: 0}).avgbal_final_year, null);
assert.equal(context.convertLivinSources({sv_ytd_qris_statis: 100}).sum_sv_ytd_stat_din, null);
assert.equal(context.convertLivinSources({sv_ytd_qris_statis: 0,
  sv_ytd_qris_dinamis: 0}).sum_sv_ytd_stat_din, 0);
const rawWorkbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(rawWorkbook, XLSX.utils.json_to_sheet([{
  store_name: 'Raw report', account_number: 'raw001', kode_cabang_final: '12600',
  growth_avgbal_rekening_yoy: 100, pct_growth_avgbal_rekening_yoy: 10,
  sv_ytd_qris_statis: 600, sv_ytd_qris_dinamis: 400
}]), 'Sheet1');
const rawResult = context.mapImportedPerformance(context.prepareLivinWorkbookRows(rawWorkbook), 'LIVIN');
assert.equal(rawResult.valid[0].avgbal_final_year, 1100);
assert.equal(rawResult.valid[0].sum_sv_ytd_stat_din, 1000);
assert.equal(rawResult.valid[0].balance_source, 'calculated');
console.log('Automatic conversion: template formula, mixed sources, direct precedence, zero and missing prerequisites passed.');
if (process.argv[2]) {
  const actualWorkbook = XLSX.read(fs.readFileSync(process.argv[2]), {type: 'buffer'});
  const actual = context.mapImportedPerformance(context.prepareLivinWorkbookRows(actualWorkbook), 'LIVIN');
  const actualMetrics = actual.valid.map(row => context.livinMetric(row));
  console.log(JSON.stringify({rows: actual.valid.length, rejected: actual.errors.length,
    available: actualMetrics.filter(row => row.implied !== null).length,
    calculatedBalance: actual.valid.filter(row => row.balance_source === 'calculated').length,
    calculatedSv: actual.valid.filter(row => row.sv_source === 'calculated').length,
    achieved: actualMetrics.filter(row => row.ratio !== null && row.ratio >= 0.2).length,
    gap: actualMetrics.reduce((sum, row) => sum + (row.gap || 0), 0)}));
}
