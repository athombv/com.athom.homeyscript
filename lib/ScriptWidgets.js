'use strict';

class ScriptWidgets {
  static MAX_RESULT_LENGTH = 16384;

  constructor(app) {
    this.app = app;
    this.results = new Map();
    this.running = new Set();
  }

  async getScript(id) {
    if (typeof id !== 'string' || !Object.hasOwn(this.app.scripts, id)) {
      throw new Error('Script not found. Select a script in the widget settings.');
    }

    return await this.app.getScript({ id });
  }

  async getResult(id) {
    const script = await this.getScript(id);

    return { name: script.name, result: this.results.get(id) ?? null };
  }

  record(id, result) {
    // Inline Flow code has no saved script to select in a widget.
    if (!Object.hasOwn(this.app.scripts, id)) {
      return;
    }

    this.results.set(id, ScriptWidgets.createResult(result));
    this.notifyResult(id).catch((err) => {
      this.app.error(err);
    });
  }

  async notifyResult(id) {
    // Notify after caching so widgets can immediately fetch the completed result.
    await this.app.homey.api.realtime('script-result-updated', { scriptId: id });
  }

  async run(id, argument) {
    if (argument != null && typeof argument !== 'string') {
      throw new Error('The script argument must be text.');
    }

    const script = await this.getScript(id);

    if (this.running.has(id)) {
      throw new Error('This script is already running from a widget.');
    }

    this.running.add(id);

    try {
      const value = await this.app.runScript({
        ...script,
        args: argument == null || argument === '' ? [] : [argument],
      });

      return ScriptWidgets.createResult({ success: true, value });
    } catch (err) {
      return ScriptWidgets.createResult({ success: false, error: err.message });
    } finally {
      this.running.delete(id);
    }
  }

  static createResult({ success, value, error }) {
    const result = { success, updatedAt: new Date().toISOString() };

    if (!success) {
      return { ...result, error: String(error).slice(0, ScriptWidgets.MAX_RESULT_LENGTH) };
    }

    // Keep one bounded JSON snapshot per script, without retaining VM objects.
    try {
      const serialized = JSON.stringify(value);

      if (serialized === undefined) {
        return { ...result, hasValue: false };
      }

      if (serialized.length > ScriptWidgets.MAX_RESULT_LENGTH) {
        return {
          ...result,
          hasValue: true,
          value: `${serialized.slice(0, ScriptWidgets.MAX_RESULT_LENGTH)}…`,
          truncated: true,
        };
      }

      return { ...result, hasValue: true, value: JSON.parse(serialized) };
    } catch (err) {
      // Display limitations must not change a script's execution outcome.
      return { ...result, hasValue: false, displayError: 'This return value cannot be displayed.' };
    }
  }
}

module.exports = { ScriptWidgets };
