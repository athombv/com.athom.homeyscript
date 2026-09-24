'use strict';

const { Base } = require('../../Base');

class RunCondition extends Base {
  /**
   * @param {Object} options
   * @param {import('@types/homey/lib/Homey')} options.homey
   */
  constructor({ homey }) {
    super({ homey });

    this.homey.flow
      .getConditionCard('run')
      .registerRunListener(async ({ script }) => {
        const scriptSource = await this.homey.app.getScript({ id: script.id });

        return await this.homey.app.runScript({
          id: scriptSource.id,
          name: scriptSource.name,
          code: scriptSource.code,
          lastExecuted: scriptSource.lastExecuted,
          version: scriptSource.version,
          realtime: false,
        });
      })
      .registerArgumentAutocompleteListener('script', async (query) => {
        return await this.homey.app.onFlowGetScriptAutocomplete(query);
      });
  }
}

module.exports = { RunCondition };
