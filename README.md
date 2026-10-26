# Gantt03

A compact four-level Gantt chart based on the supplied reference. Data is saved in the existing **bnaimitzvah** Supabase project, in isolated `gantt03_nodes` and `gantt03_settings` tables.

## Run

```sh
npm ci
npm run dev
```

`npm run build` creates the static application in `dist/`. `npm run preview` serves that build.

## Use

- Right-click a node (or Shift+F10): **Add parent, Add child, Sibling, Edit, Notes, Comments, Delete**. Level four has **Sibling, Edit, Notes, Comments, Delete**.
- **Sibling** inserts a row after the selected node's branch, with the same parent and indentation. It also works for root nodes and level-four nodes.
- Add parent wraps a node and its branch. A wrapper that would exceed four levels is rejected atomically. The database also rejects cycles and fifth-level inserts.
- Add root, Add child, and Add parent insert an inline name row. Enter or ✓ saves it; × cancels the draft. Add root creates a level-one node. Delete removes the selected node and all descendants after confirmation.
- Click a node name to edit its name, colored date ranges, text color, or links. Add color range adds another independently colored bar on the same row. Overlaps appear as horizontal stripes. Remove a range with ×. Double-clicking an unscheduled date appends a one-day range without replacing existing ranges.
- A right-aligned integer in the node cell shows days until its next scheduled date. If all dates are past, it shows days since the most recent date as a negative integer. Active-today ranges and unscheduled nodes show no count. Counts update when the local date changes.
- **Notes** opens a rich text box with bold, italic, underline, headings, and lists. Notes save automatically after a short pause; closing also saves the latest keystrokes. Existing plain notes are preserved. Formatting is sanitized for display. Save failures stay visible with retry/reload controls.
- The single **Align** button cycles **Left → Center → Right → Left** for the current paragraph or selected text, and saves the alignment automatically.
- Click any cell in a Notes grid, then use **Align** to align its entire column. The button shows the active column letter, such as **Align B: Center**. Other columns retain their alignment.
- In Notes, **Insert 20 × 8 grid** inserts an editable table with 20 rows and 8 columns at the cursor. Use Tab / Shift+Tab between cells. Grid content saves automatically with the note and supports undo after closing Notes.
- **Clear note** removes all text, formatting, and grids from the open note and saves the empty note automatically. Close Notes and press Esc to undo the clear, including any recent typing. Comments are separate and remain intact.
- **Comments** opens the node's comment history. Each Add comment submission appends a separate entry with a server timestamp displayed in the viewer's local timezone. Concurrent submissions are preserved, and retries do not duplicate a submission.
- One link toggles between Expand All and Collapse All. Individual [+] / [-] controls manage branches. Collapse choices persist in this browser.
- Notes and Links act on the selected node. General Links are shared. Calendar and Calendar Detail show scheduled nodes within the visible date range.
- Use Refresh to see changes from another session.
- The default date range extends through **August 31, 2027**, including both calendar views. The Days selector still offers shorter ranges.
- Hover any date cell to see its project/task name, date as `Oct. 25 Sun`, and an integer day offset (negative for past dates, 0 today). Date headers show the date and offset.
- Right-click a date cell for **Red, Blue, Green, Clear**. This changes that date only; other dates on the row are preserved.
- Drag the body of a colored cell to move its colors to another date/row and clear the source. Hover near a cell’s lower-right corner to show a blue circle. Hover the circle for a cross cursor, then drag it to paint. The circle disappears on mouse release. Painting fills the rectangle between source and destination, including intermediate dates and visible rows. A striped source carries all its colors. Drop outside the grid or press Escape to cancel. Color moves between rows save together; a conflicting edit in another session is rejected.
- Press **Esc** to undo the most recent saved change in this browser session, including colors, node moves, edits, additions and deletions. Up to 30 changes are kept until reload. During a drag, Esc cancels the unfinished drag; in a dialog it closes the dialog. Undo rejects conflicting newer shared edits.
- Drag node names directly to move the whole branch; no drag handle is displayed or required. Drop at a name's top/bottom edge to reorder, or in its middle to nest. Drop on **Drop node at root** to make it a root. Cycles and moves exceeding four levels are rejected.

The app intentionally has **no login and no row-level access restrictions**, as requested. Anyone with the app or its publishable key can read and change this app's data. Only the public browser key is included; no Supabase secret or service-role key is used. Existing tables are untouched.

## Verification

```sh
npm test
npm run build
# With the dev server running and Microsoft Edge installed:
node scripts/browser-check.mjs
node scripts/drag-check.mjs
node scripts/undo-check.mjs
node scripts/notes-comments-check.mjs
node scripts/notes-grid-check.mjs
node scripts/notes-alignment-check.mjs
```

The browser checks create and clean up their own temporary branches in Supabase. `supabase/schema.sql` records the initial schema and reference seed; `supabase/add-colored-ranges.sql` adds multiple colors while preserving the prior schedule; `supabase/cell-color-edits.sql` adds atomic color edits. `supabase/undo-actions.sql` adds guarded undo. `supabase/notes-comments.sql` adds rich notes, timestamped comments, and extends undo to preserve both. All have already been applied to the connected project and should not be rerun there.

## Hosting

GitHub Pages deploys automatically from main using .github/workflows/pages.yml. The Vite base path is /gantt03/.

