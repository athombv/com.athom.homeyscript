/*
 * In this script we turn on all lights.
 */

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