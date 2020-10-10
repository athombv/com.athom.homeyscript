/*
 * This script gets the Homey's owner,
 * and logs "Hello, <Name>!"
 */

const user = await Homey.users.getUserMe();
console.log(`Hello, ${user.name}!`);