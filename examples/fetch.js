/*
 * This script demonstrates how to get some
 * information from the internet using fetch().
 * 
 * In this example, we get the HomeyScript app from the Homey App Store API,
 * and show the app's rating using emoji.
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

log(`Rating: ${stars}`);