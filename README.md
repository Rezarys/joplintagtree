# Tag Tree for Joplin

Install: in Joplin desktop, open **Tools > Options > Plugins** (macOS: **Joplin > Settings > Plugins**), search for `Tag Tree`, click **Install**, restart.

Shows your tags as a tree in a side panel. The levels come from the tag name: `project/alpha` and `project/beta` sit under `project`. Nothing to migrate, nothing to convert: name your tags with a separator and they fold.

```
- area  (group)
    home
    work
  inbox
- project  (group)
    alpha
  - beta
      review
- reading  (group)
    done
    to read
```

## Use

1. **View > Toggle Tag Tree** shows or hides the panel.
2. Click a tag to list its notes, as in the sidebar. Click the arrow to open or close a branch.
3. Type in the filter box to show only the tags whose path contains the text, with their parents opened.
4. **Refresh** reloads the list. The panel also reloads after a sync, when you select another note while it is open, and when you change the separator.

A level that is not a tag itself (`project` above, when only `project/alpha` exists) is shown as a group: it opens and closes but has no notes of its own.

## Separator

**Tools > Options > Tag Tree > Separator between levels**. Default `/`. Use `.` for names like `art.music`, or `:`. Spaces around the separator are ignored, so `Books / Python` and `Books/Python` land in the same place; if both exist, both stay clickable.

## Read only

The plugin only reads the tag list (`id` and `title`). It never creates, renames, merges or deletes a tag, and never touches a note. No network request, no telemetry, no account.

## Limits

- It is a view. Searching a parent tag does not return the notes of its children, and a note tagged `project/alpha` is not tagged `project`.
- No note counts per tag, on purpose: counting needs one request per tag, which gets slow on large tag lists.
- Desktop only.
- Tested with automated tests against a simulated Joplin plugin API only. It has not been run by hand in the Joplin app yet, and the panel script (open branches, filter) has no automated test in a browser. If something is off, open an issue.

## Manual install

Download `publish/io.github.rezarys.joplintagtree.jpl` from this repository, then in **Tools > Options > Plugins**, use the gear icon, **Install from file**.

## Build and test

```
node --test tests/
node --test scripts/
```

The second command rebuilds `publish/` (the `.jpl` archive and its info file), without any dependency.

## Background

Hierarchical tags are a long standing request: https://github.com/laurent22/joplin/issues/375. This plugin does the display part only, reading the hierarchy from the names, as suggested in https://github.com/laurent22/joplin/issues/375#issuecomment-930487499.

Built with AI assistance, tested with automated tests, not reviewed line by line.

MIT License, Younes Z.
