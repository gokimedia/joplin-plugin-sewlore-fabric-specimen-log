export type Unit = 'mm' | 'cm' | 'in';
export interface Specimen {
  id: string; project: string; date: string; beforeWidth: number; beforeHeight: number;
  beforeUnit: Unit; afterWidth: number; afterHeight: number; afterUnit: Unit;
  method: string; notes: string;
}
export interface Log { schemaVersion: 1; specimens: Specimen[] }
export const HEADERS = ['id', 'project', 'date', 'beforeWidth', 'beforeHeight', 'beforeUnit', 'afterWidth', 'afterHeight', 'afterUnit', 'method', 'notes'] as const;
export function text(value: unknown, label: string, max = 5000): string {
  if (typeof value !== 'string' || value.length > max || value.includes('\0')) throw new Error(`${label} must be text of at most ${max} characters.`);
  return value;
}
export function positive(value: unknown, label: string): number {
  if (typeof value !== 'number' && typeof value !== 'string') throw new Error(`${label} must be a positive decimal number.`);
  if (typeof value === 'string' && !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim())) throw new Error(`${label} must be a positive decimal number.`);
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0 || n > 1e9 || n < 1e-9) throw new Error(`${label} must be between 0.000000001 and 1000000000.`);
  return n;
}
export function unit(value: unknown): Unit {
  if (value !== 'mm' && value !== 'cm' && value !== 'in') throw new Error('Unit must be mm, cm, or in.');
  return value;
}
export function toMm(value: number, from: Unit): number { return value * (from === 'cm' ? 10 : from === 'in' ? 25.4 : 1); }
export function validateSpecimen(value: unknown): Specimen {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('A specimen must be an object.');
  const v = value as Record<string, unknown>;
  const id = text(v.id, 'Specimen ID', 100).trim();
  if (!id) throw new Error('Specimen ID is required.');
  const date = text(v.date, 'Date', 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(date).toISOString().slice(0, 10) !== date) throw new Error('Date must be a valid YYYY-MM-DD date.');
  return { id, project: text(v.project, 'Project', 200), date,
    beforeWidth: positive(v.beforeWidth, 'Before width'), beforeHeight: positive(v.beforeHeight, 'Before height'), beforeUnit: unit(v.beforeUnit),
    afterWidth: positive(v.afterWidth, 'After width'), afterHeight: positive(v.afterHeight, 'After height'), afterUnit: unit(v.afterUnit),
    method: text(v.method, 'Method', 1000), notes: text(v.notes, 'Notes') };
}
export function change(s: Specimen) {
  const w0 = toMm(s.beforeWidth, s.beforeUnit), h0 = toMm(s.beforeHeight, s.beforeUnit);
  const w1 = toMm(s.afterWidth, s.afterUnit), h1 = toMm(s.afterHeight, s.afterUnit);
  return { beforeWidthMm: w0, beforeHeightMm: h0, afterWidthMm: w1, afterHeightMm: h1,
    widthContractionPercent: (1 - w1 / w0) * 100, heightContractionPercent: (1 - h1 / h0) * 100 };
}
export function validateLog(value: unknown): Log {
  if (!value || typeof value !== 'object') throw new Error('Invalid saved log.');
  const v = value as Record<string, unknown>;
  if (v.schemaVersion !== 1 || !Array.isArray(v.specimens) || v.specimens.length > 1000) throw new Error('Unsupported or oversized saved log.');
  const specimens = v.specimens.map(validateSpecimen);
  if (new Set(specimens.map(s => s.id)).size !== specimens.length) throw new Error('Duplicate specimen IDs.');
  return { schemaVersion: 1, specimens };
}
// Same spreadsheet formula defence used by the MIT Sewlore sewing-math package.
export function csvCell(value: unknown): string {
  let s = String(value ?? '');
  if (typeof value !== 'number' && (/^[\s]*[=+\-@]/.test(s) || /^[\t\r\n]/.test(s))) s = `'${s}`;
  return `"${s.replaceAll('"', '""')}"`;
}
export function toCsv(records: Specimen[]): string {
  return [HEADERS.map(csvCell).join(','), ...records.map(r => HEADERS.map(h => csvCell(r[h])).join(','))].join('\r\n');
}
export function parseCsv(input: string): string[][] {
  if (input.length > 16_000_000) throw new Error('CSV exceeds 16 MB text limit.');
  const rows: string[][] = [], row: string[] = [];
  let cell = '', quoted = false, ended = false;
  const pushCell = () => { row.push(cell); cell = ''; ended = false; };
  const pushRow = () => { pushCell(); if (row.some(c => c !== '')) rows.push(row.splice(0)); else row.length = 0; };
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (quoted) { if (c === '"' && input[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') { quoted = false; ended = true; } else cell += c; }
    else if (c === '"') { if (cell || ended) throw new Error('Unexpected quote in CSV.'); quoted = true; }
    else if (c === ',') pushCell();
    else if (c === '\r' || c === '\n') { if (c === '\r' && input[i + 1] === '\n') i++; pushRow(); }
    else { if (ended) throw new Error('Unexpected text after a quoted CSV field.'); cell += c; }
  }
  if (quoted) throw new Error('Unclosed CSV quoted field.');
  if (cell || row.length || ended) pushRow();
  return rows;
}
export function fromCsv(input: string): Specimen[] {
  const rows = parseCsv(input.replace(/^\uFEFF/, ''));
  if (!rows.length || rows[0].join(',') !== HEADERS.join(',')) throw new Error(`Use this exact CSV header: ${HEADERS.join(',')}`);
  const records = rows.slice(1).map((row, i) => {
    if (row.length !== HEADERS.length) throw new Error(`CSV row ${i + 2} has the wrong number of fields.`);
    const obj: Record<string, unknown> = {};
    HEADERS.forEach((h, j) => { obj[h] = row[j]; });
    return validateSpecimen(obj);
  });
  return validateLog({ schemaVersion: 1, specimens: records }).specimens;
}
export function html(value: unknown): string { return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;'); }
export function md(value: unknown): string { return String(value).replaceAll('\\', '\\\\').replaceAll('|', '\\|').replaceAll('\r', '').replaceAll('\n', '<br>').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('[', '\\[').replaceAll(']', '\\]'); }
export function format(n: number): string { return n === 0 ? '0' : Math.abs(n) < 0.0001 ? n.toExponential(4) : Number(n.toFixed(4)).toString(); }
export function report(records: Specimen[]): string {
  const lines = ['# Fabric specimen log', '', 'Contraction = (before − after) ÷ before × 100. Negative values indicate growth. Each axis is calculated separately. These entries describe user-supplied measurements, not certified fabric performance.', '', '| ID | Project | Date | Before | After | Width contraction | Height contraction |', '| --- | --- | --- | --- | --- | --- | --- |'];
  for (const s of records) { const c = change(s); lines.push(`| ${md(s.id)} | ${md(s.project)} | ${s.date} | ${s.beforeWidth} × ${s.beforeHeight} ${s.beforeUnit} | ${s.afterWidth} × ${s.afterHeight} ${s.afterUnit} | ${format(c.widthContractionPercent)}% | ${format(c.heightContractionPercent)}% |`); }
  for (const s of records) lines.push('', `## ${md(s.id)}`, '', `Method: ${md(s.method) || 'Not recorded'}`, '', `Notes: ${md(s.notes) || 'None'}`);
  return lines.join('\n');
}
