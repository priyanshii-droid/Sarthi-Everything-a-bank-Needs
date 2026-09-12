'use strict';
const assert=require('assert');
const {classifySource}=require('../research/source-policy');
const {extractSources}=require('../research/research-agent');
const {parseDocument,documentProvenance}=require('../documents/document-parser');
const {extractFinancialFacts}=require('../documents/extraction');

assert.strictEqual(classifySource('https://www.rbi.org.in/test'),'official');
assert.strictEqual(classifySource('https://example.com/test'),'public');
const sources=extractSources([{url:'https://www.rbi.org.in/a',title:'RBI'} ,{url:'https://www.rbi.org.in/a'}]);
assert.strictEqual(sources.length,1);
const nested=extractSources([{
  type:'message',
  content:[{type:'output_text',annotations:[{type:'url_citation',url:'https://example.com/current',title:'Current source'}]}]
}]);
assert.strictEqual(nested.length,1);
assert.strictEqual(nested[0].url,'https://example.com/current');

const parsed=parseDocument(Buffer.from(JSON.stringify([{date:'2026-09-01',description:'Salary',amount:50000},{date:'2026-09-02',description:'Swiggy',amount:-500}])),'statement.json');
assert.strictEqual(parsed.ledger.length,2);
const prov=documentProvenance(parsed,'statement.json');
assert.strictEqual(prov.rowCount,2);
const facts=extractFinancialFacts(parsed);
assert.strictEqual(facts[0].provenance.sourceRow,1);
assert.ok(facts[1].confidence>0);
console.log('research/document tests passed');
