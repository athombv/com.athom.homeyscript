'use strict';

module.exports = {
  async runScript({ homey, body }) {
    return await homey.app.scriptWidgets.run(body.scriptId, body.argument);
  },
};
