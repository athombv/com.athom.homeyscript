/*
 * This script will let Homey say something.
 * If a string-type argument is set, it will say the argument.
 * Otherwise, it'll say "Hello from HomeyScript!"
 */

const text = (typeof args[0] === 'string')
  ? args[0]
  : 'Hello from HomeyScript!';

log('Say:', text);
await say(text);