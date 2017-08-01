// Returns true if there is at least one light turned on
let devices = await Homey.devices.getDevices();

return Object.values(devices).some(device => {
    if(device.class != 'light') return false;
    if(!device.state.onoff) return false;
    console.log(device.name);
    return true;
});