const assert = require('assert');
const { buildPlan, classifyIntent } = require('../intelligence/planner');
const { makeEvidence, evidenceQuality } = require('../intelligence/evidence');
const { verifyInvestigation } = require('../intelligence/verifier');

assert.equal(classifyIntent('Why am I spending too much?'), 'financial_investigation');
assert.deepEqual(buildPlan('Why am I spending too much?').steps, ['get_financial_summary','audit_transactions','compare_months','investigate_finances']);
assert.equal(buildPlan('Can I afford a laptop?').intent, 'affordability');
assert.equal(buildPlan('Why am I spending too much?').verificationRequired, true);

const evidence=[makeEvidence('get_financial_summary',{income:10000,expenses:7000,surplus:3000})];
const verified=verifyInvestigation(evidence);
assert.equal(verified.passed,true);
assert.equal(verified.decisionGate,'PASS');
assert.equal(verified.verificationScore,100);

const bad=[makeEvidence('get_financial_summary',{income:10000,expenses:7000,surplus:2000})];
assert.equal(verifyInvestigation(bad).passed,false);
assert.equal(verifyInvestigation(bad).decisionGate,'REVIEW_REQUIRED');

const audit=[makeEvidence('audit_transactions',{issues:[],coverage:'Good'})];
assert.equal(verifyInvestigation(audit).passed,true);
assert.equal(evidenceQuality([...evidence,audit]).usable,true);

const toolError=[makeEvidence('audit_transactions',{error:'boom'})];
assert.equal(verifyInvestigation(toolError).passed,false);
assert.equal(evidenceQuality(toolError).usable,false);

console.log('orchestrator.test.js: PASS');
