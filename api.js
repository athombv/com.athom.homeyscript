'use strict';

module.exports = {
  async getScripts({ homey, query }) {
    const scripts = await homey.app.getScripts();


    const response = {};

    for (const script of Object.values(scripts)) {
      response[script.id] = {
        ...script,
        code: undefined
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
    const {
      code,
      args
    } = body;

    try {
      const script = await homey.app.getScript({ id });

      return {
        success: true,
        returns: await homey.app.runScript({
          script,
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

  async createScript({ homey, params, body }) {
    return homey.app.createScript({ script: body });
  },

  async updateScript({ homey, params, query, body }) {
    const { id } = params;
    return homey.app.updateScript({ id, script: body });
  },

  async deleteScript({ homey, params }) {
    const { id } = params;
    return homey.app.deleteScript({ id });
  },

}
