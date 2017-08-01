'use strict';

const Sandbox = require('../lib/ScriptSandbox.js');
global.appspace = true;
const script = {
    code: `return homeyAPI.devices.getDevices();
        console.log("test");
    `,
    filename: 'test.js'
}

new Sandbox(script).run().then(console.log);
