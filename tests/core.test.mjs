import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const c = require('../qa/compiled/core.cjs');
const specimen = (patch = {}) => c.validateSpecimen({ id: 'S-1', project: 'Synthetic QA', date: '2026-10-11', beforeWidth: 10, beforeHeight: 20, beforeUnit: 'cm', afterWidth: 95, afterHeight: 210, afterUnit: 'mm', method: 'Synthetic values; not a physical test', notes: 'Digital fixture only', ...patch });
test('independent axes normalize units and preserve growth', () => {
  const r = c.change(specimen());
  assert.ok(Math.abs(r.widthContractionPercent - 5) < 1e-10);
  assert.ok(Math.abs(r.heightContractionPercent + 5) < 1e-10);
  assert.equal(r.beforeWidthMm, 100);
  assert.equal(r.afterHeightMm, 210);
});
test('inch/cm equivalence gives zero contraction without averaging axes', () => {
  const r = c.change(specimen({ beforeWidth: 1, beforeHeight: 2, beforeUnit: 'in', afterWidth: 2.54, afterHeight: 5.08, afterUnit: 'cm' }));
  assert.ok(Math.abs(r.widthContractionPercent) < 1e-10);
  assert.ok(Math.abs(r.heightContractionPercent) < 1e-10);
});
test('rejects zero, negative, exponent text, boolean, infinite, extreme, missing units and impossible date', () => {
  for (const bad of [0, -1, NaN, Infinity, true, null, {}, '2abc', '1e3', '', 1e12]) assert.throws(() => specimen({ beforeWidth: bad }));
  assert.throws(() => specimen({ afterUnit: 'm' }));
  assert.throws(() => specimen({ date: '2026-02-29' }));
  assert.doesNotThrow(() => specimen({ date: '2024-02-29' }));
});
test('CSV round-trip retains quotes, commas and embedded newlines', () => {
  const original = specimen({ id: 'Q,"1', notes: 'Line 1\nLine 2, "quoted"', project: 'Cotton, sample' });
  assert.deepEqual(c.fromCsv(c.toCsv([original])), [original]);
});
test('spreadsheet formula labels are deliberately neutralized', () => {
  const original = specimen({ id: '=HYPERLINK("bad")', notes: '\t=1+1' });
  const parsed = c.fromCsv(c.toCsv([original]))[0];
  assert.equal(parsed.id, "'=HYPERLINK(\"bad\")");
  assert.equal(parsed.notes, "'\t=1+1");
  assert.equal(parsed.beforeWidth, 10);
});
test('CSV malformed quotes, wrong schema, duplicates and oversized data abort', () => {
  assert.throws(() => c.parseCsv('"unfinished'));
  assert.throws(() => c.parseCsv('"a"bad,b'));
  assert.throws(() => c.fromCsv('id,wrong\n1,2'));
  assert.throws(() => c.fromCsv(c.toCsv([specimen(), specimen()])));
  assert.throws(() => c.parseCsv('a'.repeat(16_000_001)));
  assert.throws(() => c.validateLog({ schemaVersion: 2, specimens: [] }));
});
test('HTML and Markdown hostile labels cannot create raw active markup', () => {
  const s = specimen({ id: '<img src=x onerror=alert(1)>', notes: '[Click](javascript:alert(1))' });
  assert.ok(!c.html(s.id).includes('<img'));
  const report = c.report([s]);
  assert.ok(!report.includes('<img'));
  assert.ok(report.includes('\\[Click\\]'));
});
