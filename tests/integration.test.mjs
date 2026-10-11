import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const source = await readFile(new URL('../dist/index.js', import.meta.url), 'utf8');
async function harness() {
  const commands = new Map(), settings = new Map(), dialogQueue = [], messages = [], notes = [], html = [];
  let registration, clipboard = '', folder = { id: 'synthetic-folder' }, openNote;
  const api = {
    plugins: { register(p) { registration = p; } },
    settings: { async registerSettings(s) { for (const [k, v] of Object.entries(s)) if (!settings.has(k)) settings.set(k, v.value); }, async value(k) { return settings.get(k); }, async setValue(k, v) { settings.set(k, v); } },
    views: { dialogs: { async create() { return 'synthetic-dialog'; }, async setFitToContent() {}, async setHtml(_, v) { html.push(v); }, async setButtons() {}, async open() { return dialogQueue.shift() ?? { id: 'cancel' }; }, async showMessageBox(v) { messages.push(v); return 0; } }, menuItems: { async create() {} } },
    commands: { async register(c) { commands.set(c.name, c); }, async execute(c, id) { if (c === 'openNote') openNote = id; } },
    workspace: { async selectedFolder() { return folder; } },
    data: { async post(_, __, v) { const n = { ...v, id: `note-${notes.length}` }; notes.push(n); return n; } },
    clipboard: { async writeText(v) { clipboard = v; } },
  };
  vm.runInNewContext(source, { joplin: api, module: { exports: {} }, exports: {}, console }, { timeout: 2000 });
  await registration.onStart();
  return { commands, settings, dialogQueue, messages, notes, html, api, clipboard: () => clipboard, openNote: () => openNote, restart: () => registration.onStart(), setFolder: v => { folder = v; }, run: id => commands.get(`sewloreFabric_${id}`).execute() };
}
const input = { id: 'QA-1', project: 'Synthetic fixture', date: '2026-10-11', beforeWidth: '100', beforeHeight: '200', beforeUnit: 'mm', afterWidth: '9.5', afterHeight: '21', afterUnit: 'cm', method: 'Synthetic only', notes: '<script>not rendered</script>' };
test('built Joplin bundle registers 6 commands and persists only confirmed entries', async () => {
  const h = await harness();
  assert.equal(h.commands.size, 6);
  h.dialogQueue.push({ id: 'ok', formData: { specimen: input } }, { id: 'cancel' });
  await h.run('add');
  assert.equal(JSON.parse(h.settings.get('fabricSpecimenLog')).specimens.length, 0);
  h.dialogQueue.push({ id: 'ok', formData: { specimen: input } }, { id: 'ok' });
  await h.run('add');
  assert.equal(JSON.parse(h.settings.get('fabricSpecimenLog')).specimens.length, 1);
  assert.ok(h.html.some(s => s.includes('5%') && s.includes('-5%')));
  assert.ok(!h.html.some(s => s.includes('<script>not rendered')));
  await h.run('export');
  assert.match(h.clipboard(), /beforeWidth/);
  await h.run('summary');
  assert.equal(h.notes.length, 1);
  assert.equal(h.notes[0].parent_id, 'synthetic-folder');
  assert.equal(h.openNote(), 'note-0');
  assert.ok(!h.notes[0].body.includes('sewlore.com'));
});
test('invalid input, duplicate IDs and malformed persisted data never overwrite saved log', async () => {
  const h = await harness();
  h.dialogQueue.push({ id: 'ok', formData: { specimen: { ...input, beforeWidth: '0' } } });
  await h.run('add');
  assert.equal(JSON.parse(h.settings.get('fabricSpecimenLog')).specimens.length, 0);
  h.dialogQueue.push({ id: 'ok', formData: { specimen: input } }, { id: 'ok' });
  await h.run('add');
  const stored = h.settings.get('fabricSpecimenLog');
  h.dialogQueue.push({ id: 'ok', formData: { specimen: input } });
  await h.run('add');
  assert.equal(h.settings.get('fabricSpecimenLog'), stored);
  await h.run('export');
  h.dialogQueue.push({ id: 'ok', formData: { import: { csv: h.clipboard() } } });
  await h.run('import');
  assert.equal(h.settings.get('fabricSpecimenLog'), stored);
  h.settings.set('fabricSpecimenLog', 'broken-json');
  await h.run('view');
  assert.equal(h.settings.get('fabricSpecimenLog'), 'broken-json');
  assert.ok(h.messages.length >= 4);
});
test('built bundle import, reload and confirmed removal preserve unrelated notes', async () => {
  const h = await harness();
  h.dialogQueue.push({ id: 'ok', formData: { specimen: input } }, { id: 'ok' });
  await h.run('add');
  await h.run('export');
  const exported = h.clipboard().replace('"QA-1"', '"QA-2"');
  h.dialogQueue.push({ id: 'ok', formData: { import: { csv: exported } } });
  await h.run('import');
  assert.equal(JSON.parse(h.settings.get('fabricSpecimenLog')).specimens.length, 2);
  await h.restart();
  assert.equal(JSON.parse(h.settings.get('fabricSpecimenLog')).specimens.length, 2);
  h.dialogQueue.push({ id: 'ok', formData: { remove: { id: 'QA-1' } } });
  await h.run('remove');
  assert.deepEqual(JSON.parse(h.settings.get('fabricSpecimenLog')).specimens.map(s => s.id), ['QA-2']);
  assert.equal(h.notes.length, 0);
});
