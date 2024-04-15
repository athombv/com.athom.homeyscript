/*
 * This script will create a few Tags for use in Flow.
 * It will remove them after 5 seconds.
 */

// Create Tags
log('Creating My String...');
await tag('My String', 'abcdef');

log('Creating My Number...');
await tag('My Number', 123);

log('Creating My Boolean...');
await tag('My Boolean', true);

// Wait 5s
for (let i = 0; i < 5; i++) {
  log('.');
  await wait(1000); // in milliseconds
}

// Delete Tags
log('Deleting My String...');
await tag('My String', null);

log('Deleting My Number...');
await tag('My Number', null);

log('Deleting My Boolean...');
await tag('My Boolean', null);