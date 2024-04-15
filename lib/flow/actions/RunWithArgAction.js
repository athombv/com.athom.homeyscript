'use strict';

const { Base } = require('../../Base');

class RunWithArgAction extends Base {
  /**
   * @param {Object} options
   * @param {import('@types/homey/lib/Homey')} options.homey
   */
  constructor({ homey }) {
    super({ homey });

    this.homey.flow.getActionCard('runWithArg')
    .registerRunListener(async ({ script, argument }) => {
      const scriptSource = await this.homey.app.getScript({ id: script.id });

      return this.homey.app.runScript({
        id: scriptSource.id,
        name: scriptSource.name,
        code: scriptSource.code,
        lastExecuted: scriptSource.lastExecuted,
        version: scriptSource.version,
        args: [argument],
        realtime: false,
      }).finally(() => {
        this.homey.app.updateScript({
          id: scriptSource.id,
          lastExecuted: new Date(),
        }).catch(this.error);
      });
    })
    .registerArgumentAutocompleteListener('script', query => this.homey.app.onFlowGetScriptAutocomplete(query));
  }
}

module.exports = { RunWithArgAction };
