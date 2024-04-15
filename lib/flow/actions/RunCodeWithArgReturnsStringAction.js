'use strict';

const { Base } = require('../../Base');

class RunCodeWithArgReturnsStringAction extends Base {
  /**
   * @param {Object} options
   * @param {import('@types/homey/lib/Homey')} options.homey
   */
  constructor({ homey }) {
    super({ homey });

    this.homey.flow
      .getActionCard('runCodeWithArgReturnsString')
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
          string: result,
        };
      });

    this.homey.flow
      .getActionCard('runCodeWithArgReturnsString_v2')
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
          string: result,
        };
      });
  }
}

module.exports = { RunCodeWithArgReturnsStringAction };
