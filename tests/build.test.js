'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { build, untar } = require('../scripts/build.js');

const ROOT = path.resolve(__dirname, '..');

test('build writes a .jpl tar with the panel files, and its info file, like the official generator', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'jpl-'));
  const { jplPath, jsonPath, manifest } = build(ROOT, out);
  assert.strictEqual(path.basename(jplPath), 'io.github.rezarys.joplintagtree.jpl');
  const archive = fs.readFileSync(jplPath);
  const files = untar(archive);
  assert.deepStrictEqual(files.map((f) => f[0]), ['index.js', 'manifest.json', 'webview.js', 'webview.css']);
  assert.deepStrictEqual(JSON.parse(files[1][1]), manifest);
  assert.strictEqual(files[2][1], fs.readFileSync(path.join(ROOT, 'src', 'webview.js'), 'utf8'));
  const info = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  assert.strictEqual(info._publish_hash, 'sha256:' + crypto.createHash('sha256').update(archive).digest('hex'));
  assert.strictEqual(info.id, manifest.id);
});

test('manifest passes the plugin repository checks', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'manifest.json'), 'utf8'));
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.ok(manifest.id.length >= 16 && /^[0-9a-zA-Z._-]+$/.test(manifest.id));
  assert.match(manifest.id, /^[0-9a-zA-Z].*[0-9a-zA-Z]$/);
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  assert.strictEqual(manifest.version, pkg.version);
  assert.ok(pkg.name.startsWith('joplin-plugin-'));
  assert.ok(pkg.keywords.includes('joplin-plugin'));
  assert.ok(pkg.files.includes('publish'));
  assert.strictEqual(manifest._recommended, undefined);
  assert.strictEqual(manifest.fundingUrl, undefined);
  const allowed = ['appearance', 'developer tools', 'editor', 'files', 'integrations', 'personal knowledge management',
    'productivity', 'search', 'tags', 'themes', 'viewer'];
  assert.ok(manifest.categories.every((c) => allowed.includes(c)));
});

test('the bundle never writes to the data API', () => {
  const code = fs.readFileSync(path.join(ROOT, 'src', 'plugin.js'), 'utf8');
  assert.ok(!/joplin\.data\.(post|put|delete)/.test(code));
  assert.ok(!/fetch\(|XMLHttpRequest|require\(/.test(code + fs.readFileSync(path.join(ROOT, 'src', 'webview.js'), 'utf8')));
});
