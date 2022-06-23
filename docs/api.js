/**
 * All properties & methods in this namespace are accessible in a HomeyScript.
 *
 * @namespace global
 * @example
 * // Get all devices
 * const devices = await Homey.devices.getDevices();
 *
 * // Loop over all devices
 * for (const device of Object.values(devices)) {
 *
 *   // If this device is a light (class)
 *   // Or this is a 'What's plugged in?'-light (virtualClass)
 *   if (device.class === 'light' || device.virtualClass === 'light') {
 *     log(`\nTurning '${device.name}' on...`);
 *
 *     // Turn the light on by setting the capability `onoff` to `true`
 *     await device.setCapabilityValue('onoff', true)
 *       .then(() => log('OK'))
 *       .catch(error => log(`Error:`, error));
 *   }
 * }
 */

/**
 * Log to the console.
 * @memberof global
 * @async
 * @function log
 * @param {...Mixed} arg1
 * @example
 * log('Hello World!');
 */

/**
 * Says something over the internal speaker.
 * @memberof global
 * @async
 * @function say
 * @param {String} text
 * @example
 * await say('Hello world!');
 */

/**
 * Creates or updates a Flow Tag. These are persistent across reboots.
 *
 * Delete a Flow Tag by providing `null` as value.
 * @memberof global
 * @async
 * @function tag
 * @param {String} id ID of the Tag
 * @param {String|Number|Boolean|null} value Value of the Tag
 * @example
 * await tag('My Tag', 1337); // Create
 * await tag('My Tag', 1338); // Update
 * await tag('My Tag', null); // Delete
 */

/**
 * Resolves after `milliseconds` milliseconds.
 *
 * @memberof global
 * @async
 * @function wait
 * @param {Number} milliseconds
 * @example
 * log('Foo');
 * await wait(1000);
 * log('Bar');
 */

/**
 * A [HomeyAPI](https://athombv.github.io/node-homey-api/HomeyAPIV2.html) instance.
 *
 * @memberof global
 * @member {HomeyAPI} Homey
 * @example
 * const devices = await Homey.devices.getDevices();
 */

/**
 * Shortcut to [node-fetch](https://www.npmjs.com/package/node-fetch/v/2.6.7).
 *
 * @memberof global
 * @async
 * @function fetch
 * @param {String} url
 * @param {Object} options
 */

/**
 * Shortcut to [lodash](https://www.npmjs.com/package/lodash).
 *
 * @memberof global
 * @member {Object} _
 */

/**
 * Provided arguments to this script.
 *
 * @memberof global
 * @member {Array} args
 * @example
 * log(args[0]); // "myArgument"
 */

/**
 * Shortcut to [Buffer](https://nodejs.org/api/buffer.html).
 *
 * @memberof global
 * @member {Object} Buffer
 */

/**
 * Shortcut to [URLSearchParams](https://nodejs.org/api/url.html#class-urlsearchparams).
 *
 * @memberof global
 * @member {Class} URLSearchParams
 */

/**
 * Shortcut to [http](https://nodejs.org/api/http.html).
 *
 * @memberof global
 * @member {Object} http
 */

/**
 * Shortcut to [https](https://nodejs.org/api/https.html).
 *
 * @memberof global
 * @member {Object} https
 */

/**
 * The filename of the HomeyScript.
 *
 * @memberof global
 * @member {String} __filename__
 */

/**
 * The Script ID of the HomeyScript.
 *
 * @memberof global
 * @member {String} __script_id__
 */

/**
 * When the HomeyScript has last executed.
 *
 * @memberof global
 * @member {Date} __last_executed__
 */

/**
 * Milliseconds since the HomeyScript has last executed.
 *
 * @memberof global
 * @member {Number} __ms_since_last_executed__
 */

/**
 * Get a global value that's accessible between HomeyScripts.
 *
 * @memberof global
 * @function global.get
 * @param {String} key Key of the property
 */

/**
 * Set a global value that's accessible between HomeyScripts.
 *
 * @memberof global
 * @function global.set
 * @param {String} key Key of the property
 * @param {Mixed} value Value of the property
 */

/**
 * Gets all keys of global values.
 *
 * @memberof global
 * @function global.keys
 * @returns {Array}
 */
