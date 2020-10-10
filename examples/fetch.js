/*
 * This script demonstrates how to get some
 * information from the internet using fetch().
 * 
 * In this example, we list the status of Athom's Cloud services.
 */

// Create the request
const res = await fetch('https://status.athom.com/api/service');
if (!res.ok) {
  throw new Error(res.statusText);
}

// Get the body JSON
const body = await res.json();

// Sort the services
body.message.sort((a, b) => {
  return a.order - b.order;
});

// Log the services
body.message.forEach(service => {
  log(`${service.name}: ${service.status}`);
});