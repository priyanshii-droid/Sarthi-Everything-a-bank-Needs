'use strict';
const assert=require('assert');
const {normalizeRows,analyze,auditTransactions}=require('../core/financial-engine');
const parsed=normalizeRows([
 {date:'2026-08-01',merchant:'Salary',category:'Income',amount:50000},
 {date:'2026-08-02',merchant:'Rent',category:'Housing',amount:-15000},
 {date:'2026-08-03',merchant:'Food',category:'Food',amount:-5000},
 {date:'2026-09-01',merchant:'Salary',category:'Income',amount:50000},
 {date:'2026-09-02',merchant:'Rent',category:'Housing',amount:-15000},
 {date:'2026-09-03',merchant:'Food',category:'Food',amount:-5000},
 {date:'2026-09-04',merchant:'Shopping',category:'Shopping',amount:-3000},
 {date:'2026-09-04',merchant:'Shopping',category:'Shopping',amount:-3000}
],{sourceId:'test'});
assert.strictEqual(parsed.ledger.length,8);
const a=analyze(parsed.ledger,'');
assert.strictEqual(a.totalIncome,100000); assert.strictEqual(a.totalExpenses,46000); assert.strictEqual(a.netSavings,54000); assert.strictEqual(a.transactionCount,8); assert.strictEqual(a.categories[0].category,'Housing'); assert.strictEqual(a.audit.duplicates,1); assert.ok(a.monthly[0].categories.length>0); assert.ok(a.savingsRate>53&&a.savingsRate<55);
assert.strictEqual(auditTransactions(parsed.ledger).duplicates,1);
console.log('financial-engine.test.js: PASS');
