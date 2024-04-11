To create a unified API for all our products we decided to introduce [homey-api](https://www.npmjs.com/package/homey-api) as the successor to [athom-api](https://www.npmjs.com/package/athom-api). New HomeyScript's will automatically use the new API under the same global variable [`Homey`](./global#.Homey).

To convert your existing scripts to the new API, you can use the following steps:

## Flow cards

The calls to `flow.getFlowCardTriggers`, `flow.getFlowCardConditions` and `flow.getFlowCardActions` now all return an object with key value pairs instead of an array.

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
  console.log(conditionCards[card.id] === card));
}
```

The property `uriObj` has been removed. Before this would contain some properties of the owner of the card. For example if the card belonged to a device it would contain the device name and the icon.

Now you must fetch the device to which the card belongs. Since the id of a card will always be of the format ``homey:<ownerType>:<ownerId>:<cardId>``. It easy to get the device from the `devices.getDevices` call and find the `ownerId`.

```javascript
const [, ownerType, ownerId, cardId] = card.id.split(':');

if (ownerType === 'device') {
  const devices = await Homey.devices.getDevices();
  console.log(devices[ownerId]);
}
```
