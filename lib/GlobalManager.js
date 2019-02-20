const {ManagerSettings} = require('homey');
const _ = require('lodash');

const globalPrefix = 'homeyscript-';

class GlobalManager {
    get(id) {
        return ManagerSettings.get(globalPrefix + id);
    }

    set(id, value) {
        ManagerSettings.set(globalPrefix + id, value);
    }

    keys() {
        return _.filter(ManagerSettings.getKeys(), key => key.startsWith(globalPrefix))
            .map(key => key.substr(globalPrefix.length));
    }
}

module.exports = GlobalManager;