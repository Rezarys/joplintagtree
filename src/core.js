'use strict';

// Pure part of the plugin: turns the flat tag list of Joplin into a tree, and the tree into HTML.
// No access to Joplin here, so it runs under node --test as is.

const SEPARATORS = ['/', '.', ':', '\\'];

function splitTitle(title, separator) {
  const parts = String(title).split(separator).map((s) => s.trim()).filter((s) => s.length);
  return parts.length ? parts : [String(title).trim() || String(title)];
}

function compareLabels(a, b) {
  const x = a.label.toLocaleLowerCase();
  const y = b.label.toLocaleLowerCase();
  if (x < y) return -1;
  if (x > y) return 1;
  return a.label < b.label ? -1 : a.label > b.label ? 1 : 0;
}

function sortTree(nodes) {
  nodes.sort(compareLabels);
  for (const node of nodes) sortTree(node.children);
  return nodes;
}

// tags: [{ id, title }]. Returns the root nodes: { label, path, tags: [{ id, title }], children }.
// A node with no tag is a group that exists only because a longer name starts with it.
function buildTree(tags, separator) {
  const sep = separator || '/';
  const root = { children: [], index: new Map() };
  for (const tag of tags) {
    if (!tag || typeof tag.title !== 'string') continue;
    let parent = root;
    const path = [];
    for (const part of splitTitle(tag.title, sep)) {
      path.push(part);
      let node = parent.index.get(part);
      if (!node) {
        node = { label: part, path: path.join(sep), tags: [], children: [], index: new Map() };
        parent.index.set(part, node);
        parent.children.push(node);
      }
      parent = node;
    }
    parent.tags.push({ id: tag.id, title: tag.title });
  }
  const strip = (nodes) => nodes.map((n) => ({ label: n.label, path: n.path, tags: n.tags, children: strip(n.children) }));
  return sortTree(strip(root.children));
}

function countTags(nodes) {
  let n = 0;
  for (const node of nodes) n += node.tags.length + countTags(node.children);
  return n;
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function renderLabel(node) {
  if (!node.tags.length) return '<span class="tt-label tt-group">' + escapeHtml(node.label) + '</span>';
  const first = node.tags[0];
  let html = '<a href="#" class="tt-label tt-tag" data-tag-id="' + escapeHtml(first.id) + '" title="'
    + escapeHtml(first.title) + '">' + escapeHtml(node.label) + '</a>';
  // Two tags can fold to the same place ("a/b" and "a / b"): each one stays reachable.
  for (const other of node.tags.slice(1)) {
    html += ' <a href="#" class="tt-label tt-tag tt-alias" data-tag-id="' + escapeHtml(other.id) + '" title="'
      + escapeHtml(other.title) + '">(' + escapeHtml(other.title) + ')</a>';
  }
  return html;
}

function renderNodes(nodes) {
  let html = '<ul class="tt-list">';
  for (const node of nodes) {
    const path = escapeHtml(node.path);
    if (node.children.length) {
      html += '<li class="tt-node" data-path="' + path + '"><details data-path="' + path + '"><summary>'
        + renderLabel(node) + '</summary>' + renderNodes(node.children) + '</details></li>';
    } else {
      html += '<li class="tt-node tt-leaf" data-path="' + path + '">' + renderLabel(node) + '</li>';
    }
  }
  return html + '</ul>';
}

function renderPanel(nodes) {
  const total = countTags(nodes);
  const body = total
    ? renderNodes(nodes)
    : '<p class="tt-empty">No tags yet.</p>';
  return '<div class="tt-root">'
    + '<div class="tt-bar"><input type="search" class="tt-filter" placeholder="Filter tags" aria-label="Filter tags">'
    + '<button type="button" class="tt-refresh" title="Reload the tag list">Refresh</button></div>'
    + '<div class="tt-count">' + total + (total === 1 ? ' tag' : ' tags') + '</div>'
    + '<div class="tt-tree">' + body + '</div></div>';
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SEPARATORS, splitTitle, buildTree, countTags, escapeHtml, renderNodes, renderPanel };
}
