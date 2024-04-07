'use strict';

const { Base } = require('../../Base');

class RunCodeAction extends Base {
  /**
   * @param {Object} options
   * @param {import('@types/homey/lib/Homey')} options.homey
   */
  constructor({ homey }) {
    super({ homey });

    this.homey.flow.getActionCard('runCode').registerRunListener(async ({ code }, state) => {
      await this.homey.app.runScript({
        id: '__temporary__',
        name: 'Test',
        code,
        args: [],
        realtime: state.realtime != null ? state.realtime : false,
        version: 1,
      });
    });

    this.homey.flow.getActionCard('runCode_v2').registerRunListener(async ({ code }, state) => {
      await this.homey.app.runScript({
        id: '__temporary__',
        name: 'Test',
        code,
        args: [],
        realtime: state.realtime != null ? state.realtime : false,
        version: 2,
      });
    });
  }
}

module.exports = { RunCodeAction };
