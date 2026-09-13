'use strict';

module.exports = {
  async runAction({ homey, body }) {
    return await homey.app.scriptWidgets.runAction(body);
  },
  async getResult({ homey, query }) {
    return await homey.app.scriptWidgets.getResult(query.scriptId);
  },
};
