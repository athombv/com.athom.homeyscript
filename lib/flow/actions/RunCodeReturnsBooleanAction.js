'use strict';

const { Base } = require('../../Base');

class RunCodeReturnsBooleanAction extends Base {
  /**
   * @param {Object} options
   * @param {import('@types/homey/lib/Homey')} options.homey
   */
  constructor({ homey }) {
    super({ homey });

    this.homey.flow
      .getActionCard('runCodeReturnsBoolean')
      .registerRunListener(async ({ code }, state) => {
        const result = await this.homey.app.runScript({
          id: '__temporary__',
          name: 'Test',
          code,
          args: [],
          realtime: state.realtime != null ? state.realtime : false,
          version: 1,
        });

        return {
          boolean: result,
        };
      });

    this.homey.flow
      .getActionCard('runCodeReturnsBoolean_v2')
      .registerRunListener(async ({ code }, state) => {
        const result = await this.homey.app.runScript({
          id: '__temporary__',
          name: 'Test',
          code,
          args: [],
          realtime: state.realtime != null ? state.realtime : false,
          version: 2,
        });

        return {
          boolean: result,
        };
      });
  }
}

module.exports = { RunCodeReturnsBooleanAction };
