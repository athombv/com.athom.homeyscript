/*
 * In this script we print all sensor values.
 */

// Get all devices
const devices = await Homey.devices.getDevices();

// Loop over all devices
for (const device of Object.values(devices)) {

  // If this device isn't available, skip it.
  if (!device.capabilitiesObj) continue;

  // If this device is a sensor (class)
  if (device.class === 'sensor') {
    log(`\n=== ${device.name} ===`);

    for (const capability of Object.values(device.capabilitiesObj)) {
      log(`${capability.title}: ${capability.value}`);
    }
  }
}