'use strict';

const { Base } = require('../../Base');

class RunCodeReturnsStringAction extends Base {
  /**
   * @param {Object} options
   * @param {import('@types/homey/lib/Homey')} options.homey
   */
  constructor({ homey }) {
    super({ homey });

    this.homey.flow
      .getActionCard('runCodeReturnsString')
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
          string: result,
        };
      });

    this.homey.flow
      .getActionCard('runCodeReturnsString_v2')
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
          string: result,
        };
      });
  }
}

module.exports = { RunCodeReturnsStringAction };
