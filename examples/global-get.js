/*
 * This script gets a global variable.
 */

const value = global.get('myHomeyScriptVariable');
log('Value:', value);

const keys = global.keys();
log('Variables:', keys);