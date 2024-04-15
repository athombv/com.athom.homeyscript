/*
 * This script demonstrates how to run an 'And' Flow Card,
 * and how to run an 'Then' Flow Card.
 */

// Run 'Day Equals' Flow 'And' Card
const { result: isWeekend } = await Homey.flow.runFlowCardCondition({
  id: 'homey:manager:cron:day_equals',
  args: {
    day: 'weekend',
  },
});

log('Is Weekend:', isWeekend);

// Run 'Show Animation' Flow 'Then' Card
// This will pulse Green (#00FF00) when it's a weekend
// or pulse Red (#FF0000) when it's a weekday
await Homey.flow.runFlowCardAction({
  id: 'homey:manager:ledring:animate_pulse',
  args: {
    animation: 'pulse',
    color: isWeekend
      ? '#00FF00'
      : '#FF0000',
  },
});