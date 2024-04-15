'use strict';

const { Base } = require('../../Base');

class RunCodeWithArgReturnsBooleanAction extends Base {
  /**
   * @param {Object} options
   * @param {import('@types/homey/lib/Homey')} options.homey
   */
  constructor({ homey }) {
    super({ homey });

    this.homey.flow
      .getActionCard('runCodeWithArgReturnsBoolean')
      .registerRunListener(async ({ code, argument }, state) => {
        const result = await this.homey.app.runScript({
          id: '__temporary__',
          name: 'Test',
          code,
          args: [argument],
          realtime: state.realtime != null ? state.realtime : false,
          version: 1,
        });

        return {
          boolean: result,
        };
      });

    this.homey.flow
      .getActionCard('runCodeWithArgReturnsBoolean_v2')
      .registerRunListener(async ({ code, argument }, state) => {
        const result = await this.homey.app.runScript({
          id: '__temporary__',
          name: 'Test',
          code,
          args: [argument],
          realtime: state.realtime != null ? state.realtime : false,
          version: 2,
        });

        return {
          boolean: result,
        };
      });
  }
}

module.exports = { RunCodeWithArgReturnsBooleanAction };
