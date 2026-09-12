'use strict';
const assert = require('assert');
const { normalizeRows, parseText } = require('../core/parser');

const rows = normalizeRows([
  { Date:'2026-09-01', Description:'Salary', Amount:'₹50,000' },
  { Date:'2026-09-02', Merchant:'Rent', Debit:'15,000' },
  { Date:'2026-09-03', Merchant:'Refund', Credit:'2,000' }
]);
assert.strictEqual(rows.length, 3);
assert.strictEqual(rows[0].amount, 50000);
assert.strictEqual(rows[1].amount, -15000);
assert.strictEqual(rows[2].amount, 2000);

const pasted = parseText('2026-09-01,Salary,50000\n2026-09-02,Rent,-15000');
assert.strictEqual(pasted.length, 2);
assert.strictEqual(pasted[1].amount, -15000);
console.log('parser.test.js: PASS');
