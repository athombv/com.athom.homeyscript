// Toggle all light devices
let devices = await Homey.devices.getDevices();

Object.values(devices).forEach(device => {
    if(device.class != 'light') return;
    console.log(device.name);
    device.setCapabilityValue('onoff', !device.state.onoff);
});

return true;