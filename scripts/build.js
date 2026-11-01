'use strict';

// Builds publish/<id>.jpl and publish/<id>.json the way the official plugin generator does,
// without webpack: the plugin has no dependency, so index.js is src/core.js then src/plugin.js,
// and the panel files are copied as they are. The .jpl is a plain tar; the .json is the manifest
// plus the sha256 of the .jpl.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const MTIME = Math.floor(Date.UTC(2026, 10, 1) / 1000);
const PANEL_FILES = ['webview.js', 'webview.css'];

function octal(value, width) {
  return value.toString(8).padStart(width - 1, '0') + '\0';
}

function tarHeader(name, size) {
  const h = Buffer.alloc(512, 0);
  h.write(name, 0, 100, 'utf8');
  h.write(octal(0o644, 8), 100, 8, 'ascii');
  h.write(octal(0, 8), 108, 8, 'ascii');
  h.write(octal(0, 8), 116, 8, 'ascii');
  h.write(octal(size, 12), 124, 12, 'ascii');
  h.write(octal(MTIME, 12), 136, 12, 'ascii');
  h.write('        ', 148, 8, 'ascii');
  h.write('0', 156, 1, 'ascii');
  h.write('ustar\0', 257, 6, 'ascii');
  h.write('00', 263, 2, 'ascii');
  let sum = 0;
  for (const byte of h) sum += byte;
  h.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'ascii');
  return h;
}

function tar(files) {
  const parts = [];
  for (const [name, content] of files) {
    const data = Buffer.from(content);
    parts.push(tarHeader(name, data.length), data);
    const pad = (512 - (data.length % 512)) % 512;
    if (pad) parts.push(Buffer.alloc(pad, 0));
  }
  parts.push(Buffer.alloc(1024, 0));
  return Buffer.concat(parts);
}

function untar(buffer) {
  const files = [];
  let offset = 0;
  while (offset + 512 <= buffer.length) {
    const header = buffer.subarray(offset, offset + 512);
    if (header.every((b) => b === 0)) break;
    const name = header.subarray(0, 100).toString('utf8').replace(/\0.*$/s, '');
    const size = parseInt(header.subarray(124, 136).toString('ascii').replace(/\0.*$/s, ''), 8);
    const data = buffer.subarray(offset + 512, offset + 512 + size);
    files.push([name, data.toString('utf8')]);
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  return files;
}

function bundle(root) {
  const core = fs.readFileSync(path.join(root, 'src', 'core.js'), 'utf8');
  const plugin = fs.readFileSync(path.join(root, 'src', 'plugin.js'), 'utf8');
  return '(function () {\n' + core + '\n' + plugin + '\n})();\n';
}

function build(root = ROOT, outDir = path.join(root, 'publish')) {
  const manifestText = fs.readFileSync(path.join(root, 'src', 'manifest.json'), 'utf8');
  const manifest = JSON.parse(manifestText);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  if (pkg.version !== manifest.version) {
    throw new Error('package.json version ' + pkg.version + ' differs from manifest version ' + manifest.version);
  }
  const files = [['index.js', bundle(root)], ['manifest.json', manifestText]];
  for (const name of PANEL_FILES) files.push([name, fs.readFileSync(path.join(root, 'src', name), 'utf8')]);
  const archive = tar(files);
  fs.mkdirSync(outDir, { recursive: true });
  for (const f of fs.readdirSync(outDir)) fs.unlinkSync(path.join(outDir, f));
  const jplPath = path.join(outDir, manifest.id + '.jpl');
  fs.writeFileSync(jplPath, archive);
  const info = { ...manifest, _publish_hash: 'sha256:' + crypto.createHash('sha256').update(archive).digest('hex'), _publish_commit: '' };
  const jsonPath = path.join(outDir, manifest.id + '.json');
  fs.writeFileSync(jsonPath, JSON.stringify(info, null, '\t'), 'utf8');
  return { jplPath, jsonPath, manifest };
}

module.exports = { build, tar, untar, bundle, PANEL_FILES };

if (require.main === module) {
  const out = build();
  console.log(out.jplPath);
  console.log(out.jsonPath);
}
