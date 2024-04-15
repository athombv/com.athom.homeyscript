/*
 * This script is an example for usage in a Flow with the 
 * 'Run a script with an argument' in the 'And'-column.
 * 
 * It checks if the argument begins with an "a",
 * and returns a boolean.
 * 
 * If this is true, the Flow will continue.
 * If it's false, the Flow will stop.
 * 
 * For example:
 * "aaa" -> true
 * "baa" -> false
 */

if (typeof args[0] !== 'string') {
  throw new Error('This script must be run from a Flow!');
}

if (args[0].startsWith('a')) {
  return true;
} else {
  return false;
}