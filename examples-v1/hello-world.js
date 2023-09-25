/*
 * This script gets the Homey's owner,
 * and logs "Hello, <Name>!"
 */

const user = await Homey.users.getUserMe();
log(`Hello, ${user.name}!`);