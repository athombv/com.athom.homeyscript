# HomeyScript

> "The best thing since sliced bread!"

Unleash the scripting power with HomeyScript. Automate everything you every dreamed of, even when Flows are not enough for you!

HomeyScript is a JavaScript-based scripting language that interacts with the Homey Web API and various Homey Apps SDK functions.

## Usage

1. Install HomeyScript from [https://homey.app/a/com.athom.homeyscript](https://homey.app/a/com.athom.homeyscript)
2. Visit [https://my.homey.app/scripts](https://my.homey.app/scripts)
3. Script as you please!

## Example

```javascript
// Get all devices
const devices = await Homey.devices.getDevices();

// Loop over all devices
for (const device of Object.values(devices)) {

  // If this device is a light (class)
  // Or this is a 'What's plugged in?'-light (virtualClass)
  if (device.class === 'light' || device.virtualClass === 'light') {
    log(`\nTurning '${device.name}' on...`);

    // Turn the light on by setting the capability `onoff` to `true`
    await device.setCapabilityValue('onoff', true)
      .then(() => log('OK'))
      .catch(error => log(`Error:`, error));
  }
}
```

For more examples, see `/examples` in the source code.

## Documentation

In your HomeyScript, the following properties are directly accessible.

### Global Properties

The following properties are accessible anywhere.

#### `log(Mixed obj1 [, Mixed obj, ..., Mixed objN])` -> `undefined`

Log a value to the console.

#### `say(String text)` -> `Promise`

Make Homey say something.

```javascript
await say('Hello world!');
```

#### `tag(String id, String|Number|Boolean value)` -> `Promise`

Creates or updates a Flow Token. These are persistent across reboots.

Delete a Flow Token by providing `null` as value.

Resolves after `milliseconds` milliseconds.

```javascript
await tag('My Tag', 1337); // Create
await tag('My Tag', 1338); // Update
await tag('My Tag', null); // Delete
```

#### `wait(Number milliseconds)` -> `Promise`

Resolves after `milliseconds` milliseconds.

```javascript
log('Foo');
await wait(1000);
log('Bar');
```

#### `Homey` -> `HomeyAPI`

This is a [HomeyAPI](https://api.developer.athom.com/HomeyAPI.html) instance with permissions on behalf of the app (`homey:manager:api`).

```javascript
const devices = await Homey.devices.getDevices();
```

#### `fetch`

Shortcut to [node-fetch](https://github.com/node-fetch/node-fetch).

#### `_`

Shortcut to [lodash](https://github.com/lodash/lodash).

#### `global.get(String key)` -> `Mixed`

Get a global value that's accessible between HomeyScripts.

#### `global.set(String key, Mixed value)` -> `undefined`

Set a global value that's accessible between HomeyScripts.

#### `global.keys()` -> `Array`

Gets all keys of global values.


#### `args` -> `Array`

The `args` array contains arguments as provided by a Flow or the Web API.

### Disclaimer

This app has been created during one of Athom's Hacky Fridays.

This means that we cannot give official support on it, but we welcome high quality issue reports.
