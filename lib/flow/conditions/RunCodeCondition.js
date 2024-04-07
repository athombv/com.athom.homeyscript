'use strict';

const { Base } = require('../../Base');

class RunCodeCondition extends Base {
  /**
   * @param {Object} options
   * @param {import('@types/homey/lib/Homey')} options.homey
   */
  constructor({ homey }) {
    super({ homey });

    this.homey.flow.getConditionCard('runCode').registerRunListener(async ({ code }, state) => {
      return Boolean(
        await this.homey.app.runScript({
          id: '__temporary__',
          name: 'Test',
          code,
          args: [],
          realtime: state.realtime != null ? state.realtime : false,
          version: 1,
        }),
      );
    });

    this.homey.flow.getConditionCard('runCode_v2').registerRunListener(async ({ code }, state) => {
      return Boolean(
        await this.homey.app.runScript({
          id: '__temporary__',
          name: 'Test',
          code,
          args: [],
          realtime: state.realtime != null ? state.realtime : false,
          version: 2,
        }),
      );
    });
  }
}

module.exports = { RunCodeCondition };
