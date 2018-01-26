'use strict';

const {FlowToken} = require('homey');

class FlowTokenManager {
  constructor() {
    this._tokens = {};
  }

  async setTokenValue(id, opts, value) {
    if (typeof value === "undefined" && !this._tokens[id]) {
      return;
    } else if (typeof value === "undefined") {
      await this._tokens[id].unregister();
      delete this._tokens[id];
      return;
    } else if (!this._tokens[id]) {
      this._tokens[id] = new FlowToken(id, opts);
      await this._tokens[id].register();
    }

    await this._tokens[id].setValue(value);
  }
}

module.exports = new FlowTokenManager();
