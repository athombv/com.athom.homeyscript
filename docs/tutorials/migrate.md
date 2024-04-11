To create a unified API for all our products we decided to introduce [homey-api](https://www.npmjs.com/package/homey-api) as the successor to [athom-api](https://www.npmjs.com/package/athom-api). New HomeyScript's will automatically use the new API under the same global variable [`Homey`](./global#.Homey).

**Editor Scripts** - [https://my.homey.app/scripts/](https://my.homey.app/scripts/)

All scripts that use the deprecated API will still work but will have an yellow indicator that tells you that it is using the deprecated API version.

To use the new API you have to create a new script and copy over the previous code and change it according to the steps below.

**Advanced FlowCards**

All Advanced FlowCards that used the inline code editor have been deprecated. To use the new API the same Advanced FlowCard must be added again and the current code can be copied over and changed according the the steps below.

To convert scripts to the new API, you can use the following steps:

## Step 1 - Devices

For a device the `driverUri` and `zoneName` properties have been removed. The `driverUri` is now part of the `driverId` and the `zoneName` has to be fetched based on the `zone` property of the device.

```javascript
let deviceZone = await device.getZone();

// Or
deviceZone = await Homey.zones.getZone({ id: device.zone });

// Or
const zones = await Homey.zones.getZones();

deviceZone = zones[device.zone];
const zoneName = deviceZone ? deviceZone.name : 'Missing Zone';
```

## Step 2 - FlowCards

The calls to `Homey.flow.getFlowCardTriggers`, `Homey.flow.getFlowCardConditions` and `Homey.flow.getFlowCardActions` now all return an object with key value pairs instead of an array.

```javascript
// The following code changes from:
const conditionCards = await Homey.flow.getFlowCardConditions();
for (const card of conditionCards) {
  // ...
}

// To:
const conditionCards = await Homey.flow.getFlowCardConditions();
for (const card of Object.values(conditionCards)) {
  // ...
}
```

The cards can be referenced by the `card.id` property. This is also the key of the card in the collection.

```javascript
const conditionCards = await Homey.flow.getFlowCardConditions();
for (const card of Object.values(conditionCards)) {
  console.log(conditionCards[card.id] === card);
}
```

The property `uriObj` has been removed. Before this would contain some properties of the owner of the card. For example if the card belonged to a device it would contain the device name and the icon.

Now you must fetch the device to which the card belongs. Since the id of a card will always be of the format ``homey:<ownerType>:<ownerId>:<cardId>``. It's easy to get the device from the `Homey.devices.getDevices` call and find the `ownerId` or pass the `ownerId` to the `devices.getDevice` call.

```javascript
const [, ownerType, ownerId, cardId] = card.id.split(':');

if (ownerType === 'device') {
  const devices = await Homey.devices.getDevices();
  console.log(devices[ownerId]);

  // Or
  const device = await Homey.devices.getDevice({ id: ownerId });
}
```

Calls to `Homey.flow.runFlowCardCondition` and `Homey.flow.runFlowCardAction` no longer require the card `uri` as a parameter.

```javascript
// The following code changes from:
await Homey.flow.runFlowCardAction({ uri: card.uri, id: card.id, args: { ... } });

// To:
await Homey.flow.runFlowCardAction({ id: card.id, args: { ... } });
```

## Step 3 - Insights
The `uriObj` property has been deleted from a Log as returned by [`Homey.insights.getLogs()`](https://athombv.github.io/node-homey-api/HomeyAPIV3Local.ManagerInsights.html#getLogs) the owner must be matched the same way as with FlowCards.

## Step 4 - FlowToken
The `uriObj` property has been deleted from a FlowToken as returned by [`Homey.flowtoken.getFlowTokens()`](https://athombv.github.io/node-homey-api/HomeyAPIV3Local.ManagerFlowToken.html#getFlowTokens) the owner must be matched the same way as with FlowCards.

## Step 5 - Drivers
The `uriObj` property has been deleted from a Driver as returned by [`Homey.drivers.getDrivers()`](https://athombv.github.io/node-homey-api/HomeyAPIV3Local.ManagerDrivers.html#getDrivers). The icon can now be found under `driver.ownerIconObj` and the color under `driver.color`.
