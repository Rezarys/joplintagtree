// Joplin entry point. Built after src/core.js into one file, so buildTree and renderPanel are in scope.
// `joplin` is the global the app gives every plugin. Read only: the plugin calls joplin.data.get and nothing else.

const SECTION = 'tagTree';
const SETTING_SEPARATOR = 'tagTreeSeparator';
const SETTING_STRING = 2;
const MENU_VIEW = 'view';

async function allTags() {
  const tags = [];
  for (let page = 1; ; page++) {
    const res = await joplin.data.get(['tags'], { fields: ['id', 'title'], page, limit: 100 });
    tags.push(...res.items);
    if (!res.has_more) return tags;
  }
}

async function separator() {
  const value = await joplin.settings.value(SETTING_SEPARATOR);
  return typeof value === 'string' && value.length ? value : '/';
}

joplin.plugins.register({
  onStart: async function () {
    await joplin.settings.registerSection(SECTION, {
      label: 'Tag Tree',
      iconName: 'fas fa-tags',
    });
    await joplin.settings.registerSettings({
      [SETTING_SEPARATOR]: {
        value: '/',
        type: SETTING_STRING,
        section: SECTION,
        public: true,
        label: 'Separator between levels',
        description: 'A tag named "project/alpha" shows under "project". Use "." for names like "art.music".',
      },
    });

    const panel = await joplin.views.panels.create('tagTreePanel');
    await joplin.views.panels.setHtml(panel, '<div class="tt-root"><div class="tt-count">Loading tags...</div></div>');
    await joplin.views.panels.addScript(panel, './webview.css');
    await joplin.views.panels.addScript(panel, './webview.js');

    let pending = null;
    let lastHtml = '';
    const refresh = async () => {
      if (pending) return pending;
      pending = (async () => {
        try {
          // Unchanged list, unchanged panel: replacing it would lose the scroll position.
          const html = renderPanel(buildTree(await allTags(), await separator()));
          if (html === lastHtml) return;
          lastHtml = html;
          await joplin.views.panels.setHtml(panel, html);
        } finally {
          pending = null;
        }
      })();
      return pending;
    };

    await joplin.views.panels.onMessage(panel, async (message) => {
      if (!message || typeof message !== 'object') return null;
      if (message.name === 'open' && typeof message.id === 'string') {
        await joplin.commands.execute('openTag', message.id);
        return true;
      }
      if (message.name === 'refresh') {
        await refresh();
        return true;
      }
      return null;
    });

    await joplin.commands.register({
      name: 'tagTree.toggle',
      label: 'Toggle Tag Tree',
      iconName: 'fas fa-tags',
      execute: async () => {
        const visible = await joplin.views.panels.visible(panel);
        await joplin.views.panels.show(panel, !visible);
        if (!visible) await refresh();
      },
    });
    await joplin.views.menuItems.create('tagTreeToggleMenu', 'tagTree.toggle', MENU_VIEW);

    await joplin.settings.onChange(async (event) => {
      if (event && Array.isArray(event.keys) && event.keys.includes(SETTING_SEPARATOR)) await refresh();
    });
    if (joplin.workspace && joplin.workspace.onSyncComplete) {
      await joplin.workspace.onSyncComplete(() => refresh());
    }
    if (joplin.workspace && joplin.workspace.onNoteSelectionChange) {
      // Tags are often added to the note just left: a cheap moment to pick them up.
      await joplin.workspace.onNoteSelectionChange(async () => {
        if (await joplin.views.panels.visible(panel)) await refresh();
      });
    }

    await refresh();
  },
});
