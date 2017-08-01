let user = await Homey.users.getUserMe();
console.log(`Hi, ${user.name}!`);