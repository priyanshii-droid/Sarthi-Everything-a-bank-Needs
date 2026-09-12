const assert = require('assert');
const { simulateScenarios, parseScenarioText } = require('../core/decision-engine');
const { analyze } = require('../core/financial-engine');

const rows = [
  {id:'1',date:'2026-01-01',merchant:'Salary',category:'Income',amount:10000,direction:'income'},
  {id:'2',date:'2026-01-02',merchant:'Food',category:'Food',amount:-2000,direction:'expense'},
  {id:'3',date:'2026-01-03',merchant:'Rent',category:'Housing',amount:-3000,direction:'expense'}
];

let r = simulateScenarios(rows, analyze, [{type:'income_change',percent:-10,category:null}]);
assert.equal(r.baseline.surplus,5000);
assert.equal(r.final.income,9000);
assert.equal(r.final.surplus,4000);
assert.equal(r.delta.surplus,-1000);

r = simulateScenarios(rows, analyze, [
  {type:'category_reduction',category:'Food',percent:20},
  {type:'expense_change',percent:10,category:null}
]);
assert.equal(r.scenarioCount,2);
assert.equal(r.final.surplus,4940);

assert.deepEqual(parseScenarioText('What if my salary falls 10%?'), {type:'income_change',percent:-10,category:null});
assert.deepEqual(parseScenarioText('Cut Shopping by 20%'), {type:'category_reduction',percent:20,category:'Shopping'});
console.log('decision-engine.test.js: PASS');
