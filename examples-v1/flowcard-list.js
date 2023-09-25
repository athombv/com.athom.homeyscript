/*
 * This script lists all 'And' and 'Then'-cards,
 * so you know how to use them in HomeyScript
 * by calling Homey.flow.runFlowCardCondition()
 * and Homey.flow.runFlowCardAction()
 * 
 * Also see: example-flowcard-run.js
 */

log('===========');
log('And-cards:');
log('===========');
const conditionCards = await Homey.flow.getFlowCardConditions();
for( const card of conditionCards ) {
  log(card.titleFormatted || card.title)
  log(JSON.stringify({
    uri: card.uri,
    id: card.id,
    args: card.args,
    droptoken: card.droptoken,
    duration: card.duration,
  }, false, 2));
  log('-----------')
}

log('===========');
log('Then-cards:');
log('===========');
const actionCards = await Homey.flow.getFlowCardActions();
for( const card of actionCards ) {
  log(card.titleFormatted || card.title)
  log(JSON.stringify({
    uri: card.uri,
    id: card.id,
    args: card.args,
    droptoken: card.droptoken,
    duration: card.duration,
  }, false, 2));
  log('-----------')
}