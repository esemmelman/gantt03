# Gantt03

A compact four-level Gantt chart based on the supplied reference. Data is saved in the existing **bnaimitzvah** Supabase project, in isolated `gantt03_nodes` and `gantt03_settings` tables.

## Run

```sh
npm ci
npm run dev
```

`npm run build` creates the static application in `dist/`. `npm run preview` serves that build.

## Use

- Right-click a node (or Shift+F10): **Add parent, Add child, Edit, Delete**. Level four has only **Edit, Delete**.
- Add parent wraps a node and its branch. A wrapper that would exceed four levels is rejected atomically. The database also rejects cycles and fifth-level inserts.
- Add root creates a level-one node. Delete removes the selected node and all descendants after confirmation.
- Double-click a node to edit its name, dates, colors, notes, or links. Click a date cell to open the editor with that day selected; clearing both dates removes the bar.
- Expand All / Collapse All and individual [+] / [-] controls manage branches. Collapse choices persist in this browser.
- Notes and Links act on the selected node. General Links are shared. Calendar and Calendar Detail show scheduled nodes within the visible date range.
- Use Refresh to see changes from another session.

The app intentionally has **no login and no row-level access restrictions**, as requested. Anyone with the app or its publishable key can read and change this app's data. Only the public browser key is included; no Supabase secret or service-role key is used. Existing tables are untouched.

## Verification

```sh
npm test
npm run build
# With the dev server running and Microsoft Edge installed:
node scripts/browser-check.mjs
```

The browser check creates and cleans up its own temporary branch in Supabase. `supabase/schema.sql` records the initial schema and reference seed; it has already been applied to the connected project and should not be rerun there.

## Hosting

GitHub Pages deploys automatically from main using .github/workflows/pages.yml. The Vite base path is /gantt03/.

