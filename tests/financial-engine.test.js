'use strict';
const assert = require('assert');
const { analyze, auditTransactions } = require('../core/financial-engine');

const tx = [
  { date:'2026-09-01', merchant:'Salary', category:'Income', amount:50000 },
  { date:'2026-09-02', merchant:'Rent', category:'Housing', amount:-15000 },
  { date:'2026-09-03', merchant:'Food', category:'Food', amount:-5000 },
  { date:'2026-09-04', merchant:'Shopping', category:'Shopping', amount:-3000 },
  { date:'2026-09-04', merchant:'Shopping', category:'Shopping', amount:-3000 }
];

const a = analyze(tx, '');
assert.strictEqual(a.totalIncome, 50000);
assert.strictEqual(a.totalExpenses, 26000);
assert.strictEqual(a.netSavings, 24000);
assert.strictEqual(a.transactionCount, 5);
assert.strictEqual(a.categories[0].category, 'Housing');
assert.strictEqual(a.audit.duplicates, 1);
assert.ok(a.savingsRate > 47 && a.savingsRate < 49);

const audit = auditTransactions(tx);
assert.strictEqual(audit.duplicates, 1);
console.log('financial-engine.test.js: PASS');
