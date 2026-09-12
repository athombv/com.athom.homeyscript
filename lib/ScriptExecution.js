'use strict';

class ScriptExecution {
  static SAVE_INTERVAL = 10 * 60 * 1000;

  constructor(app) {
    this.app = app;
    this.entries = new Map();
    this.dirty = false;
    this.timer = null;
    this.stopped = false;
  }

  initialize() {
    const stored = this.app.homey.settings.get('scriptExecution') || {};
    const definitions = {};
    let hasLegacyTimestamps = false;
    let migratedMetadata = false;

    for (const [id, script] of Object.entries(this.app.scripts)) {
      const { lastExecuted, ...definition } = script;
      definitions[id] = definition;
      hasLegacyTimestamps ||= Object.hasOwn(script, 'lastExecuted');

      // A partially completed migration can contain both formats; prefer the new one.
      if (Object.hasOwn(stored, id)) {
        this.entries.set(id, { lastExecuted: stored[id].lastExecuted });
      } else if (lastExecuted != null) {
        migratedMetadata = true;
        this.entries.set(id, { lastExecuted: new Date(lastExecuted).toISOString() });
      }
    }

    const hasDeletedScripts = this.entries.size !== Object.keys(stored).length;

    if (migratedMetadata || hasDeletedScripts) {
      // Submit metadata before removing legacy fields. SDK settings snapshots include both keys.
      this.app.homey.settings.set('scriptExecution', Object.fromEntries(this.entries));
    }

    if (hasLegacyTimestamps) {
      this.app.homey.settings.set('scripts', definitions);
    }

    this.app.scripts = definitions;
  }

  getLastExecuted(id) {
    return this.entries.get(id)?.lastExecuted ?? null;
  }

  record(id, lastExecuted = new Date()) {
    // Ignore inline code and scripts deleted while a run was in flight.
    if (this.stopped || !Object.hasOwn(this.app.scripts, id)) {
      return;
    }

    const timestamp = new Date(lastExecuted).toISOString();

    if (this.getLastExecuted(id) === timestamp) {
      return;
    }

    this.entries.set(id, { lastExecuted: timestamp });
    this.dirty = true;
    this.scheduleSave();
  }

  delete(id) {
    if (this.entries.delete(id)) {
      this.dirty = true;
      this.scheduleSave();
    }
  }

  scheduleSave() {
    if (this.stopped || this.timer !== null) {
      return;
    }

    // Do not reset this deadline on each run: continuous execution must still get saved.
    this.timer = this.app.homey.setTimeout(() => {
      this.timer = null;

      try {
        this.flush();
      } catch (err) {
        this.app.error('Could not save script execution metadata:', err);
        this.scheduleSave();
      }
    }, ScriptExecution.SAVE_INTERVAL);
  }

  flush() {
    if (!this.dirty) {
      return;
    }

    this.app.homey.settings.set('scriptExecution', Object.fromEntries(this.entries));
    this.dirty = false;
  }

  stop() {
    this.stopped = true;

    if (this.timer !== null) {
      this.app.homey.clearTimeout(this.timer);
      this.timer = null;
    }

    // The unload event still has settings access; onUninit runs too late in the SDK.
    try {
      this.flush();
    } catch (err) {
      this.app.error('Could not save script execution metadata before unloading:', err);
    }
  }
}

module.exports = { ScriptExecution };
