'use strict';

const { Base } = require('../../Base');

class RunCodeWithArgAction extends Base {
  /**
   * @param {Object} options
   * @param {import('@types/homey/lib/Homey')} options.homey
   */
  constructor({ homey }) {
    super({ homey });

    this.homey.flow
      .getActionCard('runCodeWithArg')
      .registerRunListener(async ({ code, argument }, state) => {
        await this.homey.app.runScript({
          id: '__temporary__',
          name: 'Test',
          code,
          args: [argument],
          realtime: state.realtime != null ? state.realtime : false,
          version: 1,
        });
      });

    this.homey.flow
      .getActionCard('runCodeWithArg_v2')
      .registerRunListener(async ({ code, argument }, state) => {
        await this.homey.app.runScript({
          id: '__temporary__',
          name: 'Test',
          code,
          args: [argument],
          realtime: state.realtime != null ? state.realtime : false,
          version: 2,
        });
      });
  }
}

module.exports = { RunCodeWithArgAction };
