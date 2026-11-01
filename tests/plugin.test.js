'use strict';

// Runs the built bundle against a fake `joplin` global: the same file the app loads.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { bundle } = require('../scripts/build.js');

const ROOT = path.resolve(__dirname, '..');

function fakeJoplin(state) {
  const page = (items, query) => {
    const limit = query.limit || 100;
    const start = ((query.page || 1) - 1) * limit;
    return { items: items.slice(start, start + limit), has_more: start + limit < items.length };
  };
  const joplin = {
    plugins: { register(p) { state.registered = p; } },
    settings: {
      async registerSection(name, spec) { state.section = [name, spec]; },
      async registerSettings(spec) { state.settingSpec = spec; },
      async value(key) { return state.settings[key]; },
      async onChange(cb) { state.onSettingsChange = cb; },
    },
    views: {
      panels: {
        async create(id) { state.panelId = id; return 'panel-handle'; },
        async setHtml(_h, html) { state.html.push(html); return html; },
        async addScript(_h, p) { state.scripts.push(p); },
        async onMessage(_h, cb) { state.onMessage = cb; },
        async show(_h, show) { state.visible = show !== false; },
        async visible() { return state.visible; },
      },
      menuItems: { async create(id, command, location) { state.menu = [id, command, location]; } },
    },
    commands: {
      async register(c) { state.commands[c.name] = c; },
      async execute(name, ...args) { state.executed.push([name, ...args]); },
    },
    workspace: {
      async onSyncComplete(cb) { state.onSync = cb; },
      async onNoteSelectionChange(cb) { state.onSelection = cb; },
    },
    data: {
      async get(p, query) {
        state.gets.push(p.join('/'));
        if (p.length === 1 && p[0] === 'tags') return page(state.tags, query);
        throw new Error('unexpected get ' + p.join('/'));
      },
      async post() { throw new Error('the plugin must not write'); },
      async put() { throw new Error('the plugin must not write'); },
      async delete() { throw new Error('the plugin must not write'); },
    },
  };
  return joplin;
}

async function load(state) {
  const joplin = fakeJoplin(state);
  vm.runInNewContext(bundle(ROOT), { joplin, console });
  await state.registered.onStart();
  return joplin;
}

function newState(tags) {
  return {
    tags: tags || [], settings: { tagTreeSeparator: '/' }, html: [], scripts: [], commands: {}, executed: [], gets: [],
    visible: true,
  };
}

const lastHtml = (state) => state.html[state.html.length - 1];

test('on start: a panel with its two files, a View menu command, a separator setting, and the tree', async () => {
  const state = newState([{ id: '1', title: 'project/alpha' }, { id: '2', title: 'inbox' }]);
  await load(state);
  assert.deepStrictEqual(state.scripts, ['./webview.css', './webview.js']);
  assert.deepStrictEqual(state.menu, ['tagTreeToggleMenu', 'tagTree.toggle', 'view']);
  assert.strictEqual(state.settingSpec.tagTreeSeparator.value, '/');
  assert.strictEqual(state.settingSpec.tagTreeSeparator.type, 2);
  assert.match(lastHtml(state), /data-path="project\/alpha"/);
  assert.match(lastHtml(state), /2 tags/);
});

test('reads every page of tags', async () => {
  const tags = [];
  for (let i = 0; i < 250; i++) tags.push({ id: 't' + i, title: 'group/tag' + i });
  const state = newState(tags);
  await load(state);
  assert.strictEqual(state.gets.length, 3);
  assert.match(lastHtml(state), /250 tags/);
});

test('a click on a tag opens it with the openTag command', async () => {
  const state = newState([{ id: 'abc', title: 'x' }]);
  await load(state);
  assert.strictEqual(await state.onMessage({ name: 'open', id: 'abc' }), true);
  assert.deepStrictEqual(state.executed, [['openTag', 'abc']]);
  assert.strictEqual(await state.onMessage({ name: 'open', id: 7 }), null);
  assert.strictEqual(await state.onMessage('junk'), null);
  assert.strictEqual(state.executed.length, 1);
});

test('refresh picks up new tags; a separator change rebuilds with the new one', async () => {
  const state = newState([{ id: '1', title: 'art.music' }]);
  await load(state);
  assert.match(lastHtml(state), /data-path="art\.music"/);
  state.tags.push({ id: '2', title: 'art.painting' });
  await state.onMessage({ name: 'refresh' });
  assert.match(lastHtml(state), /2 tags/);
  state.settings.tagTreeSeparator = '.';
  await state.onSettingsChange({ keys: ['tagTreeSeparator'] });
  assert.match(lastHtml(state), /<details data-path="art">/);
});

test('an empty separator falls back to the slash', async () => {
  const state = newState([{ id: '1', title: 'a/b' }]);
  state.settings.tagTreeSeparator = '';
  await load(state);
  assert.match(lastHtml(state), /<details data-path="a">/);
});

test('the toggle command shows a hidden panel and refreshes it, or hides a visible one', async () => {
  const state = newState([{ id: '1', title: 'a' }]);
  await load(state);
  const before = state.html.length;
  await state.commands['tagTree.toggle'].execute();
  assert.strictEqual(state.visible, false);
  const reads = state.gets.length;
  state.tags.push({ id: '2', title: 'b' });
  await state.commands['tagTree.toggle'].execute();
  assert.strictEqual(state.visible, true);
  assert.strictEqual(state.gets.length, reads + 1);
  assert.strictEqual(state.html.length, before + 1);
});

test('sync and note selection refresh the panel, the latter only when it is visible', async () => {
  const state = newState([{ id: '1', title: 'a' }]);
  await load(state);
  let reads = state.gets.length;
  await state.onSync();
  assert.strictEqual(state.gets.length, ++reads);
  state.visible = false;
  await state.onSelection();
  assert.strictEqual(state.gets.length, reads);
  state.visible = true;
  await state.onSelection();
  assert.strictEqual(state.gets.length, reads + 1);
});

test('an unchanged tag list does not replace the panel, a changed one does', async () => {
  const state = newState([{ id: '1', title: 'a' }]);
  await load(state);
  const n = state.html.length;
  await state.onSync();
  assert.strictEqual(state.html.length, n);
  state.tags.push({ id: '2', title: 'a/b' });
  await state.onSync();
  assert.strictEqual(state.html.length, n + 1);
});

test('the panel script parses', () => {
  const code = fs.readFileSync(path.join(ROOT, 'src', 'webview.js'), 'utf8');
  assert.doesNotThrow(() => new vm.Script(code));
});
