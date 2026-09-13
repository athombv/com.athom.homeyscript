'use strict';

const { WidgetResult } = require('./WidgetResult');

class ScriptWidgets {
  static MAX_RESULT_LENGTH = 16384;

  constructor(app) {
    this.app = app;
    this.results = new Map();
    this.running = new Set();
    this.lastResultTime = 0;
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

    // A result timestamp also identifies the exact document an action came from.
    this.lastResultTime = Math.max(Date.now(), this.lastResultTime + 1);
    const snapshot = ScriptWidgets.createResult(result);
    snapshot.updatedAt = new Date(this.lastResultTime).toISOString();
    this.results.set(id, snapshot);
    this.notifyResult(id).catch((err) => {
      this.app.error(err);
    });
    return snapshot;
  }

  async notifyResult(id) {
    // Notify after caching so widgets can immediately fetch the completed result.
    await this.app.homey.api.realtime('script-result-updated', { scriptId: id });
  }

  async run(id, argument, { beforeRun, widgetEvent = null } = {}) {
    if (argument != null && typeof argument !== 'string') {
      throw new Error('The script argument must be text.');
    }

    const script = await this.getScript(id);

    // Recheck after the asynchronous lookup, immediately before execution.
    beforeRun?.();

    if (this.running.has(id)) {
      throw new Error('This script is already running from a widget.');
    }

    this.running.add(id);
    let snapshot;

    try {
      const value = await this.app.runScript({
        ...script,
        widgetEvent,
        args: argument == null || argument === '' ? [] : [argument],
        onWidgetResult(result) {
          snapshot = result;
        },
      });

      return snapshot ?? ScriptWidgets.createResult({ success: true, value });
    } catch (err) {
      return snapshot ?? ScriptWidgets.createResult({ success: false, error: err.message });
    } finally {
      this.running.delete(id);
    }
  }

  async runAction({ scriptId, updatedAt, actionId, formId, values } = {}) {
    try {
      await this.getScript(scriptId);
      const snapshot = this.results.get(scriptId);
      const checkCurrent = () => {
        if (
          !snapshot ||
          snapshot.updatedAt !== updatedAt ||
          this.results.get(scriptId) !== snapshot
        ) {
          const error = new Error('This panel has changed. Refreshed the panel; try again.');
          error.code = 'STALE_RESULT';
          throw error;
        }
      };

      checkCurrent();
      if (!snapshot.success || !WidgetResult.isDocument(snapshot.value)) {
        throw new Error('This result does not contain widget actions.');
      }

      let action;
      let form;

      for (const block of snapshot.value.blocks) {
        if (block.type === 'form' && block.id === formId && block.submit.id === actionId) {
          form = block;
          action = block.submit;
          break;
        }

        if (formId !== undefined || block.type !== 'actions') {
          continue;
        }

        action = block.buttons.find((button) => {
          return button.id === actionId;
        });
        if (action) {
          break;
        }
      }

      if (!action) {
        throw new Error('Action not found in this panel.');
      }

      let widgetEvent = { type: 'action', actionId };

      if (form) {
        const fieldErrors = WidgetResult.validateValues(form, values);

        if (Object.keys(fieldErrors).length > 0) {
          return { success: false, code: 'VALIDATION_ERROR', fieldErrors };
        }

        widgetEvent = {
          type: 'submit',
          actionId,
          formId: form.id,
          values: JSON.parse(JSON.stringify(values)),
        };
      } else if (values !== undefined) {
        throw new Error('Only form submissions accept field values.');
      }

      const targets = Object.entries(this.app.scripts).filter(([, script]) => {
        return script.name === action.script;
      });

      if (targets.length === 0) {
        throw new Error(`Script not found: ${action.script}`);
      }

      if (targets.length > 1) {
        throw new Error(`Script name is ambiguous: ${action.script}`);
      }

      const result = await this.run(targets[0][0], action.argument, {
        beforeRun: checkCurrent,
        widgetEvent,
      });

      // Action returns update the target cache, but never replace the control panel.
      if (!result.success) {
        if (form && result.validationError) {
          const names = new Set(
            form.fields.map((field) => {
              return field.name;
            }),
          );
          const entries = Object.entries(result.validationError.fields).filter(([name]) => {
            return names.has(name);
          });

          if (entries.length > 0) {
            return {
              success: false,
              code: 'VALIDATION_ERROR',
              fieldErrors: Object.fromEntries(entries),
              error: result.validationError.message,
            };
          }
        }

        return { success: false, error: result.error };
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: err.message, code: err.code };
    }
  }

  static createResult({ success, value, error, validationError }) {
    const result = { success, updatedAt: new Date().toISOString() };

    if (!success) {
      result.error = String(error).slice(0, ScriptWidgets.MAX_RESULT_LENGTH);

      if (validationError) {
        const serialized = JSON.stringify({ error: result.error, validationError });

        if (serialized.length <= ScriptWidgets.MAX_RESULT_LENGTH) {
          result.validationError = JSON.parse(serialized).validationError;
        }
      }

      return result;
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
