# Dashboard widgets

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

Return a number for a large metric, a boolean for `true`/`false`, text for a
message, or an array for a list. Objects appear as formatted JSON. An optional
unit is shown next to numbers. For example:

```js
return 820;
```

Set the unit to `W` to show `820 W`. Run the script once in the editor to populate
the widget. For periodic updates, use a Flow that runs the saved script.

## Prototype limits

- Results are kept in memory and reset when HomeyScript restarts. The widget
  shows “No result yet” until the script runs again.
- Results belong to the script, so runs with different arguments share the same
  latest result. Unsaved editor test code also updates that script's result.
- Each script retains one result, capped at 16,384 serialized characters.
  Longer values are shortened and displayed as text.
- Errors replace the previous result. The completion time is included when
  **Show hint / last execution** is enabled.
- Script output is displayed as text; HTML is not executed.
- Inline Flow code has no saved script to select and is not included.

## Local checks

### Picker previews

Homey's [widget SDK guide](https://apps.developer.homey.app/the-basics/widgets)
requires separate `preview-light.png` and `preview-dark.png` files that accurately
represent the widget. Our previews use a 1024 × 1024 transparent canvas, following
the CLI starter template, with a centered widget at its natural content height.

The button preview shows the default argumentless layout: a round play control,
editable label, script title, and readiness text. The result preview shows a sample
numeric return value with a unit and execution timestamp. Colors, Roboto font
weights, padding, and control sizes match the widget styles. Transparent variants
omit the card surface and shadow while retaining the same content and spacing.

Keep the adjacent SVG sources and PNG exports in sync. Export at 1024 × 1024 with
Roboto Regular, Medium, and Bold available, preserving the alpha channel. Inspect
both themes at the picker size (128 × 128), as well as full resolution. The SVGs
are editable sources; Homey consumes the PNG files.

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
