'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { splitTitle, buildTree, countTags, renderPanel, escapeHtml } = require('../src/core.js');

const shape = (nodes) => nodes.map((n) => [n.label, n.tags.map((t) => t.id), shape(n.children)]);

test('splitTitle trims parts and drops empty ones', () => {
  assert.deepStrictEqual(splitTitle('Books / Programming / Python', '/'), ['Books', 'Programming', 'Python']);
  assert.deepStrictEqual(splitTitle('a//b/', '/'), ['a', 'b']);
  assert.deepStrictEqual(splitTitle('art.music', '.'), ['art', 'music']);
  assert.deepStrictEqual(splitTitle('/', '/'), ['/']);
});

test('a tag with a slash sits under its parent, parents without a tag become groups', () => {
  const tree = buildTree([
    { id: '1', title: 'project/alpha' },
    { id: '2', title: 'project/beta' },
    { id: '3', title: 'inbox' },
    { id: '4', title: 'area/home/garden' },
  ], '/');
  assert.deepStrictEqual(shape(tree), [
    ['area', [], [['home', [], [['garden', ['4'], []]]]]],
    ['inbox', ['3'], []],
    ['project', [], [['alpha', ['1'], []], ['beta', ['2'], []]]],
  ]);
  assert.strictEqual(tree[2].children[0].path, 'project/alpha');
  assert.strictEqual(countTags(tree), 4);
});

test('a real tag can also have children', () => {
  const tree = buildTree([{ id: 'p', title: 'project' }, { id: 'a', title: 'project/alpha' }], '/');
  assert.deepStrictEqual(shape(tree), [['project', ['p'], [['alpha', ['a'], []]]]]);
});

test('the separator is a setting: with "." the slash is plain text', () => {
  const tags = [{ id: '1', title: 'art.music' }, { id: '2', title: 'art.painting' }, { id: '3', title: 'a/b' }];
  assert.deepStrictEqual(shape(buildTree(tags, '.')), [
    ['a/b', ['3'], []],
    ['art', [], [['music', ['1'], []], ['painting', ['2'], []]]],
  ]);
});

test('sorting ignores case, and two names folding to one place keep both tags', () => {
  const tree = buildTree([
    { id: '1', title: 'b' }, { id: '2', title: 'A' }, { id: '3', title: 'a/x' }, { id: '4', title: 'a / x' },
  ], '/');
  assert.deepStrictEqual(tree.map((n) => n.label), ['A', 'a', 'b']);
  const x = tree[1].children[0];
  assert.deepStrictEqual(x.tags.map((t) => t.id), ['3', '4']);
});

test('items without a title are skipped', () => {
  assert.deepStrictEqual(buildTree([null, { id: '1' }, { id: '2', title: 'ok' }], '/').map((n) => n.label), ['ok']);
});

test('the panel escapes tag names and links each tag by id', () => {
  const html = renderPanel(buildTree([{ id: 'x1', title: '<b>&"/q\'' }], '/'));
  assert.ok(!html.includes('<b>'));
  assert.ok(html.includes(escapeHtml('<b>&"')));
  assert.match(html, /data-tag-id="x1"/);
  assert.match(html, /1 tag</);
});

test('the panel nests groups in details elements and says when there are no tags', () => {
  const html = renderPanel(buildTree([{ id: '1', title: 'project/alpha' }], '/'));
  assert.match(html, /<details data-path="project"><summary><span class="tt-label tt-group">project<\/span><\/summary>/);
  assert.match(html, /<li class="tt-node tt-leaf" data-path="project\/alpha"><a href="#" class="tt-label tt-tag" data-tag-id="1"/);
  assert.match(renderPanel([]), /No tags yet\./);
});

test('five thousand tags build in well under a second', () => {
  const tags = [];
  for (let i = 0; i < 5000; i++) tags.push({ id: 't' + i, title: 'g' + (i % 50) + '/s' + (i % 7) + '/tag' + i });
  const start = Date.now();
  const html = renderPanel(buildTree(tags, '/'));
  assert.ok(Date.now() - start < 1000);
  assert.match(html, /5000 tags/);
});
