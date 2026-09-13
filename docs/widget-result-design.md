# WidgetResult: shared rendering, forms and editor previews

Updated 2026-09-13. The form foundation and standalone playground are implemented.
React, integration into the actual Homey web app, and a visual builder remain
future work. See [Dashboard widgets](widgets.md) for the public script API.

## Architecture in place

| Layer                  | Source                                                  | Responsibility                                                                                          |
| ---------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Document contract      | `lib/WidgetResult.js` and `.d.ts`                       | Versioning, serialization, field-path validation and public types                                       |
| Interaction controller | `lib/WidgetInteractionController.js` and `.d.ts`        | Drafts, dirty fields, validation errors, pending submissions and dispatch through an injected adapter   |
| DOM renderer           | `widget-renderer/ResultRenderer.js` and `.css`          | Semantic block/form elements, field bindings, focus preservation, relative times and error presentation |
| Homey adapter          | `widget-renderer/WidgetHost.js` and widget host scripts | Homey API dispatch, snapshot retrieval, realtime/polling, visibility and widget height                  |
| Preview adapter        | `playground/preview.js`                                 | Simulated submissions, validation, failure responses and stale-result refresh                           |
| Markdown               | `MarkdownParser.mjs` and `MarkdownRenderer.mjs`         | Remark syntax-tree parsing separated from DOM conversion                                                |

The interaction controller has no DOM or Homey dependency. The renderer receives
it through its constructor and subscribes to state changes. The Homey adapter
supplies `dispatch(intent)` and `refresh()` callbacks; these are host code, never
callbacks embedded in JSON. The preview uses the same renderer and controller
with a simulated adapter.

Renderer teardown removes its listeners, subscriptions and timers without
owning the lifetime of the controller's drafts. A host disposing the entire view
should call both `renderer.destroy()` and `controller.destroy()`. Page hide pauses
view timers rather than destroying state, allowing back/forward cache restoration.

## Format and compatibility

Existing documents retain marker version 1. Forms and optional stable block IDs
select version 2. The constructor supplies the version; new renderers understand
both. Older renderers fall back to JSON for version 2 rather than misinterpreting
its controls. Version 1 rejects version-2-only fields.

Block IDs identify logical blocks, never execution snapshots. Form field names
identify values inside their form. Action IDs remain document-unique. Renderer
state must not use result timestamps as control identity.

TypeScript declarations describe the public JSON and adapter interfaces. The
compiler uses the `typescript-contract` npm alias because Homey CLI treats a
`typescript` development dependency as opting the entire app into compilation;
this app remains JavaScript, with separate contract checks. Runtime
validation is centralized in `WidgetResult.js` and used by both the browser and
server. Declaration fixtures compile under `npm run check:types`; runtime fixtures
exercise accepted documents and rejected values. Runtime-only restrictions such
as finite numbers, valid calendar dates, duplicate IDs and size limits still
require validation. These declarations do not wire autocomplete into Homey's
script editor by themselves.

## Submission contract

1. A script returns a form with fields and a named-script submit action.
2. Edits update only the controller's draft state. No script runs on input change.
3. Save validates and submits that form's values with the source snapshot identity.
4. The server finds the form and action in the cached document, validates submitted
   values, resolves the exact saved-script name, and rechecks the snapshot after
   asynchronous lookup immediately before executing.
5. The script receives `widgetEvent = { type: 'submit', actionId, formId, values }`.
   The optional fixed string argument remains in `args[0]`.
6. Ordinary target returns update the target cache and metadata but are not
   interpreted as originating-widget output or commands.

Ordinary action buttons receive `{ type: 'action', actionId }`. Other invocation
paths receive `widgetEvent === null`.

The first field types are text, checkbox and date. Data is text, boolean and a
calendar-date string/null, respectively. Controls do not invent timezone offsets.
Forms form separate submission boundaries, so unrelated forms do not contribute
values. The existing widget concurrency guard covers submit actions too.

The action response envelope can contain `success`, `error`, `code`, and
`fieldErrors`. Schema validation produces inline field errors; execution and
transport failures produce a four-second toast. Field errors from an old submitted
value are not applied to a value edited while awaiting the response. Scripts throw
`WidgetValidationError({ fields, message? })` for business-rule errors. The VM
captures bounded, detached details in the failed result cache; the action runner
filters names to the submitted form. The optional message adds a toast. Ordinary
JSON returns are not treated as action responses. The helper and its types live
in `lib/WidgetValidationError.js` and `.d.ts`.

## Drafts, updates and identity

Each mounted controller owns independent drafts; state is not shared across
widgets, users or previews. Untouched fields adopt refreshed defaults. Edited
fields preserve their value while form ID, field name and field type match. A
removed field drops its draft; a type change resets to the new default. A default
that catches up with a draft makes the field untouched again.

Successful submissions apply form-level `onSuccess` (`retain` by default, `clear`,
or `reset`) with optional field-level overrides. Field revision counters protect
newer edits even when someone edits away from and back to the submitted value.
Only unchanged fields in the same form definition receive success behavior or
late field errors. `reset` restores defaults and marks fields untouched; `clear`
uses type-specific empty values and preserves them as drafts if defaults differ.
Failures retain drafts. Stale
submissions fetch the fresh document, reconcile compatible values, show the error,
and require another explicit Save. No retries or automatic action replay occur.

Forms reuse their DOM nodes and matching input nodes. Updates avoid rewriting an
input value when it already matches, preserving text selection. Reordering may
move a retained form; the renderer restores focus to the same surviving input.
IME composition is tracked so updates do not overwrite in-progress text and Enter
during composition does not submit. Full reloads do not persist drafts.

Identical snapshots skip rendering. Other content blocks still rebuild on changed
snapshots; general keyed diffing and table-row identity remain future work. The
current optimization is focused on preserving editable form controls.

## Playground and verification

Run `npm run build:widgets` and `npm run playground`, then open
`http://127.0.0.1:5001`. A JSON editor and example gallery feed narrow and wide
previews, each with independent controller state. The gallery covers every block
and supported option, including ordinary returns and result states. All four
widget variants use their real HTML, host scripts and CSS with a simulated Homey
adapter. Original Homey OS CSS and font files are served from the sibling checkout
(`HOMEY_OS_PATH` overrides its location). Theme, transparency and font scaling
follow the widget bridge. The controls exercise changing defaults, block
reordering, stale server state, and execution/field failures. Submitted events
are shown for inspection. No Homey is contacted. This is not yet integrated into
the Homey web app's script editor.

Tests cover legacy serialization, the v2 schema, server validation, normal VM
execution and metadata, argument compatibility, stale requests (including the
lookup race), form isolation, draft reconciliation, duplicate submissions,
failures, rendering and teardown. Browser checks exercise the actual input nodes,
focus and cursor selection, keyboard submission, narrow widths and theme changes.

`npm run build:widgets` generates all four widget copies from shared source and
bundles remark locally with its license notices. Generated copies are checked in;
Homey installation does not require a browser build. Tests enforce asset parity.

## Moving to React

The next experiment can replace DOM presentation while keeping the same document,
controller and adapters. A React renderer can subscribe to the controller and
emit edits/submits without executing Homey APIs itself. Form IDs and field names
provide stable keys; snapshots remain separate execution metadata.

Use an imperative mount/update/destroy wrapper for widget frames, and direct
components for the web app. Share source and theme styles so preview does not
become a separate approximation. Bundle the runtime locally for widget frames;
allow the web app to use its compatible React runtime.

Before adoption, test all block types and measure bundle size, startup and updates
across several widget frames. Preserve drafts, focus, selection, IME composition,
and accessible field errors. React is not automatically a performance improvement.

## Further decisions

- Optional panel refresh after a successful action.
- Additional fields such as numbers, selects, multi-selects and time pickers.
- Immediate device controls as an explicit behavior separate from form editing.
- Form conflict/review UI for incompatible remote changes; drafts currently reset
  when field types change and disappear when fields are removed.
- General keyed block/row reconciliation and optional cross-reload drafts.
- Real editor integration, preview/live-action boundaries, and autocomplete.
- A builder that edits the same JSON; arbitrary JavaScript round-tripping remains
  outside its scope.
