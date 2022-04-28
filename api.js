'use strict';

module.exports = {
  async getScripts({ homey, query }) {
    const scripts = await homey.app.getScripts();

    if (query.version === '2') {
      const response = {};

      for (const script of Object.values(scripts)) {
        response[script.id] = {
          ...script,
          code: undefined
        }
      }

      return response;
    }

    return Object.keys(scripts);
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

  async createScript({ homey, params, body }) {
    return homey.app.createScriptV2({ script: body });
  },

  async updateScript({ homey, params, query, body }) {
    const { id } = params;

    if (query.version === '2') {
      return homey.app.updateScriptV2({ id, script: body });
    }

    const { code } = body;
    return homey.app.updateScript({ id, code });
  },

  async deleteScript({ homey, params }) {
    const { id } = params;
    return homey.app.deleteScript({ id });
  },

}
