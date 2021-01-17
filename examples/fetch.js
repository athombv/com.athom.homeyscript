/*
 * This script demonstrates how to get some
 * information from the internet using fetch().
 * 
 * In this example, we list the status of Athom's Cloud services.
 */

// Create the request
const res = await fetch('https://apps-api.athom.com/api/v1/app/com.athom.homeyscript');
if (!res.ok) {
  throw new Error(res.statusText);
}

// Get the body JSON
const body = await res.json();

log(`${body.liveBuild.name.en} (${body.id}) v${body.liveVersion}`);

// Print rating
const stars = Array(Math.round(body.rating))
  .fill('⭐️')
  .join('');

console.log(`Rating: ${stars}`);