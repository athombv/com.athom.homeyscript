# Dashboard widgets

For feature direction, shared rendering, editor previews and the proposed React
proof of concept, see [WidgetResult design and roadmap](widget-result-design.md).

Requires Homey 12.3.0 or later. Add **Script Result**, **Script Button**,
**Script Result (Transparent)**, or **Script Button (Transparent)** from HomeyScript
in the dashboard widget picker, then select a saved script in the widget settings.
The transparent variants have no card background or shadow; input and button
surfaces remain visible. They have the same settings and behavior as their standard
counterparts. Transparency is fixed by the chosen variant.

Both widgets automatically grow and shrink to fit their content, including
long results, errors, and text wrapping when the dashboard width changes.
Use **Show script title** to hide or show the title inside either widget.
**Custom script title** overrides the displayed script name; leaving it empty
uses the script name. These settings are separate from Homey's dashboard heading.
Turn off **Show hint / last execution** to hide the helper text, routine run
status, and timestamps. Errors and missing-script setup instructions remain
visible. The widget height adjusts when this text is hidden.

## Script Button

Choose a script and a button label. Without an argument input, the widget shows
a round play button with the editable **Button label** beside it. Turn off
**Show button label** for just the round button. Tapping the button or its label
runs the saved script and shows its return value or error. Turn off **Show script result** to hide the
returned value below the button; errors remain visible. This does
not affect updates to a separate Script Result widget.
**Enable argument input** replaces the label beside the play button with an
editable input. Type an argument in the dashboard, then click play or press
Enter. The exact text is passed as `args[0]`; empty input passes no arguments.
Both controls are disabled during execution and until the current spinner rotation
finishes. Each rotation takes 0.4 seconds; the execution text changes to success
or error at the same time as the button becomes ready. Reduced-motion mode skips
this animation wait. Previous output remains visible while running, and new output
appears as soon as it arrives. Enter used to confirm IME text does not submit. With argument input off, the script receives no arguments.

**Clear after run** clears the input after success, retaining it on errors. Both
checkboxes default to off. Otherwise, text remains between runs until the widget
reloads. The former fixed argument setting is no longer used.

For example, save this script:

```js
return `Hello ${args[0] || 'Homey'}!`;
```

Enable argument input and type `World` to display `Hello World!` after submitting.
Concurrent button runs of the same script are rejected until its current widget
run finishes. Runs started from the editor or Flows are independent.

## Script Result

Displays the most recently completed run of the selected saved script, whether
started from a Script Button, the editor, or a Flow. An app realtime event tells
the widget to fetch the result as soon as the script finishes. The widget also
checks every 15 seconds while visible and when it becomes visible again, so it
can recover from missed events.
Opening or refreshing the dashboard never executes the script.

## Result format

Ordinary strings, numbers, booleans and `null` display as plain text. Arrays and
objects display as formatted JSON. An empty string displays “Empty text”; returning
`undefined` displays the existing no-return message. Tabs are literal text and do
not create columns. The former widget-level unit setting is no longer used.

Use the global `WidgetResult` constructor to request structured output. It works
in saved scripts run from the editor, Flows, or either widget:

```js
return new WidgetResult({
  blocks: [
    { type: 'metric', label: 'Consumption', value: 460, unit: 'W' },
    { type: 'status', text: 'Evening controls', tone: 'neutral' },
    {
      type: 'actions',
      buttons: [
        { id: 'night', label: '🌙 Good night', script: 'good-night' },
        { id: 'office', label: '💡 Office lights', script: 'set-room-lights', argument: 'Office' },
      ],
    },
  ],
});
```

Blocks appear vertically in the supplied order. Both widget types and their
transparent variants use the same renderer. Text is literal except in `markdown`
blocks. Raw HTML, arbitrary CSS, nested blocks, and executable callbacks are not supported. Empty documents,
tables and lists display “No content”, “No rows” and “No items”, respectively.

### Block contract

Documents without forms or block IDs retain `$homeyscriptResult: 1`. Adding a
`form` or an optional block `id` selects version 2 automatically. New renderers
accept both versions; older renderers show unfamiliar versions as JSON.

All blocks may have an optional, document-unique `id`. Form IDs are required.
Block IDs and field names use 1–64 ASCII letters, digits, underscores or hyphens,
starting with a letter. Keep them stable across script runs.

The constructor accepts `{ blocks: [...] }`. Unknown properties and invalid values
throw `TypeError` with a field path, such as `blocks[0].rows[2].lastActive`.

| Type       | Required fields                                   | Optional fields                                                                                   |
| ---------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `table`    | Nonempty `columns` array; `rows` array of objects | `showHeaders` (default `true`)                                                                    |
| `list`     | `items` array                                     | `ordered` (default `false`)                                                                       |
| `metric`   | Finite numeric `value`                            | Text `label`, text `unit`, integer `decimals` from 0 to 6                                         |
| `status`   | Text `text`                                       | Text `description`, emoji/text `icon`, `tone`: `neutral` (default), `success`, `warning`, `error` |
| `form`     | `id`, nonempty `fields`, `submit` action          | None                                                                                              |
| `markdown` | Text `text`                                       | None                                                                                              |
| `actions`  | `buttons` array                                   | None                                                                                              |

Markdown blocks use CommonMark syntax: headings, bold/italic text, ordered and
unordered lists (including nested lists), blockquotes, horizontal rules, links,
and inline/fenced code. Headings use widget-sized Homey typography. Code is plain
text without syntax highlighting. Raw HTML is ignored; images display only their
alt text. Links must be absolute `https:`, `http:`, or `mailto:` URLs and open in a
new browsing context. Unsupported and relative links retain their text without
being clickable. GitHub extensions such as Markdown tables, task checkboxes,
strikethrough, and footnotes are outside this version; use a `table` block for
aligned data.

```js
return new WidgetResult({
  blocks: [
    {
      type: 'markdown',
      text: '## 🏠 Home summary\n\n- All doors **closed**\n- Laundry is finished\n\n> Updated by HomeyScript.',
    },
    { type: 'metric', label: 'Power', value: 420, unit: 'W' },
  ],
});
```

Table columns have a unique, nonempty text `key`, text `label`, optional `align`
(`left` by default, `center`, `right`), and optional `format: 'relativeTime'`.
Rows map keys to text, finite numbers, booleans or null. Missing/null cells are
blank. Extra primitive fields in a row are ignored by the renderer. Headers and
row order follow the supplied arrays; the renderer does not sort data.

List items are strings or objects with required text `text`, optional emoji/text
`icon`, optional text `secondary`, and optional `secondaryFormat: 'relativeTime'`.
When relative-time formatting is selected, `secondary` can also be null or missing.

Metrics use the display locale. Supplying `decimals` fixes the displayed decimal
places; otherwise normal locale number-formatting defaults apply. Status tones
style the content and do not change execution success.

### Relative timestamps

A table column's `format` or a list item's `secondaryFormat` can be `relativeTime`.
Supply an ISO timestamp including a timezone, for example
`2026-09-12T15:30:00Z`. Convert a Date with `.toISOString()` before returning it.
Null/missing timestamps display nothing; malformed timestamps fail validation.

The widget updates wording immediately and every minute while visible, showing
values such as “3 min ago”, “2h 15m ago”, or “in 5 min”. Updates pause while hidden
and resume on return. They do not execute scripts, fetch data, or change the
execution timestamp. A Flow must still run the script to update the underlying
sensor readings and activity state.

### Forms and submitted values

A form owns its draft values and one Save action. Editing inputs does not run any
script. Only that form's values are submitted when Save is pressed.

```js
return new WidgetResult({
  blocks: [
    {
      type: 'form',
      id: 'away-settings',
      fields: [
        { name: 'note', type: 'text', label: 'Note', defaultValue: '', required: true },
        { name: 'enabled', type: 'checkbox', label: 'Enable away mode', defaultValue: false },
        { name: 'until', type: 'date', label: 'Away until', defaultValue: null },
      ],
      submit: { id: 'save-away', label: 'Save', script: 'save-away-settings' },
    },
  ],
});
```

Each field requires a form-unique `name`, `type`, and nonempty `label`. Supported
field types are `text`, `checkbox`, and `date`. Optional `required` defaults to
false. Optional `defaultValue` defaults to `''`, `false`, and `null`, respectively.
Text is limited to 4,096 characters; forms contain 1–32 fields and each submission
is limited to 16,384 serialized characters. Required text must contain a
non-whitespace character, a required checkbox must be checked, and a required
date must be set. Dates are valid calendar dates from `0001-01-01` through
`9999-12-31`, without timezone conversion.

The `submit` action uses the same `id`, `label`, `script`, and optional `argument`
contract as ordinary buttons. Action IDs are unique across both action blocks
and form submits. The target script receives a separate global:

```js
// In the saved script named save-away-settings:
if (widgetEvent?.type !== 'submit') {
  throw new Error('Submit the away-settings form to run this script.');
}

const { note, enabled, until } = widgetEvent.values;
// note is text; enabled is boolean; until is YYYY-MM-DD or null.
global.set('away-settings', { note, enabled, until });
```

The full event is `{ type: 'submit', actionId, formId, values }`. Ordinary widget
actions receive `{ type: 'action', actionId }`. Editor, Flow, and main Script
Button runs receive `widgetEvent === null`. Existing `args[0]` remains the fixed
string argument configured on the action; it is never replaced by form JSON.

The browser and server validate values against the same contract. Invalid fields
show inline errors and prevent execution. Arbitrary target-script returns remain
ignored as panel output.

#### After a successful submission

Set `onSuccess` on a form and optionally override it on individual fields:

```js
{
  type: 'form',
  id: 'settings',
  onSuccess: 'retain',
  fields: [
    { name: 'enabled', type: 'checkbox', label: 'Enabled' },
    { name: 'note', type: 'text', label: 'Note', onSuccess: 'clear' },
    { name: 'until', type: 'date', label: 'Until', defaultValue: '2026-12-31', onSuccess: 'reset' },
  ],
  submit: { id: 'save', label: 'Save', script: 'save-settings' },
}
```

| Value    | Behavior                                                                              |
| -------- | ------------------------------------------------------------------------------------- |
| `retain` | Keep the value. This is the default when neither field nor form specifies a behavior. |
| `clear`  | Use `''` for text, `false` for checkboxes, and `null` for dates.                      |
| `reset`  | Restore the field's `defaultValue`, or its type's empty value when omitted.           |

These behaviors run only after success, including when the target returns `false`
without throwing. Failures, stale responses and ignored duplicate clicks do not
clear or reset values. Edits made during submission survive, including editing
away from and back to the submitted value. A changed form definition makes the old
response inapplicable. Clearing a required field is allowed; it will be validated
on the next submission. Reset fields become untouched; cleared fields remain
drafts when their empty value differs from the default. No panel script is rerun.

#### Script validation errors

Throw `WidgetValidationError` to report business-rule errors beside form inputs:

```js
throw new WidgetValidationError({
  fields: { until: 'Choose a date after today.' },
  message: 'Some settings need your attention.', // Optional four-second toast.
});
```

`fields` requires 1–32 entries keyed by field name. Names follow the same rules as
form field names. Each message must be nonempty text of at most 1,024 characters;
the complete details object is limited to 16,384 serialized characters. The
constructor validates and detaches its input. Errors are plain text, never HTML.

The first invalid input receives focus. Editing a field clears its error. A late
field error only applies when that field has not changed since submission. An
omitted `message` shows only inline errors; supplying it also shows a toast.
Unknown field names are filtered out by the server. If none match the submitted
form, or the script was run without a form, its normal error message is shown.

Ordinary exceptions such as `throw new Error('Could not reach the thermostat.')`
show a toast. Both error kinds retain values and skip `onSuccess`. Throwing a
validation error stops execution and records a failed run with normal metadata
and target-cache updates. The target cache contains bounded, detached error
details; oversized error snapshots fall back to the normal error text. Returning
an error object does not signal failure: it must be thrown. Editor and Flow runs
also fail normally when a validation error is thrown.

Drafts are local to each mounted widget/preview. Realtime updates adopt new
defaults for untouched fields and preserve edits when form ID, field name, and
field type match. Removed fields lose their drafts; changed types use the new
default. Matching form controls retain their DOM nodes and focus across updates
and reordering. Drafts remain after failure; success follows `onSuccess`. They are not persisted
across a full page reload. If fresh defaults match a draft, that field becomes
untouched again. Stale submissions do not execute: refresh, keep compatible
drafts, and require another explicit Save. Nothing is automatically replayed.

### Action controls

Each button requires nonempty text `id`, `label`, and `script`; `id` must be unique
across the whole document. Optional `argument` must be text. `script` is the exact,
case-sensitive saved-script name, including any extension if present. A missing
or ambiguous name produces an error. Names are resolved when clicked, so renaming
a target requires updating its reference in the panel script.

Clicking runs the saved target script. `argument` becomes `args[0]`; an omitted or
empty argument passes no arguments, as with Script Button. The originating panel
stays visible and never displays the target's return value. Buttons retain their label and appearance
during execution, with no loading or success feedback. Failures show an accessible
error toast inside the widget for four seconds, without shifting the panel layout.
Repeat clicks are ignored while a panel action runs; the server also rejects simultaneous widget runs of
the same target script.

Target runs update their own result cache and execution metadata normally. The
panel script is not automatically rerun. Existing Flow/realtime updates continue;
if the target is the panel script itself, its run naturally updates that cache.

The browser submits the source script ID, result timestamp, and action ID.
Form submissions additionally send `formId` and their typed `values`.
The server resolves the action from that exact cached document. If the document
changed, the action does not run; the widget fetches the new panel and asks the
user to try again. Reloading a panel never executes its actions.

### Serialization and migration

`WidgetResult` validates and snapshots its input and serializes through `toJSON()`
as `{ "$homeyscriptResult": 1, "blocks": [...] }`. The marker identifies the format
version. Rendering and action dispatch validate this envelope after JSON transport;
they do not depend on JavaScript class identity. Returning an ordinary
`{ blocks: [...] }` object prints JSON. Unsupported versions and malformed envelopes
also print JSON, while oversized results use the existing truncated-text fallback.

The canonical validator is `lib/WidgetResult.js`. Its browser copy and the shared
renderer/style assets live in each widget's public directory because Homey serves
these directories independently. Tests enforce identical copies. This explicit
block contract has TypeScript declarations in `lib/WidgetResult.d.ts` and
controller interfaces in `lib/WidgetInteractionController.d.ts`. Runtime schema
validation remains in `WidgetResult.js`; `npm run check:types` and runtime fixtures
check the two sides. Editor autocomplete integration is still a separate step.

Existing numeric dashboards should use a `metric` block for a large number and
unit. Existing array-based lists should use a `list` block. Replace tab-padded
strings with a `table` block. No saved scripts are migrated automatically.

See [zone-activity example](../examples/zone-activity.js) for an activity table with
parent-first ordering, sibling `sortIndex`, no indentation, icons, and relative
timestamps. The example only reads zones. Install or paste it manually on an
existing Homey, run it once, and select it in a widget.

## Prototype limits

- Results are kept in memory and reset when HomeyScript restarts. The widget
  shows “No result yet” until the script runs again.
- Results belong to the script, so runs with different arguments share the same
  latest result. Unsaved editor test code also updates that script's result.
- Each script retains one result, capped at 16,384 serialized characters.
  Longer values are shortened and displayed as text.
- Errors replace the previous result. The completion time is included when
  **Show hint / last execution** is enabled.
- Text remains literal inside all blocks; HTML is not executed.
- Inline Flow code has no saved script to select and is not included.

## Local checks

### Picker previews

Homey's [widget SDK guide](https://apps.developer.homey.app/the-basics/widgets)
requires separate `preview-light.png` and `preview-dark.png` files that accurately
represent the widget. Follow the linked Figma template's abstract visual style:
use rounded placeholder bars for titles, labels, values, and timestamps, with no
rendered text or numbers. Keep recognizable controls such as the play icon.

Our previews use a 1024 × 1024 canvas with the template's light or dark background
and a centered widget at its natural content height. The button preview shows the
default argumentless layout: a round play control with a label placeholder. The
result preview uses a larger placeholder for the return value. Both include small
placeholders for the script title and status. Transparent variants omit the card
surface and shadow; the preview canvas remains visible behind their content.

Keep the adjacent SVG sources and PNG exports in sync. Export at 1024 × 1024 and
inspect both themes at the picker size (128 × 128), as well as full resolution.
The SVGs are editable sources; Homey consumes the PNG files. No fonts are needed.

### Validation

Run `npm test`, `npm run lint`, and `homey app validate`.
Check widget formatting with:

```sh
npx prettier --check 'widgets/**/*.{js,css,html,json}' 'test/*.test.js' lib/ScriptWidgets.js docs/widgets.md
```

After installing the app on a development Homey, add both widgets with the same
script and tap its button.
The result widget should update as soon as the script finishes. Also check a failing script,
a deleted script, and dashboard light and dark modes.

Each variant has its own public asset directory because Homey serves assets per
widget. Keep each standard/transparent pair in sync when changing behavior or
styles; their manifests differ only in name and transparency.

### Building widget assets

Run `npm run build:widgets` after changing the shared Markdown sources,
`lib/WidgetResult.js`, `lib/WidgetInteractionController.js`, or the shared renderer,
styles and Homey adapter under `widget-renderer/`. The command bundles remark into a local browser
asset, includes dependency licenses, and synchronizes the four widget variants.
Generated assets are checked in so Homey installation needs no browser build or
CDN access. Do not edit `widget-markdown.js` directly.

`widget-renderer/MarkdownParser.mjs` returns a remark syntax tree without DOM
access; `MarkdownRenderer.mjs` converts supported nodes into DOM elements. This
separation allows a future React preview to reuse the parsing layer. The cache
still stores the original Markdown string within the normal result size limit.

### Preview playground

Run `npm run build:widgets` followed by `npm run playground`, then open
`http://127.0.0.1:5001`. The example picker covers every block type, table/list
variants, all status tones, metric precision 0–6, supported Markdown elements,
actions, form fields and success behaviors. It also includes ordinary returns,
empty states, failed executions, truncation and unsupported document versions.
The input-format selector supports WidgetResult options, ordinary JSON values,
and complete result states. Invalid JSON keeps the last valid preview visible.

Both 320px and 480px previews load the actual widget HTML, host JavaScript and CSS.
Choose any of the four widget variants, light/dark theme, font scaling or the
Script Button argument input. Each preview has independent draft state. Switching
widget variant or argument-input mode reloads the frames; theme and font changes
preserve them. Script Button previews simulate a run on Apply JSON. Updating
defaults and reordering exercise the real host's result-update behavior.

The server serves Homey's original `homey.widgets.css`, imported CSS files and
Roboto/NotoSansArabic fonts from the sibling `node-homey-os` checkout at
`packages/homey-core/www/widgets`. Set `HOMEY_OS_PATH` to use another checkout and
`WIDGET_PLAYGROUND_PORT` to change the port. Missing Homey styles stop startup
with a diagnostic; there is no approximate theme fallback. No OS files are copied
into the app. Font scale, dark mode and transparency use the same root settings
as Homey's widget bridge. The surrounding playground layout, striped background
for transparency, and capped scrollable preview viewport are preview-only.
Native date pickers can still vary between browsers and operating systems.

Stage a remote change to exercise stale submissions, or select simulated
execution, connection and field errors, including an optional toast. Submitted
script names, fixed arguments and widget events appear below the previews. All
actions are simulated; the playground does not connect to Homey or run scripts.
