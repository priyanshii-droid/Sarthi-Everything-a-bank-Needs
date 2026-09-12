const assert = require('assert');
const { buildPlan, classifyIntent } = require('../intelligence/planner');
const { makeEvidence } = require('../intelligence/evidence');
const { verifyInvestigation } = require('../intelligence/verifier');

assert.equal(classifyIntent('Why am I spending too much?'), 'financial_investigation');
assert.deepEqual(buildPlan('Why am I spending too much?').steps, ['get_financial_summary','audit_transactions','compare_months','investigate_finances']);
assert.equal(buildPlan('Can I afford a laptop?').intent, 'affordability');

const evidence=[makeEvidence('get_financial_summary',{income:10000,expenses:7000,surplus:3000})];
const verified=verifyInvestigation(evidence);
assert.equal(verified.passed,true);

const bad=[makeEvidence('get_financial_summary',{income:10000,expenses:7000,surplus:2000})];
assert.equal(verifyInvestigation(bad).passed,false);
console.log('orchestrator.test.js: PASS');
