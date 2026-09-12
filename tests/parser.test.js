'use strict';
const assert=require('assert');
const {normalizeRows,parseNumber}=require('../core/financial-engine');
const {parsePlainText}=require('../core/parser');

const parsed=normalizeRows([
  {Date:'2026-09-01',Description:'Salary',Amount:'₹50,000'},
  {Date:'2026-09-02',Merchant:'Rent',Debit:'15,000'},
  {Date:'2026-09-03',Merchant:'Refund',Credit:'2,000'}
],{sourceId:'test'});
assert.strictEqual(parsed.ledger.length,3);
assert.strictEqual(parsed.ledger[0].amount,50000);
assert.strictEqual(parsed.ledger[1].amount,-15000);
assert.strictEqual(parsed.ledger[2].amount,2000);
assert.strictEqual(parsed.ledger[1].direction,'expense');
assert.strictEqual(parsed.ledger[2].direction,'income');
assert.strictEqual(parsed.reconciliation.balanced,true);
assert.strictEqual(parsed.ledger[0].sourceRow,1);
const pasted=parsePlainText('2026-09-01,Salary,50000\n2026-09-02,Rent,-15000','paste');
assert.strictEqual(pasted.ledger.length,2);
assert.strictEqual(pasted.ledger[1].amount,-15000);
assert.strictEqual(parseNumber('(1,500)'),-1500);
console.log('parser.test.js: PASS');
