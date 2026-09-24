// Save this script as "save-away-settings". It stores preferences; it does not control devices.
if (widgetEvent?.type !== 'submit' || widgetEvent.formId !== 'away-settings') {
  throw new Error('Submit the away-settings form to run this script.');
}
const { note, enabled, until } = widgetEvent.values;

// Calendar dates compare directly without converting the submitted date's timezone.
if (until !== null && until < new Date().toISOString().slice(0, 10)) {
  throw new WidgetValidationError({
    fields: { until: 'Choose today or a later date (UTC).' },
  });
}

global.set('away-settings', { note, enabled, until });
