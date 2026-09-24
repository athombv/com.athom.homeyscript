# Script execution metadata

Script definitions and execution timestamps use separate app settings:

- `scripts`: saved code, name, ID, and version.
- `scriptExecution`: a map from script ID to `{ lastExecuted }`, with ISO timestamps.

Creating, editing, or deleting a script still saves its definition immediately.
The shared runner records timestamps in memory after successful and failed saved-script
runs, including runs from the editor and Flows. Inline Flow code does not
create execution metadata. A deleted script cannot be recreated by a finishing run.

The first changed timestamp schedules one save for 10 minutes later. Further runs
update the pending snapshot without resetting the deadline. Unchanged timestamps
and idle periods do not cause saves. Pending metadata is also submitted on Homey's
`unload` event, before the SDK closes access to settings. A crash or power cut may
lose changes since the last successful save, normally up to 10 minutes.

## Compatibility and migration

Startup reads legacy `scripts[id].lastExecuted` values when there is no separate
metadata entry. It submits the metadata before removing legacy fields from script
definitions. Either format, or both together, is accepted at startup; the separate
metadata wins when both exist. Orphaned metadata for deleted scripts is discarded.
Downgrading to versions that only understand the old format is not supported.

`getScripts()`, `getScript()`, and script create/update responses continue exposing
`lastExecuted`. `getScript()` still returns it as a Date, preserving the script
variables `__last_executed__` and `__ms_since_last_executed__`. Timestamp-only
`updateScript()` calls remain supported and use the batched metadata path.

## Storage limits

Homey's SDK sends the entire app-settings document when any key changes. This
separation removes per-execution saves and avoids repeatedly constructing the script
definitions for timestamp updates; it does not make each underlying database write
contain only the metadata key. Code edits and scripts explicitly using `global.set()`
can still cause other settings writes.

The public settings API is synchronous and does not acknowledge disk persistence.
Synchronous save failures retain pending metadata and retry on the next interval;
asynchronous transport failures are handled by the SDK. The unload save is best-effort.
