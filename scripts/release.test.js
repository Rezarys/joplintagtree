'use strict';

// Release check: rebuilds publish/ in place, then prints the tree a sample tag list gives.
// Run with `node --test scripts/` before `npm publish`.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { build, untar } = require('./build.js');
const { buildTree } = require('../src/core.js');

test('publish/ holds the current build', () => {
  const { jplPath, jsonPath } = build();
  assert.deepStrictEqual(untar(fs.readFileSync(jplPath)).map((f) => f[0]),
    ['index.js', 'manifest.json', 'webview.js', 'webview.css']);
  assert.ok(fs.existsSync(jsonPath));
  console.log(path.relative(path.resolve(__dirname, '..'), jplPath) + ' ' + fs.statSync(jplPath).size + ' bytes');
});

test('sample tags, as a tree', () => {
  const titles = ['project/alpha', 'project/beta', 'project/beta/review', 'area/home', 'area/work', 'inbox',
    'reading/to read', 'reading/done'];
  const lines = [];
  const walk = (nodes, depth) => {
    for (const n of nodes) {
      lines.push('  '.repeat(depth) + (n.children.length ? '- ' : '  ') + n.label + (n.tags.length ? '' : '  (group)'));
      walk(n.children, depth + 1);
    }
  };
  walk(buildTree(titles.map((title, i) => ({ id: String(i), title })), '/'), 0);
  console.log(lines.join('\n'));
});
