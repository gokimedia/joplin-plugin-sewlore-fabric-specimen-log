import joplin from 'api';
import { MenuItemLocation, SettingItemType } from 'api/types';
import { change, format, fromCsv, html, Log, report, toCsv, validateLog, validateSpecimen } from './core';

const KEY = 'fabricSpecimenLog';
const STYLE = '<style>body{font:14px system-ui;max-width:850px}label{display:block;margin:12px 0}input,select,textarea{display:block;width:100%;box-sizing:border-box;padding:6px}textarea{min-height:65px}table{border-collapse:collapse;width:100%}th,td{padding:7px;border:1px solid #888;text-align:left}small{display:block;margin:8px 0}fieldset{display:inline-block;width:43%;vertical-align:top;margin:8px}</style>';
let dialog: string;
let busy = false;
async function load(): Promise<Log> { return validateLog(JSON.parse(await joplin.settings.value(KEY))); }
async function save(log: Log) { await joplin.settings.setValue(KEY, JSON.stringify(validateLog(log))); }
async function run(task: () => Promise<void>) {
  if (busy) return;
  busy = true;
  try { await task(); } catch (e) { await joplin.views.dialogs.showMessageBox(e instanceof Error ? e.message : String(e)); } finally { busy = false; }
}
async function open(markup: string, buttons: { id: string; title: string }[]) {
  await joplin.views.dialogs.setHtml(dialog, STYLE + markup);
  await joplin.views.dialogs.setButtons(dialog, buttons);
  return joplin.views.dialogs.open(dialog);
}
const units = '<option value="mm">mm</option><option value="cm">cm</option><option value="in">in</option>';
async function add() {
  const log = await load();
  if (log.specimens.length >= 1000) throw new Error('Log limit is 1000 specimens. Export and remove old entries before adding more.');
  const result = await open(`<h2>Record a fabric specimen</h2><small>Enter actual readings. Width and height must follow the same marked axes before and after washing. Each pair can use a different unit.</small><form name="specimen"><label>Specimen ID<input name="id" required maxlength="100"></label><label>Project<input name="project" maxlength="200"></label><label>Measurement date<input name="date" type="date" value="${new Date().toISOString().slice(0, 10)}" required></label><fieldset><legend>Before washing</legend><label>Width<input name="beforeWidth" type="number" step="any" min="0.000000001" required></label><label>Height<input name="beforeHeight" type="number" step="any" min="0.000000001" required></label><label>Unit<select name="beforeUnit">${units}</select></label></fieldset><fieldset><legend>After washing</legend><label>Width<input name="afterWidth" type="number" step="any" min="0.000000001" required></label><label>Height<input name="afterHeight" type="number" step="any" min="0.000000001" required></label><label>Unit<select name="afterUnit">${units}</select></label></fieldset><label>Method / wash conditions<textarea name="method" maxlength="1000"></textarea></label><label>Project notes<textarea name="notes" maxlength="5000"></textarea></label></form>`, [{ id: 'ok', title: 'Review measurements' }, { id: 'cancel', title: 'Cancel' }]);
  if (result.id !== 'ok') return;
  const specimen = validateSpecimen(result.formData?.specimen);
  if (log.specimens.some(s => s.id === specimen.id)) throw new Error('That specimen ID already exists. Use a unique ID or remove the old entry first.');
  const c = change(specimen);
  const confirmed = await open(`<h2>Review ${html(specimen.id)}</h2><p>Before: ${specimen.beforeWidth} × ${specimen.beforeHeight} ${specimen.beforeUnit}<br>After: ${specimen.afterWidth} × ${specimen.afterHeight} ${specimen.afterUnit}</p><p>Width contraction: <strong>${format(c.widthContractionPercent)}%</strong><br>Height contraction: <strong>${format(c.heightContractionPercent)}%</strong></p><p>Positive = smaller; negative = growth. No average is applied.</p><p>Method: ${html(specimen.method)}</p><p>Notes: ${html(specimen.notes)}</p>`, [{ id: 'ok', title: 'Save locally' }, { id: 'cancel', title: 'Cancel' }]);
  if (confirmed.id === 'ok') { log.specimens.push(specimen); await save(log); }
}
async function view() {
  const log = await load();
  const rows = log.specimens.map(s => { const c = change(s); return `<tr><td>${html(s.id)}</td><td>${html(s.project)}</td><td>${s.date}</td><td>${format(c.widthContractionPercent)}%</td><td>${format(c.heightContractionPercent)}%</td></tr>`; }).join('');
  await open(`<h2>Fabric specimen log</h2><p>${log.specimens.length} saved specimens. Positive contraction means smaller; negative means growth.</p><table><thead><tr><th>ID</th><th>Project</th><th>Date</th><th>Width contraction</th><th>Height contraction</th></tr></thead><tbody>${rows}</tbody></table><small>Use the Create summary note command to read method and project notes. Export CSV regularly as a backup.</small>`, [{ id: 'ok', title: 'Close' }]);
}
async function exportCsv() {
  const log = await load();
  await joplin.clipboard.writeText(toCsv(log.specimens));
  await joplin.views.dialogs.showMessageBox(`Copied ${log.specimens.length} specimens as CSV. Paste into a UTF-8 .csv file to keep a backup. Spreadsheet-risk text has an apostrophe prefix; numeric readings are unchanged.`);
}
async function importCsv() {
  const result = await open('<h2>Import fabric specimens</h2><p>Paste CSV exported by this plugin. Imports append entries; duplicate IDs cancel the entire import. No existing entry is overwritten.</p><form name="import"><label>CSV<textarea name="csv" style="height:300px"></textarea></label></form>', [{ id: 'ok', title: 'Validate CSV' }, { id: 'cancel', title: 'Cancel' }]);
  if (result.id !== 'ok') return;
  const records = fromCsv(String(result.formData?.import?.csv ?? ''));
  if (!records.length) throw new Error('The CSV contains no specimens.');
  const log = await load();
  const combined = validateLog({ schemaVersion: 1, specimens: [...log.specimens, ...records] });
  const confirmed = await joplin.views.dialogs.showMessageBox(`Append ${records.length} specimens to the local log? This creates ${combined.specimens.length} entries.`);
  if (confirmed === 0) await save(combined);
}
async function summary() {
  const log = await load();
  if (!log.specimens.length) throw new Error('Add a specimen first.');
  const folder = await joplin.workspace.selectedFolder();
  if (!folder?.id) throw new Error('Select a notebook first.');
  const created = await joplin.data.post(['notes'], null, { parent_id: folder.id, title: `Fabric specimen summary ${new Date().toISOString().slice(0, 10)}`, body: report(log.specimens) });
  await joplin.commands.execute('openNote', created.id);
}
async function remove() {
  const log = await load();
  if (!log.specimens.length) throw new Error('The log is empty.');
  const options = log.specimens.map(s => `<option value="${html(s.id)}">${html(s.id)} — ${html(s.project)}</option>`).join('');
  const result = await open(`<h2>Remove one specimen</h2><p>Export a CSV backup before removing measurements.</p><form name="remove"><label>Specimen<select name="id">${options}</select></label></form>`, [{ id: 'ok', title: 'Review removal' }, { id: 'cancel', title: 'Cancel' }]);
  if (result.id !== 'ok') return;
  const id = String(result.formData?.remove?.id ?? '');
  if (!log.specimens.some(s => s.id === id)) throw new Error('No matching specimen.');
  if (await joplin.views.dialogs.showMessageBox(`Permanently remove specimen ${id} from this plugin's local log? Existing summary notes are unaffected.`) === 0) await save({ schemaVersion: 1, specimens: log.specimens.filter(s => s.id !== id) });
}
joplin.plugins.register({ onStart: async () => {
  await joplin.settings.registerSettings({ [KEY]: { value: '{"schemaVersion":1,"specimens":[]}', type: SettingItemType.String, public: false, label: 'Fabric specimen data' } });
  dialog = await joplin.views.dialogs.create('sewloreFabricSpecimenDialog');
  await joplin.views.dialogs.setFitToContent(dialog, false);
  const commands = [ ['add', 'Record fabric specimen', add], ['view', 'View fabric specimen log', view], ['export', 'Export fabric specimens to CSV clipboard', exportCsv], ['import', 'Import fabric specimens from CSV', importCsv], ['summary', 'Create fabric specimen summary note', summary], ['remove', 'Remove fabric specimen', remove] ] as const;
  for (const [id, label, fn] of commands) {
    const name = `sewloreFabric_${id}`;
    await joplin.commands.register({ name, label, execute: async () => run(fn) });
    await joplin.views.menuItems.create(name, name, MenuItemLocation.Tools);
  }
} });
