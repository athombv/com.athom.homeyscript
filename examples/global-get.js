/*
 * This script gets a global variable.
 */

const value = global.get('myHomeyScriptVariable');
console.log('Value:', value);

const keys = global.keys();
console.log('Variables:', keys);