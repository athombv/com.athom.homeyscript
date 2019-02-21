// Toggle all light devices
let devices = await Homey.devices.getDevices();

_.forEach(devices, device => {
    if(device.class != 'light') return;
    console.log(device.name);
    device.setCapabilityValue('onoff', !device.capabilitiesObj.onoff.value);
});

return true;
