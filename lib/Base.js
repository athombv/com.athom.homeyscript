'use strict';

class Base {
  /**
   * @param {Object} options
   * @param {import('@types/homey/lib/Homey')} options.homey
   */
  constructor({ homey }) {
    this.homey = homey;

    this.log = (...args) => {
      homey.emit('__log', `[${this.constructor.name}]`, ...args);
    };

    this.error = (...args) => {
      homey.emit('__error', `[${this.constructor.name}]`, ...args);
    };
  }
}

module.exports = { Base };
