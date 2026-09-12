'use strict';

module.exports = {
  async getResult({ homey, query }) {
    return await homey.app.scriptWidgets.getResult(query.scriptId);
  },
};
