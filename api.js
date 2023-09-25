'use strict';

module.exports = {
  async getScripts({ homey, query }) {
    const scripts = await homey.app.getScripts();
    const response = {};

    for (const script of Object.values(scripts)) {
      response[script.id] = {
        ...script,
        code: undefined,
      };
    }

    return response;
  },

  async getScript({ homey, params }) {
    const { id } = params;
    return homey.app.getScript({ id });
  },

  async runScript({ homey, params, body = {} }) {
    const { id } = params;
    const { code, args } = body;

    try {
      const script = await homey.app.getScript({ id });

      const result = await homey.app.runScript({
        id: script.id,
        name: script.name,
        code: code || script.code,
        lastExecuted: script.lastExecuted,
        version: 2,
        args,
      }).finally(() => {
        homey.app.updateScript({ id: script.id, lastExecuted: new Date() }).catch(() => {});
      });

      return {
        success: true,
        returns: result,
      };
    } catch (err) {
      return {
        success: false,
        returns: {
          message: err.message,
          stack: err.stack,
        },
      };
    }
  },

  async createScript({ homey, params, body = {} }) {
    const { name, code } = body;

    return homey.app.createScript({ name, code });
  },

  async updateScript({
    homey, params, query, body = {},
  }) {
    const { id } = params;
    const { name, code } = body;

    return homey.app.updateScript({ id, name, code });
  },

  async deleteScript({ homey, params }) {
    const { id } = params;
    return homey.app.deleteScript({ id });
  },

};
