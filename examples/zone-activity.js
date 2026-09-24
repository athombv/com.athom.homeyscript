// Read zone activity. Run periodically from a Flow to refresh the underlying state.
const zones = Object.values(await Homey.zones.getZones());

zones.sort((a, b) => {
  const orderA = a.sortIndex ?? Number.MAX_SAFE_INTEGER;
  const orderB = b.sortIndex ?? Number.MAX_SAFE_INTEGER;

  return orderA - orderB || a.name.localeCompare(b.name);
});

const rows = [];
const visited = new Set();

function appendZone(zone) {
  if (visited.has(zone.id)) {
    return;
  }

  visited.add(zone.id);
  let activity = '❔';
  let lastActive = null;

  if (zone.active === true) {
    activity = '🟢';
  } else if (zone.active === false) {
    activity = '⚪';
    if (zone.activeLastUpdated != null) {
      const timestamp = new Date(zone.activeLastUpdated);
      if (Number.isFinite(timestamp.getTime())) {
        activity = '💤';
        lastActive = timestamp.toISOString();
      }
    }
  }

  rows.push({ zone: `${activity} ${zone.name}`, lastActive });

  for (const child of zones) {
    if (child.parent === zone.id) {
      appendZone(child);
    }
  }
}

for (const zone of zones) {
  if (zone.parent == null) {
    appendZone(zone);
  }
}

// Include zones whose parent disappeared from the fetched snapshot.
for (const zone of zones) {
  appendZone(zone);
}

return new WidgetResult({
  blocks: [
    {
      type: 'table',
      showHeaders: false,
      columns: [
        { key: 'zone', label: 'Zone' },
        { key: 'lastActive', label: 'Last active', format: 'relativeTime' },
      ],
      rows,
    },
  ],
});
