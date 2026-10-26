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
- Add root, Add child, and Add parent insert an inline name row. Enter or ✓ saves it; ▤ saves it and opens details; × cancels the draft. Add root creates a level-one node. Delete removes the selected node and all descendants after confirmation.
- Use ▤ or double-click a node to edit its name, colored date ranges, text color, notes, or links. Add color range adds another independently colored bar on the same row. Overlaps appear as horizontal stripes. Remove a range with ×. Clicking an unscheduled date appends a one-day range without replacing existing ranges.
- One link toggles between Expand All and Collapse All. Individual [+] / [-] controls manage branches. Collapse choices persist in this browser.
- Notes and Links act on the selected node. General Links are shared. Calendar and Calendar Detail show scheduled nodes within the visible date range.
- Use Refresh to see changes from another session.
- Hover any date cell or date header to see only its integer offset from today (negative for past dates, 0 today).
- Right-click a date cell for **Red, Blue, Green, Clear**. This changes that date only; other dates on the row are preserved.
- Drag a colored cell in **Paint** mode to fill the rectangle between its source and destination, including intermediate dates and visible rows. A striped source paints all its colors. Choose **Move**, or hold Shift before dragging, to move one cell's colors to another date/row and clear the source. Drop outside the grid or press Escape to cancel. Color moves between rows save together; a conflicting edit in another session is rejected.
- Drag node names to move the whole branch. Drop at a name's top/bottom edge to reorder, or in its middle to nest. Drop on **Drop node at root** to make it a root. Cycles and moves exceeding four levels are rejected.

The app intentionally has **no login and no row-level access restrictions**, as requested. Anyone with the app or its publishable key can read and change this app's data. Only the public browser key is included; no Supabase secret or service-role key is used. Existing tables are untouched.

## Verification

```sh
npm test
npm run build
# With the dev server running and Microsoft Edge installed:
node scripts/browser-check.mjs
node scripts/drag-check.mjs
```

The browser checks create and clean up their own temporary branches in Supabase. `supabase/schema.sql` records the initial schema and reference seed; `supabase/add-colored-ranges.sql` adds multiple colors while preserving the prior schedule; `supabase/cell-color-edits.sql` adds atomic color edits. All have already been applied to the connected project and should not be rerun there.

## Hosting

GitHub Pages deploys automatically from main using .github/workflows/pages.yml. The Vite base path is /gantt03/.

