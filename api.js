'use strict';

module.exports = {
  async getScripts({ homey, ...args }) {
    const scripts = await homey.app.getScripts({ ...args });
    return Object.keys(scripts);
  },

  async getScript({ homey, params }) {
    const { id } = params;
    return homey.app.getScript({ id });
  },

  async runScript({ homey, params, body = [] }) {
    const { id } = params;
    const {
      code,
      args
    } = body;

    try {
      return {
        success: true,
        returns: await homey.app.runScript({
          id,
          code,
          args,
        }),
      };
    } catch (err) {
      return {
        success: false,
        returns: {
          message: err.message,
          stack: err.stack,
        },
      }
    }
  },

  async updateScript({ homey, params, body }) {
    const { id } = params;
    const { code } = body;
    return homey.app.updateScript({ id, code });
  },

  async deleteScript({ homey, params }) {
    const { id } = params;
    return homey.app.deleteScript({ id });
  },

}